'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Play, Loader2, Shuffle, Plus, Music, Trash2, MoreHorizontal } from 'lucide-react';
import { usePlayerStore, Track } from '@/hooks/usePlayerStore';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { toast } from 'sonner';
import TrackContextMenu from '@/components/TrackContextMenu';

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

interface Playlist {
  id: string;
  name: string;
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
  const { currentTrack, isPlaying, playTrack, togglePlayPause, setQueue, shuffleAndPlay } = usePlayerStore();
  const [contextMenu, setContextMenu] = useState<{ track: Track; x: number; y: number } | null>(null);

  // Playlists state (for mobile)
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    fetch('/api/history?limit=50')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setHistory(data); })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Also fetch playlists
    fetch('/api/playlists')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPlaylists(data); })
      .catch(() => {});
  }, [session]);

  const handlePlay = useCallback((item: HistoryItem, index: number) => {
    const track = historyToTrack(item);
    if (currentTrack?.id === track.id) { togglePlayPause(); return; }
    const tracks = history.map(historyToTrack);
    setQueue(tracks, index);
    playTrack(track);
  }, [currentTrack, togglePlayPause, setQueue, history, playTrack]);

  const handlePlayAll = () => {
    if (history.length === 0) return;
    const tracks = history.map(historyToTrack);
    setQueue(tracks, 0);
    playTrack(tracks[0]);
  };

  const handleShuffle = () => {
    if (history.length === 0) return;
    shuffleAndPlay(history.map(historyToTrack));
  };

  const handleCreatePlaylist = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: '' }),
      });
      if (res.ok) {
        const pl = await res.json();
        setPlaylists((prev) => [pl, ...prev]);
        setNewName('');
        setShowCreateModal(false);
        toast.success('Playlist created');
      }
    } catch {}
  };

  const handleDeletePlaylist = async (e: React.MouseEvent, playlistId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
      if (res.ok) {
        setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
        toast.success('Playlist deleted');
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    setContextMenu({ track, x: e.clientX, y: e.clientY });
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
        <Clock size={48} />
        <p>Sign in to see your listening history</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" onClick={(e) => { if (contextMenu && !(e.target as HTMLElement).closest('[data-context-menu]')) setContextMenu(null); }}>
      {/* Your Playlists — shown on mobile for playlist management */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">Your Playlists</h2>
          <button
            onClick={() => setShowCreateModal(!showCreateModal)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>

        {showCreateModal && (
          <div className="mb-4 bg-white/5 rounded-lg p-3">
            <input
              type="text"
              placeholder="Playlist name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
              className="w-full bg-neutral-800 text-white text-sm rounded px-3 py-2.5 outline-none focus:ring-1 focus:ring-white/20 mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleCreatePlaylist} className="text-sm bg-white text-black px-4 py-1.5 rounded-full font-medium hover:scale-105 transition-transform">
                Create
              </button>
              <button onClick={() => { setShowCreateModal(false); setNewName(''); }} className="text-sm text-neutral-400 hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        )}

        {playlists.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 mb-2">
            {playlists.map((p) => (
              <Link
                key={p.id}
                href={`/playlist/${p.id}`}
                className="group relative flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-md p-3 transition-colors"
              >
                <div className="w-10 h-10 rounded bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center flex-shrink-0">
                  <Music size={16} className="text-white" />
                </div>
                <span className="text-sm font-medium text-white truncate flex-1">{p.name}</span>
                <button
                  onClick={(e) => handleDeletePlaylist(e, p.id)}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 active:opacity-100 text-neutral-500 hover:text-red-400 transition-all p-1"
                >
                  <Trash2 size={12} />
                </button>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-neutral-500 text-sm mb-4">No playlists yet. Tap + to create one!</p>
        )}

        <div className="border-t border-neutral-800 mt-2 pt-4" />
      </div>

      {/* History Header */}
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

      {/* Play All + Shuffle */}
      {history.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlayAll}
            className="w-12 h-12 sm:w-14 sm:h-14 bg-green-500 hover:bg-green-400 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all"
            title="Play all"
          >
            <Play size={22} className="text-black fill-black translate-x-[1px]" />
          </button>
          <button
            onClick={handleShuffle}
            className="w-10 h-10 sm:w-12 sm:h-12 text-neutral-400 hover:text-white transition-colors flex items-center justify-center"
            title="Shuffle play"
          >
            <Shuffle size={24} />
          </button>
        </div>
      )}

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
            <div className="w-10" />
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
                onContextMenu={(e) => handleContextMenu(e, track)}
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
                <button
                  onClick={(e) => { e.stopPropagation(); handleContextMenu(e, track); }}
                  className="md:opacity-0 md:group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-white mx-1 p-1"
                >
                  <MoreHorizontal size={18} />
                </button>
                <div className="hidden sm:block w-20 text-right pr-4 text-sm text-neutral-400">{formatDuration(track.durationMs / 1000)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <TrackContextMenu
          track={contextMenu.track}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
