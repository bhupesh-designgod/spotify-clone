import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import PlayerBar from '@/components/PlayerBar';
import YouTubePlayer from '@/components/YouTubePlayer';
import AuthButton from '@/components/AuthButton';
import Providers from '@/components/Providers';
import LyricsOverlay from '@/components/LyricsOverlay';
import MobileNav from '@/components/MobileNav';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Spotify Clone',
  description: 'A Spotify clone built with Next.js',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-foreground flex h-screen overflow-hidden flex-col`}>
        <Providers>
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Top bar with auth */}
              <div className="flex items-center justify-end px-4 sm:px-6 py-3 bg-transparent absolute top-0 right-0 z-40">
                <AuthButton />
              </div>
              <main className="flex-1 overflow-y-auto bg-gradient-to-b from-neutral-900 to-black p-4 sm:p-6 pt-14 pb-4">
                {children}
              </main>
            </div>
          </div>
          <PlayerBar />
          <MobileNav />
          <LyricsOverlay />
          <YouTubePlayer />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
