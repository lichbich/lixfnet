'use client';

import React, { useState, useRef } from 'react';
import { Play, Plus, Check, ThumbsUp, ChevronDown } from 'lucide-react';
import { Movie } from '@/types';
import { Top10Badge, RatingBadge } from '@/components/ui/Badge';
import { useNetflix } from '@/context/NetflixContext';

interface MovieCardProps {
  movie: Movie;
  variant?: 'landscape' | 'portrait';
  fillWidth?: boolean;
  className?: string;
}

export const MovieCard = React.memo<MovieCardProps>(({
  movie,
  variant = 'landscape',
  fillWidth = false,
  className = '',
}) => {
  const {
    openModal,
    startPlaying,
    toggleMyList,
    isInMyList,
    onCardHover,
    onCardLeave,
  } = useNetflix();
  const [isLiked, setIsLiked] = useState(false);
  const inList = isInMyList(movie.id);

  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      onCardHover(movie, rect);
    }
  };

  const handleMouseLeave = () => {
    onCardLeave();
  };

  const isPortrait = variant === 'portrait';
  const mainImage = isPortrait
    ? movie.posterUrl || movie.backdropUrl
    : movie.backdropUrl || movie.posterUrl;

  const sizeClasses = fillWidth
    ? isPortrait
      ? 'w-full aspect-[2/3]'
      : 'w-full aspect-video'
    : isPortrait
      ? 'w-[145px] sm:w-[175px] md:w-[195px] aspect-[2/3]'
      : 'w-[210px] sm:w-[240px] md:w-[260px] aspect-video';

  return (
    <div
      ref={cardRef}
      onClick={() => openModal(movie)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative flex-shrink-0 rounded-md sm:rounded-lg overflow-hidden bg-zinc-800 shadow-md border border-white/5 cursor-pointer group select-none transition-[border-color,box-shadow] duration-200 ease-out hover:border-white/40 hover:shadow-2xl ${sizeClasses} ${className}`}
    >
      {/* Smart Adaptive Ambient Blur Layer */}
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-md scale-110 opacity-30 pointer-events-none"
        style={{ backgroundImage: `url('${mainImage}')` }}
      />

      {/* Main Image with object-top to keep faces anchored */}
      <img
        src={mainImage}
        alt={movie.title}
        loading="lazy"
        className="relative w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500 ease-out will-change-transform"
      />

      {/* Top 10 badge */}
      {movie.badges?.isTop10 && (
        <div className="absolute top-2 left-2 z-10">
          <Top10Badge size="sm" platform={movie.badges?.platform} />
        </div>
      )}

      {/* Ribbon badge (Tập mới / Mới thêm / Chưa có sẵn) */}
      {movie.badges?.ribbon && (
        <div className={`absolute top-2 ${movie.badges?.isTop10 ? 'right-2' : 'left-2'} z-10`}>
          <span
            className={`${
              movie.badges.ribbon === 'Chưa có sẵn' || movie.badges.ribbon === 'Sắp chiếu'
                ? 'bg-amber-600/90 text-white border border-amber-500/30'
                : 'bg-red-600 text-white'
            } font-extrabold text-[9px] uppercase px-1.5 py-0.5 rounded shadow`}
          >
            {movie.badges.ribbon}
          </span>
        </div>
      )}

      {/* Normal Gradient & Bottom Title */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent transition-opacity group-hover:opacity-0" />
      <div className="absolute bottom-2 left-2.5 right-2.5 transition-opacity group-hover:opacity-0">
        <h4 className="text-white font-bold text-xs sm:text-sm drop-shadow line-clamp-1 uppercase">
          {movie.title}
        </h4>
        {isPortrait && movie.subTitle && (
          <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
            {movie.subTitle}
          </p>
        )}
      </div>

      {/* Hover Info Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/85 to-black/40 p-2.5 sm:p-3 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {/* Top actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Play Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                startPlaying(movie);
              }}
              title="Phát"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 active:scale-95 transition"
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black ml-0.5" />
            </button>

            {/* My List Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMyList(movie);
              }}
              title={inList ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách'}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-white/40 bg-zinc-800/80 hover:border-white text-white flex items-center justify-center active:scale-95 transition"
            >
              {inList ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" /> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* Thumbs Up Like */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLiked(!isLiked);
              }}
              title="Thích"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-white/40 bg-zinc-800/80 hover:border-white flex items-center justify-center active:scale-95 transition ${
                isLiked ? 'text-blue-400 border-blue-400' : 'text-white'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* More details chevron */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openModal(movie);
            }}
            title="Chi tiết"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-white/40 bg-zinc-800/80 hover:border-white text-white flex items-center justify-center active:scale-95 transition"
          >
            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Metadata info */}
        <div>
          <h4 className="text-white font-bold text-xs sm:text-sm line-clamp-1 mb-1 uppercase">
            {movie.title}
          </h4>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] mb-1">
            <span className="text-green-400 font-bold">{movie.matchRate}% Phù hợp</span>
            {Boolean(movie.year && movie.year > 0) && (
              <span className="text-zinc-200 font-semibold">{movie.year}</span>
            )}
            <RatingBadge rating={movie.rating} className="text-[9px] sm:text-[10px] px-1 py-0" />
            <span className="text-zinc-400 truncate max-w-[80px]">{movie.seasons}</span>
          </div>

          {/* Genres */}
          <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-zinc-300 line-clamp-1">
            {movie.genres.slice(0, 3).map((genre, idx) => (
              <span key={genre} className="flex items-center gap-1">
                {idx > 0 && <span className="text-zinc-500">•</span>}
                <span>{genre}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

MovieCard.displayName = 'MovieCard';
