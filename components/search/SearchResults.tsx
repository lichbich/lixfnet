'use client';

import React, { useState, useEffect } from 'react';
import { useNetflix } from '@/context/NetflixContext';
import { MovieCard } from '@/components/cards/MovieCard';
import { searchMovies } from '@/services/movieApi';
import { Movie } from '@/types';
import { Loader2 } from 'lucide-react';

export const SearchResults: React.FC = () => {
  const { searchQuery, setSearchQuery } = useNetflix();
  const [apiResults, setApiResults] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setApiResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchMovies(searchQuery);
        setApiResults(results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!searchQuery.trim()) return null;

  const combinedMovies = apiResults;

  return (
    <div className="pt-24 px-4 sm:px-8 md:px-12 max-w-[1920px] mx-auto min-h-[70vh]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Kết quả tìm kiếm cho: <span className="text-red-500 font-extrabold">&quot;{searchQuery}&quot;</span>
          </h2>
          {isLoading && <Loader2 className="w-5 h-5 animate-spin text-red-500" />}
        </div>

        <button
          onClick={() => setSearchQuery('')}
          className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
        >
          Xóa tìm kiếm
        </button>
      </div>

      {isLoading && combinedMovies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
          <p className="text-sm">Đang tìm kiếm phim từ máy chủ Nguồn C...</p>
        </div>
      ) : combinedMovies.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">
          <p className="text-lg">Không tìm thấy kết quả nào phù hợp với &quot;{searchQuery}&quot;.</p>
          <p className="text-sm text-zinc-500 mt-2">
            Gợi ý: Thử tìm theo tên tiếng Việt hoặc tên gốc như &quot;Tình&quot;, &quot;Vua&quot;, &quot;Game&quot;, &quot;Bác sĩ&quot;,...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {combinedMovies.map((movie) => (
            <div key={movie.id} className="flex justify-center">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
