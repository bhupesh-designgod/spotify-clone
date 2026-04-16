'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Home, Search, Library, Heart, Clock, Plus, Music, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Playlist {
  id: string;
  name: string;
}

export default function Sidebar() {
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!session) return;
    fetch('/api/playlists')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPlaylists(data); })
      .catch(() => {});
  }, [session]);

  const handleCreatePlaylist = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: '' }),
      });
      if (res.ok) {
        const pl = await res.json();
        setPlaylists((prev) => [pl, ...prev]);
        setNewName('');
        setShowCreateModal(false);
        toast.success('Playlist created');
      }
    } catch {}
  };

  const handleDeletePlaylist = async (e: React.MouseEvent, playlistId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
      if (res.ok) {
        setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
        toast.success('Playlist deleted');
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="hidden md:flex w-64 bg-black p-6 flex-col gap-6 text-neutral-400 flex-shrink-0">
      <div className="flex flex-col gap-1">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start gap-4 hover:text-white transition-colors duration-200">
            <Home size={24} />
            <span className="font-semibold text-base">Home</span>
          </Button>
        </Link>
        <Link href="/search">
          <Button variant="ghost" className="w-full justify-start gap-4 hover:text-white transition-colors duration-200">
            <Search size={24} />
            <span className="font-semibold text-base">Search</span>
          </Button>
        </Link>
        <Button variant="ghost" className="w-full justify-start gap-4 hover:text-white transition-colors duration-200">
          <Library size={24} />
          <span className="font-semibold text-base">Your Library</span>
        </Button>
      </div>

      {session && (
        <div className="mt-2 pt-4 border-t border-neutral-800 flex flex-col gap-1">
          <Link href="/liked">
            <Button variant="ghost" className="w-full justify-start gap-3 hover:text-white transition-colors duration-200 text-sm">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-600 to-blue-400 flex items-center justify-center">
                <Heart size={12} className="text-white fill-white" />
              </div>
              Liked Songs
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="ghost" className="w-full justify-start gap-3 hover:text-white transition-colors duration-200 text-sm">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-green-600 to-teal-400 flex items-center justify-center">
                <Clock size={12} className="text-white" />
              </div>
              Recently Played
            </Button>
          </Link>
        </div>
      )}

      {session && (
        <div className="mt-2 pt-4 border-t border-neutral-800">
          <div className="flex items-center justify-between px-2 mb-3">
            <h3 className="uppercase tracking-wider text-xs font-bold text-neutral-500">Playlists</h3>
            <button onClick={() => setShowCreateModal(!showCreateModal)} className="text-neutral-400 hover:text-white transition-colors">
              <Plus size={18} />
            </button>
          </div>

          {showCreateModal && (
            <div className="mb-3 px-2">
              <input
                type="text"
                placeholder="Playlist name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                className="w-full bg-neutral-800 text-white text-sm rounded px-3 py-2 outline-none focus:ring-1 focus:ring-white/20 mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={handleCreatePlaylist} className="text-xs bg-white text-black px-3 py-1 rounded-full font-medium hover:scale-105 transition-transform">
                  Create
                </button>
                <button onClick={() => { setShowCreateModal(false); setNewName(''); }} className="text-xs text-neutral-400 hover:text-white">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <ul className="flex flex-col gap-1 overflow-y-auto max-h-40">
            {playlists.map((p) => (
              <li key={p.id} className="group">
                <Link href={`/playlist/${p.id}`} className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium hover:text-white cursor-pointer transition-colors duration-200 rounded hover:bg-white/5">
                  <Music size={14} className="flex-shrink-0" />
                  <span className="truncate flex-1">{p.name}</span>
                  <button
                    onClick={(e) => handleDeletePlaylist(e, p.id)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 transition-all flex-shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
