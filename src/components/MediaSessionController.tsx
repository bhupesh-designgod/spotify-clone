'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '@/hooks/usePlayerStore';

/**
 * Wires the Web MediaSession API into the player store.
 *
 *  - Lock-screen / notification-shade media controls on Android & iOS.
 *  - AirPods / Bluetooth / wired-headset play/pause/skip buttons.
 *  - Signals to the OS that the page is actively playing media, which keeps
 *    the HTML5 <audio> element alive when the screen locks or the user
 *    switches apps.
 */
export default function MediaSessionController() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);

  // Register action handlers once.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { ms.setActionHandler(action, handler); } catch { /* unsupported */ }
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
      (['play','pause','previoustrack','nexttrack','seekto','seekbackward','seekforward'] as MediaSessionAction[])
        .forEach((a) => safeSet(a, null));
    };
  }, []);

  // Update metadata when track changes.
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

  // Reflect playback state for the OS lock-screen UI.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Update position for the lock-screen scrubber.
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
    } catch { /* ignore invalid state */ }
  }, [progress, duration]);

  return null;
}
