import type { NextRequest } from 'next/server';
import { resolveStreams, pickBestAudio } from '@/lib/server/upstream';

/**
 * Server-side audio passthrough.
 *
 * The browser sets this as the <audio> src directly (e.g. /api/stream/dQw4w9WgXcQ).
 * We resolve the upstream audio URL server-side (racing Piped + Invidious) and
 * stream the bytes to the client. This avoids:
 *   - CORS issues (same-origin URL for the browser)
 *   - IP-pinning (upstream URL is fetched by our server, not the client)
 *   - PoToken / bot-challenge failures (handled upstream)
 *
 * Range requests are forwarded so iOS Safari can seek and receives
 * 206 Partial Content responses as expected.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

async function handleRequest(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> }
): Promise<Response> {
  const { videoId } = await ctx.params;
  if (!videoId) {
    return new Response('Missing videoId', { status: 400 });
  }

  const meta = await resolveStreams(videoId);
  const audioStream = pickBestAudio(meta?.audioStreams || []);
  if (!audioStream?.url) {
    return new Response('No audio stream available', { status: 502 });
  }

  const upstreamHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  };
  const range = request.headers.get('range');
  if (range) upstreamHeaders.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(audioStream.url, {
      headers: upstreamHeaders,
      redirect: 'follow',
    });
  } catch (err) {
    return new Response(`Upstream fetch failed: ${(err as Error).message}`, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Upstream returned ${upstream.status}`, { status: 502 });
  }

  // Reject bot-challenge HTML pages masquerading as audio
  const ct = upstream.headers.get('content-type') || '';
  if (ct.includes('text/html')) {
    return new Response('Upstream blocked by bot challenge', { status: 502 });
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    responseHeaders.set(key, value);
  });
  responseHeaders.set('Accept-Ranges', 'bytes');
  responseHeaders.set('Cache-Control', 'no-store');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> }
) {
  return handleRequest(request, ctx);
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> }
) {
  const res = await handleRequest(request, ctx);
  return new Response(null, { status: res.status, headers: res.headers });
}
