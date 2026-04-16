'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import {
  Play, Pause, SkipBack, SkipForward, Mic2,
  Volume1, Volume2, VolumeX, Repeat, Shuffle, Loader2, Heart
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function PlayerBar() {
  const { data: session } = useSession();
  const {
    currentTrack, isPlaying, togglePlayPause, nextTrack, prevTrack,
    progress, duration, seek, volume, setVolume, isLoading, error,
  } = usePlayerStore();

  const trackIds = currentTrack ? [currentTrack.id] : [];
  const { isLiked, toggleLike } = useLikedSongs(trackIds);

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const displayProgress = isSeeking ? seekValue : progress;
  const progressPercent = duration > 0 ? (displayProgress / duration) * 100 : 0;

  const getSeekPosition = useCallback((clientX: number) => {
    if (!progressBarRef.current || !duration) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (x / rect.width) * duration;
  }, [duration]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getSeekPosition(e.clientX);
    setIsSeeking(true);
    setSeekValue(pos);
    const handleMouseMove = (moveEvent: MouseEvent) => setSeekValue(getSeekPosition(moveEvent.clientX));
    const handleMouseUp = (upEvent: MouseEvent) => {
      seek(getSeekPosition(upEvent.clientX));
      setIsSeeking(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [getSeekPosition, seek]);

  const handleProgressTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const pos = getSeekPosition(t.clientX);
    setIsSeeking(true);
    setSeekValue(pos);
    const handleMove = (moveEvent: TouchEvent) => {
      const tt = moveEvent.touches[0];
      if (tt) setSeekValue(getSeekPosition(tt.clientX));
    };
    const handleEnd = (endEvent: TouchEvent) => {
      const tt = endEvent.changedTouches[0];
      if (tt) seek(getSeekPosition(tt.clientX));
      setIsSeeking(false);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
  }, [getSeekPosition, seek]);

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id);

  return (
    <div className="bg-[#181818] border-t border-neutral-800 z-50 flex-shrink-0">
      {/* Mobile thin progress bar (top edge) */}
      <div
        ref={progressBarRef}
        className="md:hidden relative h-1 w-full bg-neutral-700 cursor-pointer touch-none"
        onMouseDown={handleProgressMouseDown} onTouchStart={handleProgressTouchStart}
      >
        <div className="absolute left-0 top-0 h-full bg-green-500" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
      </div>

      <div className="h-16 md:h-[90px] flex items-center justify-between px-2 sm:px-4">
        {/* Track Info */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 md:w-[30%] md:flex-initial md:min-w-[180px] min-w-0">
          {currentTrack.albumArt ? (
            <img src={currentTrack.albumArt} alt={currentTrack.name} className="w-11 h-11 md:w-14 md:h-14 rounded shadow-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-11 h-11 md:w-14 md:h-14 bg-neutral-700 rounded shadow-lg flex items-center justify-center text-neutral-500 flex-shrink-0">♪</div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-white truncate md:hover:underline md:cursor-pointer">{currentTrack.name}</span>
            <span className="text-xs text-neutral-400 truncate md:hover:underline md:cursor-pointer">{currentTrack.artist}</span>
            {error && <span className="text-xs text-red-400 truncate">{error}</span>}
          </div>
          {session && (
            <button onClick={() => toggleLike(currentTrack)} className="ml-1 sm:ml-2 flex-shrink-0 p-1">
              <Heart size={18} className={liked ? 'text-green-500 fill-green-500' : 'text-neutral-400 hover:text-white'} />
            </button>
          )}
        </div>

        {/* Mobile play/pause + lyrics (right side) */}
        <div className="flex md:hidden items-center gap-1 flex-shrink-0">
          <button onClick={() => (window as any)._toggleLyrics?.()} className="text-neutral-400 hover:text-white p-2" title="Lyrics">
            <Mic2 size={18} />
          </button>
          <button onClick={prevTrack} className="text-neutral-300 p-1">
            <SkipBack size={20} className="fill-current" />
          </button>
          <button
            onClick={togglePlayPause}
            disabled={isLoading}
            className="w-9 h-9 flex items-center justify-center bg-white text-black rounded-full disabled:opacity-60"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current translate-x-[1px]" />}
          </button>
          <button onClick={nextTrack} className="text-neutral-300 p-1">
            <SkipForward size={20} className="fill-current" />
          </button>
        </div>

        {/* Desktop Controls */}
        <div className="hidden md:flex flex-col items-center justify-center gap-1 w-[40%] max-w-[722px]">
          <div className="flex items-center gap-5">
            <button className="text-neutral-400 hover:text-white transition-colors"><Shuffle size={18} /></button>
            <button onClick={prevTrack} className="text-neutral-400 hover:text-white transition-colors"><SkipBack size={22} className="fill-current" /></button>
            <button onClick={togglePlayPause} disabled={isLoading} className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform disabled:opacity-60">
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current translate-x-[1px]" />}
            </button>
            <button onClick={nextTrack} className="text-neutral-400 hover:text-white transition-colors"><SkipForward size={22} className="fill-current" /></button>
            <button className="text-neutral-400 hover:text-white transition-colors"><Repeat size={18} /></button>
          </div>

          {/* Progress Bar (desktop) */}
          <div className="flex items-center gap-2 w-full max-w-[600px]">
            <span className="text-[11px] text-neutral-400 w-10 text-right tabular-nums">{formatTime(displayProgress)}</span>
            <div ref={progressBarRef} className="relative flex-1 h-3 flex items-center cursor-pointer group" onMouseDown={handleProgressMouseDown} onTouchStart={handleProgressTouchStart}>
              <div className="absolute inset-x-0 h-1 rounded-full bg-neutral-600 group-hover:h-[6px] transition-all">
                <div className="absolute left-0 top-0 h-full bg-white group-hover:bg-green-500 rounded-full transition-colors" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ left: `calc(${Math.min(progressPercent, 100)}% - 6px)` }} />
            </div>
            <span className="text-[11px] text-neutral-400 w-10 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume & Lyrics (desktop) */}
        <div className="hidden md:flex items-center justify-end gap-2 w-[30%] min-w-[180px] text-neutral-400 pr-2">
          <button onClick={() => (window as any)._toggleLyrics?.()} className="hover:text-white transition-colors" title="Lyrics">
            <Mic2 size={18} />
          </button>
          <button onClick={() => setVolume(volume === 0 ? 50 : 0)} className="hover:text-white transition-colors">
            {volume === 0 ? <VolumeX size={20} /> : volume < 50 ? <Volume1 size={20} /> : <Volume2 size={20} />}
          </button>
          <div className="w-24">
            <Slider value={[volume]} max={100} step={1} onValueChange={(val) => setVolume(Array.isArray(val) ? val[0] : val)} />
          </div>
        </div>
      </div>
    </div>
  );
}
