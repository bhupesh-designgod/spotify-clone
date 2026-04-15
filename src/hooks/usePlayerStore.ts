import { create } from 'zustand';
import { Howl, Howler } from 'howler';
import { findBestPipedAudioStream } from '@/lib/piped';

export interface Track {
  id: string;
  name: string;
  artist: string;
  durationMs: number;
  albumArt: string;
  uri?: string;
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  isLoading: boolean;
  error: string | null;
  sound: Howl | null;

  // Actions
  playTrack: (track: Track) => Promise<void>;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  addToQueue: (track: Track) => void;
  clearQueue: () => void;
  updateProgress: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  volume: 0.5,
  progress: 0,
  duration: 0,
  isLoading: false,
  error: null,
  sound: null,

  playTrack: async (track: Track) => {
    set({ isLoading: true, error: null, currentTrack: track, progress: 0 });
    
    // Stop currently playing sound if any
    const existingSound = get().sound;
    if (existingSound) {
      existingSound.unload();
    }

    const streamUrl = await findBestPipedAudioStream(track.name, track.artist, track.durationMs);
    
    if (!streamUrl) {
      set({ 
        isLoading: false, 
        error: 'Track unavailable. Could not find a stream matching this track.',
        isPlaying: false 
      });
      return;
    }

    const sound = new Howl({
      src: [streamUrl],
      html5: true, // Force HTML5 audio to allow streaming large files without loading entirely
      volume: get().volume,
      onload: () => {
        set({ duration: sound.duration(), isLoading: false });
      },
      onplay: () => {
        set({ isPlaying: true, error: null });
        requestAnimationFrame(get().updateProgress);
      },
      onpause: () => {
        set({ isPlaying: false });
      },
      onend: () => {
        get().nextTrack();
      },
      onloaderror: () => {
        set({ error: 'Failed to load audio stream.', isLoading: false, isPlaying: false });
      },
      onplayerror: () => {
        set({ error: 'Failed to play audio stream.', isLoading: false, isPlaying: false });
        // Howler docs suggest unlocking audio context here if necessary, but html5:true usually bypasses this issue.
      }
    });

    set({ sound });
    sound.play();
  },

  togglePlayPause: () => {
    const { sound, isPlaying } = get();
    if (!sound) return;

    if (isPlaying) {
      sound.pause();
    } else {
      sound.play();
    }
  },

  nextTrack: () => {
    const { queue, currentTrack, playTrack } = get();
    if (queue.length === 0) {
      set({ isPlaying: false, progress: 0 }); // end of queue
      return;
    }
    
    // Find current index in queue
    const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;
    if (currentIndex >= 0 && currentIndex < queue.length - 1) {
      playTrack(queue[currentIndex + 1]);
    } else {
      // either not in queue or it was the last track
      set({ isPlaying: false, progress: 0 });
    }
  },

  prevTrack: () => {
    const { queue, currentTrack, playTrack, sound } = get();
    
    // If progress > 3s, restart current track
    if (sound && sound.seek() > 3) {
      sound.seek(0);
      set({ progress: 0 });
      return;
    }

    if (queue.length === 0) return;

    const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;
    if (currentIndex > 0) {
      playTrack(queue[currentIndex - 1]);
    } else {
      sound?.seek(0);
      set({ progress: 0 });
    }
  },

  seek: (position: number) => {
    const { sound } = get();
    if (sound) {
      sound.seek(position);
      set({ progress: position });
    }
  },

  setVolume: (volume: number) => {
    const { sound } = get();
    if (sound) {
      sound.volume(volume);
    }
    set({ volume });
  },

  addToQueue: (track: Track) => set((state) => ({ queue: [...state.queue, track] })),
  
  clearQueue: () => set({ queue: [] }),

  updateProgress: () => {
    const { sound, isPlaying } = get();
    if (sound && isPlaying) {
      set({ progress: sound.seek() as number });
      requestAnimationFrame(get().updateProgress);
    }
  }
}));
