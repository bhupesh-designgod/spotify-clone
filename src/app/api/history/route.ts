import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

// GET — recent play history
export async function GET(request: NextRequest) {
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const { data, error } = await supabase
    .from('play_history')
    .select('*')
    .eq('user_id', dbId)
    .order('played_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — log a play
export async function POST(request: NextRequest) {
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from('play_history')
    .insert({
      user_id: dbId,
      track_id: body.track_id,
      track_name: body.track_name,
      track_artist: body.track_artist || '',
      track_album_art: body.track_album_art || '',
      track_video_id: body.track_video_id || '',
      track_duration_ms: body.track_duration_ms || 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
