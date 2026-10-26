'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Info, Volume2, VolumeX, Sparkles, CheckCircle2 } from 'lucide-react';
import { NetflixRibbonN } from '@/components/ui/NetflixLogo';
import { useNetflix } from '@/context/NetflixContext';
import { Movie } from '@/types';
import { formatEpisodeTitle } from '@/services/movieApi';
import { useHdTrailerFrame } from '@/lib/useHdTrailerFrame';
import { DEFAULT_BACKDROP_IMAGE } from '@/lib/movieUtils';

interface HeroBannerProps {
  movie?: Movie | null;
  badgeText?: string;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ movie, badgeText }) => {
  const {
    openModal,
    startPlaying,
    isMuted,
    toggleMute,
    trailerVolume,
    setTrailerVolume,
    selectedMovie,
    playingMovie,
    getWatchProgress,
    isCardTrailerPlaying,
  } = useNetflix();
  const isModalOpen = Boolean(selectedMovie || playingMovie);

  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [backupKeys, setBackupKeys] = useState<string[]>([]);
  const [isTrailerPlaying, setIsTrailerPlaying] = useState<boolean>(false);
  const [isTrailerReady, setIsTrailerReady] = useState<boolean>(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(movie?.logoUrl || null);
  const [isLogoLoaded, setIsLogoLoaded] = useState<boolean>(false);
  const [isInView, setIsInView] = useState<boolean>(true);
  const [isTabVisible, setIsTabVisible] = useState<boolean>(true);
  const [isWindowFocused, setIsWindowFocused] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { containerRef: trailerContainerRef, iframeStyle: hdIframeStyle } = useHdTrailerFrame({
    baseWidth: 2560,
    baseHeight: 1440,
    overscan: 1.2,
  });
  const trailerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isTrailerPlayingRef = useRef(isTrailerPlaying);
  const isInViewRef = useRef(isInView);
  const isModalOpenRef = useRef(isModalOpen);
  const isMutedRef = useRef(isMuted);
  const trailerVolumeRef = useRef(trailerVolume);
  trailerVolumeRef.current = trailerVolume;
  const isCardTrailerPlayingRef = useRef(isCardTrailerPlaying);

  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resumeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentVolumeRef = useRef<number>(100);
  const isFadingRef = useRef<boolean>(false);

  useEffect(() => {
    isTrailerPlayingRef.current = isTrailerPlaying;
  }, [isTrailerPlaying]);

  useEffect(() => {
    isInViewRef.current = isInView;
  }, [isInView]);

  useEffect(() => {
    isModalOpenRef.current = isModalOpen;
  }, [isModalOpen]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (!isMuted) {
      currentVolumeRef.current = 100;
    }
  }, [isMuted]);

  useEffect(() => {
    isCardTrailerPlayingRef.current = isCardTrailerPlaying;
  }, [isCardTrailerPlaying]);

  // Helper to send postMessage commands to YouTube player iframe safely and reliably
  const sendIframeCommand = useCallback((func: string, args: any = '') => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
      if (args === '') {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args: [] }),
          '*'
        );
      } else if (typeof args === 'number' || typeof args === 'string') {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args: [args] }),
          '*'
        );
      }
    } catch {}
  }, []);

  // Smoothly fade out audio and pause video
  const fadeOutAndPause = useCallback((durationMs: number = 550) => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (resumeDebounceTimerRef.current) {
      clearTimeout(resumeDebounceTimerRef.current);
      resumeDebounceTimerRef.current = null;
    }

    if (!iframeRef.current || !isTrailerPlayingRef.current) return;

    // If muted, no audio to fade, pause immediately
    if (isMutedRef.current) {
      sendIframeCommand('pauseVideo');
      sendIframeCommand('mute');
      return;
    }

    isFadingRef.current = true;
    const steps = 11;
    const intervalMs = Math.max(20, Math.floor(durationMs / steps)); // ~50ms
    let currentVol = currentVolumeRef.current > 0 ? currentVolumeRef.current : trailerVolumeRef.current;
    const stepDec = currentVol / steps;

    fadeTimerRef.current = setInterval(() => {
      currentVol = Math.max(0, currentVol - stepDec);
      currentVolumeRef.current = Math.round(currentVol);
      sendIframeCommand('setVolume', Math.round(currentVol));

      if (currentVol <= 0) {
        if (fadeTimerRef.current) {
          clearInterval(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }
        isFadingRef.current = false;
        sendIframeCommand('pauseVideo');
        sendIframeCommand('mute');
      }
    }, intervalMs);
  }, [sendIframeCommand]);

  // Smoothly resume video and fade audio back in
  const fadeInAndResume = useCallback((durationMs: number = 450) => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    if (!iframeRef.current || !isTrailerPlayingRef.current) return;

    // Start video playback
    sendIframeCommand('playVideo');

    // If user's preference is muted, remain muted
    if (isMutedRef.current) {
      sendIframeCommand('mute');
      sendIframeCommand('setVolume', 0);
      return;
    }

    // Unmute and fade from 0 up to 100
    isFadingRef.current = true;
    sendIframeCommand('unMute');
    sendIframeCommand('setVolume', 0);
    currentVolumeRef.current = 0;

    const steps = 10;
    const intervalMs = Math.max(20, Math.floor(durationMs / steps)); // ~45ms
    let currentVol = 0;
    const targetVol = trailerVolumeRef.current;
    const stepInc = targetVol / steps;

    fadeTimerRef.current = setInterval(() => {
      currentVol = Math.min(targetVol, currentVol + stepInc);
      currentVolumeRef.current = Math.round(currentVol);
      sendIframeCommand('setVolume', Math.round(currentVol));

      if (currentVol >= targetVol) {
        if (fadeTimerRef.current) {
          clearInterval(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }
        isFadingRef.current = false;
        sendIframeCommand('setVolume', targetVol);
      }
    }, intervalMs);
  }, [sendIframeCommand]);

  // Cleanup fade timers on unmount
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) {
        clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      if (resumeDebounceTimerRef.current) {
        clearTimeout(resumeDebounceTimerRef.current);
        resumeDebounceTimerRef.current = null;
      }
    };
  }, []);

  // Fetch trailer from TMDB API and autoplay smoothly if available
  useEffect(() => {
    setIsTrailerPlaying(false);
    setIsTrailerReady(false);
    setTrailerKey(null);
    setBackupKeys([]);

    if (trailerTimerRef.current) {
      clearTimeout(trailerTimerRef.current);
      trailerTimerRef.current = null;
    }

    if (!movie) return;

    setIsLogoLoaded(false);
    let isCancelled = false;
    const movieSlug = movie.slug || movie.id;

    // Check client storage cache for logo first
    let cachedLogo: string | null = null;
    try {
      cachedLogo = sessionStorage.getItem(`netlix_logo_v3_${movieSlug}`);
    } catch {}

    if (cachedLogo && cachedLogo !== 'none') {
      setLogoUrl(cachedLogo);
    } else if (movie.logoUrl) {
      setLogoUrl(movie.logoUrl);
    } else {
      setLogoUrl(null);
    }

    // Check client-side storage cache first for trailer
    let cachedKey: string | null = null;
    try {
      cachedKey = sessionStorage.getItem(`netlix_trailer_${movieSlug}`);
    } catch {
      // ignore
    }

    const immediateKey =
      movie.trailerYoutubeKey || (cachedKey && cachedKey !== 'none' ? cachedKey : null);

    if (immediateKey) {
      setTrailerKey(immediateKey);
      trailerTimerRef.current = setTimeout(() => {
        if (!isCancelled) {
          setIsTrailerPlaying(true);
        }
      }, 1000);
    } else {
      const qTitle = encodeURIComponent(movie.title || '');
      const qSub = encodeURIComponent(movie.subTitle || '');
      const qSlug = encodeURIComponent(movieSlug);
      const qYear = encodeURIComponent(movie.year ? String(movie.year) : '');
      const qTmdbId = encodeURIComponent(movie.tmdb?.id ? String(movie.tmdb.id) : '');
      const qMediaType = encodeURIComponent(movie.tmdb?.type || '');
      const qTrailerUrl = encodeURIComponent(movie.trailerUrl || '');

      fetch(
        `/api/trailer?title=${qTitle}&subTitle=${qSub}&slug=${qSlug}&year=${qYear}&tmdbId=${qTmdbId}&mediaType=${qMediaType}&trailerUrl=${qTrailerUrl}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (isCancelled) return;
          if (data.logoUrl) {
            setLogoUrl(data.logoUrl);
            try {
              sessionStorage.setItem(`netlix_logo_v3_${movieSlug}`, data.logoUrl);
            } catch {}
          }
          if (data.youtubeKey) {
            setTrailerKey(data.youtubeKey);
            if (data.backupKeys && Array.isArray(data.backupKeys)) {
              setBackupKeys(data.backupKeys);
            }
            try {
              sessionStorage.setItem(`netlix_trailer_${movieSlug}`, data.youtubeKey);
            } catch {
              // ignore
            }
            // Only start trailer playback if key is verified
            trailerTimerRef.current = setTimeout(() => {
              if (!isCancelled) {
                setIsTrailerPlaying(true);
              }
            }, 1000);
          } else {
            // Movie has no trailer: keep clean backdrop poster
            setTrailerKey(null);
            setIsTrailerPlaying(false);
            setIsTrailerReady(false);
          }
        })
        .catch(() => {});
    }

    // Proactively fetch TMDB logo if not in cache or on movie
    if (!movie.logoUrl && cachedLogo !== 'none' && !cachedLogo) {
      const qTitle = encodeURIComponent(movie.title || '');
      const qSub = encodeURIComponent(movie.subTitle || '');
      const qSlug = encodeURIComponent(movieSlug);
      const qYear = encodeURIComponent(movie.year ? String(movie.year) : '');
      const qTmdbId = encodeURIComponent(movie.tmdb?.id ? String(movie.tmdb.id) : '');
      const qMediaType = encodeURIComponent(movie.tmdb?.type || '');

      fetch(
        `/api/logo?title=${qTitle}&subTitle=${qSub}&slug=${qSlug}&year=${qYear}&tmdbId=${qTmdbId}&mediaType=${qMediaType}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (!isCancelled && data.logoUrl) {
            setLogoUrl(data.logoUrl);
            try {
              sessionStorage.setItem(`netlix_logo_v3_${movieSlug}`, data.logoUrl);
            } catch {}
          } else if (!isCancelled) {
            try {
              sessionStorage.setItem(`netlix_logo_v3_${movieSlug}`, 'none');
            } catch {}
          }
        })
        .catch(() => {});
    }

    return () => {
      isCancelled = true;
      if (trailerTimerRef.current) {
        clearTimeout(trailerTimerRef.current);
        trailerTimerRef.current = null;
      }
    };
  }, [movie?.id]);

  // Handle YouTube player messages, state changes, and genuine errors
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        // 1. YouTube Player State Handling
        const playerState =
          data?.event === 'onStateChange' && typeof data?.info === 'number'
            ? data.info
            : typeof data?.info?.playerState === 'number'
            ? data.info.playerState
            : undefined;

        if (playerState === 1) {
          // 1 = PLAYING: Video is actively playing!
          setIsTrailerReady(true);
          sendIframeCommand('setPlaybackQuality', 'hd1080');
          sendIframeCommand('setPlaybackQualityRange', ['hd1080', 'highres']);
        } else if (
          playerState === 5 ||
          playerState === -1 ||
          (playerState === 2 && !isCardTrailerPlayingRef.current)
        ) {
          // 5 = CUED, -1 = UNSTARTED, 2 = PAUSED
          // Proactively enforce playVideo so video does not stay stuck in pause
          const isAppActive =
            typeof document !== 'undefined'
              ? document.visibilityState === 'visible' && document.hasFocus()
              : true;
          const shouldPlay =
            isInViewRef.current &&
            !isModalOpenRef.current &&
            isAppActive &&
            !isCardTrailerPlayingRef.current &&
            isTrailerPlayingRef.current;

          if (shouldPlay) {
            sendIframeCommand('playVideo');
            if (!isMutedRef.current) {
              sendIframeCommand('unMute');
              sendIframeCommand('setVolume', trailerVolumeRef.current);
            }
          }
        }

        // 2. Genuine YouTube Error Detection
        // MUST only check error codes if this is an actual onError event or has an explicit errorCode property!
        const isOnErrorEvent = data?.event === 'onError';
        const explicitErrorCode =
          data?.info?.errorCode ??
          (isOnErrorEvent
            ? typeof data?.info === 'number'
              ? data.info
              : typeof data?.data === 'number'
              ? data.data
              : undefined
            : undefined);

        const isError =
          isOnErrorEvent ||
          (explicitErrorCode !== undefined && [2, 5, 100, 101, 150].includes(explicitErrorCode));

        if (isError) {
          if (backupKeys.length > 0) {
            const nextKey = backupKeys[0];
            setTrailerKey(nextKey);
            setBackupKeys((prev) => prev.slice(1));
            setIsTrailerReady(false);
          } else {
            // Revert cleanly to sharp backdrop poster without displaying YouTube error screen
            setIsTrailerPlaying(false);
            setIsTrailerReady(false);
          }
        }
      } catch {
        // ignore non-json messages
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [backupKeys, sendIframeCommand]);

  // Pause trailer when user scrolls down away from Hero, resume when back in view
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting && entry.intersectionRatio > 0.15);
      },
      {
        threshold: [0, 0.15, 0.5, 1.0],
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [movie?.id]);

  // Pause trailer when tab is hidden or user switches to another window/app, resume on return
  useEffect(() => {
    const handlePause = () => {
      sendIframeCommand('pauseVideo');
      sendIframeCommand('mute');
    };

    const handleResumeIfEligible = () => {
      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      const hasFocus = typeof document !== 'undefined' ? document.hasFocus() : true;
      if (
        isVisible &&
        hasFocus &&
        isInViewRef.current &&
        !isModalOpenRef.current &&
        !isCardTrailerPlayingRef.current &&
        isTrailerPlayingRef.current
      ) {
        sendIframeCommand('playVideo');
        if (!isMutedRef.current) {
          sendIframeCommand('unMute');
        }
      }
    };

    const handleVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);
      if (!visible) {
        handlePause();
      } else {
        setTimeout(handleResumeIfEligible, 60);
      }
    };

    const handleBlur = () => {
      setIsWindowFocused(false);
      handlePause();
    };

    const handleFocus = () => {
      setIsWindowFocused(true);
      setTimeout(handleResumeIfEligible, 60);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePause);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePause);
    };
  }, [sendIframeCommand]);

  // Coordinate with card hover trailer: when card starts playing trailer, smoothly fade out & pause HeroBanner;
  // when card trailer stops, smoothly resume HeroBanner
  useEffect(() => {
    if (!iframeRef.current || !isTrailerPlaying || !trailerKey) return;

    const isAppActive = isTabVisible && isWindowFocused;
    const eligibleToPlay = isInView && !isModalOpen && isAppActive;

    if (isCardTrailerPlaying) {
      if (resumeDebounceTimerRef.current) {
        clearTimeout(resumeDebounceTimerRef.current);
        resumeDebounceTimerRef.current = null;
      }
      // Card trailer active: smoothly fade out HeroBanner audio then pause video
      fadeOutAndPause(550);
    } else {
      // Card trailer stopped: debounce slightly (200ms) to avoid stutter when user moves between cards
      if (eligibleToPlay) {
        if (resumeDebounceTimerRef.current) {
          clearTimeout(resumeDebounceTimerRef.current);
        }
        resumeDebounceTimerRef.current = setTimeout(() => {
          if (
            !isCardTrailerPlayingRef.current &&
            isInViewRef.current &&
            !isModalOpenRef.current
          ) {
            fadeInAndResume(450);
          }
        }, 200);
      }
    }

    return () => {
      if (resumeDebounceTimerRef.current) {
        clearTimeout(resumeDebounceTimerRef.current);
        resumeDebounceTimerRef.current = null;
      }
    };
  }, [
    isCardTrailerPlaying,
    isTrailerPlaying,
    trailerKey,
    isInView,
    isModalOpen,
    isTabVisible,
    isWindowFocused,
    fadeOutAndPause,
    fadeInAndResume,
  ]);

  // Sync play / pause with viewport visibility, window/tab focus, and modal state
  useEffect(() => {
    if (iframeRef.current && isTrailerPlaying && trailerKey) {
      const isAppActive = isTabVisible && isWindowFocused;
      const shouldPlay = isInView && !isModalOpen && isAppActive && !isCardTrailerPlaying;

      if (shouldPlay) {
        sendIframeCommand('playVideo');
        if (!isMuted) {
          sendIframeCommand('unMute');
        }
      } else if (!isCardTrailerPlaying) {
        sendIframeCommand('pauseVideo');
        sendIframeCommand('mute');
      }
    }
  }, [isInView, isModalOpen, isTabVisible, isWindowFocused, isTrailerPlaying, trailerKey, isMuted, isCardTrailerPlaying, sendIframeCommand]);

  // Sync mute / unmute and volume state with YouTube iframe via postMessage
  useEffect(() => {
    if (iframeRef.current && isTrailerPlaying && trailerKey) {
      const isAppActive = isTabVisible && isWindowFocused;
      if (isAppActive && !isModalOpen && !isCardTrailerPlaying) {
        sendIframeCommand(isMuted ? 'mute' : 'unMute');
        if (!isMuted) {
          currentVolumeRef.current = trailerVolume;
          sendIframeCommand('setVolume', trailerVolume);
        }
      }
    }
  }, [isMuted, trailerVolume, isTrailerPlaying, trailerKey, isTabVisible, isWindowFocused, isModalOpen, isCardTrailerPlaying, sendIframeCommand]);

  if (!movie) {
    return (
      <section className="pt-20 md:pt-24 px-4 sm:px-8 md:px-12 w-full max-w-[1920px] mx-auto">
        <div className="relative w-full h-[76vh] sm:h-[82vh] min-h-[580px] sm:min-h-[660px] max-h-[880px] rounded-2xl md:rounded-3xl overflow-hidden bg-zinc-900 border border-white/5 animate-shimmer">
          <div className="absolute bottom-14 left-10 space-y-4 max-w-xl">
            <div className="w-12 h-6 bg-zinc-800 rounded" />
            <div className="w-3/4 h-12 bg-zinc-800 rounded" />
            <div className="w-1/2 h-6 bg-zinc-800 rounded" />
            <div className="flex gap-4 pt-2">
              <div className="w-32 h-10 bg-zinc-800 rounded-full" />
              <div className="w-36 h-10 bg-zinc-800 rounded-full" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative pt-20 md:pt-24 px-4 sm:px-8 md:px-12 w-full max-w-[1920px] mx-auto">
      {/* Hero Card & Ambient Glow Wrapper with isolated stacking context */}
      <div className="relative w-full isolate">
        {/* Dynamic Radiant Ambilight Glow based on Poster/Backdrop Image */}
        <div className="absolute -inset-6 sm:-inset-10 md:-inset-16 z-0 pointer-events-none select-none transition-all duration-1000 overflow-visible">
          {/* Layer 1: Wide High-Saturation Atmospheric Aura */}
          <div
            className="absolute inset-0 rounded-[44px] md:rounded-[64px] filter blur-[80px] md:blur-[130px] saturate-[260%] brightness-[1.35] opacity-85 md:opacity-95 transition-all duration-1000 scale-105"
            style={{
              backgroundImage: `url('${movie.backdropUrl || movie.posterUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />

          {/* Layer 2: Intense Edge Bloom Halo */}
          <div
            className="absolute inset-2 sm:inset-4 md:inset-6 rounded-[32px] md:rounded-[48px] filter blur-[35px] md:blur-[55px] saturate-[280%] brightness-[1.4] opacity-90 md:opacity-100 transition-all duration-700"
            style={{
              backgroundImage: `url('${movie.backdropUrl || movie.posterUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />

          {/* Layer 3: Bottom Ambient Spill into the row gap */}
          <div
            className="absolute -bottom-8 sm:-bottom-12 inset-x-12 sm:inset-x-20 h-24 sm:h-32 rounded-full filter blur-[50px] md:blur-[70px] saturate-[280%] brightness-[1.4] opacity-80 md:opacity-90 pointer-events-none"
            style={{
              backgroundImage: `url('${movie.backdropUrl || movie.posterUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'bottom center',
            }}
          />

          {/* Layer 4: Soft Breathing Ambient Pulse Overlay */}
          <div
            className="absolute inset-0 rounded-[40px] md:rounded-[60px] filter blur-[90px] opacity-40 mix-blend-screen animate-pulse pointer-events-none"
            style={{
              backgroundImage: `url('${movie.backdropUrl || movie.posterUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              animationDuration: '5s',
            }}
          />
        </div>

        {/* Framed Rounded Hero Card with increased height and cinema aspect */}
        <div
          ref={containerRef}
          className="relative z-10 w-full h-[62vh] sm:h-[82vh] min-h-[480px] sm:min-h-[660px] max-h-[880px] rounded-2xl md:rounded-3xl overflow-hidden shadow-[0_30px_70px_-15px_rgba(0,0,0,0.95)] border border-white/10 bg-zinc-900 group"
        >
          {/* Adaptive Background Image & Video Layers */}
          {/* Adaptive Background Image & Video Layers */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Ambient Blurred Cinema Fill: Radiates matching scene colors to soften any letterbox boundaries */}
            <div
              className="absolute inset-0 bg-cover bg-center filter blur-3xl scale-125 opacity-70 pointer-events-none transition-all duration-1000"
              style={{
                backgroundImage: `url('${movie.backdropUrl || movie.posterUrl || DEFAULT_BACKDROP_IMAGE}')`,
              }}
            />

            {/* Main Sharp Image Layer */}
            <div
              className={`absolute inset-0 bg-cover bg-center md:bg-right transition-opacity duration-1000 ${
                isTrailerPlaying && trailerKey && isTrailerReady ? 'opacity-0' : 'opacity-100 group-hover:scale-102'
              }`}
              style={{
                backgroundImage: `url('${movie.backdropUrl || movie.posterUrl || DEFAULT_BACKDROP_IMAGE}')`,
              }}
            />

            {/* Live Autoplay YouTube Trailer Player - Centered Full-Cover without black letterbox gaps */}
            {isTrailerPlaying && trailerKey && (
              <div
                ref={trailerContainerRef}
                className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none flex items-center justify-center"
              >
                <iframe
                  ref={iframeRef}
                  style={hdIframeStyle}
                  id="hero-trailer-iframe"
                  src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=${trailerKey}&playsinline=1&enablejsapi=1&vq=hd1080${
                    typeof window !== 'undefined' && window.location.origin
                      ? `&origin=${encodeURIComponent(window.location.origin)}`
                      : ''
                  }`}
                  title={`${movie.title} Trailer`}
                  onLoad={() => {
                    setIsTrailerReady(true);
                    // Initial YouTube API listening handshake
                    try {
                      iframeRef.current?.contentWindow?.postMessage(
                        JSON.stringify({ event: 'listening' }),
                        '*'
                      );
                    } catch {}

                    // Enforce Full HD 1080p stream
                    sendIframeCommand('setPlaybackQuality', 'hd1080');
                    sendIframeCommand('setPlaybackQualityRange', ['hd1080', 'highres']);
                    setTimeout(() => {
                      sendIframeCommand('setPlaybackQuality', 'hd1080');
                      sendIframeCommand('setPlaybackQualityRange', ['hd1080', 'highres']);
                    }, 500);

                    const isAppActive =
                      typeof document !== 'undefined'
                        ? document.visibilityState === 'visible' && document.hasFocus()
                        : true;
                    const shouldPlay =
                      isInView &&
                      !isModalOpen &&
                      isAppActive &&
                      !isCardTrailerPlayingRef.current;

                    if (shouldPlay) {
                      // Proactively start playback to ensure browser autoplay policy doesn't stall
                      sendIframeCommand('playVideo');
                      setTimeout(() => {
                        if (!isCardTrailerPlayingRef.current && !isModalOpenRef.current) {
                          sendIframeCommand('playVideo');
                        }
                      }, 150);
                      setTimeout(() => {
                        if (!isCardTrailerPlayingRef.current && !isModalOpenRef.current) {
                          sendIframeCommand('playVideo');
                        }
                      }, 350);

                      if (!isMuted) {
                        sendIframeCommand('unMute');
                        sendIframeCommand('setVolume', trailerVolume);
                        currentVolumeRef.current = trailerVolume;
                      } else {
                        sendIframeCommand('mute');
                        sendIframeCommand('setVolume', 0);
                        currentVolumeRef.current = 0;
                      }
                    } else {
                      sendIframeCommand('pauseVideo');
                      sendIframeCommand('mute');
                    }
                  }}
                  className={`transition-opacity duration-1000 ${
                    isTrailerReady ? 'opacity-100' : 'opacity-0'
                  }`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}

            {/* Top Soft Vignette: Smoothly feathers upper edge */}
            <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black/60 via-black/15 to-transparent pointer-events-none" />

            {/* Left Gradient: Text readability while preserving video visibility */}
            <div className="absolute inset-y-0 left-0 w-full md:w-3/5 bg-gradient-to-r from-black/85 via-black/35 to-transparent pointer-events-none" />

            {/* Bottom Feathering: Natural ambient fade around metadata instead of harsh solid black slab */}
            <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-[#141414] via-[#141414]/50 to-transparent pointer-events-none" />
          </div>

          {/* Top-Left Netflix "N" Logo & Category Ribbon */}
          <div className="absolute top-6 left-6 md:top-8 md:left-10 z-10 flex items-center gap-3">
            <NetflixRibbonN className="w-6 h-10 md:w-8 md:h-12 drop-shadow-xl" />
            {badgeText && (
              <span className="text-[11px] sm:text-xs uppercase tracking-widest text-zinc-300 font-bold bg-black/50 backdrop-blur-md px-2.5 py-1 rounded border border-white/10 inline-block drop-shadow">
                {badgeText}
              </span>
            )}
          </div>

          {/* Top-Right Mute / Audio Toggle & Liquid Glass Volume Slider */}
          <div className="absolute top-6 right-6 md:top-8 md:right-10 z-10">
            <div className="relative group/vol flex items-center">
              <div className="flex items-center gap-2.5 h-10 px-2 rounded-full border border-white/35 bg-black/45 hover:bg-black/65 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_8px_24px_rgba(0,0,0,0.5)] transition-all duration-300">
                <button
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white hover:text-red-400 transition cursor-pointer shrink-0"
                >
                  {isMuted || trailerVolume === 0 ? (
                    <VolumeX className="w-5 h-5 text-red-400" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </button>

                <div className="w-0 group-hover/vol:w-28 sm:group-hover/vol:w-32 opacity-0 group-hover/vol:opacity-100 overflow-hidden transition-all duration-300 ease-out flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={isMuted ? 0 : trailerVolume}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTrailerVolume(val);
                    }}
                    className="w-16 sm:w-20 h-1.5 bg-white/20 hover:bg-white/35 accent-red-600 rounded-lg cursor-pointer transition-all"
                    aria-label="Âm lượng trailer"
                  />
                  <span className="text-[11px] font-bold text-zinc-300 tabular-nums select-none shrink-0 drop-shadow pr-1">
                    {isMuted ? '0%' : `${trailerVolume}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Content Left Block - Minimalist Netflix Layout to showcase trailer */}
          <div className="absolute bottom-6 left-4 sm:bottom-14 sm:left-10 md:left-14 max-w-xl lg:max-w-2xl z-10 text-white">
            {/* Main Title / Title Logo with CSS Grid Stacking (Zero vertical layout shift) */}
            <div className="grid grid-cols-1 grid-rows-1 items-end mb-3 sm:mb-4">
              {/* Layer 1: Plain text title */}
              <div
                style={{ gridArea: '1 / 1 / 2 / 2' }}
                className={`transition-opacity duration-500 ease-in-out ${
                  isLogoLoaded && logoUrl
                    ? 'opacity-0 pointer-events-none'
                    : 'opacity-100'
                }`}
              >
                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight leading-tight text-white drop-shadow-2xl line-clamp-2">
                  {movie.title}
                </h1>
                {movie.subTitle && (
                  <h2 className="text-xs sm:text-sm md:text-base font-semibold tracking-wider uppercase mt-1 text-zinc-300 drop-shadow line-clamp-1">
                    {movie.subTitle}
                  </h2>
                )}
              </div>

              {/* Layer 2: Graphic Title logo */}
              {logoUrl && (
                <div
                  style={{ gridArea: '1 / 1 / 2 / 2' }}
                  className={`relative w-fit max-w-[280px] sm:max-w-[400px] md:max-w-[480px] transition-opacity duration-500 ease-in-out ${
                    isLogoLoaded
                      ? 'opacity-100'
                      : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <img
                    src={logoUrl}
                    alt={movie.title}
                    onLoad={() => setIsLogoLoaded(true)}
                    onError={() => {
                      setLogoUrl(null);
                      setIsLogoLoaded(false);
                    }}
                    className="max-h-24 sm:max-h-32 md:max-h-40 w-auto object-contain select-none pointer-events-none transition-transform duration-500 hover:scale-105"
                    style={{ filter: 'drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.7)) drop-shadow(0 4px 16px rgba(0, 0, 0, 0.95))' }}
                    loading="eager"
                  />
                  {movie.subTitle && (
                    <h2 className="text-xs sm:text-sm font-semibold tracking-wider uppercase mt-2 text-zinc-300 drop-shadow line-clamp-1">
                      {movie.subTitle}
                    </h2>
                  )}
                </div>
              )}
            </div>

            {/* Clean, concise single-line metadata like real Netflix (Series • Genre • Year • Duration • Quality • Match) */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm font-semibold text-zinc-300 mb-4 sm:mb-6 drop-shadow">
              <span>{movie.type === 'series' ? 'Series' : 'Phim điện ảnh'}</span>
              {movie.genres && movie.genres.length > 0 && (
                <>
                  <span>•</span>
                  <span className="text-zinc-200">{movie.genres[0]}</span>
                </>
              )}
              <span>•</span>
              <span>{movie.year}</span>
              <span>•</span>
              <span>{movie.seasons || (movie.type === 'series' ? 'Nhiều tập' : 'Phim lẻ')}</span>
              <span>•</span>
              <span className="border border-white/40 px-1 py-0.2 rounded text-[10px] text-zinc-200">
                {movie.quality || 'HD'}
              </span>
              <span>•</span>
              <span className="text-green-400 font-bold">{movie.matchRate}% Phù hợp</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {(() => {
                const watchProgress = movie ? getWatchProgress(movie.slug || movie.id, movie) : undefined;
                return (
                  <button
                    onClick={() => {
                      if (watchProgress?.episodeEmbed || watchProgress?.episodeM3u8) {
                        startPlaying(
                          movie,
                          watchProgress.episodeEmbed,
                          formatEpisodeTitle(watchProgress.episodeTitle),
                          watchProgress.episodeM3u8
                        );
                      } else {
                        startPlaying(movie);
                      }
                    }}
                    className="flex items-center gap-2 bg-white text-black font-bold text-sm sm:text-base px-6 sm:px-7 py-2.5 rounded-full hover:bg-white/90 active:scale-95 transition-all shadow-xl cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                    <span>
                      {watchProgress?.episodeTitle
                        ? `Tiếp tục xem • ${formatEpisodeTitle(watchProgress.episodeTitle)}`
                        : 'Phát'}
                    </span>
                  </button>
                );
              })()}

              <button
                onClick={() => openModal(movie)}
                className="flex items-center gap-2 bg-white/25 hover:bg-white/35 text-white font-medium text-sm sm:text-base px-5 sm:px-6 py-2.5 rounded-full backdrop-blur-md active:scale-95 transition-all shadow-md cursor-pointer"
              >
                <Info className="w-5 h-5" />
                <span>Thông tin khác</span>
              </button>
            </div>
          </div>

          {/* Bottom Right Badges from API */}
          <div className="absolute bottom-10 right-6 md:right-10 z-10 hidden sm:flex items-center gap-2.5">
            {movie.currentEpisode && (
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-md">
                <span className="p-1 rounded bg-red-600/80 text-white">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <span>{movie.currentEpisode}</span>
              </div>
            )}

            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-md">
              <span className="text-green-400">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <span>Đã có bản {movie.quality || 'HD'}</span>
            </div>
          </div>
      </div>
    </div>
  </section>
);
};
