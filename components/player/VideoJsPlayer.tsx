'use client';

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import '@videojs/react/video/skin.css';
import { VideoPlayer, VideoSkin, Video, usePlayer } from '@videojs/react/video';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { ArrowLeft, ListVideo } from 'lucide-react';
import { formatEpisodeTitle } from '@/services/movieApi';
import { CleanPlaylistLoader } from '@/lib/m3u8Filter';
import { NextEpisodeCard } from './NextEpisodeCard';

export interface VideoJsPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  subTitle?: string;
  episodeTitle?: string;
  initialTime?: number;
  episodes?: { slug: string; name: string; embed?: string; m3u8?: string }[];
  currentEpisodeTitle?: string;
  onSelectEpisode?: (embed?: string, title?: string, m3u8?: string) => void;
  onClose: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (e: any) => void;
  className?: string;
  nextEpisode?: { slug?: string; name: string; embed?: string; m3u8?: string } | null;
  onPlayNextEpisode?: () => void;
}

/**
 * Screen orientation helpers for mobile devices.
 * Automatically locks device to landscape on fullscreen, and unlocks back to normal on exit.
 */
export const lockScreenLandscape = async () => {
  if (typeof window === 'undefined') return;
  try {
    const scr = window.screen as any;
    const orientation = scr?.orientation || scr?.mozOrientation || scr?.msOrientation;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape');
    } else if (typeof scr?.lockOrientation === 'function') {
      scr.lockOrientation('landscape');
    } else if (typeof scr?.mozLockOrientation === 'function') {
      scr.mozLockOrientation('landscape');
    } else if (typeof scr?.msLockOrientation === 'function') {
      scr.msLockOrientation('landscape');
    }
  } catch (err) {
    // Unsupported on some platforms (e.g. iOS Safari) or user permission restriction
  }
};

export const unlockScreenOrientation = () => {
  if (typeof window === 'undefined') return;
  try {
    const scr = window.screen as any;
    const orientation = scr?.orientation || scr?.mozOrientation || scr?.msOrientation;
    if (orientation && typeof orientation.unlock === 'function') {
      orientation.unlock();
    } else if (typeof scr?.unlockOrientation === 'function') {
      scr.unlockOrientation();
    } else if (typeof scr?.mozUnlockOrientation === 'function') {
      scr.mozUnlockOrientation();
    } else if (typeof scr?.msUnlockOrientation === 'function') {
      scr.msUnlockOrientation();
    }
  } catch (err) {}
};

/**
 * Orientation handler hook placed inside VideoPlayer context.
 * Syncs reactive player fullscreen state with device orientation.
 */
const OrientationHandler: React.FC = () => {
  const isFullscreen = usePlayer((state) => Boolean((state as any).isFullscreen));

  // Sync orientation when Video.js updates isFullscreen state
  useEffect(() => {
    if (isFullscreen) {
      lockScreenLandscape();
    } else {
      unlockScreenOrientation();
    }
  }, [isFullscreen]);

  // Direct DOM listeners for fullscreen changes and button taps
  useEffect(() => {
    const handleNativeFsChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (isFs) {
        lockScreenLandscape();
      } else {
        unlockScreenOrientation();
      }
    };

    document.addEventListener('fullscreenchange', handleNativeFsChange);
    document.addEventListener('webkitfullscreenchange', handleNativeFsChange);

    // Fast-path: On mobile, capture tap on the fullscreen button for instant user-gesture lock
    const handleCaptureClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.media-fullscreen-button')) {
        const isCurrentlyFs = Boolean(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement
        );
        if (!isCurrentlyFs) {
          lockScreenLandscape();
        }
      }
    };
    document.addEventListener('click', handleCaptureClick, true);

    return () => {
      document.removeEventListener('fullscreenchange', handleNativeFsChange);
      document.removeEventListener('webkitfullscreenchange', handleNativeFsChange);
      document.removeEventListener('click', handleCaptureClick, true);
      unlockScreenOrientation();
    };
  }, []);

  return null;
};

/**
 * TopBar component placed INSIDE VideoPlayer context.
 * Designed to prevent collision with Video.js's top-right control pill on mobile.
 */
const PlayerTopBar: React.FC<{
  onClose: () => void;
  movieTitle: string;
  subTitle?: string;
  episodeTitle: string;
  episodes?: { slug: string; name: string; embed?: string; m3u8?: string }[];
  currentEpisodeTitle?: string;
  onSelectEpisode?: (embed?: string, title?: string, m3u8?: string) => void;
}> = ({
  onClose,
  movieTitle,
  subTitle,
  episodeTitle,
  episodes,
  currentEpisodeTitle,
  onSelectEpisode,
}) => {
  const controlsVisible = usePlayer((state) => Boolean((state as any).controlsVisible));
  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-20 px-2.5 py-2 sm:px-5 sm:py-4 flex items-center justify-between text-white pointer-events-none transition-all duration-300 ease-out ${
        controlsVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-2'
      }`}
    >
      {/* Left Section: Back button + (Mobile Episode Button) + Movie Info */}
      <div className="flex items-center gap-1.5 sm:gap-4 min-w-0 pointer-events-auto">
        {/* Back / Exit Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Thoát xem phim"
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-white backdrop-blur-md border border-white/20 transition cursor-pointer shrink-0 shadow-lg"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-xs sm:text-sm font-semibold tracking-wide">Thoát</span>
        </button>

        {/* Mobile Episode Selector Button: Grouped on the left so right side is completely clear */}
        {episodes && episodes.length > 1 && onSelectEpisode && (
          <div className="relative shrink-0 sm:hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEpisodeSelector((prev) => !prev);
              }}
              aria-label="Danh sách tập"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 active:scale-95 text-white backdrop-blur-md border border-white/20 transition cursor-pointer text-xs font-semibold shadow-lg"
            >
              <ListVideo className="w-3.5 h-3.5 text-red-500" />
              <span className="max-w-[75px] truncate">{episodeTitle}</span>
            </button>
          </div>
        )}

        {/* Title Information */}
        <div className="min-w-0 flex flex-col justify-center">
          <h2 className="text-xs sm:text-base md:text-lg font-bold uppercase tracking-wide truncate max-w-[90px] xs:max-w-[145px] sm:max-w-xs md:max-w-md drop-shadow">
            {movieTitle}
          </h2>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-zinc-300 font-medium truncate">
            <span className="text-red-400 font-bold drop-shadow hidden sm:inline">{episodeTitle}</span>
            {subTitle && (
              <span className="text-zinc-400 truncate max-w-[110px] sm:max-w-[220px]">
                {subTitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Right: Episode Selector for wide screens */}
      {episodes && episodes.length > 1 && onSelectEpisode && (
        <div className="relative shrink-0 hidden sm:block pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEpisodeSelector((prev) => !prev);
            }}
            aria-label="Danh sách tập"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 active:scale-95 text-white backdrop-blur-md border border-white/20 transition cursor-pointer text-xs sm:text-sm font-semibold shadow-lg"
          >
            <ListVideo className="w-4 h-4 text-red-500" />
            <span>Chọn tập ({episodes.length})</span>
          </button>
        </div>
      )}

      {/* Mobile Right Spacer: Reserves 140px on screens < 640px so Video.js's top-right control pill is NEVER overlapped */}
      <div className="w-[140px] shrink-0 sm:hidden pointer-events-none" />

      {/* Episode Selection Dropdown / Modal */}
      {showEpisodeSelector && episodes && onSelectEpisode && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              setShowEpisodeSelector(false);
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed sm:absolute top-14 left-4 right-4 sm:left-auto sm:right-5 sm:top-16 max-w-sm sm:w-80 max-h-72 sm:max-h-80 overflow-y-auto bg-zinc-900/98 backdrop-blur-xl border border-zinc-700 rounded-xl p-3 grid grid-cols-4 gap-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
          >
            <div className="col-span-4 flex items-center justify-between pb-1.5 border-b border-zinc-800 mb-1">
              <span className="text-xs font-bold text-zinc-300">Danh sách tập ({episodes.length})</span>
              <button
                onClick={() => setShowEpisodeSelector(false)}
                className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 cursor-pointer"
              >
                Đóng
              </button>
            </div>
            {episodes.map((ep) => {
              const epTitle = formatEpisodeTitle(ep.name);
              const isEpActive = currentEpisodeTitle === epTitle;
              return (
                <button
                  key={ep.slug}
                  onClick={() => {
                    onSelectEpisode(ep.embed, epTitle, ep.m3u8);
                    setShowEpisodeSelector(false);
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
  );
};

export const VideoJsPlayer: React.FC<VideoJsPlayerProps> = ({
  src,
  poster,
  title = '',
  subTitle,
  episodeTitle = '',
  initialTime = 0,
  episodes,
  currentEpisodeTitle,
  onSelectEpisode,
  onClose,
  onTimeUpdate,
  onPause,
  onEnded,
  onError,
  className = '',
  nextEpisode,
  onPlayNextEpisode,
}) => {
  const isHls = src.includes('.m3u8') || src.includes('m3u8');
  const hasSeekedRef = useRef(false);

  // Local state for exact time monitoring passed to NextEpisodeCard
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Determine effective next episode: use passed nextEpisode or derive from episodes list
  const effectiveNextEpisode = useMemo(() => {
    if (nextEpisode !== undefined) return nextEpisode;
    if (!episodes || episodes.length <= 1) return null;
    const currentFormatted = formatEpisodeTitle(currentEpisodeTitle || episodeTitle || '');
    const currentIndex = episodes.findIndex(
      (ep) => formatEpisodeTitle(ep.name) === currentFormatted
    );
    if (currentIndex >= 0 && currentIndex + 1 < episodes.length) {
      return episodes[currentIndex + 1];
    }
    return null;
  }, [nextEpisode, episodes, currentEpisodeTitle, episodeTitle]);

  const handlePlayNext = useCallback(() => {
    if (onPlayNextEpisode) {
      onPlayNextEpisode();
    } else if (effectiveNextEpisode && onSelectEpisode) {
      onSelectEpisode(
        effectiveNextEpisode.embed,
        formatEpisodeTitle(effectiveNextEpisode.name),
        effectiveNextEpisode.m3u8
      );
    }
  }, [onPlayNextEpisode, effectiveNextEpisode, onSelectEpisode]);

  // Configure HLS source with CleanPlaylistLoader to strip in-stream gambling ads in RAM (ERR-15)
  const hlsSource = useMemo(() => {
    return {
      src,
      type: 'application/vnd.apple.mpegurl',
      preferPlayback: 'mse' as const,
      engine: {
        hlsJs: {
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          pLoader: CleanPlaylistLoader as any,
        },
      },
    };
  }, [src]);

  useEffect(() => {
    hasSeekedRef.current = false;
  }, [src]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.duration && !isNaN(video.duration)) {
      setDuration(video.duration);
    }
    if (!hasSeekedRef.current && initialTime > 5 && video.duration > initialTime) {
      hasSeekedRef.current = true;
      try {
        video.currentTime = initialTime;
      } catch {}
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.currentTime) {
      setCurrentTime(video.currentTime);
    }
    if (video.duration && !isNaN(video.duration)) {
      setDuration(video.duration);
      if (onTimeUpdate) {
        onTimeUpdate(video.currentTime, video.duration);
      }
    } else if (onTimeUpdate) {
      onTimeUpdate(video.currentTime, 0);
    }
  };

  const handlePause = () => {
    if (onPause) {
      onPause();
    }
  };

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-black overflow-hidden [&_.media-title]:hidden! ${className}`}>
      <VideoPlayer poster={poster}>
        <OrientationHandler />
        <VideoSkin style={{ width: '100%', height: '100%' }}>
          {isHls ? (
            <HlsJsVideo
              src={src}
              source={hlsSource}
              poster={poster}
              autoPlay
              playsInline
              crossOrigin="anonymous"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPause={handlePause}
              onEnded={onEnded}
              onError={onError}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <Video
              src={src}
              poster={poster}
              autoPlay
              playsInline
              crossOrigin="anonymous"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPause={handlePause}
              onEnded={onEnded}
              onError={onError}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}

          {/* Synchronized TopBar integrated directly inside Video.js UI */}
          <PlayerTopBar
            onClose={onClose}
            movieTitle={title}
            subTitle={subTitle}
            episodeTitle={episodeTitle}
            episodes={episodes}
            currentEpisodeTitle={currentEpisodeTitle}
            onSelectEpisode={onSelectEpisode}
          />

          {/* Netflix-Style Liquid Glass Next Episode Floating Card (ERR-16 / Obsidian 03.4 spec) */}
          {effectiveNextEpisode && (
            <NextEpisodeCard
              nextEpisode={effectiveNextEpisode}
              movieTitle={title}
              onPlayNext={handlePlayNext}
              currentTimeOverride={currentTime}
              durationOverride={duration}
            />
          )}
        </VideoSkin>
      </VideoPlayer>
    </div>
  );
};

export default VideoJsPlayer;

