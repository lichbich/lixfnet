'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '@videojs/react/video';
import { Sparkles, Play, X } from 'lucide-react';
import { formatEpisodeTitle } from '@/services/movieApi';

export interface NextEpisodeCardProps {
  nextEpisode?: { slug?: string; name: string; embed?: string; m3u8?: string } | null;
  movieTitle?: string;
  onPlayNext: () => void;
  currentTimeOverride?: number;
  durationOverride?: number;
}

/**
 * Netflix-Style Liquid Glass "Next Episode" Floating Card
 * Business Specification: Obsidian 03.4 & 01.2 (Section 2.3)
 * - Strict episode safeguard: only renders if a genuine next episode exists in the current server.
 * - Activates at last 90 seconds (duration - currentTime <= 90 && duration > 120).
 * - Gentle 5s auto-fadeout without forced countdown (respects outro / after-credits).
 * - Interaction revival: mousemove / touchstart / pointerdown re-reveals card within 90s.
 * - Rewind recovery: resets trigger flag if user seeks back before 90s.
 * - Adaptive positioning: floats above scrubber controls when visible, glides down when idle.
 */
export const NextEpisodeCard: React.FC<NextEpisodeCardProps> = ({
  nextEpisode,
  movieTitle = '',
  onPlayNext,
  currentTimeOverride,
  durationOverride,
}) => {
  const playerCurrentTime = usePlayer((state) => (state as any)?.currentTime ?? 0);
  const playerDuration = usePlayer((state) => (state as any)?.duration ?? 0);
  const controlsVisible = usePlayer((state) => Boolean((state as any)?.controlsVisible));

  const currentTime =
    currentTimeOverride !== undefined && currentTimeOverride > 0
      ? currentTimeOverride
      : playerCurrentTime;
  const duration =
    durationOverride !== undefined && durationOverride > 0 ? durationOverride : playerDuration;

  const [showCard, setShowCard] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTriggeredNearEndRef = useRef(false);
  const isHoveredRef = useRef(false);

  const nextEpisodeRef = useRef(nextEpisode);
  nextEpisodeRef.current = nextEpisode;

  const isNearEnd = Boolean(
    nextEpisode &&
      typeof duration === 'number' &&
      !isNaN(duration) &&
      isFinite(duration) &&
      duration > 120 &&
      currentTime >= duration - 90 &&
      currentTime < duration
  );
  const isNearEndRef = useRef(isNearEnd);
  isNearEndRef.current = isNearEnd;

  // Revives the Next Episode Card and sets a gentle 5-second auto-hide timeout
  const resetTimer = useCallback(() => {
    if (!nextEpisodeRef.current || !isNearEndRef.current) return;
    setShowCard(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (!isHoveredRef.current) {
      timerRef.current = setTimeout(() => {
        setShowCard(false);
      }, 5000);
    }
  }, []);

  // Time monitor: triggers near end (last 90s) and handles rewind recovery
  useEffect(() => {
    if (!nextEpisode || !duration || isNaN(duration) || duration <= 120) return;
    const remaining = duration - currentTime;

    if (remaining <= 90 && remaining > 0) {
      if (!hasTriggeredNearEndRef.current) {
        hasTriggeredNearEndRef.current = true;
        resetTimer();
      }
    } else if (remaining > 90) {
      // Rewind recovery: if user seeks backwards before the 90s mark, reset trigger flag & hide card
      if (hasTriggeredNearEndRef.current) {
        hasTriggeredNearEndRef.current = false;
        setShowCard(false);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    }
  }, [currentTime, duration, nextEpisode, resetTimer]);

  // Interaction revival: mousemove / touchstart / pointerdown inside last 90s re-reveals card
  useEffect(() => {
    const handleInteraction = () => {
      if (isNearEndRef.current && nextEpisodeRef.current) {
        resetTimer();
      }
    };

    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    window.addEventListener('pointerdown', handleInteraction);

    return () => {
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('pointerdown', handleInteraction);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [resetTimer]);

  // Reset state when nextEpisode changes (e.g. after episode transition)
  useEffect(() => {
    setShowCard(false);
    hasTriggeredNearEndRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [nextEpisode]);

  const handlePlayNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowCard(false);
    hasTriggeredNearEndRef.current = false;
    onPlayNext();
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCard(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    resetTimer();
  };

  if (!nextEpisode) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute right-3 sm:right-8 z-30 transition-all duration-500 ease-out transform ${
        controlsVisible ? 'bottom-24 sm:bottom-32' : 'bottom-6 sm:bottom-8'
      } ${
        showCard
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
      }`}
    >
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative overflow-hidden bg-black/40 hover:bg-black/55 backdrop-blur-2xl border border-white/20 hover:border-white/35 rounded-2xl p-4 sm:p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_16px_40px_rgba(0,0,0,0.5)] w-[calc(100vw-2rem)] max-w-[290px] sm:max-w-xs group/card transition-all duration-300"
      >
        {/* Liquid Glass Ambient Refraction Glows */}
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-red-600/20 rounded-full blur-2xl pointer-events-none" />

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          aria-label="Đóng thông báo tập tiếp theo"
          className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 w-6 h-6 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 border border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer z-10"
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
          <h4 className="text-white font-extrabold text-sm sm:text-base md:text-lg mt-2 line-clamp-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            {formatEpisodeTitle(nextEpisode.name)}
          </h4>
          {movieTitle && (
            <p className="text-zinc-200 text-xs line-clamp-1 mt-0.5 font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
              {movieTitle}
            </p>
          )}
        </div>

        {/* Action Button: Phát ngay (Liquid Glass Pill with Shimmer) */}
        <button
          onClick={handlePlayNow}
          className="relative z-10 overflow-hidden mt-3 sm:mt-4 w-full py-2 sm:py-2.5 px-4 bg-white/20 hover:bg-white/30 active:scale-98 text-white backdrop-blur-xl border border-white/35 hover:border-white/50 rounded-xl flex items-center justify-center gap-2 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.6),0_6px_20px_rgba(0,0,0,0.35)] transition-all cursor-pointer group/btn"
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
  );
};

export default NextEpisodeCard;
