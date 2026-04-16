export interface PipedSearchItem {
  url: string;
  type: string;
  title: string;
  thumbnail: string;
  uploaderName: string;
  uploaderUrl: string;
  uploaderAvatar: string;
  uploadedDate: string;
  shortDescription: string;
  duration: number;
  views: number;
  uploaded: number;
  uploaderVerified: boolean;
  isShort: boolean;
}

export interface PipedAudioStream {
  url: string;
  format: string;
  quality: string;
  mimeType: string;
  codec: string;
  videoOnly: boolean;
  bitrate: number;
  initStart: number;
  initEnd: number;
  indexStart: number;
  indexEnd: number;
  width: number;
  height: number;
  fps: number;
  audioSampleRate?: number;
}

export interface PipedStreamResponse {
  title: string;
  description: string;
  uploadDate: string;
  uploader: string;
  uploaderUrl: string;
  uploaderAvatar: string;
  thumbnailUrl: string;
  hls: string;
  dash: string | null;
  lbryId: string | null;
  category: string;
  license: string;
  visibility: string;
  tags: string[];
  metaInfo: any[];
  duration: number;
  audioStreams: PipedAudioStream[];
  videoStreams: any[];
  relatedStreams: any[];
  subtitles: any[];
  livestream: boolean;
  proxyUrl: string;
  chapters: any[];
}

/**
 * All Piped API calls go through our own /api/piped proxy to avoid CORS.
 * The proxy expects: GET /api/piped?path=/search&q=...&filter=...
 */
async function pipedFetch(path: string, params?: Record<string, string>): Promise<any> {
  const searchParams = new URLSearchParams({ path, ...params });
  const res = await fetch(`/api/piped?${searchParams.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Piped proxy returned ${res.status}`);
  }
  return res.json();
}

/**
 * Rewrite Piped's proxied thumbnail URL to the direct YouTube CDN URL.
 * Piped instances expose thumbnails through `pipedproxy.*` which goes down with
 * the instance — i.ytimg.com is served directly by Google and is reliable.
 */
function ytThumb(item: any): string {
  const videoId: string | undefined = item?.url?.replace?.('/watch?v=', '');
  if (videoId) return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  return item?.thumbnail || '';
}

export async function searchPiped(query: string): Promise<PipedSearchItem[]> {
  const data = await pipedFetch('/search', {
    q: query,
    filter: 'music_songs',
  });
  const items: PipedSearchItem[] = (data.items || [])
    .filter((item: any) => item.type === 'stream' && !item.isShort)
    .map((item: any) => ({ ...item, thumbnail: ytThumb(item) }));
  return items;
}

export async function getStreamUrl(videoId: string): Promise<string | null> {
  try {
    const data: PipedStreamResponse = await pipedFetch(`/streams/${videoId}`);

    if (!data.audioStreams || data.audioStreams.length === 0) {
      return null;
    }

    // Filter audio-only streams and pick highest bitrate
    const audioOnly = data.audioStreams.filter(
      (s) => !s.videoOnly && s.mimeType?.startsWith('audio/')
    );

    if (audioOnly.length === 0) {
      const best = data.audioStreams.reduce((prev, curr) =>
        curr.bitrate > prev.bitrate ? curr : prev
      );
      return best.url;
    }

    const best = audioOnly.reduce((prev, curr) =>
      curr.bitrate > prev.bitrate ? curr : prev
    );
    return best.url;
  } catch (error) {
    console.error('Failed to get stream URL:', error);
    return null;
  }
}

export async function findBestPipedAudioStream(
  trackName: string,
  artistName: string,
  durationMs: number
): Promise<string | null> {
  try {
    const query = `${trackName} ${artistName} official audio`;
    const items = await searchPiped(query);

    const targetDurationSec = Math.floor(durationMs / 1000);

    let bestMatch = items.find(
      (item) => Math.abs(item.duration - targetDurationSec) <= 5
    );

    if (!bestMatch && items.length > 0) {
      bestMatch = items[0];
    }

    if (!bestMatch) return null;

    const videoId = bestMatch.url.replace('/watch?v=', '');
    return getStreamUrl(videoId);
  } catch (error) {
    console.error('Piped API Error:', error);
    return null;
  }
}
