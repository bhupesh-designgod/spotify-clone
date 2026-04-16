import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

// POST — add track to playlist
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify ownership
  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', id)
    .eq('user_id', dbId)
    .single();
  if (!playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();

  // Get max position
  const { data: maxPos } = await supabase
    .from('playlist_tracks')
    .select('position')
    .eq('playlist_id', id)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const nextPos = (maxPos?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('playlist_tracks')
    .insert({
      playlist_id: id,
      track_id: body.track_id,
      track_name: body.track_name,
      track_artist: body.track_artist || '',
      track_album_art: body.track_album_art || '',
      track_video_id: body.track_video_id || '',
      track_duration_ms: body.track_duration_ms || 0,
      position: nextPos,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT — reorder tracks (bulk update positions)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { tracks } = body; // Array of { id, position }

  if (!Array.isArray(tracks)) {
    return NextResponse.json({ error: 'tracks array required' }, { status: 400 });
  }

  // Update each track position
  for (const t of tracks) {
    await supabase
      .from('playlist_tracks')
      .update({ position: t.position })
      .eq('id', t.id)
      .eq('playlist_id', id);
  }

  return NextResponse.json({ success: true });
}

// DELETE — remove track from playlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const trackRowId = searchParams.get('trackRowId');
  if (!trackRowId) return NextResponse.json({ error: 'Missing trackRowId' }, { status: 400 });

  const { error } = await supabase
    .from('playlist_tracks')
    .delete()
    .eq('id', trackRowId)
    .eq('playlist_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
