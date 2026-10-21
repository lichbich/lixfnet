'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Globe,
  SlidersHorizontal,
  Loader2,
  Check,
  Grid3X3,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import { MovieCard } from '@/components/cards/MovieCard';
import { SearchResults } from '@/components/search/SearchResults';
import { useNetflix } from '@/context/NetflixContext';
import {
  API_COUNTRIES,
  CountryOption,
  getMoviesByCountryPaginated,
} from '@/services/movieApi';
import { Movie } from '@/types';

type AudioType = 'original' | 'dubbed' | 'subtitles';
type SortType = 'suggested' | 'year-desc' | 'year-asc' | 'title-asc';

export default function OriginalAudioPage() {
  const { searchQuery } = useNetflix();

  // Filter States
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(
    API_COUNTRIES.find((c) => c.slug === 'han-quoc') || API_COUNTRIES[0]
  );
  const [audioType, setAudioType] = useState<AudioType>('original');
  const [sortBy, setSortBy] = useState<SortType>('suggested');
  const [viewMode, setViewMode] = useState<'landscape' | 'portrait'>('landscape');

  // Dropdown UI states
  const [openDropdown, setOpenDropdown] = useState<'audio' | 'country' | 'sort' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Data States
  const [movies, setMovies] = useState<Movie[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch movies whenever selected country changes
  useEffect(() => {
    let isCancelled = false;

    async function loadCountryMovies() {
      setIsLoading(true);
      setPage(1);
      try {
        const { movies: fetchedMovies, totalPages: pages, totalItems: items } =
          await getMoviesByCountryPaginated(selectedCountry.slug, 1);

        if (!isCancelled) {
          setMovies(fetchedMovies);
          setTotalPages(pages);
          setTotalItems(items);
        }
      } catch (err) {
        console.error('Failed to load movies for country:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadCountryMovies();

    return () => {
      isCancelled = true;
    };
  }, [selectedCountry.slug]);

  // Load more movies (Next page)
  const handleLoadMore = async () => {
    if (isLoadingMore || page >= totalPages) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const { movies: newMovies } = await getMoviesByCountryPaginated(
        selectedCountry.slug,
        nextPage
      );
      setMovies((prev) => [...prev, ...newMovies]);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more movies:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Sort movies client-side
  const sortedMovies = [...movies].sort((a, b) => {
    if (sortBy === 'year-desc') return b.year - a.year;
    if (sortBy === 'year-asc') return a.year - b.year;
    if (sortBy === 'title-asc') return a.title.localeCompare(b.title, 'vi');
    return 0; // 'suggested' keeps API natural order
  });

  // Global search takeover
  if (searchQuery.trim()) {
    return <SearchResults />;
  }

  const audioLabels: Record<AudioType, string> = {
    original: 'Ngôn ngữ gốc',
    dubbed: 'Lồng tiếng',
    subtitles: 'Phụ đề',
  };

  const sortLabels: Record<SortType, string> = {
    suggested: 'Đề xuất cho bạn',
    'year-desc': 'Năm phát hành (Mới nhất)',
    'year-asc': 'Năm phát hành (Cũ nhất)',
    'title-asc': 'Tên phim (A-Z)',
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-8 md:px-12 max-w-[1920px] mx-auto text-white">
      {/* Top Header Bar with Filters */}
      <div
        ref={dropdownRef}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-800"
      >
        {/* Page Title & Count */}
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
            <span>Duyệt tìm theo ngôn ngữ</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 flex items-center gap-2">
            <span>
              Quốc gia: <strong className="text-white">{selectedCountry.name}</strong>
            </span>
            <span>•</span>
            <span>
              {totalItems > 0 ? `${totalItems.toLocaleString()} phim` : 'Đang cập nhật'}
            </span>
            <span>•</span>
            <span className="text-green-400 font-medium">Bản quyền HD / 4K</span>
          </p>
        </div>

        {/* Filter Controls (Matching Netflix Desktop Screenshot) */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs sm:text-sm">
          <span className="text-zinc-400 text-xs hidden xl:inline">
            Điều chỉnh tùy chọn của bạn:
          </span>

          {/* DROPDOWN 1: Ngôn ngữ gốc / Lồng tiếng / Phụ đề */}
          <div className="relative">
            <button
              onClick={() =>
                setOpenDropdown(openDropdown === 'audio' ? null : 'audio')
              }
              className="flex items-center gap-2 bg-black border border-white/20 hover:border-white px-3 py-1.5 rounded text-white font-medium transition"
            >
              <span>{audioLabels[audioType]}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openDropdown === 'audio' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openDropdown === 'audio' && (
              <div className="absolute left-0 lg:right-0 mt-2 w-48 bg-[#181818]/95 backdrop-blur-md border border-zinc-700/80 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200 ease-out origin-top">
                {(Object.keys(audioLabels) as AudioType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setAudioType(type);
                      setOpenDropdown(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-zinc-800 flex items-center justify-between text-xs sm:text-sm text-zinc-200 hover:text-white transition"
                  >
                    <span>{audioLabels[type]}</span>
                    {audioType === type && <Check className="w-3.5 h-3.5 text-red-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DROPDOWN 2: Chọn Quốc Gia / Ngôn Ngữ (FULL 20 QUỐC GIA TỪ API) */}
          <div className="relative">
            <button
              onClick={() =>
                setOpenDropdown(openDropdown === 'country' ? null : 'country')
              }
              className="flex items-center gap-2 bg-black border border-white/20 hover:border-white px-3 py-1.5 rounded text-white font-medium transition min-w-[150px] justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <Globe className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                <span className="truncate">{selectedCountry.language}</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
                  openDropdown === 'country' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openDropdown === 'country' && (
              <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto custom-scrollbar bg-[#181818]/95 backdrop-blur-md border border-zinc-700/80 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200 ease-out origin-top-right">
                <div className="px-3.5 py-2 text-[11px] text-zinc-400 border-b border-zinc-800 font-semibold uppercase tracking-wider">
                  Chọn quốc gia sản xuất
                </div>
                {API_COUNTRIES.map((c) => {
                  const isSelected = selectedCountry.slug === c.slug;
                  return (
                    <button
                      key={c.slug}
                      onClick={() => {
                        setSelectedCountry(c);
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-zinc-800 flex items-center justify-between text-xs sm:text-sm transition ${
                        isSelected
                          ? 'bg-zinc-800/80 text-white font-bold'
                          : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{c.language}</span>
                        <span className="text-[11px] text-zinc-400 font-normal">
                          {c.name}
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-red-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* DROPDOWN 3: Sắp xếp theo */}
          <div className="relative">
            <button
              onClick={() =>
                setOpenDropdown(openDropdown === 'sort' ? null : 'sort')
              }
              className="flex items-center gap-2 bg-black border border-white/20 hover:border-white px-3 py-1.5 rounded text-white font-medium transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Sắp xếp:</span>
              <span>{sortLabels[sortBy]}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openDropdown === 'sort' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openDropdown === 'sort' && (
              <div className="absolute right-0 mt-2 w-56 bg-[#181818]/95 backdrop-blur-md border border-zinc-700/80 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200 ease-out origin-top-right">
                {(Object.keys(sortLabels) as SortType[]).map((sort) => (
                  <button
                    key={sort}
                    onClick={() => {
                      setSortBy(sort);
                      setOpenDropdown(null);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-zinc-800 flex items-center justify-between text-xs sm:text-sm text-zinc-200 hover:text-white transition"
                  >
                    <span>{sortLabels[sort]}</span>
                    {sortBy === sort && <Check className="w-3.5 h-3.5 text-red-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Mode Toggle: 16:9 Landscape vs 2:3 Portrait */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5 ml-auto sm:ml-0">
            <button
              onClick={() => setViewMode('landscape')}
              title="Xem dạng thẻ ngang (16:9)"
              className={`p-1.5 rounded transition ${
                viewMode === 'landscape'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('portrait')}
              title="Xem dạng áp phích đứng (2:3)"
              className={`p-1.5 rounded transition ${
                viewMode === 'portrait'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Country Pill Bar for fast 1-click switching */}
      <div className="py-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {API_COUNTRIES.slice(0, 10).map((c) => {
          const isActive = selectedCountry.slug === c.slug;
          return (
            <button
              key={c.slug}
              onClick={() => setSelectedCountry(c)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? 'bg-white text-black shadow-md scale-105'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-white/5'
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      {/* Movie Grid Section */}
      <div className="mt-6">
        {isLoading ? (
          /* Shimmer Loading Grid */
          <div
            className={`grid gap-3 sm:gap-4 md:gap-5 ${
              viewMode === 'portrait'
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7'
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
            }`}
          >
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-md bg-zinc-850 border border-white/5 animate-pulse bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 ${
                  viewMode === 'portrait' ? 'aspect-[2/3]' : 'aspect-video'
                }`}
              />
            ))}
          </div>
        ) : sortedMovies.length === 0 ? (
          /* Empty State */
          <div className="text-center py-24 text-zinc-400 space-y-3">
            <Globe className="w-12 h-12 mx-auto text-zinc-600 animate-pulse" />
            <h3 className="text-lg font-bold text-white">Chưa tìm thấy phim</h3>
            <p className="text-sm max-w-md mx-auto">
              Hiện tại danh mục quốc gia này đang được cập nhật thêm nội dung từ API. Vui lòng chọn quốc gia khác.
            </p>
          </div>
        ) : (
          /* Real Movies Responsive Grid */
          <>
            <div
              className={`grid gap-3 sm:gap-4 md:gap-5 ${
                viewMode === 'portrait'
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
              }`}
            >
              {sortedMovies.map((movie) => (
                <div key={movie.id} className="w-full flex justify-center">
                  <div className="w-full">
                    <MovieCard movie={movie} variant={viewMode} />
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button / Pagination */}
            {page < totalPages && (
              <div className="mt-12 flex flex-col items-center justify-center gap-3">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 bg-[#2b2b2b] hover:bg-[#383838] border border-white/20 text-white px-8 py-3 rounded-full font-bold text-sm tracking-wide transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tải thêm phim...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-red-500" />
                      <span>
                        Tải thêm phim (Trang {page + 1} / {totalPages})
                      </span>
                    </>
                  )}
                </button>
                <span className="text-xs text-zinc-400">
                  Đã tải {movies.length} / {totalItems.toLocaleString()} phim
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
