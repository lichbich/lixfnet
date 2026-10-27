'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNetflix } from '@/context/NetflixContext';
import { getMovieDetail, formatEpisodeTitle } from '@/services/movieApi';
import { VideoJsPlayer, unlockScreenOrientation } from './VideoJsPlayer';

export const VideoPlayerModal: React.FC = () => {
  const {
    playingMovie,
    stopPlaying,
    currentEpisodeEmbed,
    currentEpisodeTitle,
    currentEpisodeM3u8,
    setPlayingEpisode,
    updateWatchProgress,
    getWatchProgress,
    getEpisodeProgress,
    isLoadingDetail,
    streamProxyUrl,
    isStreamProxyEnabled,
  } = useNetflix();

  const [isExiting, setIsExiting] = useState(false);

  // Active stream and server references
  const activeEmbed = currentEpisodeEmbed || playingMovie?.embedUrl;

  const currentServer = useMemo(() => {
    if (!playingMovie?.episodesServers || playingMovie.episodesServers.length === 0) return null;

    if (activeEmbed || currentEpisodeTitle) {
      const formattedCur = formatEpisodeTitle(currentEpisodeTitle || '');
      for (const srv of playingMovie.episodesServers) {
        const found = srv.items?.some(
          (ep) =>
            (activeEmbed && ep.embed === activeEmbed) ||
            formatEpisodeTitle(ep.name) === formattedCur
        );
        if (found) return srv;
      }
    }

    const serverWithM3u8 = playingMovie.episodesServers.find((srv) =>
      srv.items?.some((ep) => ep.m3u8 && ep.m3u8.trim().length > 0)
    );
    if (serverWithM3u8) return serverWithM3u8;

    return playingMovie.episodesServers[0];
  }, [playingMovie?.episodesServers, activeEmbed, currentEpisodeTitle]);

  const resolvedM3u8 = useMemo(() => {
    if (currentEpisodeM3u8 && currentEpisodeM3u8.trim()) return currentEpisodeM3u8.trim();

    if (currentServer?.items) {
      const match = currentServer.items.find(
        (ep) =>
          (activeEmbed && ep.embed === activeEmbed) ||
          formatEpisodeTitle(ep.name) === formatEpisodeTitle(currentEpisodeTitle || '')
      );
      if (match?.m3u8 && match.m3u8.trim()) return match.m3u8.trim();
    }

    if (playingMovie?.episodesServers) {
      for (const srv of playingMovie.episodesServers) {
        const match = srv.items?.find(
          (ep) =>
            (activeEmbed && ep.embed === activeEmbed) ||
            formatEpisodeTitle(ep.name) === formatEpisodeTitle(currentEpisodeTitle || '')
        );
        if (match?.m3u8 && match.m3u8.trim()) return match.m3u8.trim();
      }
    }

    const isMovieOrEp1 =
      playingMovie?.type === 'movie' ||
      !currentEpisodeTitle ||
      formatEpisodeTitle(currentEpisodeTitle) === 'Tập 1' ||
      formatEpisodeTitle(currentEpisodeTitle) === 'Tập 01';

    if (isMovieOrEp1 && playingMovie?.m3u8Url) {
      return playingMovie.m3u8Url;
    }

    return null;
  }, [currentEpisodeM3u8, currentServer, activeEmbed, currentEpisodeTitle, playingMovie]);

  const effectiveM3u8 = useMemo(() => {
    if (!resolvedM3u8) return '';
    if (isStreamProxyEnabled && streamProxyUrl && !resolvedM3u8.includes('/m3u8?url=')) {
      const cleanBase = streamProxyUrl.replace(/\/+$/, '');
      return `${cleanBase}/m3u8?url=${encodeURIComponent(resolvedM3u8)}`;
    }
    return resolvedM3u8;
  }, [resolvedM3u8, isStreamProxyEnabled, streamProxyUrl]);

  const isDirectHls = Boolean(effectiveM3u8);
  const isLocalVideo = Boolean(playingMovie?.videoUrl && !resolvedM3u8 && !activeEmbed);
  const activeVideoSource = isDirectHls ? effectiveM3u8 : isLocalVideo ? playingMovie?.videoUrl : null;

  // Next episode reference
  const nextEpisode = useMemo(() => {
    if (!currentServer?.items || currentServer.items.length <= 1) return null;
    const currentTitle = formatEpisodeTitle(
      currentEpisodeTitle || playingMovie?.currentEpisode || ''
    );
    const currentIndex = currentServer.items.findIndex(
      (ep) =>
        (activeEmbed && ep.embed === activeEmbed) ||
        (resolvedM3u8 && ep.m3u8 === resolvedM3u8) ||
        formatEpisodeTitle(ep.name) === currentTitle
    );
    if (currentIndex >= 0 && currentIndex + 1 < currentServer.items.length) {
      return currentServer.items[currentIndex + 1];
    }
    return null;
  }, [currentServer, activeEmbed, resolvedM3u8, currentEpisodeTitle, playingMovie?.currentEpisode]);

  // Watch progress tracker refs
  const lastSavedTimeRef = useRef(0);
  const lastCloudSyncTimeRef = useRef(Date.now());
  const currentProgressRef = useRef({ time: 0, duration: 0 });

  // Dedicated saver: updates local state, only syncs to Vercel/Firebase when syncToCloud is true
  const saveProgressNow = useCallback(
    (syncToCloud: boolean = true) => {
      if (!playingMovie || currentProgressRef.current.time <= 0) return;
      if (syncToCloud) {
        lastCloudSyncTimeRef.current = Date.now();
      }
      updateWatchProgress(
        playingMovie,
        Math.round(currentProgressRef.current.time),
        Math.round(currentProgressRef.current.duration || 45 * 60),
        currentEpisodeTitle || playingMovie.currentEpisode,
        activeEmbed || playingMovie.embedUrl,
        resolvedM3u8 || playingMovie.m3u8Url,
        syncToCloud
      );
    },
    [playingMovie, currentEpisodeTitle, activeEmbed, resolvedM3u8, updateWatchProgress]
  );

  const handlePlayNextEpisode = useCallback(() => {
    if (!nextEpisode) return;
    saveProgressNow(true);
    setPlayingEpisode(
      nextEpisode.embed,
      formatEpisodeTitle(nextEpisode.name),
      nextEpisode.m3u8
    );
  }, [nextEpisode, saveProgressNow, setPlayingEpisode]);

  const handleSelectEpisode = useCallback(
    (embed?: string, epTitle?: string, m3u8?: string) => {
      saveProgressNow(true);
      setPlayingEpisode(embed || '', epTitle || 'Tập 1', m3u8);
    },
    [saveProgressNow, setPlayingEpisode]
  );

  // Initial resume playback time
  const initialTime = useMemo(() => {
    if (!playingMovie) return 0;
    const movieKey = playingMovie.slug || playingMovie.id;
    const currentEp = formatEpisodeTitle(currentEpisodeTitle || playingMovie.currentEpisode || 'Tập 1');
    const epProg = getEpisodeProgress(movieKey, currentEp, playingMovie);
    const movieProg = getWatchProgress(movieKey, playingMovie);

    return (
      epProg?.currentTime ||
      (formatEpisodeTitle(currentEp) === formatEpisodeTitle(movieProg?.episodeTitle || '')
        ? movieProg?.currentTime
        : 0) ||
      0
    );
  }, [playingMovie, currentEpisodeTitle, getEpisodeProgress, getWatchProgress]);

  // While playing: updates local state & localStorage (0 server requests). Heartbeat syncs to cloud only every 5 minutes.
  const handleTimeUpdate = useCallback(
    (time: number, dur: number) => {
      currentProgressRef.current = { time, duration: dur };
      if (Math.abs(time - lastSavedTimeRef.current) >= 5 && playingMovie) {
        lastSavedTimeRef.current = time;
        // 1. Update local state & localStorage (0 network requests, 0 Vercel compute)
        saveProgressNow(false);

        // 2. Safety Heartbeat: If user watches continuously without pause for 5 minutes, sync to cloud once
        if (Date.now() - lastCloudSyncTimeRef.current >= 5 * 60 * 1000) {
          saveProgressNow(true);
        }
      }
    },
    [playingMovie, saveProgressNow]
  );

  // Sync to cloud immediately when user pauses video
  const handlePause = useCallback(() => {
    saveProgressNow(true);
  }, [saveProgressNow]);

  // Smooth cinematic fade to black before closing, syncing progress to cloud
  const handleClose = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);

    // Cleanly exit fullscreen if active
    if (typeof document !== 'undefined') {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitFullscreenElement && (document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
    unlockScreenOrientation();

    // Persist to cloud on exit
    saveProgressNow(true);

    setTimeout(() => {
      stopPlaying();
      setIsExiting(false);
      try {
        if (typeof window !== 'undefined' && window.history.state?.lixfnetPlayer) {
          window.history.back();
        }
      } catch {}
    }, 350);
  }, [isExiting, saveProgressNow, stopPlaying]);

  // Flush progress when tab is closed, switched away, or backgrounded
  useEffect(() => {
    if (!playingMovie) return;
    const handleUnloadOrHide = () => {
      saveProgressNow(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveProgressNow(true);
      }
    };

    window.addEventListener('pagehide', handleUnloadOrHide);
    window.addEventListener('beforeunload', handleUnloadOrHide);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pagehide', handleUnloadOrHide);
      window.removeEventListener('beforeunload', handleUnloadOrHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [playingMovie?.id, saveProgressNow]);

  // Ensure orientation lock is released when unmounting
  useEffect(() => {
    return () => {
      unlockScreenOrientation();
    };
  }, []);

  // Escape key listener to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!playingMovie) return;
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playingMovie, handleClose]);

  // Android hardware back / browser history integration
  useEffect(() => {
    if (!playingMovie) return;
    try {
      window.history.pushState({ lixfnetPlayer: true }, '');
    } catch {}

    const handlePop = () => {
      handleClose();
    };

    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
    };
  }, [playingMovie?.id, handleClose]);

  // Resolve stream if missing
  useEffect(() => {
    if (playingMovie && !activeEmbed && !resolvedM3u8 && playingMovie.slug) {
      let isCancelled = false;
      const key = playingMovie.slug || playingMovie.id;
      const wp = getWatchProgress(key, playingMovie);

      if (wp?.episodeEmbed || wp?.episodeM3u8) {
        setPlayingEpisode(wp.episodeEmbed || '', wp.episodeTitle || 'Tập 1', wp.episodeM3u8);
      } else {
        getMovieDetail(playingMovie.slug)
          .then((detailed) => {
            if (isCancelled || !detailed) return;
            const firstServer = detailed.episodesServers?.[0];
            const firstEp = firstServer?.items?.[0];
            const resolvedEmbed = firstEp?.embed || detailed.embedUrl;
            const resM3u8 = firstEp?.m3u8 || detailed.m3u8Url;
            if (resolvedEmbed || resM3u8) {
              setPlayingEpisode(
                resolvedEmbed || '',
                firstEp ? formatEpisodeTitle(firstEp.name) : (detailed.currentEpisode ? formatEpisodeTitle(detailed.currentEpisode) : 'Tập 1'),
                resM3u8
              );
            }
          })
          .catch((err) => {
            console.error('VideoPlayerModal failed to resolve stream:', err);
          });
      }

      return () => {
        isCancelled = true;
      };
    }
  }, [playingMovie?.id, playingMovie?.slug, activeEmbed, resolvedM3u8, getWatchProgress, setPlayingEpisode]);

  if (!playingMovie) return null;

  const displayEpisodeTitle = formatEpisodeTitle(
    currentEpisodeTitle || playingMovie.currentEpisode || 'Tập 1'
  );

  return (
    <div
      className={`fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center select-none overflow-hidden transition-all duration-350 ease-out ${
        isExiting ? 'opacity-0 scale-[0.98] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Main Player Display */}
      <div className="w-full h-full flex items-center justify-center bg-black">
        {activeVideoSource ? (
          <VideoJsPlayer
            key={activeVideoSource}
            src={activeVideoSource}
            poster={playingMovie.backdropUrl || playingMovie.posterUrl}
            title={playingMovie.title}
            subTitle={playingMovie.subTitle}
            episodeTitle={displayEpisodeTitle}
            episodes={currentServer?.items}
            currentEpisodeTitle={displayEpisodeTitle}
            onSelectEpisode={handleSelectEpisode}
            onClose={handleClose}
            initialTime={initialTime}
            onTimeUpdate={handleTimeUpdate}
            onPause={handlePause}
            onEnded={() => {
              saveProgressNow(true);
              if (nextEpisode) {
                handlePlayNextEpisode();
              }
            }}
            nextEpisode={nextEpisode}
            onPlayNextEpisode={handlePlayNextEpisode}
          />
        ) : activeEmbed ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {/* Top Exit button for standalone iframe */}
            <div className="absolute top-4 left-4 z-40">
              <button
                onClick={handleClose}
                aria-label="Thoát xem phim"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-white backdrop-blur-md border border-white/20 transition cursor-pointer shadow-lg"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm font-semibold tracking-wide">Thoát</span>
              </button>
            </div>
            <iframe
              src={activeEmbed}
              title={playingMovie.title}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              className="w-full h-full border-0"
            />
          </div>
        ) : isLoadingDetail || playingMovie.slug ? (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-12 h-12 border-3 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
            <h3 className="text-lg md:text-xl font-bold text-white uppercase tracking-wide">
              {playingMovie.title}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400">
              Đang khởi tạo luồng phát {displayEpisodeTitle}...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md">
            <h3 className="text-xl font-bold text-white uppercase tracking-wide">{playingMovie.title}</h3>
            <p className="text-sm text-zinc-400">
              Chưa có luồng phát trực tiếp cho tập phim này. Vui lòng thử lại sau hoặc chọn tập phim khác.
            </p>
            <button
              onClick={handleClose}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition cursor-pointer"
            >
              Quay lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayerModal;
