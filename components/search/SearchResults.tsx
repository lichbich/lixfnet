'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNetflix } from '@/context/NetflixContext';
import { MovieCard } from '@/components/cards/MovieCard';
import { searchMoviesWithPagination } from '@/services/movieApi';
import { Movie } from '@/types';
import { Loader2 } from 'lucide-react';

export const SearchResults: React.FC = () => {
  const { searchQuery, setSearchQuery } = useNetflix();
  const [apiResults, setApiResults] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // References to keep current values in scroll handler without stale closure
  const isLoadingRef = useRef(false);
  const isLoadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const currentPageRef = useRef(1);
  const searchQueryRef = useRef(searchQuery);

  isLoadingRef.current = isLoading;
  isLoadingMoreRef.current = isLoadingMore;
  hasMoreRef.current = hasMore;
  currentPageRef.current = currentPage;
  searchQueryRef.current = searchQuery;

  // Search debounce when user types
  useEffect(() => {
    const clean = searchQuery.trim();
    if (!clean) {
      setApiResults([]);
      setCurrentPage(1);
      setTotalPages(1);
      setHasMore(false);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await searchMoviesWithPagination(clean, 1);
        if (isCancelled) return;
        setApiResults(res.movies);
        setCurrentPage(1);
        setTotalPages(res.totalPages);
        setHasMore(res.totalPages > 1);
      } catch (err) {
        if (!isCancelled) console.error('Search error:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }, 350); // 350ms debounce

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Load next page function
  const loadNextPage = useCallback(async () => {
    if (isLoadingRef.current || isLoadingMoreRef.current || !hasMoreRef.current) return;
    const clean = searchQueryRef.current.trim();
    if (!clean) return;

    const nextPage = currentPageRef.current + 1;
    setIsLoadingMore(true);

    try {
      const res = await searchMoviesWithPagination(clean, nextPage);
      setApiResults((prev) => {
        const existingKeys = new Set(prev.map((m) => m.slug || m.id));
        const newItems = res.movies.filter((m) => !existingKeys.has(m.slug || m.id));
        return [...prev, ...newItems];
      });
      setCurrentPage(nextPage);
      setTotalPages(res.totalPages);
      setHasMore(nextPage < res.totalPages);
    } catch (err) {
      console.error('Failed to load more search results:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  // Infinite scroll trigger when reaching bottom of page
  useEffect(() => {
    const handleScroll = () => {
      if (isLoadingRef.current || isLoadingMoreRef.current || !hasMoreRef.current) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 700;
      if (scrollPosition >= threshold) {
        loadNextPage();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadNextPage]);

  if (!searchQuery.trim()) return null;

  const combinedMovies = apiResults;

  // Netflix-style "Tác phẩm khác để khám phá" suggestions from top search results
  const exploreSuggestions = React.useMemo(() => {
    if (apiResults.length <= 1) return [];
    const titles: string[] = [];
    const seen = new Set<string>();
    const cleanQ = searchQuery.toLowerCase().trim();

    for (const m of apiResults) {
      const displayTitle = m.title.trim();
      const lower = displayTitle.toLowerCase();
      if (!seen.has(lower) && lower !== cleanQ) {
        seen.add(lower);
        titles.push(displayTitle);
      }
      if (titles.length >= 8) break;
    }
    return titles;
  }, [apiResults, searchQuery]);

  return (
    <div className="pt-24 px-4 sm:px-8 md:px-12 max-w-[1920px] mx-auto min-h-[70vh] pb-20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Kết quả tìm kiếm cho: <span className="text-red-500 font-extrabold">&quot;{searchQuery}&quot;</span>
          </h2>
          {isLoading && <Loader2 className="w-5 h-5 animate-spin text-red-500" />}
          {!isLoading && combinedMovies.length > 0 && (
            <span className="text-xs text-zinc-400 font-medium bg-zinc-800/80 px-2.5 py-0.5 rounded-full border border-white/5">
              {combinedMovies.length} phim
            </span>
          )}
        </div>

        <button
          onClick={() => setSearchQuery('')}
          className="text-xs text-zinc-400 hover:text-white underline cursor-pointer transition-colors"
        >
          Xóa tìm kiếm
        </button>
      </div>

      {/* Netflix-style explore suggestions bar */}
      {exploreSuggestions.length > 0 && !isLoading && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mb-8 text-xs sm:text-sm text-zinc-400 font-normal">
          <span className="text-zinc-500">Tác phẩm khác để khám phá:</span>
          {exploreSuggestions.map((title, idx) => (
            <React.Fragment key={title}>
              {idx > 0 && <span className="text-zinc-700 select-none">|</span>}
              <button
                onClick={() => setSearchQuery(title)}
                className="text-zinc-300 hover:text-white transition-colors cursor-pointer hover:underline"
              >
                {title}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {isLoading && combinedMovies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
          <p className="text-sm font-medium">Đang tìm kiếm phim hay nhất cho bạn...</p>
        </div>
      ) : combinedMovies.length === 0 ? (
        <div className="text-center py-20 text-zinc-400">
          <p className="text-lg">Không tìm thấy kết quả nào phù hợp với &quot;{searchQuery}&quot;.</p>
          <p className="text-sm text-zinc-500 mt-2">
            Gợi ý: Thử tìm theo tên tiếng Việt hoặc tên gốc như &quot;Tình&quot;, &quot;Vua&quot;, &quot;Game&quot;, &quot;Bác sĩ&quot;,...
          </p>
        </div>
      ) : (
        <>
          {/* Netflix-style 5 columns desktop grid with larger cards and fillWidth */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-2 sm:gap-x-2.5 md:gap-x-3 gap-y-8 sm:gap-y-10 md:gap-y-12">
            {combinedMovies.map((movie) => (
              <div key={movie.id} className="w-full">
                <MovieCard movie={movie} fillWidth />
              </div>
            ))}
          </div>

          {/* Infinite Scroll Loader at bottom */}
          {isLoadingMore && (
            <div className="flex items-center justify-center py-10 gap-2.5 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
              <span className="text-sm font-medium">Đang tải thêm kết quả...</span>
            </div>
          )}

          {/* End of results indicator */}
          {!hasMore && combinedMovies.length > 10 && (
            <div className="text-center py-10 text-xs text-zinc-500 font-medium border-t border-zinc-800/60 mt-12">
              Đã hiển thị toàn bộ {combinedMovies.length} kết quả tìm kiếm cho &quot;{searchQuery}&quot;
            </div>
          )}
        </>
      )}
    </div>
  );
};
