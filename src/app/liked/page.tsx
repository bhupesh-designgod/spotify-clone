'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, Play, Loader2, Shuffle, MoreHorizontal } from 'lucide-react';
import { usePlayerStore, Track } from '@/hooks/usePlayerStore';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import TrackContextMenu from '@/components/TrackContextMenu';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

interface LikedSong {
  id: string;
  track_id: string;
  track_name: string;
  track_artist: string;
  track_album_art: string;
  track_video_id: string;
  track_duration_ms: number;
  liked_at: string;
}

function likedSongToTrack(song: LikedSong): Track {
  return {
    id: song.track_id,
    name: song.track_name,
    artist: song.track_artist,
    albumArt: song.track_album_art,
    streamUrl: song.track_video_id,
    durationMs: song.track_duration_ms,
  };
}

export default function LikedSongsPage() {
  const { data: session } = useSession();
  const [songs, setSongs] = useState<LikedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentTrack, isPlaying, playTrack, togglePlayPause, isLoading, setQueue, shuffleAndPlay } = usePlayerStore();
  const [contextMenu, setContextMenu] = useState<{ track: Track; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    fetch('/api/likes')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSongs(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  const handlePlay = useCallback((song: LikedSong, index: number) => {
    const track = likedSongToTrack(song);
    if (currentTrack?.id === track.id) { togglePlayPause(); return; }
    const tracks = songs.map(likedSongToTrack);
    setQueue(tracks, index);
    playTrack(track);
  }, [currentTrack, togglePlayPause, setQueue, songs, playTrack]);

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    const tracks = songs.map(likedSongToTrack);
    setQueue(tracks, 0);
    playTrack(tracks[0]);
  };

  const handleShuffle = () => {
    if (songs.length === 0) return;
    shuffleAndPlay(songs.map(likedSongToTrack));
  };

  const handleUnlike = async (song: LikedSong) => {
    setSongs((prev) => prev.filter((s) => s.id !== song.id));
    try {
      await fetch(`/api/likes?trackId=${encodeURIComponent(song.track_id)}`, { method: 'DELETE' });
    } catch {
      toast.error('Failed to unlike');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    setContextMenu({ track, x: e.clientX, y: e.clientY });
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
        <Heart size={48} />
        <p>Sign in to see your liked songs</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" onClick={(e) => { if (contextMenu && !(e.target as HTMLElement).closest('[data-context-menu]')) setContextMenu(null); }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 pb-2 sm:pb-6">
        <div className="w-32 h-32 sm:w-48 sm:h-48 bg-gradient-to-br from-purple-700 to-blue-400 rounded-lg flex items-center justify-center shadow-2xl">
          <Heart size={48} className="text-white fill-white sm:hidden" />
          <Heart size={64} className="text-white fill-white hidden sm:block" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-400 font-bold">Playlist</p>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white mt-1 sm:mt-2">Liked Songs</h1>
          <p className="text-sm text-neutral-400 mt-1 sm:mt-2">{songs.length} songs</p>
        </div>
      </div>

      {/* Play All + Shuffle */}
      {songs.length > 0 && (
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
      ) : songs.length === 0 ? (
        <p className="text-neutral-500 text-center py-10">Songs you like will appear here</p>
      ) : (
        <div>
          <div className="hidden sm:flex px-4 py-2 text-xs uppercase tracking-wider text-neutral-500 border-b border-white/5 mb-1">
            <div className="w-12 text-center">#</div>
            <div className="flex-1">Title</div>
            <div className="w-10" />
            <div className="w-10" />
            <div className="w-20 text-right pr-4">Duration</div>
          </div>

          {songs.map((song, index) => {
            const track = likedSongToTrack(song);
            const isCurrent = currentTrack?.id === track.id;
            const isThisPlaying = isCurrent && isPlaying;

            return (
              <div
                key={song.id}
                className={`group flex items-center px-2 sm:px-4 py-2 rounded-md cursor-pointer transition-colors duration-150 ${isCurrent ? 'bg-white/10' : 'hover:bg-white/5'}`}
                onClick={() => handlePlay(song, index)}
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
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnlike(song); }}
                  className="w-10 flex justify-center p-1"
                >
                  <Heart size={18} className="text-green-500 fill-green-500 hover:text-green-400" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleContextMenu(e, track); }}
                  className="md:opacity-0 md:group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-white mx-1 p-1"
                >
                  <MoreHorizontal size={18} />
                </button>
                <div className="hidden sm:block w-20 text-right pr-4 text-sm text-neutral-400">
                  {formatDuration(track.durationMs / 1000)}
                </div>
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
