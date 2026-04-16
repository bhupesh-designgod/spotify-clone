import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyToken } from '@/lib/spotify';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const spotifyPath = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `https://api.spotify.com/v1/${spotifyPath}${searchParams ? `?${searchParams}` : ''}`;

    let token: string;
    try {
      token = await getSpotifyToken();
    } catch (e: any) {
      if (e.message.includes('missing in environment variables')) {
        return NextResponse.json(
          { error: 'Spotify Credentials missing. Please add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local' },
          { status: 500 }
        );
      }
      throw e;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Spotify API Proxy Error:', response.status, errorText);
      return NextResponse.json({ error: 'Failed to fetch from Spotify API' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Spotify Edge Route Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
