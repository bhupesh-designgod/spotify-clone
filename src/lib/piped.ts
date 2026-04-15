export interface PipedSearchItem {
  url: string;
  type: 'stream';
  title: string;
  thumbnail: string;
  uploaderName: string;
  uploaderUrl: string;
  uploaderAvatar: string;
  uploadedDate: string;
  shortDescription: string;
  duration: number; // in seconds
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
  bitrates: number[];
  audioStreams: PipedAudioStream[];
  videoStreams: any[];
  relatedStreams: any[];
  subtitles: any[];
  livestream: boolean;
  proxyUrl: string;
  chapters: any[];
}

const PIPED_API_BASE = 'https://pipedapi.kavin.rocks';

export async function findBestPipedAudioStream(
  trackName: string,
  artistName: string,
  durationMs: number
): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${trackName} ${artistName} official audio`);
    // NOTE: filter=music_songs works well, sometimes 'all' is safer if 'music_songs' yields poor results, but we'll stick to 'music_songs'
    const searchRes = await fetch(`${PIPED_API_BASE}/search?q=${query}&filter=music_songs`);
    if (!searchRes.ok) throw new Error('Failed to search Piped API');

    const searchData = await searchRes.json();
    const items: PipedSearchItem[] = searchData.items?.filter((item: any) => item.type === 'stream') || [];

    const targetDurationSec = Math.floor(durationMs / 1000);
    // Find item with duration within 5 seconds tolerance
    let bestMatch = items.find(
      (item) => Math.abs(item.duration - targetDurationSec) <= 5
    );

    // fallback to first item if none within 5 seconds tolerance, although we risk matching wrong versions.
    // For MVP, we'll be strict or provide the closest fallback.
    if (!bestMatch) {
      if (items.length > 0) {
        bestMatch = items[0]; // fallback
      } else {
        return null;
      }
    }

    const videoId = bestMatch.url.replace('/watch?v=', '');

    // Get stream details
    const streamRes = await fetch(`${PIPED_API_BASE}/streams/${videoId}`);
    if (!streamRes.ok) throw new Error('Failed to fetch stream from Piped API');

    const streamData: PipedStreamResponse = await streamRes.json();

    if (!streamData.audioStreams || streamData.audioStreams.length === 0) {
      return null;
    }

    // Pick highest bitrate audio stream
    const bestAudio = streamData.audioStreams.reduce((prev, current) => {
      return (current.bitrate > prev.bitrate) ? current : prev;
    });

    return bestAudio.url;
  } catch (error) {
    console.error('Piped API Error:', error);
    return null;
  }
}
