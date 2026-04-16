/**
 * Shared upstream resolver used by /api/piped (search + streams metadata)
 * and /api/stream/[videoId] (audio passthrough).
 *
 * Public Piped instances have been mostly down for weeks, so we race Piped
 * against Invidious in parallel and resolve with the first valid response.
 *
 * Invidious calls use ?local=true so the upstream rewrites the audio URLs to
 * point through Invidious's own /videoplayback proxy. That bypasses YouTube's
 * IP-pinning of signed googlevideo URLs (which broke playback for many
 * tracks because the URL was signed for the upstream's IP, not the client's).
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

const FETCH_TIMEOUT_MS = 5000;

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

interface Attempt<T> {
  url: string;
  validate: (data: any) => T | null;
}

async function raceAttempts<T>(attempts: Attempt<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    let pending = attempts.length;
    if (pending === 0) return resolve(null);
    for (const a of attempts) {
      tryFetch(a.url).then((data) => {
        if (settled) return;
        const v = data ? a.validate(data) : null;
        if (v !== null) {
          settled = true;
          resolve(v);
          return;
        }
        pending--;
        if (pending === 0 && !settled) {
          settled = true;
          resolve(null);
        }
      });
    }
  });
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

// ---------- Public resolvers ----------

/**
 * @param mode  "proxied"  - prefer URLs already routed through the upstream's
 *                          own proxy (good for direct browser playback
 *                          because the URL isn't IP-pinned to one server)
 *              "direct"   - prefer raw googlevideo URLs (good for our own
 *                          server-side streaming proxy because we don't want
 *                          another hop, and bot-challenge pages on upstream
 *                          proxies turn into HTML-instead-of-audio failures)
 */
export async function resolveStreams(
  videoId: string,
  mode: 'proxied' | 'direct' = 'proxied'
): Promise<any | null> {
  const invidiousQs = mode === 'proxied' ? '?local=true' : '';
  const attempts: Attempt<any>[] = [
    ...PIPED_INSTANCES.map((i) => ({
      url: `${i}/streams/${videoId}`,
      validate: (data: any) => {
        if (!data || !Array.isArray(data.audioStreams) || !data.audioStreams.length) return null;
        if (mode === 'direct') {
          // Strip Piped's own /videoplayback proxy hosts; fall back to whatever
          // raw URLs are present in the response. If everything is proxied
          // (some Piped instances rewrite all URLs), reject and let another
          // upstream win the race.
          const direct = data.audioStreams.filter(
            (s: any) => typeof s.url === 'string' && /\.googlevideo\.com\//.test(s.url)
          );
          if (!direct.length) return null;
          return { ...data, audioStreams: direct };
        }
        return data;
      },
    })),
    ...INVIDIOUS_INSTANCES.map((i) => ({
      url: `${i}/api/v1/videos/${videoId}${invidiousQs}`,
      validate: (data: any) => {
        if (!data || !Array.isArray(data.adaptiveFormats)) return null;
        const out = invidiousStreamsToPipedResponse(data);
        return out.audioStreams.length ? out : null;
      },
    })),
  ];
  return raceAttempts(attempts);
}

export async function resolveSearch(query: string): Promise<any | null> {
  const pipedQs = new URLSearchParams({ q: query, filter: 'music_songs' }).toString();
  const invQs = `q=${encodeURIComponent(query)}&type=video&sort=relevance`;
  const attempts: Attempt<any>[] = [
    ...PIPED_INSTANCES.map((i) => ({
      url: `${i}/search?${pipedQs}`,
      validate: (data: any) =>
        data && Array.isArray(data.items) && data.items.length ? data : null,
    })),
    ...INVIDIOUS_INSTANCES.map((i) => ({
      url: `${i}/api/v1/search?${invQs}`,
      validate: (data: any) => {
        if (!Array.isArray(data)) return null;
        const items = data
          .filter((item: any) => item?.type === 'video' && item.videoId)
          .map(invidiousVideoToPipedSearchItem);
        return items.length ? { items } : null;
      },
    })),
  ];
  return raceAttempts(attempts);
}

/**
 * Pick the best playable audio stream for an `<audio>` element.
 * Prefers AAC (m4a/mp4) over webm/opus because iOS Safari can't decode opus.
 * Within a format group, prefers higher bitrate.
 */
export function pickBestAudio(streams: any[]): any | null {
  if (!streams || streams.length === 0) return null;
  const score = (s: any) => {
    const mt = (s.mimeType || '').toLowerCase();
    let formatScore = 0;
    if (mt.includes('mp4') || mt.includes('m4a') || mt.includes('aac')) formatScore = 2;
    else if (mt.includes('webm') || mt.includes('opus')) formatScore = 1;
    return formatScore * 1_000_000 + (Number(s.bitrate) || 0);
  };
  return streams.reduce((prev, curr) => (score(curr) > score(prev) ? curr : prev));
}
