import { NextRequest, NextResponse } from 'next/server';

const PIPED_INSTANCES = [
  'https://pipedapi.in.projectsegfau.lt',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.smnz.de',
  'https://pipedapi.r4fo.com',
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Missing "path" query param' }, { status: 400 });
  }

  // Build the remaining query params (exclude "path")
  const otherParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'path') otherParams.append(key, value);
  });
  const queryString = otherParams.toString();
  const fullPath = `${path}${queryString ? `?${queryString}` : ''}`;

  for (const instance of PIPED_INSTANCES) {
    try {
      const url = `${instance}${fullPath}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: 'All Piped API instances failed' },
    { status: 502 }
  );
}
