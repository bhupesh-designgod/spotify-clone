'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Track } from '@/hooks/usePlayerStore';

export function useLikedSongs(trackIds?: string[]) {
  const { data: session } = useSession();
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Fetch liked status for a batch of track IDs
  useEffect(() => {
    if (!session || !trackIds || trackIds.length === 0) return;

    const check = async () => {
      try {
        const res = await fetch(`/api/likes/check?trackIds=${trackIds.join(',')}`);
        if (res.ok) {
          const ids: string[] = await res.json();
          setLikedSet(new Set(ids));
        }
      } catch {}
    };
    check();
  }, [session, trackIds?.join(',')]);

  const isLiked = useCallback((trackId: string) => likedSet.has(trackId), [likedSet]);

  const toggleLike = useCallback(async (track: Track) => {
    if (!session) return;

    const wasLiked = likedSet.has(track.id);

    // Optimistic update
    setLikedSet((prev) => {
      const next = new Set(prev);
      if (wasLiked) {
        next.delete(track.id);
      } else {
        next.add(track.id);
      }
      return next;
    });

    try {
      if (wasLiked) {
        await fetch(`/api/likes?trackId=${encodeURIComponent(track.id)}`, { method: 'DELETE' });
      } else {
        await fetch('/api/likes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            track_id: track.id,
            track_name: track.name,
            track_artist: track.artist,
            track_album_art: track.albumArt,
            track_video_id: track.videoId || '',
            track_duration_ms: track.durationMs,
          }),
        });
      }
    } catch {
      // Revert on error
      setLikedSet((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(track.id);
        else next.delete(track.id);
        return next;
      });
    }
  }, [session, likedSet]);

  return { isLiked, toggleLike, likedSet, isLoggedIn: !!session };
}
