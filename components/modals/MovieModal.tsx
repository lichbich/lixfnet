'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Play,
  Plus,
  Check,
  ThumbsUp,
  Volume2,
  VolumeX,
  Tv,
  Loader2,
} from 'lucide-react';
import { RatingBadge, QualityBadge } from '@/components/ui/Badge';
import { useNetflix } from '@/context/NetflixContext';
import { getSimilarMovies } from '@/services/movieApi';
import { Movie } from '@/types';

export const MovieModal: React.FC = () => {
  const {
    selectedMovie,
    closeModal,
    startPlaying,
    toggleMyList,
    isInMyList,
    openModal,
    isLoadingDetail,
    getWatchProgress,
    getEpisodeProgress,
    isMuted,
    toggleMute,
  } = useNetflix();

  const [activeServerIndex, setActiveServerIndex] = useState(0);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [isLiked, setIsLiked] = useState(false);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  const [episodeRangeIndex, setEpisodeRangeIndex] = useState<number | 'all'>(0);

  // Smooth enter & exit animation state
  const [displayedMovie, setDisplayedMovie] = useState<Movie | null>(selectedMovie);
  const [isOpen, setIsOpen] = useState(false);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modal trailer states & 3-second idle timer
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [backupKeys, setBackupKeys] = useState<string[]>([]);
  const [isTrailerPlaying, setIsTrailerPlaying] = useState<boolean>(false);
  const [isTrailerReady, setIsTrailerReady] = useState<boolean>(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (selectedMovie) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setDisplayedMovie(selectedMovie);
      // Double rAF ensures smooth CSS bloom transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsOpen(true);
        });
      });
    } else if (isOpen) {
      setIsOpen(false);
      exitTimerRef.current = setTimeout(() => {
        setDisplayedMovie(null);
        exitTimerRef.current = null;
      }, 260);
    }
  }, [selectedMovie]);

  // Fetch and start trailer swiftly when modal opens
  useEffect(() => {
    setIsTrailerPlaying(false);
    setIsTrailerReady(false);
    setTrailerKey(null);
    setBackupKeys([]);

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (!displayedMovie || !isOpen) return;

    let isCancelled = false;
    const movieSlug = displayedMovie.slug || displayedMovie.id;

    // Start trailer swiftly after 800ms of opening modal
    const startTrailer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (!isCancelled) {
          setIsTrailerPlaying(true);
        }
      }, 800);
    };

    let cachedKey: string | null = null;
    try {
      cachedKey = sessionStorage.getItem(`netlix_trailer_${movieSlug}`);
    } catch {
      // ignore
    }

    if (cachedKey && cachedKey !== 'none') {
      setTrailerKey(cachedKey);
      startTrailer();
    } else {
      const qTitle = encodeURIComponent(displayedMovie.title || '');
      const qSub = encodeURIComponent(displayedMovie.subTitle || '');
      const qSlug = encodeURIComponent(movieSlug);
      const qYear = encodeURIComponent(displayedMovie.year ? String(displayedMovie.year) : '');
      const qTmdbId = encodeURIComponent(displayedMovie.tmdb?.id ? String(displayedMovie.tmdb.id) : '');
      const qMediaType = encodeURIComponent(displayedMovie.tmdb?.type || '');

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
            startTrailer();
          } else {
            setTrailerKey(null);
            setIsTrailerPlaying(false);
            setIsTrailerReady(false);
          }
        })
        .catch(() => {});
    }

    return () => {
      isCancelled = true;
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [displayedMovie?.id, isOpen]);

  // Sync mute/unmute state with modal trailer iframe
  useEffect(() => {
    if (iframeRef.current && isTrailerPlaying && trailerKey) {
      try {
        const action = isMuted ? 'mute' : 'unMute';
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: action, args: '' }),
          '*'
        );
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: action, args: [] }),
          '*'
        );
      } catch {
        // ignore
      }
    }
  }, [isMuted, isTrailerPlaying, trailerKey]);

  // Pause modal trailer when tab is hidden or user switches app, resume on return
  useEffect(() => {
    if (!isOpen || !isTrailerPlaying) return;

    const handleVisibility = () => {
      if (!iframeRef.current?.contentWindow) return;
      const isVisible = document.visibilityState === 'visible';
      if (!isVisible) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }),
          '*'
        );
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'mute', args: '' }),
          '*'
        );
      } else {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
          '*'
        );
        if (!isMuted) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'unMute', args: '' }),
            '*'
          );
        }
      }
    };

    const handleBlur = () => {
      if (!iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }),
        '*'
      );
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'mute', args: '' }),
        '*'
      );
    };

    const handleFocus = () => {
      if (!iframeRef.current?.contentWindow) return;
      if (document.visibilityState === 'visible') {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
          '*'
        );
        if (!isMuted) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'unMute', args: '' }),
            '*'
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handleBlur);
    };
  }, [isOpen, isTrailerPlaying, isMuted]);

  // Graceful close handler with exit animation and cleanup
  const handleClose = useCallback(() => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setIsTrailerPlaying(false);
    setIsTrailerReady(false);
    setIsOpen(false);
    exitTimerRef.current = setTimeout(() => {
      closeModal();
      setDisplayedMovie(null);
      setTrailerKey(null);
      exitTimerRef.current = null;
    }, 260);
  }, [closeModal]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (displayedMovie) {
      document.body.style.overflow = 'hidden';
      setActiveServerIndex(0);
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [displayedMovie]);

  // Load similar movies prioritized by: 1. Country, 2. Genres, 3. Main Cast
  useEffect(() => {
    const target = displayedMovie;
    if (!target) return;
    let isCancelled = false;

    async function loadSimilar() {
      setIsLoadingSimilar(true);
      try {
        const results = await getSimilarMovies(target, 6);
        if (!isCancelled) {
          setSimilarMovies(results);
        }
      } catch (err) {
        console.error('Failed to load similar titles:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingSimilar(false);
        }
      }
    }

    loadSimilar();

    return () => {
      isCancelled = true;
    };
  }, [displayedMovie?.id, displayedMovie?.slug, displayedMovie?.countrySlug, displayedMovie?.country]);

  // Auto-sync episode range tab to the currently watched episode for long series
  useEffect(() => {
    if (!displayedMovie) return;
    const targetServer = displayedMovie.episodesServers?.[activeServerIndex];
    const items = targetServer?.items || [];
    if (items.length <= 25) {
      setEpisodeRangeIndex(0);
      return;
    }
    const movieKey = displayedMovie.slug || displayedMovie.id;
    const wp = getWatchProgress(movieKey);
    const currentEpIndex = items.findIndex((ep) => {
      return (
        Boolean(wp?.episodeTitle) &&
        (wp?.episodeTitle === `Tập ${ep.name}` ||
          wp?.episodeTitle === ep.name ||
          wp?.episodeTitle?.endsWith(` ${ep.name}`) ||
          wp?.episodeTitle?.includes(`Tập ${ep.name} `))
      );
    });
    if (currentEpIndex >= 0) {
      setEpisodeRangeIndex(Math.floor(currentEpIndex / 25));
    } else {
      setEpisodeRangeIndex(0);
    }
  }, [displayedMovie?.id, displayedMovie?.slug, displayedMovie?.episodesServers, activeServerIndex, getWatchProgress]);

  if (!displayedMovie) return null;

  const movie = displayedMovie;
  const movieKey = movie.slug || movie.id;
  const watchProgress = getWatchProgress(movieKey);
  const inList = isInMyList(movie.id);

  // Dynamic real duration for movie & episodes
  const epDurationMinutes =
    movie.durationMinutes ||
    (watchProgress?.duration ? Math.round(watchProgress.duration / 60) : 45);
  const epDurationLabel = movie.duration || `${epDurationMinutes} phút`;

  const currentSeasonData = movie.seasonsList?.find(
    (s) => s.seasonNumber === selectedSeason
  );

  const activeServer = movie.episodesServers?.[activeServerIndex];
  const allEpisodes = activeServer?.items || [];
  const CHUNK_SIZE = 25;
  const totalEpisodeChunks = Math.ceil(allEpisodes.length / CHUNK_SIZE);

  const visibleEpisodes =
    episodeRangeIndex === 'all' || allEpisodes.length <= CHUNK_SIZE
      ? allEpisodes
      : allEpisodes.slice(
          (episodeRangeIndex as number) * CHUNK_SIZE,
          ((episodeRangeIndex as number) + 1) * CHUNK_SIZE
        );

  const hasApiEpisodes = Boolean(movie.episodesServers && movie.episodesServers.length > 0);
  const isExpectedSeriesOrEpisodes =
    Boolean(movie.slug) ||
    movie.type === 'series' ||
    Boolean(movie.seasons?.includes('Tập')) ||
    Boolean(movie.seasons?.includes('mùa')) ||
    Boolean(movie.seasons?.includes('Mùa'));
  const showEpisodesSkeleton = isLoadingDetail && !hasApiEpisodes && isExpectedSeriesOrEpisodes;

  const handlePlayOrResume = () => {
    setIsTrailerPlaying(false);
    setIsTrailerReady(false);
    handleClose();
    if (watchProgress?.episodeEmbed) {
      startPlaying(movie, watchProgress.episodeEmbed, watchProgress.episodeTitle);
    } else if (activeServer && activeServer.items.length > 0) {
      const firstEp = activeServer.items[0];
      startPlaying(movie, firstEp.embed, `Tập ${firstEp.name}`);
    } else if (movie.embedUrl) {
      startPlaying(movie, movie.embedUrl, movie.currentEpisode || 'Xem phim');
    } else {
      startPlaying(movie);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto flex justify-center p-0 sm:p-4 md:p-6 transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Click outside to close backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Modal Dialog Card */}
      <div
        style={{
          transform: isOpen ? 'scale(1) translateY(0px)' : 'scale(0.92) translateY(24px)',
          opacity: isOpen ? 1 : 0,
          transition: 'transform 340ms cubic-bezier(0.16, 1, 0.3, 1), opacity 260ms ease-out',
        }}
        className="relative w-full max-w-4xl bg-[#181818] rounded-xl overflow-hidden shadow-2xl z-10 my-auto text-white border border-white/10 will-change-transform"
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          aria-label="Đóng"
          className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-[#181818]/80 hover:bg-[#181818] border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Backdrop Banner Header */}
        <div className="relative aspect-[16/9] w-full max-h-[460px] bg-zinc-900 overflow-hidden">
          {/* Ambient blurred backdrop layer */}
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-xl scale-110 opacity-40 pointer-events-none"
            style={{
              backgroundImage: `url('${movie.backdropUrl || movie.posterUrl}')`,
            }}
          />
          <img
            src={movie.backdropUrl || movie.posterUrl}
            alt={movie.title}
            className={`relative w-full h-full object-cover object-top transition-opacity duration-1000 ${
              isTrailerPlaying && trailerKey && isTrailerReady ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* Live YouTube Trailer Player with 3s Idle Autoplay */}
          {isTrailerPlaying && trailerKey && (
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
              <iframe
                ref={iframeRef}
                src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&modestbranding=1&rel=0&loop=1&playlist=${trailerKey}&playsinline=1&enablejsapi=1${
                  typeof window !== 'undefined' && window.location.origin
                    ? `&origin=${encodeURIComponent(window.location.origin)}`
                    : ''
                }`}
                title={`${movie.title} Trailer`}
                onLoad={() => {
                  setIsTrailerReady(true);
                  try {
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'listening' }),
                      '*'
                    );
                  } catch {}

                  const isAppActive =
                    typeof document !== 'undefined'
                      ? document.visibilityState === 'visible' && document.hasFocus()
                      : true;
                  if (!isAppActive) {
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }),
                      '*'
                    );
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'command', func: 'mute', args: '' }),
                      '*'
                    );
                  } else if (!isMuted) {
                    iframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'command', func: 'unMute', args: '' }),
                      '*'
                    );
                  }
                }}
                className={`w-[124%] h-[124%] -ml-[12%] -mt-[12%] object-cover transition-opacity duration-1000 ${
                  isTrailerReady ? 'opacity-100' : 'opacity-0'
                }`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          )}

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-black/30 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none" />

          {/* Banner Controls & Title */}
          <div className="absolute bottom-8 left-6 sm:left-10 right-6 sm:right-10 flex items-end justify-between">
            <div className="max-w-xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight drop-shadow-lg text-white">
                {movie.title}
              </h1>
              {movie.subTitle && (
                <p className="text-sm sm:text-base text-zinc-300 font-semibold tracking-wider uppercase mt-1 drop-shadow">
                  {movie.subTitle}
                </p>
              )}

              {/* Action Buttons & In-Progress Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePlayOrResume}
                    className="flex items-center gap-2 bg-white text-black font-bold px-6 py-2.5 rounded-md hover:bg-white/90 active:scale-95 transition shadow-lg text-sm sm:text-base group"
                  >
                    <Play className="w-5 h-5 fill-black" />
                    <span>{watchProgress ? 'Tiếp tục xem' : 'Phát'}</span>
                  </button>

                  <button
                    onClick={() => toggleMyList(movie)}
                    aria-label={inList ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách'}
                    className="w-10 h-10 rounded-full border-2 border-white/40 bg-zinc-900/60 hover:border-white text-white flex items-center justify-center active:scale-95 transition"
                  >
                    {inList ? <Check className="w-5 h-5 text-green-400" /> : <Plus className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setIsLiked(!isLiked)}
                    aria-label="Thích"
                    className={`w-10 h-10 rounded-full border-2 border-white/40 bg-zinc-900/60 hover:border-white flex items-center justify-center active:scale-95 transition ${
                      isLiked ? 'text-blue-400 border-blue-400' : 'text-white'
                    }`}
                  >
                    <ThumbsUp className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress pill if user has watched */}
                {watchProgress && (
                  <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 max-w-fit shadow-md">
                    <div className="w-20 sm:w-28 bg-zinc-700/80 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#E50914] h-full rounded-full transition-all duration-300"
                        style={{ width: `${watchProgress.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-300 font-semibold whitespace-nowrap">
                      {watchProgress.episodeTitle || 'Tập 1'} • {Math.round(watchProgress.currentTime / 60)}/{epDurationMinutes}ph
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mute button */}
            <button
              onClick={toggleMute}
              aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              className="w-10 h-10 rounded-full border border-white/30 bg-zinc-900/60 hover:bg-zinc-900 text-white flex items-center justify-center transition cursor-pointer active:scale-95 shadow-md"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>

        {/* Modal Body Info */}
        <div className="px-6 sm:px-10 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Left 2 cols: Synopsis and details */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-green-400 font-bold">{movie.matchRate}% Phù hợp</span>
                <span className="text-zinc-400 font-medium">{movie.year}</span>
                <RatingBadge rating={movie.rating} />
                <span className="text-zinc-300 font-medium">{movie.seasons}</span>
                {movie.duration && (
                  <span className="text-zinc-400 font-medium border border-zinc-700/80 px-1.5 py-0.5 rounded text-xs">
                    {movie.duration}
                  </span>
                )}
                {movie.quality && <QualityBadge quality={movie.quality} />}
                {movie.audioTags?.map((tag) => (
                  <span key={tag} className="border border-white/30 text-white/70 text-[10px] px-1 rounded">
                    {tag}
                  </span>
                ))}
              </div>

              <p className="text-sm sm:text-base text-zinc-200 leading-relaxed font-normal">
                {movie.description}
              </p>
            </div>

            {/* Right col: Cast, Genres, Director */}
            <div className="space-y-3 text-xs sm:text-sm text-zinc-400">
              {movie.cast && movie.cast.length > 0 && (
                <div>
                  <span className="text-zinc-500">Diễn viên: </span>
                  <span className="text-zinc-300">{movie.cast.join(', ')}</span>
                </div>
              )}
              {movie.genres && (
                <div>
                  <span className="text-zinc-500">Thể loại: </span>
                  <span className="text-zinc-300">{movie.genres.join(', ')}</span>
                </div>
              )}
              {movie.tags && movie.tags.length > 0 && (
                <div>
                  <span className="text-zinc-500">Thuộc tính: </span>
                  <span className="text-zinc-300">{movie.tags.join(', ')}</span>
                </div>
              )}
              {movie.director && (
                <div>
                  <span className="text-zinc-500">Đạo diễn: </span>
                  <span className="text-zinc-300">{movie.director}</span>
                </div>
              )}
            </div>
          </div>

          {/* SKELETON LOADER FOR EPISODES LIST (while loading movie detail from API) */}
          {showEpisodesSkeleton && (
            <div className="mt-10 border-t border-zinc-800/80 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <Tv className="w-5 h-5 text-red-500 animate-pulse" />
                  <h3 className="text-xl font-bold text-white tracking-tight">Danh sách tập phim</h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-zinc-400 bg-zinc-800/70 border border-white/5 shadow-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                    Đang tải tập phim...
                  </span>
                </div>

                {/* Shimmer server buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-medium">Máy chủ:</span>
                  <div className="flex gap-1.5 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800/80">
                    <div className="relative overflow-hidden w-20 h-7 rounded bg-zinc-800/80">
                      <div className="absolute inset-0 -translate-x-full animate-netflix-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                    </div>
                    <div className="relative overflow-hidden w-24 h-7 rounded bg-zinc-800/50">
                      <div className="absolute inset-0 -translate-x-full animate-netflix-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid of Skeleton Episode Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-3.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="relative flex flex-col justify-between p-3.5 rounded-xl border border-white/5 bg-zinc-900/50 overflow-hidden min-h-[96px]"
                  >
                    {/* Netflix Shimmer Sweep */}
                    <div className="absolute inset-0 -translate-x-full animate-netflix-shimmer bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />

                    {/* Top row */}
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="h-4 w-14 bg-zinc-800/90 rounded-md animate-pulse" />
                      <div className="w-6 h-6 rounded-full bg-zinc-800/60 animate-pulse" />
                    </div>

                    {/* Duration / Subtitle */}
                    <div className="h-3 w-16 bg-zinc-800/50 rounded animate-pulse mb-3" />

                    {/* Bottom Progress Bar Skeleton */}
                    <div className="w-full mt-auto space-y-1.5">
                      <div className="w-full bg-zinc-800/60 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-zinc-700/50 h-full rounded-full transition-all"
                          style={{ width: `${i === 0 ? 60 : i === 1 ? 40 : 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-zinc-600">
                        <div className="h-2.5 w-12 bg-zinc-800/40 rounded animate-pulse" />
                        <div className="h-2.5 w-6 bg-zinc-800/40 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REAL EPISODES LIST FROM API (with Progress tracking) */}
          {hasApiEpisodes && (
            <div className="mt-10 border-t border-zinc-800 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <Tv className="w-5 h-5 text-red-500" />
                  <h3 className="text-xl font-bold text-white tracking-tight">Danh sách tập phim</h3>
                  {allEpisodes.length > 0 && (
                    <span className="text-xs text-zinc-400 font-medium bg-zinc-800/80 px-2.5 py-0.5 rounded-full border border-white/5">
                      {allEpisodes.length} tập
                    </span>
                  )}
                  {isLoadingDetail && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-red-400 bg-red-950/30 px-2.5 py-0.5 rounded-full border border-red-500/20">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Đang cập nhật...
                    </span>
                  )}
                </div>

                {/* Server Switcher */}
                {movie.episodesServers && movie.episodesServers.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 font-medium">Máy chủ:</span>
                    <div className="flex gap-1.5 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800">
                      {movie.episodesServers.map((server, idx) => (
                        <button
                          key={server.server_name}
                          onClick={() => setActiveServerIndex(idx)}
                          className={`text-xs px-3 py-1 rounded-md font-medium transition-all ${
                            activeServerIndex === idx
                              ? 'bg-red-600 text-white font-bold shadow-md shadow-red-600/30'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                          }`}
                        >
                          {server.server_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Episode Range Tabs (for series with > 25 episodes) */}
              {allEpisodes.length > CHUNK_SIZE && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
                  <span className="text-xs text-zinc-400 font-medium shrink-0">Khoảng tập:</span>
                  {Array.from({ length: totalEpisodeChunks }).map((_, chunkIdx) => {
                    const startEp = chunkIdx * CHUNK_SIZE + 1;
                    const endEp = Math.min((chunkIdx + 1) * CHUNK_SIZE, allEpisodes.length);
                    const isSelected = episodeRangeIndex === chunkIdx;
                    return (
                      <button
                        key={chunkIdx}
                        onClick={() => setEpisodeRangeIndex(chunkIdx)}
                        className={`text-xs px-3 py-1 rounded-full font-medium shrink-0 transition-all ${
                          isSelected
                            ? 'bg-white text-black font-bold shadow-sm'
                            : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700/80 border border-white/5'
                        }`}
                      >
                        Tập {startEp} - {endEp}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setEpisodeRangeIndex('all')}
                    className={`text-xs px-3 py-1 rounded-full font-medium shrink-0 transition-all ${
                      episodeRangeIndex === 'all'
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700/80 border border-white/5'
                    }`}
                  >
                    Tất cả ({allEpisodes.length})
                  </button>
                </div>
              )}

              {/* Episodes Grid with Individual Progress Tracking */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-3.5">
                {visibleEpisodes.map((ep) => {
                  const epProg = getEpisodeProgress(movieKey, ep.name);
                  const isCurrent =
                    Boolean(watchProgress?.episodeTitle) &&
                    (watchProgress?.episodeTitle === `Tập ${ep.name}` ||
                      watchProgress?.episodeTitle === ep.name ||
                      watchProgress?.episodeTitle?.endsWith(` ${ep.name}`) ||
                      watchProgress?.episodeTitle?.includes(`Tập ${ep.name} `));
                  const percent = epProg?.progressPercent || (isCurrent ? watchProgress?.progressPercent : 0);
                  const isCompleted = epProg?.isCompleted;

                  return (
                    <button
                      key={ep.slug}
                      onClick={() => {
                        handleClose();
                        startPlaying(movie, ep.embed, `Tập ${ep.name}`);
                      }}
                      className={`relative flex flex-col justify-between p-3.5 rounded-xl transition-all duration-200 text-left group border min-h-[96px] ${
                        isCurrent
                          ? 'bg-gradient-to-br from-red-950/40 via-zinc-900 to-zinc-900 border-red-500 shadow-[0_0_20px_rgba(229,9,20,0.25)] ring-1 ring-red-500/70 scale-[1.01]'
                          : isCompleted
                          ? 'bg-zinc-900/60 border-white/10 hover:border-white/30 hover:bg-zinc-800/80 hover:-translate-y-0.5'
                          : 'bg-zinc-900/40 border-white/5 hover:border-white/20 hover:bg-zinc-800/70 hover:-translate-y-0.5'
                      }`}
                    >
                      {/* Top Row: Single Clean Episode Title & Status Badge */}
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-bold text-white truncate tracking-tight group-hover:text-red-400 transition-colors">
                            Tập {ep.name}
                          </span>
                        </div>

                        {/* Status Badge */}
                        {isCurrent ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-red-600 text-white shadow-[0_0_12px_rgba(229,9,20,0.6)] border border-red-400/40 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            Đang xem
                          </span>
                        ) : isCompleted ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 whitespace-nowrap">
                            <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                            Đã xem
                          </span>
                        ) : (
                          <div className="shrink-0 w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:bg-red-600 group-hover:text-white group-hover:border-red-600 group-hover:scale-105 transition-all duration-200">
                            <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                          </div>
                        )}
                      </div>

                      {/* Middle Info: Duration / Status */}
                      <div className="flex items-center justify-between text-xs text-zinc-400 font-normal mt-1 mb-2.5">
                        <span className="truncate">{epDurationLabel}</span>
                        {isCurrent ? (
                          <span className="text-[10px] font-semibold text-red-400 shrink-0">Tiếp tục &rarr;</span>
                        ) : !isCompleted && !percent ? (
                          <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            Phát &gt;
                          </span>
                        ) : null}
                      </div>

                      {/* Bottom Progress Bar */}
                      <div className="w-full mt-auto">
                        {percent && percent > 0 ? (
                          <div>
                            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isCompleted
                                    ? 'bg-emerald-500'
                                    : 'bg-red-600 shadow-[0_0_8px_rgba(229,9,20,0.6)]'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(percent, 4))}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-1 font-mono">
                              <span className={isCurrent ? 'text-zinc-200 font-semibold' : ''}>
                                {isCompleted
                                  ? 'Hoàn thành'
                                  : `${epProg ? Math.round(epProg.currentTime / 60) : (isCurrent ? Math.round((watchProgress?.currentTime || 0) / 60) : 0)}/${epDurationMinutes}ph`}
                              </span>
                              <span className="text-zinc-500">{Math.round(percent)}%</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="w-full bg-zinc-800/40 h-1.5 rounded-full overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="h-full bg-white/20 rounded-full w-full" />
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-zinc-500 mt-1">
                              <span>Chưa xem</span>
                              <span className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                Bắt đầu
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* FALLBACK MOCK EPISODES LIST (if no API server) */}
          {!showEpisodesSkeleton &&
            !hasApiEpisodes &&
            movie.seasonsList &&
            movie.seasonsList.length > 0 && (
              <div className="mt-10 border-t border-zinc-800 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Tập</h3>
                  {movie.seasonsList.length > 1 && (
                    <select
                      value={selectedSeason}
                      onChange={(e) => setSelectedSeason(Number(e.target.value))}
                      className="bg-[#242424] text-white text-sm font-semibold px-3 py-1.5 rounded border border-zinc-700 outline-none cursor-pointer"
                    >
                      {movie.seasonsList.map((season) => (
                        <option key={season.seasonNumber} value={season.seasonNumber}>
                          {season.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-3">
                  {currentSeasonData?.episodes.map((ep) => {
                    const epProg = getEpisodeProgress(movieKey, ep.number.toString());
                    const isCurrent =
                      Boolean(watchProgress?.episodeTitle) &&
                      (watchProgress?.episodeTitle === `Tập ${ep.number}` ||
                        watchProgress?.episodeTitle === ep.title);
                    const percent = epProg?.progressPercent || (isCurrent ? watchProgress?.progressPercent : 0);

                    return (
                      <div
                        key={ep.id}
                        onClick={() => {
                          handleClose();
                          startPlaying(movie, ep.embedUrl, ep.title);
                        }}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 rounded-lg hover:bg-zinc-800/60 cursor-pointer border-b border-zinc-800/50 transition group"
                      >
                        <span className="text-lg font-bold text-zinc-500 w-6 flex-shrink-0 text-center">
                          {ep.number}
                        </span>
                        <div className="relative w-full sm:w-36 aspect-video rounded overflow-hidden flex-shrink-0 bg-zinc-800">
                          <img
                            src={ep.thumbnail || movie.backdropUrl}
                            alt={ep.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                            <Play className="w-8 h-8 fill-white text-white" />
                          </div>
                          {percent && percent > 0 ? (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700/80">
                              <div className="bg-[#E50914] h-full" style={{ width: `${percent}%` }} />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm">
                            <h4 className="font-bold text-white group-hover:text-red-500 transition flex items-center gap-2">
                              <span>{ep.title}</span>
                              {isCurrent && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-red-600 text-white shadow-[0_0_12px_rgba(229,9,20,0.6)] border border-red-400/40 whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  Đang xem
                                </span>
                              )}
                            </h4>
                            {ep.duration && <span className="text-xs text-zinc-400">{ep.duration}</span>}
                          </div>
                          {ep.description && (
                            <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                              {ep.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* More Like This (Nội dung tương tự) */}
          <div className="mt-10 border-t border-zinc-800 pt-6">
            <h3 className="text-xl font-bold text-white mb-4">Nội dung tương tự</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {isLoadingSimilar && similarMovies.length === 0
                ? Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="bg-[#202020] rounded-md overflow-hidden border border-white/5 animate-pulse flex flex-col justify-between"
                    >
                      <div className="aspect-video w-full bg-zinc-800/80" />
                      <div className="p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="h-3 w-16 bg-zinc-700/60 rounded" />
                          <div className="w-6 h-6 rounded-full bg-zinc-700/60" />
                        </div>
                        <div className="h-4 w-4/5 bg-zinc-700/80 rounded" />
                        <div className="h-3 w-full bg-zinc-800 rounded" />
                      </div>
                    </div>
                  ))
                : similarMovies.map((simMovie) => (
                    <div
                      key={simMovie.id}
                      onClick={() => openModal(simMovie)}
                      className="bg-[#202020] rounded-md overflow-hidden border border-white/5 hover:border-white/20 transition cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-zinc-800">
                        <div
                          className="absolute inset-0 bg-cover bg-center filter blur-md scale-110 opacity-30 pointer-events-none"
                          style={{ backgroundImage: `url('${simMovie.backdropUrl || simMovie.posterUrl}')` }}
                        />
                        <img
                          src={simMovie.backdropUrl || simMovie.posterUrl}
                          alt={simMovie.title}
                          className="relative w-full h-full object-cover object-top group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute top-2 right-2 bg-black/70 px-1.5 py-0.5 rounded text-[11px] font-bold text-zinc-300">
                          {simMovie.seasons}
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-green-400 font-bold text-xs">
                              {simMovie.matchRate}% Phù hợp
                            </span>
                            {simMovie.country && (
                              <span className="text-[10px] text-zinc-300 font-medium px-1.5 py-0.5 rounded bg-zinc-800/80 border border-white/10">
                                {simMovie.country}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMyList(simMovie);
                            }}
                            className="w-7 h-7 rounded-full border border-white/30 flex items-center justify-center hover:border-white text-white shrink-0"
                          >
                            {isInMyList(simMovie.id) ? (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <h4 className="font-bold text-sm text-white line-clamp-1 uppercase">
                          {simMovie.title}
                        </h4>
                        <p className="text-xs text-zinc-400 line-clamp-2 mt-1">
                          {simMovie.description}
                        </p>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
