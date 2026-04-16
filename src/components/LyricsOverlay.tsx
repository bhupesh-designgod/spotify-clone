'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { X, Music2 } from 'lucide-react';
import { usePlayerStore } from '@/hooks/usePlayerStore';

interface LyricLine { time: number; text: string; }

function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/;
  for (const raw of lrc.split('\n')) {
    const m = raw.match(regex);
    if (m) {
      const t = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3].padEnd(3, '0')) / 1000;
      const text = m[4].trim();
      if (text) lines.push({ time: t, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

interface LyricsData { syncedLyrics: string | null; plainLyrics: string | null; }

export default function LyricsOverlay() {
  const { currentTrack, progress } = usePlayerStore();
  const [show, setShow] = useState(false);
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedId, setCachedId] = useState<string | null>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any)._toggleLyrics = () => setShow(v => !v);
    return () => { delete (window as any)._toggleLyrics; };
  }, []);

  useEffect(() => {
    if (!currentTrack) { setLyrics(null); setCachedId(null); return; }
    if (cachedId === currentTrack.id) return;
    setLoading(true); setError(null);
    const dur = Math.round(currentTrack.durationMs / 1000);
    const p = new URLSearchParams({ track_name: currentTrack.name, artist_name: currentTrack.artist });
    if (dur > 0) p.set('duration', String(dur));
    fetch(`/api/lyrics?${p}`).then(r => {
      if (r.ok) return r.json();
      throw new Error();
    }).then(d => {
      setLyrics({ syncedLyrics: d.syncedLyrics || null, plainLyrics: d.plainLyrics || null });
    }).catch(() => {
      setLyrics(null); setError('No lyrics available for this track');
    }).finally(() => { setLoading(false); setCachedId(currentTrack.id); });
  }, [currentTrack?.id]);

  const syncedLines = useMemo(() => lyrics?.syncedLyrics ? parseLRC(lyrics.syncedLyrics) : null, [lyrics?.syncedLyrics]);

  const currentIdx = useMemo(() => {
    if (!syncedLines) return -1;
    let idx = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].time <= progress) idx = i; else break;
    }
    return idx;
  }, [syncedLines, progress]);

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentIdx]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-xl flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          {currentTrack?.albumArt && <img src={currentTrack.albumArt} alt="" className="w-10 h-10 sm:w-12 sm:h-12 rounded shadow-lg flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-white font-semibold text-base sm:text-lg truncate">{currentTrack?.name || 'No track'}</p>
            <p className="text-neutral-400 text-xs sm:text-sm truncate">{currentTrack?.artist}</p>
          </div>
        </div>
        <button onClick={() => setShow(false)} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0">
          <X size={20} className="text-white" />
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4 text-neutral-500"><Music2 size={40} className="animate-pulse" /><p>Loading lyrics...</p></div>
          </div>
        ) : error || !lyrics ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4 text-neutral-500"><Music2 size={48} /><p className="text-base sm:text-lg text-center">{error || 'No lyrics available'}</p></div>
          </div>
        ) : syncedLines ? (
          <div className="max-w-2xl mx-auto py-[30vh]">
            {syncedLines.map((line, i) => (
              <div key={`${i}-${line.time}`} ref={i === currentIdx ? activeRef : undefined}
                className={`py-2 sm:py-3 transition-all duration-300 cursor-pointer ${
                  i === currentIdx ? 'text-white text-xl sm:text-3xl font-bold' : i < currentIdx ? 'text-white/30 text-lg sm:text-2xl font-semibold' : 'text-white/50 text-lg sm:text-2xl font-semibold'
                }`}
                onClick={() => usePlayerStore.getState().seek(line.time)}>
                {line.text}
              </div>
            ))}
          </div>
        ) : lyrics.plainLyrics ? (
          <div className="max-w-2xl mx-auto py-10">
            {lyrics.plainLyrics.split('\n').map((l, i) => <p key={i} className="text-white/80 text-base sm:text-xl leading-relaxed py-1">{l || '\u00A0'}</p>)}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-500"><p className="text-base sm:text-lg">No lyrics available</p></div>
        )}
      </div>
    </div>
  );
}
