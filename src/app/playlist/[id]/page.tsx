'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { Play, Loader2, Trash2, GripVertical, ArrowLeft, Music2 } from 'lucide-react';
import { usePlayerStore, Track } from '@/hooks/usePlayerStore';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

interface PlaylistTrack {
  id: string;
  track_id: string;
  track_name: string;
  track_artist: string;
  track_album_art: string;
  track_video_id: string;
  track_duration_ms: number;
  position: number;
}

interface PlaylistData {
  id: string;
  name: string;
  description: string;
  tracks: PlaylistTrack[];
}

function ptToTrack(pt: PlaylistTrack): Track {
  return {
    id: pt.track_id,
    name: pt.track_name,
    artist: pt.track_artist,
    albumArt: pt.track_album_art,
    videoId: pt.track_video_id,
    durationMs: pt.track_duration_ms,
  };
}

function SortableTrackRow({
  pt,
  index,
  isCurrent,
  isThisPlaying,
  onPlay,
  onRemove,
}: {
  pt: PlaylistTrack;
  index: number;
  isCurrent: boolean;
  isThisPlaying: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: pt.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center px-2 sm:px-4 py-2 rounded-md cursor-pointer transition-colors duration-150 ${isCurrent ? 'bg-white/10' : 'hover:bg-white/5'}`}
      onClick={onPlay}
    >
      <div className="hidden sm:flex w-8 justify-center" {...attributes} {...listeners}>
        <GripVertical size={14} className="text-neutral-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing" />
      </div>
      <div className="hidden sm:flex w-10 text-center justify-center items-center text-sm">
        {isThisPlaying ? (
          <div className="flex items-end gap-[3px] h-4">
            <span className="w-[3px] bg-green-500 rounded-full animate-[bounce_1s_ease-in-out_infinite]" style={{ height: '60%' }} />
            <span className="w-[3px] bg-green-500 rounded-full animate-[bounce_1s_ease-in-out_0.2s_infinite]" style={{ height: '100%' }} />
            <span className="w-[3px] bg-green-500 rounded-full animate-[bounce_1s_ease-in-out_0.4s_infinite]" style={{ height: '40%' }} />
          </div>
        ) : (
          <>
            <span className="group-hover:hidden text-neutral-400">{index + 1}</span>
            <Play size={14} className="hidden group-hover:block text-white fill-current" />
          </>
        )}
      </div>
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <img src={pt.track_album_art} alt={pt.track_name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className={`text-sm font-medium truncate ${isCurrent ? 'text-green-500' : 'text-white'}`}>{pt.track_name}</span>
          <span className="text-xs text-neutral-400 truncate">{pt.track_artist}</span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="md:opacity-0 md:group-hover:opacity-100 text-neutral-400 hover:text-red-400 transition-all mx-1 sm:mx-2 p-1"
      >
        <Trash2 size={16} />
      </button>
      <div className="hidden sm:block w-16 text-right text-sm text-neutral-400">
        {formatDuration(pt.track_duration_ms / 1000)}
      </div>
    </div>
  );
}

export default function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const { currentTrack, isPlaying, playTrack, togglePlayPause, setQueue } = usePlayerStore();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    fetch(`/api/playlists/${id}`)
      .then((r) => r.json())
      .then((data) => { if (data.id) setPlaylist(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, id]);

  const handlePlay = useCallback((pt: PlaylistTrack, index: number) => {
    const track = ptToTrack(pt);
    if (currentTrack?.id === track.id) { togglePlayPause(); return; }
    const tracks = playlist?.tracks.map(ptToTrack) || [];
    setQueue(tracks, index);
    playTrack(track);
  }, [currentTrack, togglePlayPause, setQueue, playlist, playTrack]);

  const handleRemoveTrack = async (pt: PlaylistTrack) => {
    if (!playlist) return;
    setPlaylist({ ...playlist, tracks: playlist.tracks.filter((t) => t.id !== pt.id) });
    try {
      await fetch(`/api/playlists/${id}/tracks?trackRowId=${pt.id}`, { method: 'DELETE' });
    } catch { toast.error('Failed to remove track'); }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!playlist) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = playlist.tracks.findIndex((t) => t.id === active.id);
    const newIndex = playlist.tracks.findIndex((t) => t.id === over.id);
    const newTracks = arrayMove(playlist.tracks, oldIndex, newIndex);
    setPlaylist({ ...playlist, tracks: newTracks });

    // Persist positions
    try {
      await fetch(`/api/playlists/${id}/tracks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: newTracks.map((t, i) => ({ id: t.id, position: i })) }),
      });
    } catch { toast.error('Failed to save order'); }
  };

  const handleDeletePlaylist = async () => {
    if (!confirm('Delete this playlist?')) return;
    try {
      await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
      router.push('/');
    } catch { toast.error('Failed to delete'); }
  };

  const handleRename = async () => {
    if (!playlist || !nameInput.trim()) return;
    setPlaylist({ ...playlist, name: nameInput.trim() });
    setEditingName(false);
    try {
      await fetch(`/api/playlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
    } catch {}
  };

  if (!session) {
    return <div className="flex items-center justify-center h-full text-neutral-500">Sign in to view playlists</div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 size={32} className="animate-spin text-neutral-500" /></div>;
  }

  if (!playlist) {
    return <div className="flex items-center justify-center h-full text-neutral-500">Playlist not found</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 pb-2 sm:pb-6">
        <div className="w-32 h-32 sm:w-48 sm:h-48 bg-gradient-to-br from-indigo-600 to-purple-800 rounded-lg flex items-center justify-center shadow-2xl flex-shrink-0">
          <Music2 size={48} className="text-white sm:hidden" />
          <Music2 size={64} className="text-white hidden sm:block" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-neutral-400 font-bold">Playlist</p>
          {editingName ? (
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="text-2xl sm:text-4xl font-extrabold text-white bg-transparent border-b border-white/20 outline-none mt-1 sm:mt-2 w-full"
              autoFocus
            />
          ) : (
            <h1
              className="text-3xl sm:text-5xl font-extrabold text-white mt-1 sm:mt-2 cursor-pointer hover:underline truncate"
              onClick={() => { setEditingName(true); setNameInput(playlist.name); }}
            >
              {playlist.name}
            </h1>
          )}
          <p className="text-sm text-neutral-400 mt-1 sm:mt-2">{playlist.tracks.length} tracks</p>
          <button onClick={handleDeletePlaylist} className="mt-2 sm:mt-3 text-xs text-neutral-500 hover:text-red-400 transition-colors">
            Delete playlist
          </button>
        </div>
      </div>

      {/* Track List */}
      {playlist.tracks.length === 0 ? (
        <p className="text-neutral-500 text-center py-10">No tracks yet. Search for songs and add them!</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={playlist.tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="hidden sm:flex px-4 py-2 text-xs uppercase tracking-wider text-neutral-500 border-b border-white/5 mb-1">
              <div className="w-8" />
              <div className="w-10 text-center">#</div>
              <div className="flex-1">Title</div>
              <div className="w-10" />
              <div className="w-16 text-right">Duration</div>
            </div>
            {playlist.tracks.map((pt, index) => {
              const isCurrent = currentTrack?.id === pt.track_id;
              return (
                <SortableTrackRow
                  key={pt.id}
                  pt={pt}
                  index={index}
                  isCurrent={isCurrent}
                  isThisPlaying={isCurrent && isPlaying}
                  onPlay={() => handlePlay(pt, index)}
                  onRemove={() => handleRemoveTrack(pt)}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
