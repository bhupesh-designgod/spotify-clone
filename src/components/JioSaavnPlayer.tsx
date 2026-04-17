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
 * HTML5 <audio> player for JioSaavn 320kbps streams.
 *
 * JioSaavn's CDN serves AAC (.mp4) audio directly with proper Range support
 * and no auth. We set audio.src = track.streamUrl and let the browser do the
 * rest — which means background playback and lock-screen controls work on
 * mobile for free.
 *
 * Exposes window._ytPlayer so usePlayerStore's seek()/setVolume() keep
 * working without store-level changes.
 */
export default function JioSaavnPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadTokenRef = useRef(0);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);

  const streamUrl = currentTrack?.streamUrl;

  // Shim window._ytPlayer so existing store code keeps working.
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

  // Wire <audio> events to the store.
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

  // Load the new stream when the track (and thus streamUrl) changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;
    const token = ++loadTokenRef.current;

    usePlayerStore.getState().setIsLoading(true);
    usePlayerStore.getState().setError(null);

    audio.src = streamUrl;
    audio.load();
    audio.play().catch(() => {
      // Autoplay blocked before a user gesture — user can hit play.
      if (token === loadTokenRef.current) {
        usePlayerStore.getState().setIsLoading(false);
      }
    });
  }, [streamUrl]);

  // Reflect store-driven play/pause.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (isPlaying && audio.paused) {
      audio.play().catch(() => {});
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying]);

  // Apply volume.
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
