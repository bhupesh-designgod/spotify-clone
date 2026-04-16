-- Spotify Clone Database Schema
-- Run this in the Supabase SQL Editor

-- Users table (auto-created on first sign-in)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Liked songs
CREATE TABLE IF NOT EXISTS liked_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  track_artist TEXT,
  track_album_art TEXT,
  track_video_id TEXT,
  track_duration_ms INT,
  liked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, track_id)
);

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playlist tracks
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE NOT NULL,
  track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  track_artist TEXT,
  track_album_art TEXT,
  track_video_id TEXT,
  track_duration_ms INT,
  position INT NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Play history (every play = new row)
CREATE TABLE IF NOT EXISTS play_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  track_artist TEXT,
  track_album_art TEXT,
  track_video_id TEXT,
  track_duration_ms INT,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_liked_songs_user ON liked_songs(user_id);
CREATE INDEX IF NOT EXISTS idx_liked_songs_user_track ON liked_songs(user_id, track_id);
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_play_history_user ON play_history(user_id);
CREATE INDEX IF NOT EXISTS idx_play_history_user_played ON play_history(user_id, played_at DESC);
