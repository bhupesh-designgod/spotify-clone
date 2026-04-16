import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

// GET — list liked songs for current user
export async function GET() {
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('liked_songs')
    .select('*')
    .eq('user_id', dbId)
    .order('liked_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — like a song
export async function POST(request: NextRequest) {
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { track_id, track_name, track_artist, track_album_art, track_video_id, track_duration_ms } = body;

  if (!track_id || !track_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('liked_songs')
    .upsert(
      {
        user_id: dbId,
        track_id,
        track_name,
        track_artist: track_artist || '',
        track_album_art: track_album_art || '',
        track_video_id: track_video_id || '',
        track_duration_ms: track_duration_ms || 0,
        liked_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,track_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — unlike a song
export async function DELETE(request: NextRequest) {
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('trackId');

  if (!trackId) return NextResponse.json({ error: 'Missing trackId' }, { status: 400 });

  const { error } = await supabase
    .from('liked_songs')
    .delete()
    .eq('user_id', dbId)
    .eq('track_id', trackId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
