'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Library, Heart } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // 4 stable tabs whether logged in or not. Liked + Library both gracefully
  // handle the unauthed case (page itself shows "Sign in to view…").
  const items = [
    { href: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
    { href: '/search', label: 'Search', icon: Search, match: (p: string) => p.startsWith('/search') },
    { href: '/liked', label: 'Liked', icon: Heart, match: (p: string) => p.startsWith('/liked') },
    { href: '/history', label: 'Library', icon: Library, match: (p: string) => p.startsWith('/history') || p.startsWith('/playlist') },
  ];

  return (
    <nav
      className="md:hidden flex justify-around items-stretch h-16 bg-black/95 backdrop-blur-md border-t border-neutral-800 z-40 pb-[env(safe-area-inset-bottom)] flex-shrink-0"
      role="navigation"
      aria-label="Primary"
    >
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors active:bg-white/5 ${
              active ? 'text-white' : 'text-neutral-400'
            }`}
          >
            {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-green-500" />}
            <Icon size={22} strokeWidth={active ? 2.5 : 2} />
            <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
