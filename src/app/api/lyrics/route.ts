import { NextRequest, NextResponse } from 'next/server';

// Proxy to LRCLIB to avoid CORS
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackName = searchParams.get('track_name');
  const artistName = searchParams.get('artist_name');
  const duration = searchParams.get('duration');
  const albumName = searchParams.get('album_name');

  if (!trackName || !artistName) {
    return NextResponse.json({ error: 'track_name and artist_name required' }, { status: 400 });
  }

  const params = new URLSearchParams({ track_name: trackName, artist_name: artistName });
  if (duration) params.set('duration', duration);
  if (albumName) params.set('album_name', albumName);

  try {
    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { 'User-Agent': 'SpotifyClone/1.0' },
    });

    if (!res.ok) {
      // If album was included, retry without it
      if (albumName) {
        params.delete('album_name');
        const retry = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
          headers: { 'User-Agent': 'SpotifyClone/1.0' },
        });
        if (retry.ok) {
          const data = await retry.json();
          return NextResponse.json(data);
        }
      }
      return NextResponse.json({ error: 'No lyrics found' }, { status: 404 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch lyrics' }, { status: 500 });
  }
}
