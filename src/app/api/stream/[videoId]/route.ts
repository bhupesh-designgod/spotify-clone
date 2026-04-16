import type { NextRequest } from 'next/server';
import { resolveStreams, pickBestAudio } from '@/lib/server/upstream';

/**
 * Server-side audio passthrough.
 *
 * Used as a fallback when the direct googlevideo URL fails in the browser
 * (which happens for newer / IP-pinned / PoToken-gated tracks). We resolve
 * the upstream URL ourselves and proxy the bytes to the client so:
 *   - the browser only ever sees a same-origin URL (no CORS issues)
 *   - YouTube's IP binding and PoToken match the Vercel function, not the
 *     end user's phone or laptop
 *
 * Range requests are forwarded so iOS Safari can seek and so the audio
 * element receives 206 Partial Content like it expects from a real file.
 *
 * Edge runtime: streaming responses don't hit the serverless timeout, which
 * matters because a play session can last several minutes.
 */

export const runtime = 'edge';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await ctx.params;
  if (!videoId) {
    return new Response('Missing videoId', { status: 400 });
  }

  // We want raw googlevideo URLs here — the Vercel function fetches them and
  // pipes the bytes through, so going through *another* upstream proxy would
  // add a hop and risk bot-challenge HTML responses.
  const meta = await resolveStreams(videoId, 'direct');
  const audioUrl = pickBestAudio(meta?.audioStreams || [])?.url;
  if (!audioUrl) {
    return new Response('No audio stream available', { status: 502 });
  }

  // Forward the Range header so byte-range requests (seek, iOS playback)
  // produce 206 Partial Content responses.
  const upstreamHeaders: Record<string, string> = {
    // Some CDNs reject requests without a normal-looking UA.
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  };
  const range = request.headers.get('range');
  if (range) upstreamHeaders.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(audioUrl, { headers: upstreamHeaders });
  } catch (err) {
    return new Response(`Upstream fetch failed: ${(err as Error).message}`, {
      status: 502,
    });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Upstream returned ${upstream.status}`, {
      status: 502,
    });
  }

  // If the upstream came back with HTML (e.g. an Anubis bot challenge from a
  // proxy that snuck through the URL filter), refuse rather than ship HTML
  // bytes to the audio element.
  const upstreamCT = upstream.headers.get('content-type') || '';
  if (upstreamCT.includes('text/html')) {
    return new Response('Upstream blocked by bot challenge', { status: 502 });
  }

  // Pass through the upstream response headers, dropping hop-by-hop ones
  // and anything that would let the browser cache an expiring signed URL.
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    responseHeaders.set(key, value);
  });
  responseHeaders.set('Accept-Ranges', 'bytes');
  responseHeaders.set('Cache-Control', 'no-store');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ videoId: string }> }
) {
  // Some clients (including iOS Safari occasionally) HEAD before GET.
  const res = await GET(request, ctx);
  return new Response(null, { status: res.status, headers: res.headers });
}
