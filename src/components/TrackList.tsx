'use client';

import { usePlayerStore, Track } from '@/hooks/usePlayerStore';
import { Play, Pause } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';

interface TrackListProps {
  tracks: Track[];
  showAlbumArt?: boolean;
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function TrackList({ tracks, showAlbumArt = true }: TrackListProps) {
  const { currentTrack, isPlaying, playTrack, togglePlayPause, isLoading, clearQueue } = usePlayerStore();

  const handlePlay = async (track: Track, index: number) => {
    if (currentTrack?.id === track.id) {
       togglePlayPause();
       return;
    }
    
    // Create queue from this point onwards
    clearQueue();
    const store = usePlayerStore.getState();
    tracks.slice(index).forEach(t => store.addToQueue(t));
    
    try {
      await playTrack(track);
      const error = usePlayerStore.getState().error;
      if (error) {
        toast.error(error);
      }
    } catch (e) {
      toast.error('Failed to play track');
    }
  };

  return (
    <div className="flex flex-col w-full text-neutral-400">
      <div className="flex px-4 py-2 text-xs uppercase tracking-wider border-b border-neutral-800 mb-2">
        <div className="w-12 text-center text-neutral-400">#</div>
        <div className="flex-1">Title</div>
        <div className="w-24 text-right pr-4">Duration</div>
      </div>

      {tracks.map((track, index) => {
        const isCurrent = currentTrack?.id === track.id;
        
        return (
          <div 
            key={track.id} 
            className="group flex items-center px-4 py-2 hover:bg-white/10 rounded-md transition cursor-pointer"
            onDoubleClick={() => handlePlay(track, index)}
          >
            <div className="w-12 text-center flex justify-center text-sm relative">
               {isCurrent && isPlaying ? (
                 <div className="flex items-end gap-[2px] h-4 text-green-500">
                   <div className="w-1 bg-green-500 animate-pulse h-3" />
                   <div className="w-1 bg-green-500 animate-[pulse_1s_infinite] h-4" />
                   <div className="w-1 bg-green-500 animate-[pulse_1.5s_infinite] h-2" />
                 </div>
               ) : isCurrent ? (
                 <span className="text-green-500">{index + 1}</span>
               ) : (
                 <>
                   <span className="group-hover:hidden">{index + 1}</span>
                   <button 
                     onClick={(e) => { e.stopPropagation(); handlePlay(track, index); }} 
                     className="hidden group-hover:block text-white"
                   >
                     <Play size={16} className="fill-current" />
                   </button>
                 </>
               )}
            </div>

            <div className="flex-1 flex items-center gap-3">
              {showAlbumArt && track.albumArt && (
                 <img src={track.albumArt} alt={track.name} className="w-10 h-10 rounded" />
              )}
              <div className="flex flex-col">
                <span className={clsx("text-base truncate", isCurrent ? "text-green-500" : "text-white")}>
                  {track.name}
                </span>
                <span className="text-sm truncate text-neutral-400 group-hover:text-white transition">
                  {track.artist}
                </span>
              </div>
            </div>

            <div className="w-24 text-right pr-4 text-sm text-neutral-400">
              {formatDuration(track.durationMs)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
