'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { LogIn, LogOut, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function AuthButton() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (status === 'loading') {
    return (
      <div className="w-8 h-8 rounded-full bg-neutral-700 animate-pulse" />
    );
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn('google')}
        className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2 rounded-full hover:scale-105 transition-transform"
      >
        <LogIn size={16} />
        Sign in
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 rounded-full p-1 pr-3 transition-colors"
      >
        {session.user?.image ? (
          <img
            src={session.user.image}
            alt={session.user.name || 'User'}
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold text-black">
            {session.user?.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <span className="text-sm font-medium text-white hidden sm:inline truncate max-w-[100px]">
          {session.user?.name?.split(' ')[0]}
        </span>
        <ChevronDown size={14} className={`text-neutral-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-neutral-800 rounded-md shadow-xl border border-neutral-700 py-1 z-50">
          <div className="px-3 py-2 border-b border-neutral-700">
            <p className="text-sm font-medium text-white truncate">{session.user?.name}</p>
            <p className="text-xs text-neutral-400 truncate">{session.user?.email}</p>
          </div>
          <button
            onClick={() => { setMenuOpen(false); signOut(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
