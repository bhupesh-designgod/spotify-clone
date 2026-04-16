import { NextRequest, NextResponse } from 'next/server';
import { resolveSearch, resolveStreams } from '@/lib/server/upstream';

/**
 * Backend-agnostic proxy that the client (src/lib/piped.ts) speaks to.
 * All upstream selection / Invidious translation lives in @/lib/server/upstream.
 */

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Missing "path" query param' }, { status: 400 });
  }

  if (path.startsWith('/streams/')) {
    const videoId = path.slice('/streams/'.length);
    const data = await resolveStreams(videoId);
    if (data) return NextResponse.json(data);
  } else if (path === '/search') {
    const q = searchParams.get('q') || '';
    const data = await resolveSearch(q);
    if (data) return NextResponse.json(data);
  }

  return NextResponse.json(
    { error: 'All upstream instances failed' },
    { status: 502 }
  );
}
