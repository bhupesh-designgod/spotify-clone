'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AuthButton from './AuthButton';

const PAGE_TITLES: Record<string, string> = {
  '/': '',
  '/search': 'Search',
  '/liked': 'Liked Songs',
  '/history': 'Recently Played',
};

function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname] !== undefined) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/playlist/')) return 'Playlist';
  return '';
}

export default function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === '/';
  const title = pageTitle(pathname);

  return (
    <header className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-2 px-3 h-12 bg-black/80 backdrop-blur-md border-b border-neutral-900">
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {isHome ? (
          <Link href="/" className="text-white font-extrabold text-base px-1 truncate">
            Spotify Clone
          </Link>
        ) : (
          <>
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20 text-white flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
            {title && (
              <span className="text-white font-semibold text-sm truncate">{title}</span>
            )}
          </>
        )}
      </div>
      <div className="flex-shrink-0">
        <AuthButton />
      </div>
    </header>
  );
}
