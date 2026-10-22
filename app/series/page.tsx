'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { MovieRow } from '@/components/rows/MovieRow';
import { RowSkeleton } from '@/components/rows/RowSkeleton';
import { MovieCard } from '@/components/cards/MovieCard';
import { SearchResults } from '@/components/search/SearchResults';
import { useNetflix } from '@/context/NetflixContext';
import {
  getMoviesByCategory,
  getMoviesByCountry,
  getMoviesByGenre,
  getFilterMoviesPaginated,
  getChineseMovieSlugs,
  isChineseMovie,
} from '@/services/movieApi';
import { Movie } from '@/types';
import { Loader2 } from 'lucide-react';

const SERIES_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả thể loại' },
  { value: 'han-quoc', label: 'Series Hàn Quốc' },
  { value: 'my', label: 'Series Âu Mỹ' },
  { value: 'nhat-ban', label: 'Phim & Anime Nhật Bản' },
  { value: 'thai-lan', label: 'Series Thái Lan' },
  { value: 'hoat-hinh', label: 'Hoạt hình & Anime' },
  { value: 'hanh-dong', label: 'Hành động' },
  { value: 'tam-ly', label: 'Tâm lý xã hội' },
  { value: 'tinh-cam', label: 'Tình cảm & Lãng mạn' },
  { value: 'kinh-di', label: 'Kinh dị & Giật gân' },
  { value: 'phim-hai', label: 'Hài hước' },
  { value: 'khoa-hoc-vien-tuong', label: 'Khoa học viễn tưởng' },
  { value: 'hinh-su', label: 'Hình sự & Tội phạm' },
  { value: 'co-trang', label: 'Cổ trang' },
];

export default function SeriesPage() {
  const { searchQuery } = useNetflix();

  const [tvShows, setTvShows] = useState<Movie[]>([]);
  const [phimBo, setPhimBo] = useState<Movie[]>([]);
  const [koreanSeries, setKoreanSeries] = useState<Movie[]>([]);
  const [usSeries, setUsSeries] = useState<Movie[]>([]);
  const [animeSeries, setAnimeSeries] = useState<Movie[]>([]);

  // Filter & Pagination States
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [filterResults, setFilterResults] = useState<Movie[]>([]);
  const [filterTotalItems, setFilterTotalItems] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingFilter, setIsLoadingFilter] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const filterPageRef = useRef<number>(1);
  const filterTotalPagesRef = useRef<number>(1);
  const hasMoreRef = useRef<boolean>(true);
  const isLoadingMoreRef = useRef<boolean>(false);
  const isFetchingFilterRef = useRef<boolean>(false);
  const chinaSlugsRef = useRef<Set<string>>(new Set());

  // Sort filtered results by release year descending (newest -> oldest)
  const sortedFilterResults = useMemo(() => {
    return [...filterResults].sort((a, b) => {
      const yearA = typeof a.year === 'number' ? a.year : parseInt(String(a.year || 0), 10) || 0;
      const yearB = typeof b.year === 'number' ? b.year : parseInt(String(b.year || 0), 10) || 0;
      if (yearB !== yearA) {
        return yearB - yearA; // Newest year first
      }
      return (b.matchRate || 0) - (a.matchRate || 0);
    });
  }, [filterResults]);

  // Initial load for default series rows
  useEffect(() => {
    let isMounted = true;
    async function loadSeries() {
      try {
        setIsLoading(true);
        const [chinaSet, shows, bo, korea, us, anime] = await Promise.all([
          getChineseMovieSlugs(),
          getMoviesByCategory('tv-shows', 1),
          getMoviesByCategory('phim-bo', 1),
          getMoviesByCountry('han-quoc', 1),
          getMoviesByCountry('my', 1),
          getMoviesByGenre('hoat-hinh', 1),
        ]);
        chinaSlugsRef.current = chinaSet;
        const clean = (arr: Movie[]) => arr.filter((m) => !isChineseMovie(m, chinaSet));
        if (isMounted) {
          if (shows.length > 0) setTvShows(clean(shows));
          if (bo.length > 0) setPhimBo(clean(bo));
          if (korea.length > 0) setKoreanSeries(clean(korea));
          if (us.length > 0) setUsSeries(clean(us));
          if (anime.length > 0) setAnimeSeries(clean(anime));
        }
      } catch (err) {
        console.error('Error loading series:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadSeries();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle filter selection with auto-fill until screen is filled, then pause
  const handleFilterChange = async (val: string) => {
    setFilterGenre(val);
    if (val === 'all') {
      setFilterResults([]);
      hasMoreRef.current = false;
      setHasMore(false);
      return;
    }

    setIsLoadingFilter(true);
    setFilterResults([]);
    filterPageRef.current = 1;
    hasMoreRef.current = true;
    setHasMore(true);
    isFetchingFilterRef.current = true;

    try {
      if (chinaSlugsRef.current.size === 0) {
        chinaSlugsRef.current = await getChineseMovieSlugs();
      }
      const chinaSet = chinaSlugsRef.current;

      let curPage = 1;
      let totalPages = 1;
      let totalItems = 0;
      const accumulated: Movie[] = [];
      const seen = new Set<string>();

      // Auto-load consecutive pages until screen is full (at least 20 items) or no more pages
      while (curPage <= 3) {
        const res = await getFilterMoviesPaginated(val, curPage);
        totalPages = res.totalPages;
        totalItems = res.totalItems;
        filterTotalPagesRef.current = totalPages;
        setFilterTotalItems(totalItems);

        for (const m of res.movies) {
          if (!m) continue;
          const k = m.slug || m.id;
          if (!seen.has(k) && !isChineseMovie(m, chinaSet)) {
            seen.add(k);
            accumulated.push(m);
          }
        }

        // Once the screen has enough movies to be completely filled, pause auto-loading!
        if (accumulated.length >= 20 || curPage >= totalPages) {
          break;
        }
        curPage++;
      }

      filterPageRef.current = curPage;
      const more = curPage < totalPages;
      hasMoreRef.current = more;
      setHasMore(more);
      setFilterResults(accumulated);
    } catch (err) {
      console.error('Failed to load filter movies:', err);
    } finally {
      setIsLoadingFilter(false);
      isFetchingFilterRef.current = false;
    }
  };

  // Load next page on scroll (Facebook-like infinite scroll)
  // Load next page on scroll (Facebook-like infinite scroll)
  const loadMore = useCallback(async () => {
    if (
      isLoadingMoreRef.current ||
      isFetchingFilterRef.current ||
      !hasMoreRef.current ||
      filterGenre === 'all'
    ) {
      return;
    }

    const nextPage = filterPageRef.current + 1;
    if (filterTotalPagesRef.current > 1 && nextPage > filterTotalPagesRef.current) {
      hasMoreRef.current = false;
      setHasMore(false);
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      if (chinaSlugsRef.current.size === 0) {
        chinaSlugsRef.current = await getChineseMovieSlugs();
      }
      const chinaSet = chinaSlugsRef.current;
      const res = await getFilterMoviesPaginated(filterGenre, nextPage);

      if (res.totalPages > 1) {
        filterTotalPagesRef.current = res.totalPages;
        setFilterTotalItems(res.totalItems);
      }

      let addedCount = 0;
      setFilterResults((prev) => {
        const seen = new Set<string>();
        const unique: Movie[] = [];
        for (const m of prev) {
          if (!m) continue;
          const k = m.slug || m.id;
          if (!seen.has(k)) {
            seen.add(k);
            unique.push(m);
          }
        }
        for (const m of res.movies) {
          if (!m) continue;
          const k = m.slug || m.id;
          if (!seen.has(k) && !isChineseMovie(m, chinaSet)) {
            seen.add(k);
            unique.push(m);
            addedCount++;
          }
        }
        return unique;
      });

      filterPageRef.current = nextPage;

      if (
        (filterTotalPagesRef.current > 1 && nextPage >= filterTotalPagesRef.current) ||
        (res.movies.length === 0 && addedCount === 0)
      ) {
        hasMoreRef.current = false;
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more filter movies:', err);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [filterGenre]);

  // Robust Window Scroll Listener for Facebook-like infinite scroll
  useEffect(() => {
    if (filterGenre === 'all' || !hasMore) return;

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        ticking = false;
        if (
          isLoadingMoreRef.current ||
          isFetchingFilterRef.current ||
          !hasMoreRef.current ||
          filterGenre === 'all'
        ) {
          return;
        }

        const scrollY = window.scrollY || window.pageYOffset;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        // When user is within 600px of the bottom of the page
        if (windowHeight + scrollY >= documentHeight - 600) {
          loadMore();
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [filterGenre, hasMore, loadMore]);

  // IntersectionObserver for bottom sentinel: auto-loads when user scrolls down
  useEffect(() => {
    if (filterGenre === 'all' || !hasMore || isLoadingFilter) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMoreRef.current && hasMoreRef.current) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: '300px',
        threshold: 0,
      }
    );

    const target = sentinelRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) observer.unobserve(target);
      observer.disconnect();
    };
  }, [filterGenre, hasMore, isLoadingFilter, loadMore, filterResults.length]);

  if (searchQuery.trim()) {
    return <SearchResults />;
  }

  const activeOption = SERIES_FILTER_OPTIONS.find((o) => o.value === filterGenre);

  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Category Header */}
      <div className="px-4 sm:px-8 md:px-12 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-extrabold text-white">Chương trình truyền hình & Series</h1>
          <div className="relative">
            <select
              value={filterGenre}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="bg-black/80 border border-zinc-700 text-white text-xs sm:text-sm font-semibold px-3 py-1.5 rounded outline-none cursor-pointer hover:border-zinc-500 transition"
            >
              {SERIES_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {isLoadingFilter && <Loader2 className="w-4 h-4 animate-spin text-red-500" />}
        </div>
      </div>

      {filterGenre !== 'all' ? (
        <div className="px-4 sm:px-8 md:px-12">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Kết quả lọc:</span>
              <span className="text-red-500 font-extrabold">{activeOption?.label || filterGenre}</span>
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 bg-zinc-900/90 px-3 py-1 rounded-full border border-zinc-800">
                Năm ra mắt: <strong className="text-white">Mới nhất &rarr; Cũ nhất</strong>
              </span>
              {sortedFilterResults.length > 0 && (
                <span className="text-xs text-zinc-400">
                  Đã tải {sortedFilterResults.length} / {filterTotalItems > 0 ? filterTotalItems.toLocaleString() : sortedFilterResults.length} phim
                </span>
              )}
            </div>
          </div>

          {isLoadingFilter ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 18 }).map((_, i) => (
                <div
                  key={i}
                  className="relative aspect-video rounded-md bg-zinc-850 border border-white/5 overflow-hidden animate-pulse bg-gradient-to-r from-zinc-850 via-zinc-800 to-zinc-850"
                >
                  <div className="absolute inset-0 -translate-x-full animate-netflix-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent pointer-events-none" />
                </div>
              ))}
            </div>
          ) : sortedFilterResults.length === 0 ? (
            <div className="text-center py-24 text-zinc-400 bg-zinc-900/40 rounded-xl border border-zinc-800">
              <p className="text-lg font-semibold text-white">Chưa tìm thấy phim phù hợp</p>
              <p className="text-sm text-zinc-500 mt-1">Vui lòng chọn danh mục hoặc thể loại khác.</p>
            </div>
          ) : (
            <>
              {/* Responsive Movie Cards Grid - Sorted by Year Descending */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sortedFilterResults.map((movie, idx) => (
                  <div key={`${movie.slug || movie.id}-${idx}`} className="w-full flex justify-center">
                    <MovieCard movie={movie} />
                  </div>
                ))}
              </div>

              {/* Bottom Sentinel & Infinite Scroll Loader / Trigger */}
              <div ref={sentinelRef} className="py-10 flex flex-col items-center justify-center min-h-[100px]">
                {isLoadingMore ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2.5 text-zinc-200 text-sm py-3 px-6 bg-zinc-900/90 rounded-full border border-white/10 shadow-lg backdrop-blur-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                      <span className="font-medium">Đang tải thêm phim...</span>
                    </div>
                  </div>
                ) : hasMore ? (
                  <button
                    onClick={loadMore}
                    className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 px-5 py-2.5 rounded-full border border-white/10 transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    <span>Cuộn xuống hoặc nhấn để tải thêm phim</span>
                    <span className="text-red-500 font-bold">&darr;</span>
                  </button>
                ) : (
                  <p className="text-xs text-zinc-500 py-3">
                    Đã hiển thị tất cả {filterResults.length} phim trong danh mục
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {isLoading ? (
            <>
              <RowSkeleton title="TV Shows mới nhất" variant="standard" />
              <RowSkeleton title="Phim bộ truyền hình đặc sắc" variant="standard" />
              <RowSkeleton title="Series Hàn Quốc nổi bật" variant="standard" />
              <RowSkeleton title="Series truyền hình Mỹ" variant="standard" />
              <RowSkeleton title="Anime & Phim hoạt hình dài tập" variant="standard" />
            </>
          ) : (
            <>
              {tvShows.length > 0 && (
                <MovieRow
                  title="TV Shows mới nhất"
                  movies={tvShows}
                  type="standard"
                />
              )}

              {phimBo.length > 0 && (
                <MovieRow
                  title="Phim bộ truyền hình đặc sắc"
                  movies={phimBo}
                  type="standard"
                />
              )}

              {koreanSeries.length > 0 && (
                <MovieRow
                  title="Series Hàn Quốc nổi bật"
                  movies={koreanSeries}
                  type="standard"
                />
              )}

              {usSeries.length > 0 && (
                <MovieRow
                  title="Series truyền hình Mỹ"
                  movies={usSeries}
                  type="standard"
                />
              )}

              {animeSeries.length > 0 && (
                <MovieRow
                  title="Anime & Phim hoạt hình dài tập"
                  movies={animeSeries}
                  type="standard"
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}


