'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/hooks/usePlayerStore';

declare global {
  interface Window {
    _ytPlayer: any;
    _ytPlayerReady: boolean;
  }
}

/**
 * HTML5 <audio> player for background-safe mobile playback.
 *
 * Audio src is always /api/stream/{videoId} — our server-side proxy that
 * races Piped + Invidious and streams bytes through. This avoids IP-pinning
 * of direct googlevideo URLs and CORS issues entirely.
 *
 * A window._ytPlayer shim is exposed so the existing store (seek, setVolume)
 * keeps working without any store changes.
 */
export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadTokenRef = useRef(0);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);

  const videoId = currentTrack?.videoId;

  // Expose shim so usePlayerStore's seek() and setVolume() keep working.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    window._ytPlayer = {
      seekTo: (t: number) => { try { audio.currentTime = t; } catch {} },
      setVolume: (v: number) => { try { audio.volume = Math.max(0, Math.min(1, v / 100)); } catch {} },
      getCurrentTime: () => audio.currentTime || 0,
      getDuration: () => (isFinite(audio.duration) ? audio.duration : 0),
      playVideo: () => audio.play().catch(() => {}),
      pauseVideo: () => audio.pause(),
    };
    window._ytPlayerReady = true;
    return () => { window._ytPlayerReady = false; };
  }, []);

  // Wire native audio events to the player store.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (isFinite(audio.duration)) usePlayerStore.getState().setDuration(audio.duration);
    };
    const onTimeUpdate = () => {
      usePlayerStore.getState().setProgress(audio.currentTime || 0);
    };
    const onPlay = () => {
      usePlayerStore.getState().setIsPlaying(true);
      usePlayerStore.getState().setIsLoading(false);
    };
    const onPause = () => {
      if (!audio.ended) usePlayerStore.getState().setIsPlaying(false);
    };
    const onWaiting = () => usePlayerStore.getState().setIsLoading(true);
    const onCanPlay = () => usePlayerStore.getState().setIsLoading(false);
    const onEnded = () => {
      usePlayerStore.getState().setIsPlaying(false);
      usePlayerStore.getState().setProgress(0);
      usePlayerStore.getState().nextTrack();
    };
    const onError = () => {
      usePlayerStore.getState().setError('Playback failed. Try another track.');
      usePlayerStore.getState().setIsLoading(false);
      usePlayerStore.getState().setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  // Load a new stream when the track changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !videoId) return;
    const token = ++loadTokenRef.current;

    usePlayerStore.getState().setIsLoading(true);
    usePlayerStore.getState().setError(null);

    // Use the server-side proxy directly — no client-side URL resolution needed.
    audio.src = `/api/stream/${videoId}`;
    audio.load();
    audio.play().catch(() => {
      // Autoplay may be blocked before a user gesture; the user can tap play.
      if (token === loadTokenRef.current) {
        usePlayerStore.getState().setIsLoading(false);
      }
    });
  }, [videoId]);

  // Reflect store-driven play/pause onto the audio element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (isPlaying && audio.paused) {
      audio.play().catch(() => {});
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying]);

  // Apply volume changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume]);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      playsInline
      className="sr-only"
    />
  );
}
