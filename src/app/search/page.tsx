'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search as SearchIcon, Play, Pause, Loader2, Heart, MoreHorizontal } from 'lucide-react';
import { usePlayerStore, Track } from '@/hooks/usePlayerStore';
import { searchPiped, PipedSearchItem } from '@/lib/piped';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { Skeleton } from '@/components/ui/skeleton';
import TrackContextMenu from '@/components/TrackContextMenu';
import { toast } from 'sonner';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function pipedItemToTrack(item: PipedSearchItem): Track {
  return {
    id: item.url,
    name: item.title,
    artist: item.uploaderName?.replace(' - Topic', '') || 'Unknown',
    durationMs: item.duration * 1000,
    albumArt: item.thumbnail,
    videoId: item.url.replace('/watch?v=', ''),
  };
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ track: Track; x: number; y: number } | null>(null);

  const { currentTrack, isPlaying, playTrack, togglePlayPause, isLoading, setQueue } =
    usePlayerStore();

  const trackIds = useMemo(() => results.map((t) => t.id), [results]);
  const { isLiked, toggleLike, isLoggedIn } = useLikedSongs(trackIds);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const doSearch = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await searchPiped(debouncedQuery);
        if (cancelled) return;
        setResults(items.map(pipedItemToTrack));
      } catch (e: any) {
        if (cancelled) return;
        setError(e.message || 'Search failed. Try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doSearch();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const handlePlay = useCallback(
    async (track: Track, index: number) => {
      if (currentTrack?.id === track.id) {
        togglePlayPause();
        return;
      }
      setQueue(results, index);
      try {
        await playTrack(track);
        const err = usePlayerStore.getState().error;
        if (err) toast.error(err);
      } catch {
        toast.error('Failed to play track');
      }
    },
    [currentTrack, togglePlayPause, setQueue, results, playTrack]
  );

  const handleContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    setContextMenu({ track, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex flex-col gap-6 h-full" onClick={(e) => { if (contextMenu && !(e.target as HTMLElement).closest('[data-context-menu]')) setContextMenu(null); }}>
      {/* Search Input */}
      <div className="relative w-full max-w-lg">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
        <input
          type="text"
          placeholder="What do you want to listen to?"
          className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/15 border border-transparent focus:border-white/20 outline-none rounded-full py-3 pl-12 pr-4 text-white placeholder-neutral-500 transition-all duration-200"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-2 mt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-12 w-12 rounded bg-white/10" />
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="h-4 w-2/5 bg-white/10" />
                  <Skeleton className="h-3 w-1/4 bg-white/10" />
                </div>
                <Skeleton className="h-3 w-10 bg-white/10" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-red-400 mt-6 text-center text-sm">{error}</div>
        ) : results.length > 0 ? (
          <>
            <h2 className="text-xl font-bold text-white mb-3">Songs</h2>
            <div className="hidden sm:flex px-4 py-2 text-xs uppercase tracking-wider text-neutral-500 border-b border-white/5 mb-1">
              <div className="w-12 text-center">#</div>
              <div className="flex-1">Title</div>
              <div className="w-10" />
              <div className="w-20 text-right pr-4">Duration</div>
            </div>

            {results.map((track, index) => {
              const isCurrent = currentTrack?.id === track.id;
              const isThisPlaying = isCurrent && isPlaying;
              const isThisLoading = isCurrent && isLoading;
              const liked = isLiked(track.id);

              return (
                <div
                  key={track.id}
                  className={`group flex items-center px-2 sm:px-4 py-2 rounded-md cursor-pointer transition-colors duration-150 ${
                    isCurrent ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                  onClick={() => handlePlay(track, index)}
                  onContextMenu={(e) => handleContextMenu(e, track)}
                >
                  {/* Number / Play icon */}
                  <div className="hidden sm:flex w-12 text-center justify-center items-center text-sm">
                    {isThisLoading ? (
                      <Loader2 size={16} className="animate-spin text-green-500" />
                    ) : isThisPlaying ? (
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

                  {/* Track Info */}
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <img src={track.albumArt} alt={track.name} className="w-11 h-11 sm:w-12 sm:h-12 rounded object-cover flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm font-medium truncate ${isCurrent ? 'text-green-500' : 'text-white'}`}>
                        {track.name}
                      </span>
                      <span className="text-xs text-neutral-400 truncate">{track.artist}</span>
                    </div>
                  </div>

                  {/* Like + Menu */}
                  <div className="flex items-center gap-2 w-10">
                    {isLoggedIn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleLike(track); }}
                        className="md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1"
                      >
                        <Heart
                          size={18}
                          className={liked ? 'text-green-500 fill-green-500' : 'text-neutral-400 hover:text-white'}
                        />
                      </button>
                    )}
                  </div>

                  {/* Three dot menu */}
                  {isLoggedIn && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleContextMenu(e as any, track); }}
                      className="md:opacity-0 md:group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-white mx-1 p-1"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  )}

                  {/* Duration */}
                  <div className="hidden sm:block w-20 text-right pr-4 text-sm text-neutral-400">
                    {formatDuration(track.durationMs / 1000)}
                  </div>
                </div>
              );
            })}
          </>
        ) : debouncedQuery ? (
          <div className="text-neutral-500 mt-8 text-center text-sm">
            No results found for &ldquo;{debouncedQuery}&rdquo;
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center mt-20 gap-4 text-neutral-500">
            <SearchIcon size={48} strokeWidth={1} />
            <p className="text-lg">Search for songs, artists, or albums</p>
          </div>
        )}
      </div>

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
