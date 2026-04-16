import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

// GET — list user's playlists
export async function GET() {
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('playlists')
    .select('*, playlist_tracks(count)')
    .eq('user_id', dbId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — create playlist
export async function POST(request: NextRequest) {
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, description } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Playlist name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('playlists')
    .insert({
      user_id: dbId,
      name: name.trim(),
      description: description?.trim() || '',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
