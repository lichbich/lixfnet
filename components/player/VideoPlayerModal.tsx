'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  MessageSquare,
  ListVideo,
  MonitorPlay,
  Sparkles,
  X,
} from 'lucide-react';
import { useNetflix } from '@/context/NetflixContext';
import { getMovieDetail, formatEpisodeTitle } from '@/services/movieApi';

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  // Resume notification state
  const [resumeToast, setResumeToast] = useState<{ title: string; seconds: number } | null>(null);
  const sessionSecondsRef = useRef(0);

  // Cinematic fade transitions
  const [isOpen, setIsOpen] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const isClosingRef = useRef(false);

  // Mobile Orientation & CSS Rotation states
  const [isCssRotated, setIsCssRotated] = useState(false);

  // Active stream and server references
  const activeEmbed = currentEpisodeEmbed || playingMovie?.embedUrl;
  const currentServer = playingMovie?.episodesServers?.[0];

  const resolvedM3u8 = (() => {
    if (currentEpisodeM3u8) return currentEpisodeM3u8;
    if (currentServer?.items) {
      const match = currentServer.items.find(
        (ep) =>
          ep.embed === activeEmbed ||
          formatEpisodeTitle(ep.name) === formatEpisodeTitle(currentEpisodeTitle || '')
      );
      if (match?.m3u8) return match.m3u8;
    }
    return playingMovie?.m3u8Url || null;
  })();

  const isDirectHls = Boolean(resolvedM3u8 && !useIframeFallback);
  const isLocalVideo = Boolean(playingMovie?.videoUrl && !resolvedM3u8 && !activeEmbed);
  const isDirectVideo = isDirectHls || isLocalVideo;

  // Wrap M3U8 with residential Vietnam proxy if user enabled proxy streaming
  const effectiveM3u8 = useMemo(() => {
    if (!resolvedM3u8) return '';
    if (isStreamProxyEnabled && streamProxyUrl && !resolvedM3u8.includes('/m3u8?url=')) {
      const cleanBase = streamProxyUrl.replace(/\/+$/, '');
      return `${cleanBase}/m3u8?url=${encodeURIComponent(resolvedM3u8)}`;
    }
    return resolvedM3u8;
  }, [resolvedM3u8, isStreamProxyEnabled, streamProxyUrl]);

  // Determine if a valid next episode exists in the current server list
  // Safety guard: If current episode is the latest or finale, nextEpisode is strictly null
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
  }, [
    currentServer,
    activeEmbed,
    resolvedM3u8,
    currentEpisodeTitle,
    playingMovie?.currentEpisode,
    formatEpisodeTitle,
  ]);

  // Next Episode Card state (triggers ~90s before end, auto-hides after 5s without auto-advance, revives on mouse/touch)
  const [showNextEpCard, setShowNextEpCard] = useState(false);
  const nextEpTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredNearEndRef = useRef(false);
  const nextEpisodeRef = useRef(nextEpisode);
  nextEpisodeRef.current = nextEpisode;

  const isNearEnd = Boolean(
    nextEpisode &&
      duration > 120 &&
      currentTime >= duration - 90 &&
      currentTime < duration
  );
  const isNearEndRef = useRef(isNearEnd);
  isNearEndRef.current = isNearEnd;

  // Revives the Next Episode Card and sets a gentle 5-second auto-hide timeout
  const resetNextEpTimer = useCallback(() => {
    if (!nextEpisodeRef.current || !isNearEndRef.current) return;
    setShowNextEpCard(true);
    if (nextEpTimerRef.current) {
      clearTimeout(nextEpTimerRef.current);
    }
    nextEpTimerRef.current = setTimeout(() => {
      setShowNextEpCard(false);
    }, 5000);
  }, []);

  // Immediately switch to the next episode
  const handlePlayNextEpisode = useCallback(() => {
    if (!nextEpisodeRef.current) return;
    if (nextEpTimerRef.current) {
      clearTimeout(nextEpTimerRef.current);
      nextEpTimerRef.current = null;
    }
    setShowNextEpCard(false);
    hasTriggeredNearEndRef.current = false;
    const nextEp = nextEpisodeRef.current;
    setPlayingEpisode(
      nextEp.embed,
      formatEpisodeTitle(nextEp.name),
      nextEp.m3u8
    );
  }, [setPlayingEpisode, formatEpisodeTitle]);

  // Reset next episode card states whenever active episode changes
  useEffect(() => {
    setShowNextEpCard(false);
    hasTriggeredNearEndRef.current = false;
    if (nextEpTimerRef.current) {
      clearTimeout(nextEpTimerRef.current);
      nextEpTimerRef.current = null;
    }
  }, [activeEmbed, resolvedM3u8, currentEpisodeTitle, playingMovie?.id]);

  // Smooth fade-in on mount
  useEffect(() => {
    if (playingMovie) {
      isClosingRef.current = false;
      setIsVideoLoaded(false);
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 30);
      return () => clearTimeout(timer);
    } else {
      setIsOpen(false);
      setIsVideoLoaded(false);
    }
  }, [playingMovie?.id, playingMovie?.slug]);

  // When active stream changes, reset video loaded state with safety fallback
  useEffect(() => {
    setIsVideoLoaded(false);
    const safetyTimer = setTimeout(() => {
      setIsVideoLoaded(true);
    }, 2500);
    return () => clearTimeout(safetyTimer);
  }, [activeEmbed, resolvedM3u8, useIframeFallback]);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    // Immediately save current progress before closing
    if (playingMovie) {
      const cur = videoRef.current ? Math.round(videoRef.current.currentTime) : sessionSecondsRef.current;
      const dur =
        videoRef.current && videoRef.current.duration > 0
          ? Math.round(videoRef.current.duration)
          : duration || 45 * 60;
      updateWatchProgress(
        playingMovie,
        cur,
        dur,
        currentEpisodeTitle || playingMovie.currentEpisode,
        activeEmbed || playingMovie.embedUrl,
        resolvedM3u8 || playingMovie.m3u8Url
      );
    }

    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      if (screen.orientation && (screen.orientation as any).unlock) {
        (screen.orientation as any).unlock();
      }
    } catch {}
    if (nextEpTimerRef.current) {
      clearTimeout(nextEpTimerRef.current);
      nextEpTimerRef.current = null;
    }
    setShowNextEpCard(false);
    setIsFullscreen(false);
    setIsCssRotated(false);
    setIsOpen(false);
    setTimeout(() => {
      stopPlaying();
      isClosingRef.current = false;
      try {
        if (typeof window !== 'undefined' && window.history.state?.lixfnetPlayer) {
          window.history.back();
        }
      } catch {}
    }, 300);
  }, [playingMovie, duration, currentEpisodeTitle, activeEmbed, resolvedM3u8, stopPlaying, updateWatchProgress]);

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

  // Auto-request landscape fullscreen on mobile when entering player
  useEffect(() => {
    if (!playingMovie) return;

    const isMobile =
      typeof window !== 'undefined' &&
      (window.innerWidth <= 768 ||
        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

    if (isMobile) {
      const triggerMobileLandscape = async () => {
        try {
          if (playerContainerRef.current?.requestFullscreen) {
            await playerContainerRef.current.requestFullscreen();
          }
          if (screen.orientation && (screen.orientation as any).lock) {
            await (screen.orientation as any).lock('landscape');
          } else if (window.innerHeight > window.innerWidth) {
            setIsCssRotated(true);
          }
        } catch {
          if (window.innerHeight > window.innerWidth) {
            setIsCssRotated(true);
          }
        }
      };
      triggerMobileLandscape();
    }
  }, [playingMovie?.id]);

  // Listen to physical orientation change
  useEffect(() => {
    const handleOrientation = () => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth > window.innerHeight) {
        setIsCssRotated(false);
      }
    };

    window.addEventListener('resize', handleOrientation);
    window.addEventListener('orientationchange', handleOrientation);
    return () => {
      window.removeEventListener('resize', handleOrientation);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, []);

  // Toggle landscape / portrait rotation
  const toggleRotate = async () => {
    try {
      if (!isCssRotated) {
        if (screen.orientation && (screen.orientation as any).lock) {
          try {
            await (screen.orientation as any).lock('landscape');
            return;
          } catch {}
        }
        setIsCssRotated(true);
      } else {
        if (screen.orientation && (screen.orientation as any).unlock) {
          try {
            (screen.orientation as any).unlock();
          } catch {}
        }
        setIsCssRotated(false);
      }
    } catch {
      setIsCssRotated(!isCssRotated);
    }
  };

  // Episode / Movie change handler: initialize progress and notify user
  useEffect(() => {
    if (!playingMovie) {
      setResumeToast(null);
      sessionSecondsRef.current = 0;
      return;
    }

    const movieKey = playingMovie.slug || playingMovie.id;
    const currentEp = formatEpisodeTitle(currentEpisodeTitle || playingMovie.currentEpisode || 'Tập 1');
    const epProg = getEpisodeProgress(movieKey, currentEp);
    const movieProg = getWatchProgress(movieKey);

    const initialSecs =
      epProg?.currentTime ||
      (formatEpisodeTitle(currentEp) === formatEpisodeTitle(movieProg?.episodeTitle || '')
        ? movieProg?.currentTime
        : 0) ||
      0;
    sessionSecondsRef.current = initialSecs;

    const defaultSecs = playingMovie.durationMinutes
      ? playingMovie.durationMinutes * 60
      : playingMovie.type === 'series'
      ? 45 * 60
      : 105 * 60;

    // Immediately record current movie & episode in watch progress
    updateWatchProgress(
      playingMovie,
      initialSecs,
      defaultSecs,
      currentEp,
      activeEmbed || playingMovie.embedUrl,
      resolvedM3u8 || playingMovie.m3u8Url
    );

    // Show resume toast notification if watched more than 5 seconds
    if (initialSecs > 5) {
      setResumeToast({ title: currentEp, seconds: initialSecs });
      const timer = setTimeout(() => setResumeToast(null), 6000);
      return () => clearTimeout(timer);
    } else {
      setResumeToast(null);
    }
  }, [
    playingMovie?.id,
    playingMovie?.slug,
    currentEpisodeTitle,
    currentEpisodeEmbed,
    currentEpisodeM3u8,
    activeEmbed,
    resolvedM3u8,
    getWatchProgress,
    getEpisodeProgress,
    updateWatchProgress,
  ]);

  // HLS stream attachment & native seek handling
  useEffect(() => {
    if (!playingMovie) return;
    if (!isDirectHls || !effectiveM3u8) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      hlsRef.current = hls;

      hls.loadSource(effectiveM3u8);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsVideoLoaded(true);
        if (sessionSecondsRef.current > 5) {
          try {
            video.currentTime = sessionSecondsRef.current;
            setCurrentTime(sessionSecondsRef.current);
          } catch {}
        }
        video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS Network error, attempting recovery...');
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS Media error, attempting recovery...');
              hls?.recoverMediaError();
              break;
            default:
              console.warn('Fatal unrecoverable HLS error, switching to iframe fallback:', data);
              hls?.destroy();
              hlsRef.current = null;
              setUseIframeFallback(true);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari / iOS HLS
      video.src = effectiveM3u8;
      const onLoaded = () => {
        setIsVideoLoaded(true);
        if (sessionSecondsRef.current > 5) {
          try {
            video.currentTime = sessionSecondsRef.current;
            setCurrentTime(sessionSecondsRef.current);
          } catch {}
        }
        video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      };
      video.addEventListener('loadedmetadata', onLoaded);
      return () => {
        video.removeEventListener('loadedmetadata', onLoaded);
      };
    }

    return () => {
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [effectiveM3u8, isDirectHls, playingMovie?.id, playingMovie?.slug, currentEpisodeEmbed]);

  // Periodic watch progress tracker (saves every 4 seconds)
  useEffect(() => {
    if (!playingMovie) return;

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;

      const defaultSecs = playingMovie.durationMinutes
        ? playingMovie.durationMinutes * 60
        : playingMovie.type === 'series'
        ? 45 * 60
        : 105 * 60;

      let nextTime: number;
      let dur: number;

      if (videoRef.current && isDirectVideo) {
        nextTime = Math.round(videoRef.current.currentTime);
        dur =
          videoRef.current.duration > 0 && !isNaN(videoRef.current.duration)
            ? Math.round(videoRef.current.duration)
            : defaultSecs;
        sessionSecondsRef.current = nextTime;
      } else {
        sessionSecondsRef.current = Math.min(sessionSecondsRef.current + 4, defaultSecs);
        nextTime = sessionSecondsRef.current;
        dur = defaultSecs;
      }

      updateWatchProgress(
        playingMovie,
        nextTime,
        dur,
        currentEpisodeTitle || playingMovie.currentEpisode,
        activeEmbed || playingMovie.embedUrl,
        resolvedM3u8 || playingMovie.m3u8Url
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [playingMovie, currentEpisodeTitle, activeEmbed, resolvedM3u8, isDirectVideo, updateWatchProgress]);

  // Self-healing fallback: If player is open without activeEmbed/resolvedM3u8 but has a movie slug
  useEffect(() => {
    if (playingMovie && !activeEmbed && !resolvedM3u8 && playingMovie.slug) {
      let isCancelled = false;
      const key = playingMovie.slug || playingMovie.id;
      const wp = getWatchProgress(key);

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

  // Auto-hide controls timer
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showEpisodeSelectorRef = useRef(showEpisodeSelector);
  showEpisodeSelectorRef.current = showEpisodeSelector;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlayingRef.current && !showEpisodeSelectorRef.current) {
        setShowControls(false);
      }
    }, 3500);
  }, []);

  useEffect(() => {
    if (showEpisodeSelector) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      setShowControls(true);
    } else {
      resetControlsTimer();
    }
  }, [showEpisodeSelector, resetControlsTimer]);

  useEffect(() => {
    resetControlsTimer();
    const handleInteraction = () => {
      resetControlsTimer();
      if (isNearEndRef.current && nextEpisodeRef.current) {
        resetNextEpTimer();
      }
    };

    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    window.addEventListener('pointerdown', handleInteraction);
    window.addEventListener('blur', handleInteraction);

    return () => {
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('blur', handleInteraction);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (nextEpTimerRef.current) clearTimeout(nextEpTimerRef.current);
    };
  }, [resetControlsTimer, resetNextEpTimer]);

  // Video interaction controls
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, []);

  const skipTime = useCallback((amount: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + amount);
      setCurrentTime(videoRef.current.currentTime);
      sessionSecondsRef.current = Math.round(videoRef.current.currentTime);
    }
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      setCurrentTime(cur);
      sessionSecondsRef.current = Math.round(cur);

      // Check for 90s near-end trigger for Next Episode card
      if (nextEpisodeRef.current && dur > 120) {
        const remaining = dur - cur;
        if (remaining <= 90 && remaining > 0) {
          if (!hasTriggeredNearEndRef.current) {
            hasTriggeredNearEndRef.current = true;
            resetNextEpTimer();
          }
        } else if (remaining > 90) {
          // If user seeks backwards before the 90s mark, reset trigger & hide card
          if (hasTriggeredNearEndRef.current) {
            hasTriggeredNearEndRef.current = false;
            setShowNextEpCard(false);
            if (nextEpTimerRef.current) {
              clearTimeout(nextEpTimerRef.current);
              nextEpTimerRef.current = null;
            }
          }
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (dur > 0 && !isNaN(dur)) {
        setDuration(dur);
      }
      if (sessionSecondsRef.current > 5 && Math.abs(videoRef.current.currentTime - sessionSecondsRef.current) > 2) {
        try {
          videoRef.current.currentTime = sessionSecondsRef.current;
        } catch {}
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = Number(e.target.value);
    setCurrentTime(seekTime);
    sessionSecondsRef.current = Math.round(seekTime);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume || 0.8;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  }, [isMuted, volume]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!playingMovie) return;
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.code === 'Space' && isDirectVideo) {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight' && isDirectVideo) {
        skipTime(10);
      } else if (e.key === 'ArrowLeft' && isDirectVideo) {
        skipTime(-10);
      } else if ((e.key === 'm' || e.key === 'M') && isDirectVideo) {
        toggleMute();
      } else if ((e.key === 'f' || e.key === 'F') && isDirectVideo) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playingMovie, isDirectVideo, togglePlay, skipTime, toggleMute, toggleFullscreen, handleClose]);

  // Auto-advance to next episode when video ends
  const handleVideoEnded = () => {
    if (nextEpisodeRef.current) {
      handlePlayNextEpisode();
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!playingMovie) return null;

  const displayEpisodeTitle = formatEpisodeTitle(
    currentEpisodeTitle || playingMovie.currentEpisode || 'Tập 1'
  );

  return (
    <div
      ref={playerContainerRef}
      style={
        isCssRotated
          ? {
              width: '100dvh',
              height: '100dvw',
              transform: 'rotate(90deg) translateY(-100%)',
              transformOrigin: 'top left',
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 99999,
            }
          : undefined
      }
      className={`fixed inset-0 z-[60] bg-black flex items-center justify-center select-none overflow-hidden transition-all duration-500 ease-out ${
        isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98] pointer-events-none'
      }`}
      onClick={resetControlsTimer}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* Resume Notification Toast with One-Click Restart */}
      {resumeToast && (
        <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 bg-black/90 backdrop-blur-md border border-red-500/40 text-white px-4 py-2.5 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.85)] flex items-center gap-3 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0" />
          <span>
            Đang phát: <strong className="text-red-400">{resumeToast.title}</strong>
            {resumeToast.seconds > 10 && (
              <>
                {' '}• Tiếp tục từ{' '}
                <strong className="text-white font-bold">{formatTime(resumeToast.seconds)}</strong>
              </>
            )}
          </span>
          {resumeToast.seconds > 10 && (
            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  setCurrentTime(0);
                  sessionSecondsRef.current = 0;
                }
                setResumeToast(null);
                if (playingMovie) {
                  updateWatchProgress(
                    playingMovie,
                    0,
                    duration || 45 * 60,
                    currentEpisodeTitle || playingMovie.currentEpisode,
                    activeEmbed || playingMovie.embedUrl,
                    resolvedM3u8 || playingMovie.m3u8Url
                  );
                }
              }}
              className="ml-1 text-[11px] font-bold uppercase tracking-wider text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full border border-white/20 transition cursor-pointer"
            >
              Xem lại từ đầu
            </button>
          )}
        </div>
      )}

      {/* CASE 1: DIRECT HLS / LOCAL VIDEO PLAYBACK */}
      {isDirectVideo ? (
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
          {/* Ambient Blurred Artwork Loading Screen */}
          <div
            className={`absolute inset-0 z-10 transition-opacity duration-1000 ease-out pointer-events-none ${
              isVideoLoaded ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {playingMovie.backdropUrl || playingMovie.posterUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-3xl scale-110 opacity-35 brightness-50"
                style={{
                  backgroundImage: `url('${playingMovie.backdropUrl || playingMovie.posterUrl}')`,
                }}
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/95" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-5">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-red-600/20 blur-xl animate-pulse" />
                <div className="w-12 h-12 border-3 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
              </div>
              <div className="space-y-1.5 max-w-lg">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white uppercase tracking-wide drop-shadow-lg">
                  {playingMovie.title}
                </h2>
                <p className="text-sm text-red-400 font-bold uppercase tracking-wider">
                  {displayEpisodeTitle}
                </p>
                <p className="text-xs text-zinc-400 font-medium tracking-wide pt-1 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
                  Đang khởi tạo luồng phát Full HD mượt mà...
                </p>
              </div>
            </div>
          </div>

          {/* HTML5 Video Element with HLS stream */}
          <video
            ref={videoRef}
            src={!resolvedM3u8 ? playingMovie.videoUrl : undefined}
            autoPlay
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={() => setIsVideoLoaded(true)}
            onEnded={handleVideoEnded}
            className={`w-full h-full object-contain transition-opacity duration-700 ease-out ${
              isVideoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Netflix-Style "Next Episode" Liquid Glass Floating Card */}
          {nextEpisode && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute right-4 sm:right-8 z-40 transition-all duration-500 ease-out transform ${
                showControls ? 'bottom-28 sm:bottom-32' : 'bottom-6 sm:bottom-8'
              } ${
                showNextEpCard
                  ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                  : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
              }`}
            >
              <div className="relative overflow-hidden bg-black/30 hover:bg-black/40 backdrop-blur-2xl border border-white/20 hover:border-white/35 rounded-2xl p-4 sm:p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_16px_40px_rgba(0,0,0,0.5)] w-72 sm:w-80 group/card transition-all duration-300">
                {/* Liquid Glass Ambient Refraction Glows */}
                <div className="absolute -top-12 -left-12 w-36 h-36 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-red-600/20 rounded-full blur-2xl pointer-events-none" />

                {/* Dismiss Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNextEpCard(false);
                    if (nextEpTimerRef.current) {
                      clearTimeout(nextEpTimerRef.current);
                      nextEpTimerRef.current = null;
                    }
                  }}
                  aria-label="Đóng thông báo tập tiếp theo"
                  className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 border border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Card Header & Metadata */}
                <div className="relative z-10 pr-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600/30 border border-red-500/40 backdrop-blur-md shadow-sm">
                    <Sparkles className="w-3 h-3 text-red-400 animate-pulse" />
                    <span className="text-[10px] sm:text-[11px] font-black tracking-wider text-red-300 uppercase">
                      Tập tiếp theo
                    </span>
                  </div>
                  <h4 className="text-white font-extrabold text-base sm:text-lg mt-2 line-clamp-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    {formatEpisodeTitle(nextEpisode.name)}
                  </h4>
                  <p className="text-zinc-200 text-xs line-clamp-1 mt-0.5 font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                    {playingMovie.title}
                  </p>
                </div>

                {/* Action Button: Phát ngay (Liquid Glass Pill with Shimmer) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayNextEpisode();
                  }}
                  className="relative z-10 overflow-hidden mt-4 w-full py-2.5 px-4 bg-white/20 hover:bg-white/30 active:scale-98 text-white backdrop-blur-xl border border-white/35 hover:border-white/50 rounded-xl flex items-center justify-center gap-2 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.6),0_6px_20px_rgba(0,0,0,0.35)] transition-all cursor-pointer group/btn"
                >
                  {/* Subtle Liquid Shimmer sweep effect */}
                  <span className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

                  <Play className="w-4 h-4 fill-white text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.7)] group-hover/btn:scale-110 transition-transform" />
                  <span className="font-extrabold text-xs sm:text-sm tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    Phát ngay
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Full Custom Netflix UI Overlay Controls */}
          <div
            className={`absolute inset-0 flex flex-col justify-between p-4 sm:p-6 md:p-8 transition-opacity duration-300 pointer-events-none z-30 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Top Header Bar */}
            <div
              onClick={(e) => e.stopPropagation()}
              className={`flex items-center justify-between text-white w-full bg-gradient-to-b from-black/95 via-black/50 to-transparent p-2.5 sm:p-3.5 rounded-2xl ${
                showControls ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
            >
              {/* Left: Back button & Title */}
              <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 pr-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                  aria-label="Thoát xem phim"
                  className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-md border border-white/15 transition cursor-pointer group shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:-translate-x-0.5 transition-transform" />
                  <span className="text-xs sm:text-sm font-semibold tracking-wide pr-0.5">Thoát</span>
                </button>

                <div className="min-w-0">
                  <h2 className="text-xs sm:text-base md:text-lg font-bold uppercase tracking-wide truncate max-w-[140px] xs:max-w-[200px] sm:max-w-xs md:max-w-md">
                    {playingMovie.title}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs text-zinc-300 font-medium">
                    <span className="text-red-400 font-bold">{displayEpisodeTitle}</span>
                    {playingMovie.subTitle && (
                      <span className="hidden sm:inline text-zinc-400 truncate max-w-[220px]">
                        • {playingMovie.subTitle}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Proxy Streaming Status Indicator */}
                {isStreamProxyEnabled && streamProxyUrl && (
                  <div
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold backdrop-blur-md shadow-sm"
                    title={`Đang truyền qua Proxy Việt Nam: ${streamProxyUrl}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Proxy VN</span>
                  </div>
                )}

                {/* Fallback to Iframe switch if embed is also available */}
                {activeEmbed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetControlsTimer();
                      setUseIframeFallback(true);
                    }}
                    className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white border border-white/15 text-xs font-medium transition cursor-pointer"
                    title="Chuyển sang trình phát Iframe dự phòng nếu gặp lỗi"
                  >
                    <MonitorPlay className="w-3.5 h-3.5" />
                    <span>Dự phòng</span>
                  </button>
                )}

                {/* 1-Tap Screen Orientation Switcher */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    toggleRotate();
                  }}
                  aria-label="Xoay màn hình"
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-md border border-white/15 transition cursor-pointer group text-xs sm:text-sm font-semibold"
                  title={isCssRotated ? 'Xoay dọc màn hình' : 'Xoay ngang màn hình'}
                >
                  <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 group-hover:rotate-45 transition-transform" />
                  <span className="hidden xs:inline">
                    {isCssRotated ? 'Xoay dọc' : 'Xoay ngang'}
                  </span>
                </button>

                {/* Episodes Selector Button if series */}
                {currentServer && currentServer.items.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resetControlsTimer();
                        setShowEpisodeSelector((prev) => !prev);
                      }}
                      aria-label="Danh sách tập"
                      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-md border border-white/15 transition cursor-pointer text-xs sm:text-sm font-semibold"
                    >
                      <ListVideo className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                      <span className="hidden sm:inline">Chọn tập ({currentServer.items.length} tập)</span>
                      <span className="sm:hidden">{displayEpisodeTitle}</span>
                    </button>

                    {/* Dropdown list of episodes */}
                    {showEpisodeSelector && (
                      <>
                        <div
                          className="fixed inset-0 z-40 pointer-events-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEpisodeSelector(false);
                          }}
                        />
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto bg-zinc-900/98 backdrop-blur-xl border border-zinc-700 rounded-xl p-2.5 grid grid-cols-4 gap-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
                        >
                          {currentServer.items.map((ep) => {
                            const epTitle = formatEpisodeTitle(ep.name);
                            const isEpActive =
                              activeEmbed === ep.embed ||
                              formatEpisodeTitle(currentEpisodeTitle || '') === epTitle;
                            return (
                              <button
                                key={ep.slug}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPlayingEpisode(ep.embed, epTitle, ep.m3u8);
                                  setShowEpisodeSelector(false);
                                  resetControlsTimer();
                                }}
                                className={`p-2 text-xs rounded-lg font-bold transition text-center cursor-pointer ${
                                  isEpActive
                                    ? 'bg-red-600 text-white shadow-md'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                                }`}
                              >
                                {epTitle}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Fullscreen Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    toggleFullscreen();
                  }}
                  aria-label="Toàn màn hình"
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer border border-white/10"
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Middle tap/click zone to toggle play/pause */}
            <div
              className={`flex-1 w-full flex items-center justify-center cursor-pointer select-none ${
                showControls ? 'pointer-events-auto' : 'pointer-events-auto'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
                resetControlsTimer();
              }}
            >
              {/* Big center play icon indicator if paused */}
              {!isPlaying && isVideoLoaded && (
                <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-2xl text-white transform hover:scale-110 transition-all pointer-events-none animate-in zoom-in-95 duration-150">
                  <Play className="w-10 h-10 fill-white ml-1.5" />
                </div>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div
              onClick={(e) => e.stopPropagation()}
              className={`space-y-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3 sm:p-4 rounded-2xl ${
                showControls ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
            >
              {/* Timeline Scrubber */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-300 font-medium w-14 text-right tabular-nums select-none">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={1}
                  value={currentTime}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onChange={handleSeek}
                  className="flex-1 h-1.5 bg-zinc-700 accent-red-600 rounded-lg cursor-pointer hover:h-2.5 transition-all pointer-events-auto"
                />
                <span className="text-xs text-zinc-300 font-medium w-14 tabular-nums select-none">
                  {formatTime(Math.max(0, duration - currentTime))}
                </span>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-4 sm:gap-6">
                  {/* Play / Pause */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetControlsTimer();
                      togglePlay();
                    }}
                    aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                    className="hover:text-red-500 hover:scale-110 active:scale-95 transition cursor-pointer"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 fill-white" />
                    ) : (
                      <Play className="w-6 h-6 fill-white" />
                    )}
                  </button>

                  {/* 10s backward */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetControlsTimer();
                      skipTime(-10);
                    }}
                    aria-label="Tua lại 10 giây"
                    className="hover:text-zinc-300 hover:scale-110 active:scale-95 transition cursor-pointer"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  {/* 10s forward */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetControlsTimer();
                      skipTime(10);
                    }}
                    aria-label="Tua tới 10 giây"
                    className="hover:text-zinc-300 hover:scale-110 active:scale-95 transition cursor-pointer"
                  >
                    <RotateCw className="w-5 h-5" />
                  </button>

                  {/* Volume control */}
                  <div className="flex items-center gap-2 group/vol" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resetControlsTimer();
                        toggleMute();
                      }}
                      aria-label="Âm lượng"
                      className="cursor-pointer hover:scale-110 transition-transform"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5 text-red-400" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onChange={handleVolumeChange}
                      className="w-16 sm:w-20 h-1 bg-zinc-600 accent-white rounded cursor-pointer pointer-events-auto"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-5">
                  {/* Audio & Subtitles Badge */}
                  <button
                    onClick={(e) => e.stopPropagation()}
                    title="Phụ đề & Âm thanh"
                    className="hover:text-zinc-300 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="hidden sm:inline">Tiếng Việt • Full HD</span>
                  </button>

                  {/* Fullscreen */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetControlsTimer();
                      toggleFullscreen();
                    }}
                    aria-label="Toàn màn hình"
                    className="hover:text-zinc-300 hover:scale-110 active:scale-95 transition cursor-pointer"
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeEmbed ? (
        /* CASE 2: IFRAME EMBED STREAMING FALLBACK */
        <div className="relative w-full h-full flex flex-col bg-black">
          {/* Ambient Cinema Backdrop & Loading Veil */}
          <div
            className={`absolute inset-0 z-10 transition-opacity duration-1000 ease-out pointer-events-none ${
              isVideoLoaded ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {playingMovie.backdropUrl || playingMovie.posterUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-3xl scale-110 opacity-35 brightness-50"
                style={{
                  backgroundImage: `url('${playingMovie.backdropUrl || playingMovie.posterUrl}')`,
                }}
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/95" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-5 animate-in fade-in duration-500">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-red-600/20 blur-xl animate-pulse" />
                <div className="w-12 h-12 border-3 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
              </div>
              <div className="space-y-1.5 max-w-lg">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white uppercase tracking-wide drop-shadow-lg">
                  {playingMovie.title}
                </h2>
                <p className="text-sm text-red-400 font-bold uppercase tracking-wider">
                  {displayEpisodeTitle}
                </p>
                <p className="text-xs text-zinc-400 font-medium tracking-wide pt-1">
                  Đang khởi tạo trình phát phim • Vui lòng chờ trong giây lát
                </p>
              </div>
            </div>
          </div>

          {/* Top gesture tap zone */}
          <div
            onClick={resetControlsTimer}
            onTouchStart={resetControlsTimer}
            className="absolute top-0 left-0 right-0 h-20 sm:h-24 z-20 cursor-pointer pointer-events-auto"
            aria-label="Hiện thanh điều khiển"
          />

          {/* Header Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/95 via-black/60 to-transparent px-4 py-3 sm:px-6 sm:py-5 flex items-center justify-between text-white transition-opacity duration-300 ${
              showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Left: Back button & Title */}
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 pr-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                aria-label="Thoát xem phim"
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-md border border-white/15 transition cursor-pointer group shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs sm:text-sm font-semibold tracking-wide pr-0.5">Thoát</span>
              </button>

              <div className="min-w-0">
                <h2 className="text-xs sm:text-base md:text-lg font-bold uppercase tracking-wide truncate max-w-[140px] xs:max-w-[200px] sm:max-w-xs md:max-w-md">
                  {playingMovie.title}
                </h2>
                <div className="flex items-center gap-2 text-[11px] sm:text-xs text-zinc-300 font-medium">
                  <span className="text-red-400 font-bold">{displayEpisodeTitle}</span>
                  {playingMovie.subTitle && (
                    <span className="hidden sm:inline text-zinc-400 truncate max-w-[200px]">
                      • {playingMovie.subTitle}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Return to direct HLS if available */}
              {resolvedM3u8 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimer();
                    setUseIframeFallback(false);
                  }}
                  className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold transition cursor-pointer shadow-md"
                  title="Chuyển về trình phát HLS cao cấp"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Dùng HLS</span>
                </button>
              )}

              {/* 1-Tap Screen Orientation Switcher */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetControlsTimer();
                  toggleRotate();
                }}
                aria-label="Xoay màn hình"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-md border border-white/15 transition cursor-pointer group text-xs sm:text-sm font-semibold"
                title={isCssRotated ? 'Xoay dọc màn hình' : 'Xoay ngang màn hình'}
              >
                <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 group-hover:rotate-45 transition-transform" />
                <span className="hidden xs:inline">
                  {isCssRotated ? 'Xoay dọc' : 'Xoay ngang'}
                </span>
              </button>

              {/* Episodes Selector Button if series */}
              {currentServer && currentServer.items.length > 1 && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetControlsTimer();
                      setShowEpisodeSelector((prev) => !prev);
                    }}
                    aria-label="Danh sách tập"
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-md border border-white/15 transition cursor-pointer text-xs sm:text-sm font-semibold"
                  >
                    <ListVideo className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                    <span className="hidden sm:inline">Chọn tập ({currentServer.items.length} tập)</span>
                    <span className="sm:hidden">{displayEpisodeTitle}</span>
                  </button>

                  {/* Dropdown list of episodes */}
                  {showEpisodeSelector && (
                    <>
                      <div
                        className="fixed inset-0 z-40 pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEpisodeSelector(false);
                        }}
                      />
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto bg-zinc-900/98 backdrop-blur-xl border border-zinc-700 rounded-xl p-2.5 grid grid-cols-4 gap-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
                      >
                        {currentServer.items.map((ep) => {
                          const epTitle = formatEpisodeTitle(ep.name);
                          const isEpActive =
                            activeEmbed === ep.embed ||
                            formatEpisodeTitle(currentEpisodeTitle || '') === epTitle;
                          return (
                            <button
                              key={ep.slug}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlayingEpisode(ep.embed, epTitle, ep.m3u8);
                                setShowEpisodeSelector(false);
                                resetControlsTimer();
                              }}
                              className={`p-2 text-xs rounded-lg font-bold transition text-center cursor-pointer ${
                                isEpActive
                                  ? 'bg-red-600 text-white shadow-md'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                              }`}
                            >
                              {epTitle}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Fullscreen Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetControlsTimer();
                  toggleFullscreen();
                }}
                aria-label="Toàn màn hình"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer border border-white/10"
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
            </div>
          </div>

          {/* IFrame Embed Stream */}
          <iframe
            src={activeEmbed}
            title={playingMovie.title}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            onLoad={() => setIsVideoLoaded(true)}
            className={`w-full h-full border-0 transition-opacity duration-700 ease-out ${
              isVideoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      ) : !activeEmbed && !resolvedM3u8 && (isLoadingDetail || playingMovie.slug) ? (
        /* Connecting stream state */
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-black text-white space-y-4">
          <button
            onClick={handleClose}
            aria-label="Thoát xem phim"
            className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-md border border-white/15 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide">Thoát</span>
          </button>
          <div className="w-12 h-12 border-3 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
          <div className="text-center px-4">
            <h3 className="text-lg md:text-xl font-bold text-white uppercase tracking-wide">
              {playingMovie.title}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Đang kết nối luồng phát {displayEpisodeTitle}...
            </p>
          </div>
        </div>
      ) : (
        /* Empty / Unavailable Stream Fallback */
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-black text-white p-6 space-y-4 text-center">
          <button
            onClick={handleClose}
            aria-label="Thoát xem phim"
            className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-md border border-white/15 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide">Thoát</span>
          </button>
          <h3 className="text-xl font-bold text-white uppercase tracking-wide">{playingMovie.title}</h3>
          <p className="text-sm text-zinc-400 max-w-md">
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
  );
};
