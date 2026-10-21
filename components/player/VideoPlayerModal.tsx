'use client';

import React, { useRef, useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useNetflix } from '@/context/NetflixContext';
import { getMovieDetail } from '@/services/movieApi';

export const VideoPlayerModal: React.FC = () => {
  const {
    playingMovie,
    stopPlaying,
    currentEpisodeEmbed,
    currentEpisodeTitle,
    setPlayingEpisode,
    updateWatchProgress,
    getWatchProgress,
    getEpisodeProgress,
    isLoadingDetail,
  } = useNetflix();

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);

  // Resume states
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [resumeToast, setResumeToast] = useState<string | null>(null);
  const [resumeTime, setResumeTime] = useState(0);
  const sessionSecondsRef = useRef(0);

  // Cinematic fade transitions
  const [isOpen, setIsOpen] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const isClosingRef = useRef(false);

  // Active stream and server references
  const activeEmbed = currentEpisodeEmbed || playingMovie?.embedUrl;
  const currentServer = playingMovie?.episodesServers?.[0];

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

  // When activeEmbed changes, reset video loaded state with safety fallback
  useEffect(() => {
    setIsVideoLoaded(false);
    const safetyTimer = setTimeout(() => {
      setIsVideoLoaded(true);
    }, 2000);
    return () => clearTimeout(safetyTimer);
  }, [activeEmbed]);

  const handleClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsOpen(false);
    setTimeout(() => {
      stopPlaying();
      isClosingRef.current = false;
    }, 350);
  };

  // Episode / Movie change handler: initialize progress and notify user
  useEffect(() => {
    if (!playingMovie) {
      setShowResumeDialog(false);
      setResumeToast(null);
      sessionSecondsRef.current = 0;
      return;
    }

    const movieKey = playingMovie.slug || playingMovie.id;
    const currentEp = currentEpisodeTitle || playingMovie.currentEpisode || 'Tập 1';
    const epProg = getEpisodeProgress(movieKey, currentEp);
    const movieProg = getWatchProgress(movieKey);

    const initialSecs =
      epProg?.currentTime ||
      (currentEp === movieProg?.episodeTitle ? movieProg?.currentTime : 0) ||
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
      currentEpisodeEmbed || playingMovie.embedUrl
    );

    // If iframe embed: do NOT show blocking popup dialog (NguonC/JWPlayer handles its own resume);
    // show a non-intrusive toast notification instead
    if (activeEmbed) {
      setShowResumeDialog(false);
      if (initialSecs > 15 || currentEp !== 'Tập 1') {
        setResumeToast(currentEp);
        const timer = setTimeout(() => setResumeToast(null), 3500);
        return () => clearTimeout(timer);
      }
    } else {
      // For local HTML5 video (demo/trailers), show resume dialog if > 15s
      if (initialSecs > 15) {
        setResumeTime(initialSecs);
        setShowResumeDialog(true);
      } else {
        setShowResumeDialog(false);
      }
    }
  }, [
    playingMovie?.id,
    playingMovie?.slug,
    currentEpisodeTitle,
    currentEpisodeEmbed,
    activeEmbed,
    getWatchProgress,
    getEpisodeProgress,
    updateWatchProgress,
  ]);

  // Periodic watch progress tracker (counts watch time smoothly while tab is active)
  useEffect(() => {
    if (!playingMovie) return;

    const interval = setInterval(() => {
      // Do not increment if user switched away to another tab
      if (typeof document !== 'undefined' && document.hidden) return;

      const defaultSecs = playingMovie.durationMinutes
        ? playingMovie.durationMinutes * 60
        : playingMovie.type === 'series'
        ? 45 * 60
        : 105 * 60;

      let nextTime: number;
      let dur: number;

      if (videoRef.current) {
        nextTime = Math.round(videoRef.current.currentTime);
        dur =
          videoRef.current.duration > 0 && !isNaN(videoRef.current.duration)
            ? videoRef.current.duration
            : defaultSecs;
        sessionSecondsRef.current = nextTime;
      } else {
        // Accumulate seconds for active embed to keep progress bar alive & realistic
        sessionSecondsRef.current = Math.min(sessionSecondsRef.current + 5, defaultSecs);
        nextTime = sessionSecondsRef.current;
        dur = defaultSecs;
      }

      updateWatchProgress(
        playingMovie,
        nextTime,
        dur,
        currentEpisodeTitle || playingMovie.currentEpisode,
        currentEpisodeEmbed || playingMovie.embedUrl
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [playingMovie, currentEpisodeTitle, currentEpisodeEmbed, updateWatchProgress]);

  // Self-healing fallback: If player is open without activeEmbed but has a movie slug, resolve stream
  useEffect(() => {
    if (playingMovie && !activeEmbed && playingMovie.slug) {
      let isCancelled = false;
      const key = playingMovie.slug || playingMovie.id;
      const wp = getWatchProgress(key);

      if (wp?.episodeEmbed) {
        setPlayingEpisode(wp.episodeEmbed, wp.episodeTitle || 'Tập 1');
      } else {
        getMovieDetail(playingMovie.slug)
          .then((detailed) => {
            if (isCancelled || !detailed) return;
            const firstServer = detailed.episodesServers?.[0];
            const firstEp = firstServer?.items?.[0];
            const resolvedEmbed = firstEp?.embed || detailed.embedUrl;
            if (resolvedEmbed) {
              setPlayingEpisode(
                resolvedEmbed,
                firstEp ? `Tập ${firstEp.name}` : (detailed.currentEpisode || 'Tập 1')
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
  }, [playingMovie?.id, playingMovie?.slug, activeEmbed, getWatchProgress, setPlayingEpisode]);

  // Auto-hide controls timeout
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      setShowControls(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3500);
    };

    window.addEventListener('mousemove', resetTimer);
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      clearTimeout(timer);
    };
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!playingMovie) return;
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.code === 'Space' && !currentEpisodeEmbed) {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight' && !currentEpisodeEmbed) {
        skipTime(10);
      } else if (e.key === 'ArrowLeft' && !currentEpisodeEmbed) {
        skipTime(-10);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playingMovie, isPlaying, currentEpisodeEmbed]);

  if (!playingMovie) return null;

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const skipTime = (amount: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += amount;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = Number(e.target.value);
    setCurrentTime(seekTime);
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

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume || 0.5;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      ref={playerContainerRef}
      className={`fixed inset-0 z-[60] bg-black flex items-center justify-center select-none overflow-hidden transition-all duration-500 ease-out ${
        isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98] pointer-events-none'
      }`}
    >
      {/* Resume Playback Dialog (Only for local HTML5 video, never blocking iframe) */}
      {showResumeDialog && !activeEmbed && (
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#181d26] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
            <h3 className="text-xl sm:text-2xl font-bold text-white">Tiếp tục xem?</h3>
            <p className="text-sm text-zinc-300">
              Bạn đã dừng tại{' '}
              <strong className="text-white font-bold">
                {Math.floor(resumeTime / 60)} phút {Math.floor(resumeTime % 60)} giây
              </strong>
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setShowResumeDialog(false);
                  if (videoRef.current) {
                    videoRef.current.currentTime = resumeTime;
                    videoRef.current.play();
                  }
                }}
                className="bg-[#E50914] hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition shadow-lg active:scale-95"
              >
                Tiếp tục xem
              </button>
              <button
                onClick={() => {
                  setShowResumeDialog(false);
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play();
                  }
                  if (playingMovie) {
                    updateWatchProgress(
                      playingMovie,
                      0,
                      45 * 60,
                      currentEpisodeTitle || playingMovie.currentEpisode,
                      currentEpisodeEmbed || playingMovie.embedUrl
                    );
                  }
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold px-5 py-2.5 rounded-lg text-sm transition active:scale-95 border border-white/10"
              >
                Xem lại từ đầu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-intrusive Resume Toast for Iframe Stream */}
      {resumeToast && (
        <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/90 backdrop-blur-md border border-red-500/30 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
          <span>
            Đang phát: <strong className="text-red-400">{resumeToast}</strong>
          </span>
        </div>
      )}

      {/* CASE 1: REAL API EMBED STREAMING */}
      {activeEmbed ? (
        <div className="relative w-full h-full flex flex-col bg-black">
          {/* Ambient Cinema Backdrop & Loading Veil (Shows while video is loading, then dissolves smoothly) */}
          <div
            className={`absolute inset-0 z-10 transition-opacity duration-1000 ease-out pointer-events-none ${
              isVideoLoaded ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {/* Ambient Blurred Artwork */}
            {playingMovie.backdropUrl || playingMovie.posterUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center filter blur-3xl scale-110 opacity-35 brightness-50"
                style={{
                  backgroundImage: `url('${playingMovie.backdropUrl || playingMovie.posterUrl}')`,
                }}
              />
            ) : null}

            {/* Deep Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/95" />

            {/* Centered Cinema Loading Pulse */}
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
                  {currentEpisodeTitle || playingMovie.currentEpisode || 'Đang chuẩn bị phim...'}
                </p>
                <p className="text-xs text-zinc-400 font-medium tracking-wide pt-1">
                  Đang khởi tạo trình phát phim • Vui lòng chờ trong giây lát
                </p>
              </div>
            </div>
          </div>

          {/* Header Bar */}
          <div
            className={`absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/90 via-black/50 to-transparent p-4 sm:p-6 flex items-center justify-between text-white transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-4">
              <button
                onClick={handleClose}
                aria-label="Quay lại"
                className="w-10 h-10 rounded-full hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-lg md:text-xl font-bold uppercase tracking-wide">
                  {playingMovie.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
                  {currentEpisodeTitle && (
                    <span className="text-red-400 font-bold">{currentEpisodeTitle}</span>
                  )}
                  {playingMovie.subTitle && <span>• {playingMovie.subTitle}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Episodes Selector Button if series */}
              {currentServer && currentServer.items.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setShowEpisodeSelector(!showEpisodeSelector)}
                    className="flex items-center gap-2 bg-zinc-800/80 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-white border border-white/20 transition cursor-pointer"
                  >
                    <ListVideo className="w-4 h-4 text-red-500" />
                    <span>Chọn tập ({currentServer.items.length} tập)</span>
                  </button>

                  {/* Dropdown list of episodes */}
                  {showEpisodeSelector && (
                    <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-lg p-2 grid grid-cols-4 gap-1.5 shadow-2xl z-50">
                      {currentServer.items.map((ep) => (
                        <button
                          key={ep.slug}
                          onClick={() => {
                            setPlayingEpisode(ep.embed, `Tập ${ep.name}`);
                            setShowEpisodeSelector(false);
                          }}
                          className={`p-2 text-xs rounded font-bold transition text-center cursor-pointer ${
                            activeEmbed === ep.embed
                              ? 'bg-red-600 text-white'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          Tập {ep.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                aria-label="Toàn màn hình"
                className="w-10 h-10 rounded-full hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* IFrame Embed Stream - Smoothly fades in when loaded */}
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
      ) : !activeEmbed && (isLoadingDetail || playingMovie.slug) ? (
        /* Connecting stream state with smooth fade */
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-black text-white space-y-4">
          <button
            onClick={handleClose}
            aria-label="Quay lại"
            className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-12 h-12 border-3 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
          <div className="text-center px-4">
            <h3 className="text-lg md:text-xl font-bold text-white uppercase tracking-wide">
              {playingMovie.title}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Đang kết nối luồng phát {currentEpisodeTitle || 'tập phim'}...
            </p>
          </div>
        </div>
      ) : playingMovie.videoUrl ? (
        /* CASE 2: HTML5 VIDEO PLAYER (for demo / trailer) */
        <>
          <video
            ref={videoRef}
            src={playingMovie.videoUrl}
            autoPlay
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={() => setIsVideoLoaded(true)}
            onClick={togglePlay}
            className={`w-full h-full object-contain cursor-pointer transition-opacity duration-700 ease-out ${
              isVideoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Overlay UI Controls */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 flex flex-col justify-between p-6 md:p-10 transition-opacity duration-300 pointer-events-none ${
              showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0'
            }`}
          >
            {/* Top Header */}
            <div className="flex items-center gap-4 text-white">
              <button
                onClick={handleClose}
                aria-label="Quay lại"
                className="w-10 h-10 rounded-full hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-lg md:text-xl font-bold uppercase tracking-wide">
                  {playingMovie.title}
                </h2>
                {playingMovie.subTitle && (
                  <p className="text-xs text-zinc-300 font-medium">{playingMovie.subTitle}</p>
                )}
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="space-y-3">
              {/* Timeline Scrubber */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-300 font-medium w-12 text-right">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1 bg-zinc-700 accent-red-600 rounded-lg cursor-pointer hover:h-2 transition-all"
                />
                <span className="text-xs text-zinc-300 font-medium w-12">
                  {formatTime(Math.max(0, duration - currentTime))}
                </span>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-4 sm:gap-6">
                  {/* Play / Pause */}
                  <button
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                    className="hover:text-red-500 transition cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
                  </button>

                  {/* 10s backward */}
                  <button
                    onClick={() => skipTime(-10)}
                    aria-label="Tua lại 10 giây"
                    className="hover:text-zinc-300 transition cursor-pointer"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  {/* 10s forward */}
                  <button
                    onClick={() => skipTime(10)}
                    aria-label="Tua tới 10 giây"
                    className="hover:text-zinc-300 transition cursor-pointer"
                  >
                    <RotateCw className="w-5 h-5" />
                  </button>

                  {/* Volume control */}
                  <div className="flex items-center gap-2 group/vol">
                    <button onClick={toggleMute} aria-label="Âm lượng" className="cursor-pointer">
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5" />
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
                      onChange={handleVolumeChange}
                      className="w-16 sm:w-20 h-1 bg-zinc-600 accent-white rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-5">
                  {/* Audio & Subtitles */}
                  <button
                    title="Phụ đề & Âm thanh"
                    className="hover:text-zinc-300 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="hidden sm:inline">Tiếng Việt</span>
                  </button>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    aria-label="Toàn màn hình"
                    className="hover:text-zinc-300 transition cursor-pointer"
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Empty / Unavailable Stream Fallback */
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-black text-white p-6 space-y-4 text-center">
          <button
            onClick={handleClose}
            aria-label="Quay lại"
            className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6" />
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
