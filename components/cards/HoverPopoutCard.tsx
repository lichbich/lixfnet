'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Plus,
  Check,
  ThumbsUp,
  ChevronDown,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useNetflix } from '@/context/NetflixContext';
import { RatingBadge, QualityBadge, Top10Badge } from '@/components/ui/Badge';
import { NetflixRibbonN } from '@/components/ui/NetflixLogo';

export const HoverPopoutCard: React.FC = () => {
  const {
    hoveredMovie,
    hoverRect,
    selectedMovie,
    playingMovie,
    onPopoutEnter,
    onPopoutLeave,
    closeHoverPopoutNow,
    startPlaying,
    openModal,
    toggleMyList,
    isInMyList,
    getWatchProgress,
    clearWatchProgress,
    isMuted,
    toggleMute,
    setIsCardTrailerPlaying,
  } = useNetflix();

  const isModalOpen = Boolean(selectedMovie || playingMovie);

  const [isLiked, setIsLiked] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeMovie, setActiveMovie] = useState(hoveredMovie);
  const [activeRect, setActiveRect] = useState(hoverRect);

  // Trailer states
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [backupKeys, setBackupKeys] = useState<string[]>([]);
  const [isTrailerPlaying, setIsTrailerPlaying] = useState<boolean>(false);
  const [isTrailerReady, setIsTrailerReady] = useState<boolean>(false);
  const trailerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync active movie and trigger smooth blooming transition
  useEffect(() => {
    if (hoveredMovie && hoverRect) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      const isSwitching = activeMovie && activeMovie.id !== hoveredMovie.id;
      setActiveMovie(hoveredMovie);
      setActiveRect(hoverRect);

      if (isSwitching) {
        setIsOpen(true);
      } else if (!isOpen) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsOpen(true);
          });
        });
      }
    } else if (!hoveredMovie && isOpen) {
      // Smooth exit transition before unmounting
      setIsOpen(false);
      exitTimerRef.current = setTimeout(() => {
        setActiveMovie(null);
        setActiveRect(null);
        exitTimerRef.current = null;
      }, 240);
    }
  }, [hoveredMovie, hoverRect]);

  // Immediately close popout and stop trailer when modal is open
  useEffect(() => {
    if (isModalOpen) {
      setIsOpen(false);
      setIsTrailerPlaying(false);
      setIsTrailerReady(false);
      if (trailerTimerRef.current) {
        clearTimeout(trailerTimerRef.current);
        trailerTimerRef.current = null;
      }
    }
  }, [isModalOpen]);

  // Broadcast to global context when this card is actively playing its trailer
  useEffect(() => {
    const isPlaying = Boolean(isOpen && activeMovie && isTrailerPlaying && trailerKey);
    setIsCardTrailerPlaying(isPlaying);
    return () => {
      setIsCardTrailerPlaying(false);
    };
  }, [isOpen, activeMovie, isTrailerPlaying, trailerKey, setIsCardTrailerPlaying]);

  // Immediately dismiss popout on any window/container scroll or wheel motion
  useEffect(() => {
    if (!activeMovie && !hoveredMovie) return;
    const handleScrollOrWheel = () => {
      closeHoverPopoutNow();
    };
    window.addEventListener('scroll', handleScrollOrWheel, { capture: true, passive: true });
    window.addEventListener('wheel', handleScrollOrWheel, { passive: true });
    window.addEventListener('touchmove', handleScrollOrWheel, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollOrWheel, { capture: true });
      window.removeEventListener('wheel', handleScrollOrWheel);
      window.removeEventListener('touchmove', handleScrollOrWheel);
    };
  }, [activeMovie, hoveredMovie, closeHoverPopoutNow]);

  // Fetch trailer only when open, and delay playback smoothly
  useEffect(() => {
    setIsTrailerPlaying(false);
    setIsTrailerReady(false);
    setTrailerKey(null);
    setBackupKeys([]);

    if (trailerTimerRef.current) {
      clearTimeout(trailerTimerRef.current);
      trailerTimerRef.current = null;
    }

    if (!activeMovie || !isOpen) return;

    let isCancelled = false;
    const movieSlug = activeMovie.slug || activeMovie.id;

    let hasKey = false;
    let timerPassed = false;

    const maybePlayTrailer = () => {
      if (!isCancelled && hasKey && timerPassed) {
        setIsTrailerPlaying(true);
      }
    };

    // Total hover delay ~ 1.5s (380ms initial card hover delay + 1120ms popout timer)
    trailerTimerRef.current = setTimeout(() => {
      timerPassed = true;
      maybePlayTrailer();
    }, 1120);

    // Check client storage cache
    let cachedKey: string | null = null;
    try {
      cachedKey = sessionStorage.getItem(`netlix_trailer_${movieSlug}`);
    } catch {
      // ignore
    }

    if (cachedKey && cachedKey !== 'none') {
      setTrailerKey(cachedKey);
      hasKey = true;
      maybePlayTrailer();
    } else {
      const qTitle = encodeURIComponent(activeMovie.title || '');
      const qSub = encodeURIComponent(activeMovie.subTitle || '');
      const qSlug = encodeURIComponent(movieSlug);
      const qYear = encodeURIComponent(activeMovie.year ? String(activeMovie.year) : '');
      const qTmdbId = encodeURIComponent(activeMovie.tmdb?.id ? String(activeMovie.tmdb.id) : '');
      const qMediaType = encodeURIComponent(activeMovie.tmdb?.type || '');

      fetch(
        `/api/trailer?title=${qTitle}&subTitle=${qSub}&slug=${qSlug}&year=${qYear}&tmdbId=${qTmdbId}&mediaType=${qMediaType}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (isCancelled) return;
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
            hasKey = true;
            maybePlayTrailer();
          } else {
            // Film has no trailer -> cleanly retain cover image without playing anything
            setTrailerKey(null);
            setIsTrailerPlaying(false);
            setIsTrailerReady(false);
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
  }, [activeMovie?.id, isOpen]);

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
          // 1 = PLAYING
          setIsTrailerReady(true);
          try {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'setPlaybackQuality', args: ['hd1080'] }),
              '*'
            );
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'setPlaybackQualityRange', args: [['hd1080', 'highres']] }),
              '*'
            );
          } catch {}
        } else if (playerState === 5 || playerState === -1 || playerState === 2) {
          // 5 = CUED, -1 = UNSTARTED, 2 = PAUSED
          // Enforce playback so card trailer doesn't get stuck in paused state
          try {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'mute', args: '' }),
              '*'
            );
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
              '*'
            );
            if (!isMuted) {
              setTimeout(() => {
                try {
                  iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: 'unMute', args: '' }),
                    '*'
                  );
                  iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
                    '*'
                  );
                } catch {}
              }, 300);
            }
          } catch {}
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
            // Revert cleanly to poster image without displaying YouTube error frame
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
  }, [backupKeys, isMuted]);

  // Sync mute/unmute state with YouTube iframe via postMessage
  useEffect(() => {
    if (iframeRef.current && isTrailerPlaying && trailerKey) {
      try {
        const action = isMuted ? 'mute' : 'unMute';
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: action, args: [] }),
          '*'
        );
      } catch {
        // ignore
      }
    }
  }, [isMuted, isTrailerPlaying, trailerKey]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
    };
  }, []);

  if (!activeMovie || !activeRect) return null;

  const inList = isInMyList(activeMovie.id);
  const watchProgress = getWatchProgress(activeMovie.slug || activeMovie.id);

  // Responsive width calculation
  const popoutWidth = typeof window !== 'undefined'
    ? Math.min(365, window.innerWidth - 32)
    : 350;

  // Horizontal position with edge boundary detection
  let left = activeRect.left + (activeRect.width - popoutWidth) / 2;
  let transformOrigin = 'center center';

  if (typeof window !== 'undefined') {
    if (left < 16) {
      left = 16;
      transformOrigin = 'left center';
    } else if (left + popoutWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoutWidth - 16;
      transformOrigin = 'right center';
    }
  }

  // Vertical position with viewport boundary detection
  let top = activeRect.top - 40;
  if (top < 70) top = 70;
  if (typeof window !== 'undefined' && top + 370 > window.innerHeight) {
    top = Math.max(70, window.innerHeight - 380);
    transformOrigin = `${transformOrigin.split(' ')[0]} bottom`;
  }

  const handleMouseEnter = () => {
    onPopoutEnter();
  };

  const handleMouseLeave = () => {
    onPopoutLeave();
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeHoverPopoutNow();
    if (watchProgress?.episodeEmbed) {
      startPlaying(activeMovie, watchProgress.episodeEmbed, watchProgress.episodeTitle);
    } else {
      startPlaying(activeMovie);
    }
  };

  const handleOpenDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeHoverPopoutNow();
    openModal(activeMovie);
  };

  const mainImage = activeMovie.backdropUrl || activeMovie.posterUrl;

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${popoutWidth}px`,
        transformOrigin,
        transition: isOpen
          ? 'left 380ms cubic-bezier(0.25, 1, 0.4, 1), top 380ms cubic-bezier(0.25, 1, 0.4, 1), transform 450ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 450ms ease-out'
          : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out',
        transform: isOpen ? 'scale(1) translateY(0px)' : 'scale(0.92) translateY(5px)',
        opacity: isOpen ? 1 : 0,
        boxShadow: isOpen
          ? '0 30px 60px -12px rgba(0, 0, 0, 0.95), 0 0 24px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.15)'
          : 'none',
      }}
      className="z-50 bg-[#181818] rounded-xl overflow-hidden text-white select-none pointer-events-auto will-change-transform"
    >
      {/* Upper 16:9 Banner Preview */}
      <div
        onClick={handleOpenDetail}
        className="relative aspect-video w-full bg-zinc-900 overflow-hidden cursor-pointer group"
      >
        {/* Ambient Blur Layer */}
        <div
          key={`blur-${activeMovie.id}`}
          className="absolute inset-0 bg-cover bg-center filter blur-md scale-110 opacity-40 pointer-events-none transition-all duration-500"
          style={{ backgroundImage: `url('${mainImage}')` }}
        />

        {/* Sharp Image Layer */}
        <img
          key={`img-${activeMovie.id}`}
          src={mainImage}
          alt={activeMovie.title}
          className={`relative w-full h-full object-cover object-top transition-all duration-700 ${
            isTrailerPlaying && trailerKey && isTrailerReady
              ? 'opacity-0 scale-100'
              : 'opacity-100 group-hover:scale-105'
          }`}
        />

        {/* Live YouTube Trailer Player (Autoplay, Loop, Muted or synced with isMuted) */}
        {isTrailerPlaying && trailerKey && (
          <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none flex items-center justify-center">
            <iframe
              ref={iframeRef}
              src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=${trailerKey}&playsinline=1&enablejsapi=1&vq=hd1080${
                typeof window !== 'undefined' && window.location.origin
                  ? `&origin=${encodeURIComponent(window.location.origin)}`
                  : ''
              }`}
              title={`${activeMovie.title} Trailer`}
              onLoad={() => {
                // Do NOT set isTrailerReady = true here. It must ONLY be set when playerState === 1
                try {
                  iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'listening' }),
                    '*'
                  );
                } catch {}

                // Enforce Full HD 1080p stream
                try {
                  iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: 'setPlaybackQuality', args: ['hd1080'] }),
                    '*'
                  );
                  iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: 'setPlaybackQualityRange', args: [['hd1080', 'highres']] }),
                    '*'
                  );
                } catch {}

                // Proactively start playback
                try {
                  iframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
                    '*'
                  );
                } catch {}

                setTimeout(() => {
                  try {
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
                      '*'
                    );
                  } catch {}
                }, 150);

                if (!isMuted) {
                  try {
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'command', func: 'unMute', args: '' }),
                      '*'
                    );
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
                      '*'
                    );
                  } catch {}
                } else {
                  try {
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'command', func: 'mute', args: '' }),
                      '*'
                    );
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }),
                      '*'
                    );
                  } catch {}
                }
              }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[116%] h-[132%] min-w-full min-h-full object-cover transition-opacity duration-700 ${
                isTrailerReady ? 'opacity-100' : 'opacity-0'
              }`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        )}

        {/* Top-Right Netflix 'N' or Top 10 + Trailer Badge */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
          {isTrailerPlaying && trailerKey && isTrailerReady && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-600/95 text-white backdrop-blur shadow-md animate-pulse">
              Trailer
            </span>
          )}
          {activeMovie.badges?.isTop10 ? (
            <Top10Badge size="sm" />
          ) : (
            <div className="bg-black/40 backdrop-blur p-1 rounded-sm">
              <NetflixRibbonN className="w-4 h-6 drop-shadow" />
            </div>
          )}
        </div>

        {/* Bottom Title & Mute Button Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-black/20 to-transparent flex items-end justify-between p-3.5 z-10 pointer-events-none">
          <h3 className="text-white font-black text-sm sm:text-base drop-shadow-md line-clamp-1 uppercase tracking-tight max-w-[80%]">
            {activeMovie.title}
          </h3>

          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            aria-label="Âm thanh"
            className="w-7 h-7 rounded-full bg-zinc-900/80 border border-white/20 hover:border-white text-white flex items-center justify-center transition active:scale-90 pointer-events-auto shadow-md"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
          </button>
        </div>
      </div>

      {/* Lower Info & Actions Section */}
      <div key={`info-${activeMovie.id}`} className="p-3.5 sm:p-4 space-y-3 animate-in fade-in duration-300">
        {/* Row of Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play Button */}
            <button
              onClick={handlePlay}
              title="Phát"
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 active:scale-95 transition-all shadow-lg hover:scale-105 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black ml-0.5" />
            </button>

            {/* My List Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMyList(activeMovie);
              }}
              title={inList ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách'}
              className="w-9 h-9 rounded-full border border-white/40 bg-zinc-800/80 hover:border-white text-white flex items-center justify-center active:scale-95 transition-all hover:scale-105 cursor-pointer"
            >
              {inList ? <Check className="w-4 h-4 text-green-400" /> : <Plus className="w-4 h-4" />}
            </button>

            {/* Remove from row ('X') Button - exactly like Netflix */}
            {watchProgress && (
              <div className="relative group/removeBtn">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const key = activeMovie.slug || activeMovie.id;
                    clearWatchProgress(key);
                    closeHoverPopoutNow();
                  }}
                  aria-label="Xóa khỏi hàng"
                  className="w-9 h-9 rounded-full border border-white/40 bg-zinc-800/80 hover:border-white hover:bg-zinc-700 text-white flex items-center justify-center active:scale-95 transition-all hover:scale-105 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Netflix-style Tooltip bubble with triangle */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-white text-black text-[11px] font-bold rounded shadow-2xl whitespace-nowrap opacity-0 group-hover/removeBtn:opacity-100 transition-opacity duration-200 pointer-events-none z-30 flex flex-col items-center">
                  <span>Xóa khỏi hàng</span>
                  <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-white -mb-1 mt-0.5" />
                </div>
              </div>
            )}

            {/* Like Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLiked(!isLiked);
              }}
              title="Thích"
              className={`w-9 h-9 rounded-full border border-white/40 bg-zinc-800/80 hover:border-white flex items-center justify-center active:scale-95 transition-all hover:scale-105 cursor-pointer ${
                isLiked ? 'text-blue-400 border-blue-400' : 'text-white'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
          </div>

          {/* More Info / Chevron Down */}
          <button
            onClick={handleOpenDetail}
            title="Chi tiết"
            className="w-9 h-9 rounded-full border border-white/40 bg-zinc-800/80 hover:border-white text-white flex items-center justify-center active:scale-95 transition-all hover:scale-105 cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Watch Progress Section if user has watched */}
        {watchProgress ? (
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
              <span className="text-red-400">{watchProgress.episodeTitle || 'Đang xem dở'}</span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {Math.round(watchProgress.currentTime / 60)}/
                {activeMovie.durationMinutes || Math.round(watchProgress.duration / 60) || 45}ph
              </span>
            </div>
            {/* Netflix Red Progress Bar */}
            <div className="w-full bg-zinc-700 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-[#E50914] h-full rounded-full transition-all duration-300"
                style={{ width: `${watchProgress.progressPercent}%` }}
              />
            </div>
          </div>
        ) : (
          /* Normal Metadata if not yet watched */
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-400 font-bold">{activeMovie.matchRate}% Phù hợp</span>
            <RatingBadge rating={activeMovie.rating} className="text-[10px]" />
            <span className="text-zinc-400 font-medium">{activeMovie.duration || activeMovie.seasons}</span>
            {activeMovie.quality && (
              <QualityBadge quality={activeMovie.quality} className="text-[10px]" />
            )}
          </div>
        )}

        {/* Genres Line */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-300 line-clamp-1 pt-0.5 border-t border-zinc-800/60">
          {activeMovie.genres.slice(0, 3).map((genre, idx) => (
            <span key={genre} className="flex items-center gap-1.5">
              {idx > 0 && <span className="text-zinc-600 font-bold">•</span>}
              <span>{genre}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
