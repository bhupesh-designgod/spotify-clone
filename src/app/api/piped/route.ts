import { NextRequest, NextResponse } from 'next/server';

/**
 * Backend-agnostic stream/search proxy.
 *
 * The client (src/lib/piped.ts) speaks the Piped JSON shape. Public Piped
 * instances have been mostly down for weeks, so this route tries Piped first
 * and falls back to Invidious instances, translating Invidious responses into
 * the Piped shape so the client doesn't need to change.
 *
 * Supported paths the client sends:
 *   /search?q=...&filter=music_songs   -> { items: PipedSearchItem[] }
 *   /streams/{videoId}                 -> PipedStreamResponse
 */

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.in.projectsegfau.lt',
  'https://api.piped.private.coffee',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.smnz.de',
  'https://pipedapi.r4fo.com',
];

const INVIDIOUS_INSTANCES = [
  'https://invidious.f5.si',
  'https://inv.in.projectsegfau.lt',
  'https://invidious.protokolla.fi',
  'https://yewtu.be',
  'https://invidious.privacyredirect.com',
  'https://invidious.fdn.fr',
  'https://inv.nadeko.net',
];

const FETCH_TIMEOUT_MS = 6000;

async function tryFetch(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------- Piped attempts ----------

async function pipedAttempt(fullPath: string): Promise<any | null> {
  for (const instance of PIPED_INSTANCES) {
    const data = await tryFetch(`${instance}${fullPath}`);
    if (data) return data;
  }
  return null;
}

// ---------- Invidious -> Piped translators ----------

function invidiousVideoToPipedSearchItem(v: any) {
  const videoId: string = v.videoId;
  return {
    url: `/watch?v=${videoId}`,
    type: 'stream',
    title: v.title,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    uploaderName: v.author || '',
    uploaderUrl: v.authorUrl || '',
    uploaderAvatar: '',
    uploadedDate: v.publishedText || '',
    shortDescription: v.description || '',
    duration: v.lengthSeconds || 0,
    views: v.viewCount || 0,
    uploaded: v.published || 0,
    uploaderVerified: !!v.authorVerified,
    isShort: false,
  };
}

function invidiousStreamsToPipedResponse(d: any) {
  const adaptive: any[] = d.adaptiveFormats || [];
  const audioStreams = adaptive
    .filter((f) => typeof f.type === 'string' && f.type.toLowerCase().startsWith('audio/'))
    .map((f) => {
      const mime: string = f.type;
      const codecMatch = /codecs="?([^";]+)"?/.exec(mime);
      return {
        url: f.url,
        format: mime.includes('mp4') ? 'M4A' : mime.includes('webm') ? 'WEBMA' : '',
        quality: f.audioQuality || `${Math.round((Number(f.bitrate) || 0) / 1000)}kbps`,
        mimeType: mime.split(';')[0].trim(),
        codec: codecMatch ? codecMatch[1] : '',
        videoOnly: false,
        bitrate: Number(f.bitrate) || 0,
        initStart: 0,
        initEnd: 0,
        indexStart: 0,
        indexEnd: 0,
        width: 0,
        height: 0,
        fps: 0,
        audioSampleRate: f.audioSampleRate ? Number(f.audioSampleRate) : undefined,
      };
    });

  return {
    title: d.title || '',
    description: d.description || '',
    uploadDate: d.publishedText || '',
    uploader: d.author || '',
    uploaderUrl: d.authorUrl || '',
    uploaderAvatar: '',
    thumbnailUrl: d.videoThumbnails?.[0]?.url || '',
    hls: d.hlsUrl || '',
    dash: d.dashUrl || null,
    lbryId: null,
    category: d.genre || '',
    license: '',
    visibility: 'public',
    tags: d.keywords || [],
    metaInfo: [],
    duration: d.lengthSeconds || 0,
    audioStreams,
    videoStreams: [],
    relatedStreams: [],
    subtitles: [],
    livestream: !!d.liveNow,
    proxyUrl: '',
    chapters: [],
  };
}

// ---------- Invidious attempts (per supported route) ----------

async function invidiousSearch(query: string): Promise<any | null> {
  const qs = `q=${encodeURIComponent(query)}&type=video&sort=relevance`;
  for (const instance of INVIDIOUS_INSTANCES) {
    const data = await tryFetch(`${instance}/api/v1/search?${qs}`);
    if (Array.isArray(data)) {
      const items = data
        .filter((item) => item?.type === 'video' && item.videoId)
        .map(invidiousVideoToPipedSearchItem);
      if (items.length) return { items };
    }
  }
  return null;
}

async function invidiousStreams(videoId: string): Promise<any | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    const data = await tryFetch(`${instance}/api/v1/videos/${videoId}`);
    if (data && Array.isArray(data.adaptiveFormats)) {
      const out = invidiousStreamsToPipedResponse(data);
      if (out.audioStreams.length) return out;
    }
  }
  return null;
}

// ---------- Route handler ----------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Missing "path" query param' }, { status: 400 });
  }

  const otherParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'path') otherParams.append(key, value);
  });
  const queryString = otherParams.toString();
  const fullPath = `${path}${queryString ? `?${queryString}` : ''}`;

  // 1) Try Piped first — fast when it's up.
  const piped = await pipedAttempt(fullPath);
  if (piped) return NextResponse.json(piped);

  // 2) Fall back to Invidious for the two routes the client actually uses.
  if (path === '/search') {
    const q = searchParams.get('q') || '';
    const data = await invidiousSearch(q);
    if (data) return NextResponse.json(data);
  } else if (path.startsWith('/streams/')) {
    const videoId = path.slice('/streams/'.length);
    const data = await invidiousStreams(videoId);
    if (data) return NextResponse.json(data);
  }

  return NextResponse.json(
    { error: 'All upstream instances failed' },
    { status: 502 }
  );
}
