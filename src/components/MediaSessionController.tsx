'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '@/hooks/usePlayerStore';

/**
 * Wires the Web MediaSession API into our player store.
 *
 * Effect on mobile:
 *  - Lock-screen / notification-shade media controls (track title, artist,
 *    album art, play/pause/skip).
 *  - AirPods / wired-headset / Bluetooth play/pause/skip buttons trigger
 *    the registered action handlers.
 *  - Helps the OS treat the page as actively playing media. Android Chrome
 *    will keep playback alive in the background. iOS Safari is more
 *    aggressive — playback often continues if the user does NOT lock the
 *    screen. When the screen IS locked, playback pauses on iOS (a Safari
 *    limitation for iframe-based players); the user can resume from the
 *    lock-screen control surface.
 */
export default function MediaSessionController() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);

  // Register action handlers once; they read fresh state from the store.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { ms.setActionHandler(action, handler); } catch { /* unsupported on this browser */ }
    };

    safeSet('play', () => {
      const s = usePlayerStore.getState();
      if (!s.isPlaying) s.togglePlayPause();
    });
    safeSet('pause', () => {
      const s = usePlayerStore.getState();
      if (s.isPlaying) s.togglePlayPause();
    });
    safeSet('previoustrack', () => usePlayerStore.getState().prevTrack());
    safeSet('nexttrack', () => usePlayerStore.getState().nextTrack());
    safeSet('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        usePlayerStore.getState().seek(details.seekTime);
      }
    });
    safeSet('seekbackward', (details) => {
      const s = usePlayerStore.getState();
      const offset = details.seekOffset ?? 10;
      s.seek(Math.max(0, s.progress - offset));
    });
    safeSet('seekforward', (details) => {
      const s = usePlayerStore.getState();
      const offset = details.seekOffset ?? 10;
      s.seek(Math.min(s.duration || Infinity, s.progress + offset));
    });

    return () => {
      // Clear handlers on unmount.
      (['play','pause','previoustrack','nexttrack','seekto','seekbackward','seekforward'] as MediaSessionAction[])
        .forEach((a) => safeSet(a, null));
    };
  }, []);

  // Update metadata when the track changes.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const art = currentTrack.albumArt;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.name,
      artist: currentTrack.artist,
      album: '',
      artwork: art ? [
        { src: art, sizes: '96x96', type: 'image/jpeg' },
        { src: art, sizes: '192x192', type: 'image/jpeg' },
        { src: art, sizes: '256x256', type: 'image/jpeg' },
        { src: art, sizes: '384x384', type: 'image/jpeg' },
        { src: art, sizes: '512x512', type: 'image/jpeg' },
      ] : [],
    });
  }, [currentTrack]);

  // Reflect playback state.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Update the OS-side position so the lock-screen scrubber tracks playback.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (typeof navigator.mediaSession.setPositionState !== 'function') return;
    if (!duration || !isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(progress, duration),
        playbackRate: 1,
      });
    } catch { /* invalid state — ignore */ }
  }, [progress, duration]);

  return null;
}
