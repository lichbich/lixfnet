'use client';

import React, { useState, useEffect } from 'react';
import { NetflixProvider } from '@/context/NetflixContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { MovieModal } from '@/components/modals/MovieModal';
import { VideoPlayerModal } from '@/components/player/VideoPlayerModal';
import { HoverPopoutCard } from '@/components/cards/HoverPopoutCard';
import { CreateUserModal } from '@/components/auth/CreateUserModal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isTransitionActive, setIsTransitionActive] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(1);

  useEffect(() => {
    setMounted(true);

    if (
      typeof window !== 'undefined' &&
      sessionStorage.getItem('lixfnet_login_transition') === 'true'
    ) {
      sessionStorage.removeItem('lixfnet_login_transition');
      setIsTransitionActive(true);
      setOverlayOpacity(1);

      // Start smooth fade-in from pure black
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOverlayOpacity(0);
        });
      });

      const timer = setTimeout(() => {
        setIsTransitionActive(false);
      }, 1100);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div suppressHydrationWarning className="min-h-full flex flex-col flex-1">
      {/* Smooth Cinema Fade-In Curtain on Login */}
      {isTransitionActive && (
        <div
          style={{ opacity: overlayOpacity }}
          className="fixed inset-0 z-[9999] bg-[#141414] pointer-events-none transition-opacity duration-1000 ease-out"
        />
      )}

      {mounted ? (
        <NetflixProvider>
          <Navbar />
          <main className="flex-1 w-full pb-16 md:pb-0">{children}</main>
          <MovieModal />
          <VideoPlayerModal />
          <HoverPopoutCard />
          <CreateUserModal />
          <Footer />
        </NetflixProvider>
      ) : (
        <div suppressHydrationWarning className="min-h-screen bg-[#141414]" />
      )}
    </div>
  );
}
