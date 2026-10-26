'use client';

import React, { useRef } from 'react';
import { Movie } from '@/types';
import { StatusBadge, Top10Badge } from '@/components/ui/Badge';
import { Top10Number } from '@/components/ui/Top10Number';
import { useNetflix } from '@/context/NetflixContext';
import { DEFAULT_POSTER_IMAGE } from '@/lib/movieUtils';

interface Top10CardProps {
  movie: Movie;
  rank: number;
}

export const Top10Card: React.FC<Top10CardProps> = ({ movie, rank }) => {
  const { openModal, onCardHover, onCardLeave } = useNetflix();
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

  return (
    <div
      onClick={() => openModal(movie)}
      className="relative flex items-center flex-shrink-0 cursor-pointer group select-none transition-all duration-500"
      style={{ width: '220px' }}
    >
      {/* SVG Outline Number */}
      <div className="relative -mr-6 md:-mr-8 z-0 flex items-center justify-center flex-shrink-0">
        <Top10Number rank={rank} />
      </div>

      {/* Vertical Poster Card */}
      <div
        ref={cardRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative z-10 w-[130px] md:w-[155px] h-[190px] md:h-[225px] rounded-md overflow-hidden bg-zinc-800 shadow-xl border border-white/5 group-hover:border-white/30 transition-all flex-shrink-0"
      >
        {/* Top-left Platform Top 10 Badge */}
        {movie.badges?.isTop10 && (
          <div className="absolute top-1.5 left-1.5 z-20">
            <Top10Badge
              size="sm"
              platform={movie.badges.platform || 'netflix'}
            />
          </div>
        )}

        <img
          src={movie.posterUrl || DEFAULT_POSTER_IMAGE}
          alt={movie.title}
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.endsWith(DEFAULT_POSTER_IMAGE)) {
              img.src = DEFAULT_POSTER_IMAGE;
            }
          }}
          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
        />

        {/* Gradient shadow for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Title overlay at the bottom */}
        <div className="absolute bottom-2 left-2 right-2 text-center">
          <p className="text-white font-extrabold text-xs sm:text-sm tracking-wide drop-shadow-md line-clamp-1 uppercase">
            {movie.title}
          </p>

          {/* Badges: Chưa có sẵn, Mới thêm, Tập mới */}
          {movie.badges && (
            <div className="mt-1 flex justify-center">
              {movie.badges.ribbon && !movie.badges.ribbon.startsWith('#') ? (
                <StatusBadge
                  ribbon={movie.badges.ribbon}
                  subBadge={movie.badges.subBadge}
                />
              ) : movie.badges.ribbon === 'Chưa có sẵn' ? (
                <StatusBadge
                  ribbon="Chưa có sẵn"
                  subBadge="Trailer"
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
