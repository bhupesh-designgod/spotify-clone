'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '@/hooks/usePlayerStore';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
    _ytPlayerReady: boolean;
    _ytPlayer: any;
  }
}

export default function YouTubePlayer() {
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingVideoRef = useRef<string | null>(null);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setIsLoading = usePlayerStore((s) => s.setIsLoading);
  const setError = usePlayerStore((s) => s.setError);
  const nextTrack = usePlayerStore((s) => s.nextTrack);

  const currentVideoId = currentTrack?.videoId;

  const stopProgressInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startProgressInterval = useCallback(() => {
    stopProgressInterval();
    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const time = playerRef.current.getCurrentTime() || 0;
          usePlayerStore.getState().setProgress(time);
        } catch {}
      }
    }, 250);
  }, [stopProgressInterval]);

  // Load YouTube IFrame API script
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If API already loaded, create player immediately
    if (window.YT && window.YT.Player) {
      createPlayer();
      return;
    }

    // Load the API script
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    window.onYouTubeIframeAPIReady = () => {
      createPlayer();
    };

    return () => {
      stopProgressInterval();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createPlayer() {
    if (playerRef.current) return;

    playerRef.current = new window.YT.Player('yt-player-container', {
      height: '1',
      width: '1',
      videoId: '',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          window._ytPlayerReady = true;
          window._ytPlayer = playerRef.current;
          playerRef.current.setVolume(usePlayerStore.getState().volume);
          // If a video was pending, load it now
          if (pendingVideoRef.current) {
            playerRef.current.loadVideoById(pendingVideoRef.current);
            pendingVideoRef.current = null;
          }
        },
        onStateChange: (event: any) => {
          const state = event.data;
          switch (state) {
            case 1: // PLAYING
              usePlayerStore.getState().setIsPlaying(true);
              usePlayerStore.getState().setIsLoading(false);
              const dur = playerRef.current?.getDuration?.() || 0;
              if (dur > 0) usePlayerStore.getState().setDuration(dur);
              startProgressInterval();
              break;
            case 2: // PAUSED
              usePlayerStore.getState().setIsPlaying(false);
              stopProgressInterval();
              break;
            case 0: // ENDED
              usePlayerStore.getState().setIsPlaying(false);
              usePlayerStore.getState().setProgress(0);
              stopProgressInterval();
              usePlayerStore.getState().nextTrack();
              break;
            case 3: // BUFFERING
              usePlayerStore.getState().setIsLoading(true);
              break;
            case 5: // CUED
              playerRef.current?.playVideo();
              break;
          }
        },
        onError: (event: any) => {
          console.error('YT Player Error code:', event.data);
          usePlayerStore.getState().setError('Playback failed. Try another track.');
          usePlayerStore.getState().setIsLoading(false);
          usePlayerStore.getState().setIsPlaying(false);
          stopProgressInterval();
        },
      },
    });
  }

  // Handle track changes
  useEffect(() => {
    if (!currentVideoId) return;

    if (playerRef.current && window._ytPlayerReady) {
      playerRef.current.loadVideoById(currentVideoId);
    } else {
      // Player not ready yet, queue it
      pendingVideoRef.current = currentVideoId;
    }
  }, [currentVideoId]);

  // Handle play/pause toggle from the store
  useEffect(() => {
    if (!playerRef.current || !window._ytPlayerReady || !currentVideoId) return;

    try {
      const playerState = playerRef.current.getPlayerState?.();
      if (isPlaying) {
        if (playerState !== 1) { // not already playing
          playerRef.current.playVideo();
        }
      } else {
        if (playerState === 1) { // is playing
          playerRef.current.pauseVideo();
        }
      }
    } catch {}
  }, [isPlaying, currentVideoId]);

  // Handle volume changes
  useEffect(() => {
    if (playerRef.current && window._ytPlayerReady) {
      try {
        playerRef.current.setVolume(volume);
      } catch {}
    }
  }, [volume]);

  // No custom event listeners needed — the store calls window._ytPlayer directly

  return (
    <div
      style={{
        position: 'fixed',
        bottom: -200,
        left: -200,
        width: 1,
        height: 1,
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      <div id="yt-player-container" />
    </div>
  );
}
