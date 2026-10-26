'use client';

import React from 'react';
import { Play, Check, CalendarClock } from 'lucide-react';
import { DEFAULT_BACKDROP_IMAGE } from '@/lib/movieUtils';

export interface EpisodeRowProps {
  number: string | number;
  title: string;
  description?: string;
  thumbnail?: string;
  fallbackThumbnail?: string;
  durationLabel?: string;
  progressPercent?: number;
  isCurrent?: boolean;
  isCompleted?: boolean;
  isUpcoming?: boolean;
  upcomingLabel?: string;
  onClick?: () => void;
}

/**
 * Netflix-style horizontal episode row:
 * [number] [16:9 still + progress] [title · duration / synopsis]
 */
export const EpisodeRow: React.FC<EpisodeRowProps> = ({
  number,
  title,
  description,
  thumbnail,
  fallbackThumbnail,
  durationLabel,
  progressPercent = 0,
  isCurrent = false,
  isCompleted = false,
  isUpcoming = false,
  upcomingLabel,
  onClick,
}) => {
  const safeFallback = fallbackThumbnail || DEFAULT_BACKDROP_IMAGE;
  const src = thumbnail || safeFallback;
  const percent = Math.min(100, Math.max(0, progressPercent));

  return (
    <button
      type="button"
      onClick={isUpcoming ? undefined : onClick}
      disabled={isUpcoming}
      aria-current={isCurrent ? 'true' : undefined}
      className={`group relative w-full flex items-center gap-3 sm:gap-5 px-3 sm:px-5 py-4 sm:py-5 text-left border-b border-zinc-800/80 last:border-b-0 transition-colors duration-200 ${
        isCurrent
          ? 'bg-zinc-800/90'
          : isUpcoming
          ? 'cursor-default'
          : 'hover:bg-zinc-800/50 cursor-pointer'
      }`}
    >
      {isCurrent && <span className="absolute left-0 inset-y-0 w-[3px] bg-[#E50914]" />}

      {/* Episode number */}
      <span
        className={`w-5 sm:w-8 shrink-0 text-center text-lg sm:text-2xl font-medium tabular-nums transition-colors ${
          isCurrent ? 'text-white' : isUpcoming ? 'text-zinc-600' : 'text-zinc-400 group-hover:text-zinc-200'
        }`}
      >
        {number}
      </span>

      {/* Still image */}
      <div className="relative shrink-0 w-[118px] sm:w-[150px] aspect-video rounded-md overflow-hidden bg-zinc-800 ring-1 ring-white/5">
        {src ? (
          <img
            src={src}
            alt={title}
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.src.endsWith(safeFallback)) img.src = safeFallback;
            }}
            className={`w-full h-full object-cover transition-transform duration-500 ${
              isUpcoming ? 'opacity-40 grayscale' : 'group-hover:scale-105'
            }`}
          />
        ) : null}

        {!isUpcoming && (
          <div
            className={`absolute inset-0 flex items-center justify-center transition-colors duration-200 ${
              isCurrent ? 'bg-black/30' : 'bg-black/0 group-hover:bg-black/40'
            }`}
          >
            <span
              className={`w-9 h-9 rounded-full border-2 border-white/90 bg-black/50 backdrop-blur-sm flex items-center justify-center transition-all duration-200 ${
                isCurrent ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'
              }`}
            >
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            </span>
          </div>
        )}

        {isUpcoming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <CalendarClock className="w-6 h-6 text-zinc-300/80" />
          </div>
        )}

        {isCompleted && (
          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 border border-white/20 flex items-center justify-center">
            <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
          </span>
        )}

        {percent > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-zinc-500/70">
            <div
              className={`h-full ${isCompleted ? 'bg-zinc-200' : 'bg-[#E50914]'}`}
              style={{ width: `${Math.max(percent, 4)}%` }}
            />
          </div>
        )}
      </div>

      {/* Text block */}
      <div className="flex-1 min-w-0 self-start sm:self-center">
        <div className="flex items-start justify-between gap-3">
          <h4
            className={`text-sm sm:text-base font-bold leading-snug line-clamp-1 transition-colors ${
              isUpcoming ? 'text-zinc-400' : 'text-white'
            }`}
          >
            {title}
          </h4>
          {durationLabel && !isUpcoming && (
            <span className="shrink-0 text-xs sm:text-sm text-zinc-300 font-medium tabular-nums">
              {durationLabel}
            </span>
          )}
        </div>

        {(isCurrent || isCompleted) && (
          <span
            className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wider ${
              isCurrent ? 'text-[#E50914]' : 'text-zinc-400'
            }`}
          >
            {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-pulse" />}
            {isCurrent ? 'Đang xem' : 'Đã xem'}
          </span>
        )}

        {isUpcoming ? (
          <p className="mt-1.5 text-xs sm:text-sm text-zinc-500">{upcomingLabel || 'Sắp ra mắt'}</p>
        ) : description ? (
          <p className="mt-1.5 text-xs sm:text-[13px] text-zinc-400 leading-relaxed line-clamp-2 sm:line-clamp-3">
            {description}
          </p>
        ) : null}
      </div>
    </button>
  );
};

/** Shimmer placeholder matching EpisodeRow layout */
export const EpisodeRowSkeleton: React.FC = () => (
  <div className="relative w-full flex items-center gap-3 sm:gap-5 px-3 sm:px-5 py-4 sm:py-5 border-b border-zinc-800/80 last:border-b-0 overflow-hidden">
    <div className="absolute inset-0 -translate-x-full animate-netflix-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent pointer-events-none" />
    <div className="w-5 sm:w-8 h-6 rounded bg-zinc-800/70 shrink-0" />
    <div className="w-[118px] sm:w-[150px] aspect-video rounded-md bg-zinc-800/80 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="flex justify-between gap-3">
        <div className="h-4 w-24 rounded bg-zinc-800/90" />
        <div className="h-4 w-12 rounded bg-zinc-800/60" />
      </div>
      <div className="h-3 w-full rounded bg-zinc-800/50" />
      <div className="h-3 w-3/4 rounded bg-zinc-800/40" />
    </div>
  </div>
);
