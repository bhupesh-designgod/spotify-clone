import { create } from 'zustand';

declare global {
  interface Window {
    _ytPlayer: any;
    _ytPlayerReady: boolean;
  }
}

export interface Track {
  id: string;
  name: string;
  artist: string;
  durationMs: number;
  albumArt: string;
  /**
   * Direct 320kbps MP4 URL (from JioSaavn's CDN). Played as-is by an <audio> element.
   * Persisted in the Supabase `track_video_id` column (kept for schema compat).
   */
  streamUrl?: string;
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  isLoading: boolean;
  error: string | null;

  playTrack: (track: Track) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  addToQueue: (track: Track) => void;
  setQueue: (tracks: Track[], startIndex: number) => void;
  clearQueue: () => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (val: boolean) => void;
  setIsLoading: (val: boolean) => void;
  setError: (err: string | null) => void;
}

// Log play to history (fire-and-forget, only when logged in)
function logPlay(track: Track) {
  if (typeof window === 'undefined') return;
  fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      track_id: track.id,
      track_name: track.name,
      track_artist: track.artist,
      track_album_art: track.albumArt,
      track_video_id: track.streamUrl || '',
      track_duration_ms: track.durationMs,
    }),
  }).catch(() => {}); // Silently fail if not logged in or error
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  volume: 50,
  progress: 0,
  duration: 0,
  isLoading: false,
  error: null,

  playTrack: (track: Track) => {
    set({
      currentTrack: track,
      isLoading: true,
      error: null,
      progress: 0,
      duration: 0,
    });
    // Log to play history
    logPlay(track);
  },

  togglePlayPause: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  nextTrack: () => {
    const { queue, queueIndex, playTrack } = get();
    const nextIdx = queueIndex + 1;
    if (nextIdx < queue.length) {
      set({ queueIndex: nextIdx });
      playTrack(queue[nextIdx]);
    } else {
      set({ isPlaying: false, progress: 0 });
    }
  },

  prevTrack: () => {
    const { queue, queueIndex, playTrack, progress } = get();
    if (progress > 3) {
      set({ progress: 0 });
      return;
    }
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) {
      set({ queueIndex: prevIdx });
      playTrack(queue[prevIdx]);
    } else {
      set({ progress: 0 });
    }
  },

  seek: (position: number) => {
    set({ progress: position });
    if (typeof window !== 'undefined' && window._ytPlayer && window._ytPlayerReady) {
      try {
        window._ytPlayer.seekTo(position, true);
      } catch (e) {
        console.error('Seek failed:', e);
      }
    }
  },

  setVolume: (volume: number) => {
    set({ volume });
    if (typeof window !== 'undefined' && window._ytPlayer && window._ytPlayerReady) {
      try {
        window._ytPlayer.setVolume(volume);
      } catch (e) {
        console.error('Volume change failed:', e);
      }
    }
  },

  addToQueue: (track: Track) =>
    set((state) => ({ queue: [...state.queue, track] })),

  setQueue: (tracks: Track[], startIndex: number) =>
    set({ queue: tracks, queueIndex: startIndex }),

  clearQueue: () => set({ queue: [], queueIndex: -1 }),

  setProgress: (progress: number) => set({ progress }),
  setDuration: (duration: number) => set({ duration }),
  setIsPlaying: (val: boolean) => set({ isPlaying: val }),
  setIsLoading: (val: boolean) => set({ isLoading: val }),
  setError: (err: string | null) => set({ error: err }),
}));
