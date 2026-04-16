import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

// GET — get playlist with tracks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: playlist, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', id)
    .eq('user_id', dbId)
    .single();

  if (error || !playlist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: tracks } = await supabase
    .from('playlist_tracks')
    .select('*')
    .eq('playlist_id', id)
    .order('position', { ascending: true });

  return NextResponse.json({ ...playlist, tracks: tracks || [] });
}

// PATCH — update playlist name/description
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, any> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description.trim();

  const { data, error } = await supabase
    .from('playlists')
    .update(updates)
    .eq('id', id)
    .eq('user_id', dbId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — delete playlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', id)
    .eq('user_id', dbId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
