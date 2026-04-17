'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Search, Music, Clock, Play } from 'lucide-react';
import { usePlayerStore, Track } from '@/hooks/usePlayerStore';

const genres = [
  { name: 'Pop', color: 'from-pink-500 to-rose-600' },
  { name: 'Hip-Hop', color: 'from-amber-500 to-orange-600' },
  { name: 'Rock', color: 'from-red-500 to-red-700' },
  { name: 'Electronic', color: 'from-cyan-500 to-blue-600' },
  { name: 'R&B', color: 'from-purple-500 to-violet-700' },
  { name: 'Jazz', color: 'from-yellow-500 to-amber-700' },
  { name: 'Classical', color: 'from-emerald-500 to-teal-700' },
  { name: 'Indie', color: 'from-lime-500 to-green-700' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

interface HistoryItem {
  track_id: string;
  track_name: string;
  track_artist: string;
  track_album_art: string;
  track_video_id: string;
  track_duration_ms: number;
  played_at: string;
}

interface LikedItem {
  track_id: string;
  track_name: string;
  track_artist: string;
  track_album_art: string;
  track_video_id: string;
  track_duration_ms: number;
}

function toTrack(item: HistoryItem | LikedItem): Track {
  return {
    id: item.track_id,
    name: item.track_name,
    artist: item.track_artist,
    albumArt: item.track_album_art,
    streamUrl: item.track_video_id, // column stores the 320kbps stream URL
    durationMs: item.track_duration_ms,
  };
}

function TrackCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <div
      onClick={onPlay}
      className="group relative bg-white/5 hover:bg-white/10 rounded-md p-3 cursor-pointer transition-all duration-200"
    >
      <div className="relative mb-3">
        <img src={track.albumArt} alt={track.name} className="w-full aspect-square rounded-md object-cover shadow-lg" />
        <button className="absolute bottom-2 right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200">
          <Play size={18} className="text-black fill-black translate-x-[1px]" />
        </button>
      </div>
      <p className="text-sm font-medium text-white truncate">{track.name}</p>
      <p className="text-xs text-neutral-400 truncate mt-0.5">{track.artist}</p>
    </div>
  );
}

function TrackRow({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <div
      onClick={onPlay}
      className="flex items-center bg-white/5 hover:bg-white/10 transition-colors duration-200 rounded overflow-hidden cursor-pointer group"
    >
      <img src={track.albumArt} alt={track.name} className="w-20 h-20 object-cover flex-shrink-0" />
      <span className="text-white font-semibold px-4 truncate flex-1">{track.name}</span>
      <div className="pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
          <Play size={14} className="text-black fill-black translate-x-[1px]" />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session } = useSession();
  const { playTrack, setQueue } = usePlayerStore();
  const [recentHistory, setRecentHistory] = useState<Track[]>([]);
  const [likedSongs, setLikedSongs] = useState<Track[]>([]);
  const [topPlayed, setTopPlayed] = useState<Track[]>([]);

  useEffect(() => {
    if (!session) return;

    // Fetch recent history (last 10 unique)
    fetch('/api/history?limit=30')
      .then((r) => r.json())
      .then((data: HistoryItem[]) => {
        if (!Array.isArray(data)) return;
        const seen = new Set<string>();
        const unique: Track[] = [];
        for (const item of data) {
          if (!seen.has(item.track_id) && unique.length < 10) {
            seen.add(item.track_id);
            unique.push(toTrack(item));
          }
        }
        setRecentHistory(unique);

        // Calculate top played (most frequent in history)
        const counts: Record<string, { count: number; track: Track }> = {};
        for (const item of data) {
          if (!counts[item.track_id]) {
            counts[item.track_id] = { count: 0, track: toTrack(item) };
          }
          counts[item.track_id].count++;
        }
        const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 6);
        setTopPlayed(sorted.map((s) => s.track));
      })
      .catch(() => {});

    // Fetch liked songs (for "Because you liked" section)
    fetch('/api/likes')
      .then((r) => r.json())
      .then((data: LikedItem[]) => {
        if (Array.isArray(data)) {
          setLikedSongs(data.slice(0, 6).map(toTrack));
        }
      })
      .catch(() => {});
  }, [session]);

  const handlePlayTrack = useCallback((track: Track, tracks: Track[], index: number) => {
    setQueue(tracks, index);
    playTrack(track);
  }, [playTrack, setQueue]);

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{getGreeting()}</h1>
        <p className="text-sm sm:text-base text-neutral-400">
          {session ? `Welcome back, ${session.user?.name?.split(' ')[0]}` : 'What do you feel like listening to?'}
        </p>
      </div>

      {/* Quick Start Cards — only shown to signed-in users; signed-out users
          get a single Search CTA so the page doesn't look broken. */}
      {session ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link href="/search" className="flex items-center bg-white/5 hover:bg-white/10 transition-colors duration-200 rounded overflow-hidden group">
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
              <Search size={28} className="text-white" />
            </div>
            <span className="text-white font-semibold px-4 group-hover:underline">Search Songs</span>
          </Link>

          <Link href="/liked" className="flex items-center bg-white/5 hover:bg-white/10 transition-colors duration-200 rounded overflow-hidden group">
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Music size={28} className="text-white" />
            </div>
            <span className="text-white font-semibold px-4 group-hover:underline">Liked Songs</span>
          </Link>

          <Link href="/history" className="flex items-center bg-white/5 hover:bg-white/10 transition-colors duration-200 rounded overflow-hidden group">
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
              <Clock size={28} className="text-white" />
            </div>
            <span className="text-white font-semibold px-4 group-hover:underline">Recently Played</span>
          </Link>
        </div>
      ) : (
        <Link href="/search" className="flex items-center bg-white/5 hover:bg-white/10 transition-colors duration-200 rounded overflow-hidden group max-w-md">
          <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
            <Search size={28} className="text-white" />
          </div>
          <span className="text-white font-semibold px-4 group-hover:underline">Search Songs</span>
        </Link>
      )}

      {/* Personalized Sections (logged in only) */}
      {session && recentHistory.length > 0 && (
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Recently Played</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {recentHistory.slice(0, 5).map((track, i) => (
              <TrackCard key={track.id + i} track={track} onPlay={() => handlePlayTrack(track, recentHistory, i)} />
            ))}
          </div>
        </div>
      )}

      {session && topPlayed.length > 0 && (
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Your Top Mix</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {topPlayed.slice(0, 5).map((track, i) => (
              <TrackCard key={track.id + i} track={track} onPlay={() => handlePlayTrack(track, topPlayed, i)} />
            ))}
          </div>
        </div>
      )}

      {session && likedSongs.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Because you liked</h2>
            <span className="text-green-500 font-bold text-base sm:text-lg truncate max-w-full">{likedSongs[0]?.name}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {likedSongs.slice(1, 6).map((track, i) => (
              <TrackCard key={track.id + i} track={track} onPlay={() => handlePlayTrack(track, likedSongs, i + 1)} />
            ))}
          </div>
        </div>
      )}

      {/* Browse by Genre — always visible */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Browse All</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {genres.map((genre) => (
            <Link
              key={genre.name}
              href="/search"
              className={`relative h-24 sm:h-32 rounded-lg overflow-hidden bg-gradient-to-br ${genre.color} p-3 sm:p-4 hover:scale-[1.03] transition-transform duration-200 shadow-lg`}
            >
              <span className="text-white font-bold text-lg sm:text-xl">{genre.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
