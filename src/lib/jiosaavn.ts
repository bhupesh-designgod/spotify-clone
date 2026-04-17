/**
 * Client for our forked JioSaavn API (sumitkolhe/jiosaavn-api, deployed to Vercel).
 *
 * The API returns 320kbps AAC (.mp4) URLs from JioSaavn's public CDN. These
 * URLs play directly in an <audio> element — no proxy, no CORS workarounds,
 * no IP-pinning issues.
 */

const API_BASE = 'https://jiosaavn-api-plum-nine.vercel.app';

import type { Track } from '@/hooks/usePlayerStore';

interface SaavnImage {
  quality: string;
  url: string;
}
interface SaavnDownloadUrl {
  quality: string;
  url: string;
}
interface SaavnArtist {
  id: string;
  name: string;
  role?: string;
}
interface SaavnSong {
  id: string;
  name: string;
  duration: number; // seconds
  image: SaavnImage[];
  downloadUrl: SaavnDownloadUrl[];
  artists: {
    primary: SaavnArtist[];
    featured?: SaavnArtist[];
    all?: SaavnArtist[];
  };
  album?: { id?: string; name?: string };
}

interface SaavnResponse<T> {
  success: boolean;
  data: T;
}

function pickImage(imgs: SaavnImage[] | undefined): string {
  if (!imgs?.length) return '';
  // Prefer 500x500; fall back to last (usually largest).
  return imgs.find((i) => i.quality === '500x500')?.url || imgs[imgs.length - 1].url;
}

function pickStreamUrl(urls: SaavnDownloadUrl[] | undefined): string {
  if (!urls?.length) return '';
  return (
    urls.find((u) => u.quality === '320kbps')?.url ||
    urls.find((u) => u.quality === '160kbps')?.url ||
    urls[urls.length - 1].url
  );
}

function artistString(song: SaavnSong): string {
  const primary = song.artists?.primary?.map((a) => a.name).filter(Boolean) || [];
  if (primary.length) return primary.join(', ');
  return 'Unknown';
}

export function saavnSongToTrack(song: SaavnSong): Track {
  return {
    id: song.id,
    name: song.name,
    artist: artistString(song),
    albumArt: pickImage(song.image),
    durationMs: (song.duration || 0) * 1000,
    streamUrl: pickStreamUrl(song.downloadUrl),
  };
}

export async function searchJioSaavn(query: string, limit = 20): Promise<Track[]> {
  const res = await fetch(
    `${API_BASE}/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`JioSaavn search failed (${res.status})`);
  const json = (await res.json()) as SaavnResponse<{ results: SaavnSong[] }>;
  if (!json.success || !json.data?.results) return [];
  return json.data.results
    .map(saavnSongToTrack)
    .filter((t) => !!t.streamUrl);
}

export async function getSongById(id: string): Promise<Track | null> {
  const res = await fetch(`${API_BASE}/api/songs/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const json = (await res.json()) as SaavnResponse<SaavnSong[]>;
  const song = Array.isArray(json.data) ? json.data[0] : (json.data as unknown as SaavnSong);
  if (!song) return null;
  return saavnSongToTrack(song);
}
