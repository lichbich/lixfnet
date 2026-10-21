'use client';

import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Movie } from '@/types';
import { MovieCard } from '@/components/cards/MovieCard';
import { Top10Card } from '@/components/cards/Top10Card';
import { ContinueWatchingCard } from '@/components/cards/ContinueWatchingCard';

interface MovieRowProps {
  title: string;
  movies: Movie[];
  type?: 'standard' | 'top10' | 'continue' | 'portrait';
}

export const MovieRow: React.FC<MovieRowProps> = ({
  title,
  movies,
  type = 'standard',
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const handleScroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollDistance = clientWidth * 0.85;
      const targetScroll =
        direction === 'left' ? scrollLeft - scrollDistance : scrollLeft + scrollDistance;

      rowRef.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth',
      });
    }
  };

  const onScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 20);
    }
  };

  if (!movies || movies.length === 0) return null;

  return (
    <section className="relative my-6 sm:my-8 px-4 sm:px-8 md:px-12 group/row">
      {/* Row Header Title */}
      <h2 className="text-white font-bold text-lg sm:text-xl md:text-2xl mb-3 tracking-tight flex items-center gap-2 group-hover/row:text-zinc-100 transition">
        <span>{title}</span>
        <span className="text-xs text-[#54b9c5] font-semibold opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 cursor-pointer hidden md:inline">
          Khám phá tất cả &gt;
        </span>
      </h2>

      {/* Row Slider Container */}
      <div className="relative">
        {/* Left Arrow Button */}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            aria-label="Cuộn sang trái"
            className="absolute top-0 bottom-0 left-0 z-30 w-10 sm:w-12 bg-black/60 hover:bg-black/85 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all rounded-r"
          >
            <ChevronLeft className="w-8 h-8 transition-transform group-hover/row:scale-125" />
          </button>
        )}

        {/* Scrollable Movies List */}
        <div
          ref={rowRef}
          onScroll={onScroll}
          className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-3 scroll-smooth"
        >
          {movies.map((movie, index) => {
            if (type === 'portrait') {
              return (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  variant="portrait"
                />
              );
            }
            if (type === 'top10') {
              return (
                <Top10Card
                  key={movie.id}
                  movie={movie}
                  rank={movie.rank || index + 1}
                />
              );
            }
            if (type === 'continue') {
              return <ContinueWatchingCard key={movie.id} movie={movie} />;
            }
            return <MovieCard key={movie.id} movie={movie} variant="landscape" />;
          })}
        </div>

        {/* Right Arrow Button */}
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            aria-label="Cuộn sang phải"
            className="absolute top-0 bottom-0 right-0 z-30 w-10 sm:w-12 bg-black/60 hover:bg-black/85 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all rounded-l"
          >
            <ChevronRight className="w-8 h-8 transition-transform group-hover/row:scale-125" />
          </button>
        )}
      </div>
    </section>
  );
};
