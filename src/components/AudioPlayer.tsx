'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { getStreamUrl } from '@/lib/piped';

declare global {
  interface Window {
    _ytPlayer: any;
    _ytPlayerReady: boolean;
  }
}

/**
 * HTML5 <audio> based player using Piped-resolved direct stream URLs.
 *
 * Why not the YouTube IFrame API:
 *   The iframe player gets suspended by mobile browsers (especially iOS
 *   Safari) the moment the tab/screen is backgrounded. A native <audio>
 *   element does not — combined with the MediaSession API it keeps
 *   playing on the lock screen / when switching apps.
 */
export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Identifies the in-flight stream-URL fetch so a fast track-change can
  // discard a stale resolution.
  const loadTokenRef = useRef(0);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);

  const videoId = currentTrack?.videoId;

  // Expose a tiny shim so the existing store calls (window._ytPlayer.seekTo /
  // setVolume) keep working without changing the store.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    window._ytPlayer = {
      seekTo: (t: number) => { try { audio.currentTime = t; } catch {} },
      setVolume: (v: number) => { try { audio.volume = Math.max(0, Math.min(1, v / 100)); } catch {} },
      getCurrentTime: () => audio.currentTime || 0,
      getDuration: () => audio.duration || 0,
      playVideo: () => audio.play().catch(() => {}),
      pauseVideo: () => audio.pause(),
    };
    window._ytPlayerReady = true;
    return () => {
      window._ytPlayerReady = false;
    };
  }, []);

  // Wire native audio events into the store.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      const d = audio.duration;
      if (d && isFinite(d)) usePlayerStore.getState().setDuration(d);
    };
    const onTimeUpdate = () => {
      usePlayerStore.getState().setProgress(audio.currentTime || 0);
    };
    const onPlay = () => {
      usePlayerStore.getState().setIsPlaying(true);
      usePlayerStore.getState().setIsLoading(false);
    };
    const onPause = () => {
      // Don't flip isPlaying off when the pause is from track-end (handled by onEnded).
      if (audio.ended) return;
      usePlayerStore.getState().setIsPlaying(false);
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

  // Resolve and load a new stream when the track changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !videoId) return;
    const token = ++loadTokenRef.current;

    usePlayerStore.getState().setIsLoading(true);
    usePlayerStore.getState().setError(null);

    (async () => {
      const url = await getStreamUrl(videoId);
      if (token !== loadTokenRef.current) return; // superseded by another track
      if (!url) {
        usePlayerStore.getState().setError('Could not resolve audio stream');
        usePlayerStore.getState().setIsLoading(false);
        usePlayerStore.getState().setIsPlaying(false);
        return;
      }
      audio.src = url;
      audio.load();
      // Autoplay if the store wants playback (it almost always does after
      // playTrack). Browsers allow this since the user clicked play.
      try {
        await audio.play();
      } catch {
        // Autoplay may be blocked if no user gesture; user can press play.
        usePlayerStore.getState().setIsLoading(false);
      }
    })();
  }, [videoId]);

  // Reflect store-driven play/pause toggles onto the audio element.
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
      // playsInline is required by iOS so playback doesn't switch to fullscreen video UI.
      playsInline
      crossOrigin="anonymous"
      className="sr-only"
    />
  );
}
