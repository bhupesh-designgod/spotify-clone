export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: string | null = null;
let tokenExpirationTime: number = 0;

export async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpirationTime) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify Client ID or Secret is missing in environment variables.');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store', // ensures we don't cache locally in Next.js statically
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Spotify token: ${response.statusText}`);
  }

  const data: SpotifyTokenResponse = await response.json();
  cachedToken = data.access_token;
  // Subtracting 5 minutes (300000ms) to ensure we refresh before it actually expires
  tokenExpirationTime = Date.now() + (data.expires_in * 1000) - 300000;

  return cachedToken;
}

export async function spotifyApiFetch(endpoint: string, options: RequestInit = {}) {
  const token = await getSpotifyToken();

  return fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
