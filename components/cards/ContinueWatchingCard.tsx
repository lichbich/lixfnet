'use client';

import React, { useRef } from 'react';
import { Play, X } from 'lucide-react';
import { Movie } from '@/types';
import { Top10Badge, StatusBadge } from '@/components/ui/Badge';
import { useNetflix } from '@/context/NetflixContext';
import { formatEpisodeTitle } from '@/services/movieApi';
import { DEFAULT_BACKDROP_IMAGE } from '@/lib/movieUtils';

interface ContinueWatchingCardProps {
  movie: Movie;
  fillWidth?: boolean;
  className?: string;
}

export const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({
  movie,
  fillWidth = false,
  className = '',
}) => {
  const { openModal, startPlaying, clearWatchProgress, onCardHover, onCardLeave } = useNetflix();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (typeof window !== 'undefined') {
      const isTouch =
        window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
        window.innerWidth < 1024 ||
        navigator.maxTouchPoints > 0;
      if (isTouch) return;
    }
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      onCardHover(movie, rect);
    }
  };

  const handleMouseLeave = () => {
    onCardLeave();
  };

  const sizeClass = fillWidth
    ? 'w-full'
    : 'w-[220px] sm:w-[250px] md:w-[270px] flex-shrink-0';

  return (
    <div
      ref={cardRef}
      onClick={() => openModal(movie)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative ${sizeClass} aspect-[16/10] rounded-md overflow-hidden bg-zinc-800 shadow-lg border border-white/5 cursor-pointer group select-none transition-all duration-300 hover:scale-105 hover:z-20 hover:border-white/20 ${className}`}
    >
      {/* Thumbnail */}
      <img
        src={movie.backdropUrl || movie.posterUrl || DEFAULT_BACKDROP_IMAGE}
        alt={movie.title}
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.src.endsWith(DEFAULT_BACKDROP_IMAGE)) {
            img.src = DEFAULT_BACKDROP_IMAGE;
          }
        }}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />

      {/* Dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* TOP 10 Badge in top-left */}
      {movie.badges?.isTop10 && (
        <div className="absolute top-2 left-2 z-10">
          <Top10Badge size="sm" platform={movie.badges?.platform} />
        </div>
      )}

      {/* Remove from row ('X') Button on Card Top-Right */}
      <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            clearWatchProgress(movie.slug || movie.id);
          }}
          title="Xóa khỏi hàng"
          className="w-7 h-7 rounded-full bg-black/80 hover:bg-red-600/90 border border-white/20 hover:border-red-500 text-white flex items-center justify-center transition active:scale-90 shadow-md cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Play Button on hover */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 pointer-events-none">
        <button
          onClick={(e) => {
            e.stopPropagation();
            startPlaying(
              movie,
              movie.embedUrl,
              movie.currentEpisode ? formatEpisodeTitle(movie.currentEpisode) : undefined,
              movie.m3u8Url
            );
          }}
          aria-label="Phát"
          className="w-12 h-12 rounded-full bg-white/90 hover:bg-white text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition pointer-events-auto cursor-pointer"
        >
          <Play className="w-6 h-6 fill-black ml-0.5" />
        </button>
      </div>

      {/* Title & Status Badges */}
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 z-10 pointer-events-none">
        <div>
          <h3 className="text-white font-bold text-xs sm:text-sm drop-shadow line-clamp-1 uppercase tracking-wide">
            {movie.title}
          </h3>
          {movie.currentEpisode && (
            <p className="text-[11px] text-zinc-300 drop-shadow line-clamp-1 mt-0.5">
              {formatEpisodeTitle(movie.currentEpisode)}
            </p>
          )}
        </div>

        {movie.badges && (movie.badges.ribbon || movie.badges.subBadge) && (
          <div className="flex-shrink-0">
            <StatusBadge
              ribbon={movie.badges.ribbon}
              subBadge={movie.badges.subBadge}
            />
          </div>
        )}
      </div>

      {/* Red Progress Bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700/80">
        <div
          className="h-full bg-[#E50914] rounded-r-full transition-all duration-300"
          style={{ width: `${movie.progress ?? 0}%` }}
        />
      </div>
    </div>
  );
};
