import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

// GET /api/likes/check?trackIds=id1,id2,id3
// Returns array of track_ids that are liked
export async function GET(request: NextRequest) {
  const session = await auth();
  const dbId = (session?.user as any)?.dbId;
  if (!dbId) return NextResponse.json([]);

  const { searchParams } = new URL(request.url);
  const trackIdsParam = searchParams.get('trackIds');
  if (!trackIdsParam) return NextResponse.json([]);

  const trackIds = trackIdsParam.split(',').filter(Boolean);
  if (trackIds.length === 0) return NextResponse.json([]);

  const { data, error } = await supabase
    .from('liked_songs')
    .select('track_id')
    .eq('user_id', dbId)
    .in('track_id', trackIds);

  if (error) return NextResponse.json([]);
  return NextResponse.json(data?.map((d: any) => d.track_id) || []);
}
