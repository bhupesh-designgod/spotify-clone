'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import {
  Play, Pause, SkipBack, SkipForward, Mic2,
  ChevronDown, Repeat, Shuffle, Loader2, Heart,
} from 'lucide-react';

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function NowPlayingScreen() {
  const { data: session } = useSession();
  const {
    currentTrack, isPlaying, togglePlayPause, nextTrack, prevTrack,
    progress, duration, seek, isLoading,
  } = usePlayerStore();

  const trackIds = currentTrack ? [currentTrack.id] : [];
  const { isLiked, toggleLike } = useLikedSongs(trackIds);

  const [show, setShow] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  // Window-level toggle so PlayerBar (or anything else) can open us.
  useEffect(() => {
    (window as any)._toggleNowPlaying = () => setShow(v => !v);
    return () => { delete (window as any)._toggleNowPlaying; };
  }, []);

  // Auto-close if track gets cleared.
  useEffect(() => { if (!currentTrack) setShow(false); }, [currentTrack]);

  const displayProgress = isSeeking ? seekValue : progress;
  const pct = duration > 0 ? (displayProgress / duration) * 100 : 0;

  const positionFromClientX = useCallback((clientX: number) => {
    if (!barRef.current || !duration) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (x / rect.width) * duration;
  }, [duration]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const pos = positionFromClientX(e.clientX);
    setIsSeeking(true);
    setSeekValue(pos);
    const move = (ev: PointerEvent) => setSeekValue(positionFromClientX(ev.clientX));
    const up = (ev: PointerEvent) => {
      seek(positionFromClientX(ev.clientX));
      setIsSeeking(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, [positionFromClientX, seek]);

  if (!show || !currentTrack) return null;
  const liked = isLiked(currentTrack.id);

  return (
    <div className="md:hidden fixed inset-0 z-[998] bg-gradient-to-b from-neutral-800 via-neutral-900 to-black flex flex-col pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
        <button
          onClick={() => setShow(false)}
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 text-white"
        >
          <ChevronDown size={22} />
        </button>
        <div className="text-center min-w-0 flex-1 px-2">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Now Playing</p>
          <p className="text-xs font-semibold text-white truncate">{currentTrack.artist}</p>
        </div>
        <div className="w-9 h-9" />
      </div>

      {/* Album art */}
      <div className="flex-1 flex items-center justify-center px-8 min-h-0">
        {currentTrack.albumArt ? (
          <img
            src={currentTrack.albumArt}
            alt={currentTrack.name}
            className="w-full max-w-sm aspect-square rounded-lg shadow-2xl object-cover"
          />
        ) : (
          <div className="w-full max-w-sm aspect-square rounded-lg bg-neutral-700 flex items-center justify-center text-6xl text-neutral-500">♪</div>
        )}
      </div>

      {/* Track info + like */}
      <div className="px-6 pt-6 pb-2 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-white truncate">{currentTrack.name}</h2>
          <p className="text-sm text-neutral-400 truncate">{currentTrack.artist}</p>
        </div>
        {session && (
          <button
            onClick={() => toggleLike(currentTrack)}
            aria-label={liked ? 'Unlike' : 'Like'}
            className="p-2 flex-shrink-0"
          >
            <Heart
              size={26}
              className={liked ? 'text-green-500 fill-green-500' : 'text-neutral-300 hover:text-white'}
            />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-6 pt-2 pb-1 flex-shrink-0">
        <div
          ref={barRef}
          onPointerDown={onPointerDown}
          className="relative h-3 flex items-center cursor-pointer touch-none"
        >
          <div className="absolute inset-x-0 h-1 rounded-full bg-neutral-700">
            <div className="absolute left-0 top-0 h-full bg-white rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
            style={{ left: `calc(${Math.min(pct, 100)}% - 6px)` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1 text-[11px] text-neutral-400 tabular-nums">
          <span>{formatTime(displayProgress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 pt-2 pb-6 flex items-center justify-between gap-2 flex-shrink-0">
        <button className="text-neutral-400 hover:text-white p-2" aria-label="Shuffle"><Shuffle size={20} /></button>
        <button onClick={prevTrack} className="text-white p-3" aria-label="Previous track">
          <SkipBack size={28} className="fill-current" />
        </button>
        <button
          onClick={togglePlayPause}
          disabled={isLoading}
          className="w-16 h-16 flex items-center justify-center bg-white text-black rounded-full active:scale-95 transition-transform disabled:opacity-60"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? <Loader2 size={26} className="animate-spin" /> : isPlaying ? <Pause size={26} className="fill-current" /> : <Play size={26} className="fill-current translate-x-[1px]" />}
        </button>
        <button onClick={nextTrack} className="text-white p-3" aria-label="Next track">
          <SkipForward size={28} className="fill-current" />
        </button>
        <button
          onClick={() => { setShow(false); (window as any)._toggleLyrics?.(); }}
          className="text-neutral-400 hover:text-white p-2"
          aria-label="Lyrics"
        >
          <Mic2 size={20} />
        </button>
      </div>
    </div>
  );
}
