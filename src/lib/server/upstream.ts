/**
 * Server-side upstream resolver.
 * Races Piped and Invidious instances in parallel; resolves with the first
 * valid response. Used by /api/stream/[videoId] to proxy audio to the client.
 *
 * Invidious is called with ?local=true so stream URLs are routed through
 * Invidious's own /videoplayback proxy, avoiding YouTube's IP-pinning of
 * signed googlevideo URLs.
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
    duration: d.lengthSeconds || 0,
    audioStreams,
  };
}

export async function resolveStreams(videoId: string): Promise<any | null> {
  // Both branches return raw googlevideo URLs. Our /api/stream proxy fetches
  // them server-side and streams bytes through — so we want DIRECT URLs, not
  // the upstream's proxied ones (those are often Cloudflare/bot-challenged).
  const attempts: Attempt<any>[] = [
    ...PIPED_INSTANCES.map((i) => ({
      url: `${i}/streams/${videoId}`,
      validate: (data: any) => {
        if (!data || !Array.isArray(data.audioStreams) || !data.audioStreams.length) return null;
        const direct = data.audioStreams.filter(
          (s: any) => typeof s.url === 'string' && /\.googlevideo\.com\//.test(s.url)
        );
        if (!direct.length) return null;
        return { ...data, audioStreams: direct };
      },
    })),
    // Invidious WITHOUT ?local=true: returns raw googlevideo URLs.
    ...INVIDIOUS_INSTANCES.map((i) => ({
      url: `${i}/api/v1/videos/${videoId}`,
      validate: (data: any) => {
        if (!data || !Array.isArray(data.adaptiveFormats)) return null;
        const out = invidiousStreamsToPipedResponse(data);
        const direct = out.audioStreams.filter(
          (s: any) => typeof s.url === 'string' && /\.googlevideo\.com\//.test(s.url)
        );
        if (!direct.length) return null;
        return { ...out, audioStreams: direct };
      },
    })),
  ];
  return raceAttempts(attempts);
}

/**
 * Pick the best playable audio stream.
 * Prefers AAC/M4A over webm/opus because iOS Safari cannot decode opus.
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
