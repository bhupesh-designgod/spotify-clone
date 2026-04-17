'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Play, Loader2 } from 'lucide-react';
import { usePlayerStore, Track } from '@/hooks/usePlayerStore';
import { useSession } from 'next-auth/react';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function relativeTime(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface HistoryItem {
  id: string;
  track_id: string;
  track_name: string;
  track_artist: string;
  track_album_art: string;
  track_video_id: string;
  track_duration_ms: number;
  played_at: string;
}

function historyToTrack(item: HistoryItem): Track {
  return {
    id: item.track_id,
    name: item.track_name,
    artist: item.track_artist,
    albumArt: item.track_album_art,
    streamUrl: item.track_video_id,
    durationMs: item.track_duration_ms,
  };
}

export default function HistoryPage() {
  const { data: session } = useSession();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentTrack, isPlaying, playTrack, togglePlayPause, setQueue } = usePlayerStore();

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    fetch('/api/history?limit=50')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setHistory(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  const handlePlay = useCallback((item: HistoryItem, index: number) => {
    const track = historyToTrack(item);
    if (currentTrack?.id === track.id) { togglePlayPause(); return; }
    const tracks = history.map(historyToTrack);
    setQueue(tracks, index);
    playTrack(track);
  }, [currentTrack, togglePlayPause, setQueue, history, playTrack]);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
        <Clock size={48} />
        <p>Sign in to see your listening history</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 pb-2 sm:pb-6">
        <div className="w-32 h-32 sm:w-48 sm:h-48 bg-gradient-to-br from-green-600 to-teal-500 rounded-lg flex items-center justify-center shadow-2xl">
          <Clock size={48} className="text-white sm:hidden" />
          <Clock size={64} className="text-white hidden sm:block" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-400 font-bold">History</p>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white mt-1 sm:mt-2">Recently Played</h1>
          <p className="text-sm text-neutral-400 mt-1 sm:mt-2">Your last 50 tracks</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-neutral-500" />
        </div>
      ) : history.length === 0 ? (
        <p className="text-neutral-500 text-center py-10">Your listening history will appear here</p>
      ) : (
        <div>
          <div className="hidden sm:flex px-4 py-2 text-xs uppercase tracking-wider text-neutral-500 border-b border-white/5 mb-1">
            <div className="w-12 text-center">#</div>
            <div className="flex-1">Title</div>
            <div className="w-24 text-right">Played</div>
            <div className="w-20 text-right pr-4">Duration</div>
          </div>

          {history.map((item, index) => {
            const track = historyToTrack(item);
            const isCurrent = currentTrack?.id === track.id;
            const isThisPlaying = isCurrent && isPlaying;

            return (
              <div
                key={item.id}
                className={`group flex items-center px-2 sm:px-4 py-2 rounded-md cursor-pointer transition-colors duration-150 ${isCurrent ? 'bg-white/10' : 'hover:bg-white/5'}`}
                onClick={() => handlePlay(item, index)}
              >
                <div className="hidden sm:flex w-12 text-center justify-center items-center text-sm">
                  {isThisPlaying ? (
                    <div className="flex items-end gap-[3px] h-4">
                      <span className="w-[3px] bg-green-500 rounded-full animate-[bounce_1s_ease-in-out_infinite]" style={{ height: '60%' }} />
                      <span className="w-[3px] bg-green-500 rounded-full animate-[bounce_1s_ease-in-out_0.2s_infinite]" style={{ height: '100%' }} />
                      <span className="w-[3px] bg-green-500 rounded-full animate-[bounce_1s_ease-in-out_0.4s_infinite]" style={{ height: '40%' }} />
                    </div>
                  ) : (
                    <>
                      <span className="group-hover:hidden text-neutral-400">{index + 1}</span>
                      <Play size={16} className="hidden group-hover:block text-white fill-current" />
                    </>
                  )}
                </div>
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <img src={track.albumArt} alt={track.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm font-medium truncate ${isCurrent ? 'text-green-500' : 'text-white'}`}>{track.name}</span>
                    <span className="text-xs text-neutral-400 truncate">{track.artist}</span>
                  </div>
                </div>
                <div className="hidden sm:block w-24 text-right text-xs text-neutral-500">{relativeTime(item.played_at)}</div>
                <div className="hidden sm:block w-20 text-right pr-4 text-sm text-neutral-400">{formatDuration(track.durationMs / 1000)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
