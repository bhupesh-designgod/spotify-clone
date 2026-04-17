'use client';

import { useEffect, useState, useRef } from 'react';
import { ListPlus, ListMusic, ChevronRight } from 'lucide-react';
import { Track, usePlayerStore } from '@/hooks/usePlayerStore';
import { toast } from 'sonner';

interface Props {
  track: Track;
  x: number;
  y: number;
  onClose: () => void;
}

interface Playlist {
  id: string;
  name: string;
}

export default function TrackContextMenu({ track, x, y, onClose }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use setTimeout to prevent the opening click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // Fetch playlists on mount
  useEffect(() => {
    fetch('/api/playlists')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPlaylists(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(track);
    toast.success('Added to queue');
    onClose();
  };

  const handleTogglePlaylists = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowPlaylists(!showPlaylists);
  };

  const handleAddToPlaylist = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: track.id,
          track_name: track.name,
          track_artist: track.artist,
          track_album_art: track.albumArt,
          track_video_id: track.streamUrl || '',
          track_duration_ms: track.durationMs,
        }),
      });
      if (res.ok) {
        toast.success('Added to playlist');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to add');
      }
    } catch {
      toast.error('Failed to add');
    }
    onClose();
  };

  // Adjust position to stay within viewport
  const menuWidth = 220;
  const menuHeight = 120;
  const adjustedX = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1400) - menuWidth - 10);
  const adjustedY = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - menuHeight - 10);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: adjustedX, top: adjustedY, zIndex: 100 }}
      className="w-52 bg-neutral-800 rounded-md shadow-2xl border border-neutral-700 py-1 text-sm"
      data-context-menu="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleAddToQueue}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
      >
        <ListPlus size={16} />
        Add to Queue
      </button>

      <div className="relative">
        <button
          onClick={handleTogglePlaylists}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
        >
          <ListMusic size={16} />
          <span className="flex-1 text-left">Add to Playlist</span>
          <ChevronRight size={14} className={`transition-transform ${showPlaylists ? 'rotate-90' : ''}`} />
        </button>

        {showPlaylists && (
          <div className="border-t border-neutral-700 bg-neutral-800">
            {loading ? (
              <p className="px-3 py-2 text-neutral-500 text-xs">Loading...</p>
            ) : playlists.length === 0 ? (
              <p className="px-3 py-2 text-neutral-500 text-xs">No playlists yet. Create one first!</p>
            ) : (
              playlists.map((p) => (
                <button
                  key={p.id}
                  onClick={(e) => handleAddToPlaylist(e, p.id)}
                  className="w-full text-left px-6 py-2 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors truncate text-xs"
                >
                  ♪ {p.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
