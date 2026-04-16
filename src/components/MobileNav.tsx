'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Library, Heart } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const items = [
    { href: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
    { href: '/search', label: 'Search', icon: Search, match: (p: string) => p.startsWith('/search') },
    ...(session
      ? [{ href: '/liked', label: 'Liked', icon: Heart, match: (p: string) => p.startsWith('/liked') }]
      : []),
    { href: '/history', label: 'Library', icon: Library, match: (p: string) => p.startsWith('/history') || p.startsWith('/playlist') },
  ];

  return (
    <nav
      className="md:hidden flex justify-around items-center h-14 bg-black/95 border-t border-neutral-800 z-40 pb-[env(safe-area-inset-bottom)] flex-shrink-0"
    >
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              active ? 'text-white' : 'text-neutral-400'
            }`}
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
