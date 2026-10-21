'use client';

import React, { useEffect, useState } from 'react';
import { MovieRow } from '@/components/rows/MovieRow';
import { SearchResults } from '@/components/search/SearchResults';
import { useNetflix } from '@/context/NetflixContext';
import {
  getMoviesByCategory,
  getMoviesByCountry,
  getMoviesByGenre,
  getChineseMovieSlugs,
  isChineseMovie,
} from '@/services/movieApi';
import { Movie } from '@/types';
import { Loader2 } from 'lucide-react';

export default function SeriesPage() {
  const { searchQuery } = useNetflix();

  const [tvShows, setTvShows] = useState<Movie[]>([]);
  const [phimBo, setPhimBo] = useState<Movie[]>([]);
  const [koreanSeries, setKoreanSeries] = useState<Movie[]>([]);
  const [usSeries, setUsSeries] = useState<Movie[]>([]);
  const [animeSeries, setAnimeSeries] = useState<Movie[]>([]);
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [filterResults, setFilterResults] = useState<Movie[]>([]);
  const [isLoadingFilter, setIsLoadingFilter] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadSeries() {
      try {
        const [chinaSet, shows, bo, korea, us, anime] = await Promise.all([
          getChineseMovieSlugs(),
          getMoviesByCategory('tv-shows', 1),
          getMoviesByCategory('phim-bo', 1),
          getMoviesByCountry('han-quoc', 1),
          getMoviesByCountry('my', 1),
          getMoviesByGenre('hoat-hinh', 1),
        ]);
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
      }
    }
    loadSeries();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFilterChange = async (val: string) => {
    setFilterGenre(val);
    if (val === 'all') {
      setFilterResults([]);
      return;
    }
    setIsLoadingFilter(true);
    try {
      let results: Movie[] = [];
      if (val === 'han-quoc' || val === 'my' || val === 'nhat-ban' || val === 'trung-quoc') {
        results = await getMoviesByCountry(val);
      } else {
        results = await getMoviesByGenre(val);
      }
      setFilterResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingFilter(false);
    }
  };

  if (searchQuery.trim()) {
    return <SearchResults />;
  }

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
              className="bg-black/80 border border-zinc-700 text-white text-xs sm:text-sm font-semibold px-3 py-1.5 rounded outline-none cursor-pointer"
            >
              <option value="all">Tất cả thể loại</option>
              <option value="han-quoc">Series Hàn Quốc</option>
              <option value="my">Series Âu Mỹ</option>
              <option value="nhat-ban">Phim & Anime Nhật Bản</option>
              <option value="trung-quoc">Series Trung Quốc</option>
              <option value="hoat-hinh">Hoạt hình</option>
              <option value="hanh-dong">Hành động</option>
              <option value="tam-ly">Tâm lý xã hội</option>
            </select>
          </div>
          {isLoadingFilter && <Loader2 className="w-4 h-4 animate-spin text-red-500" />}
        </div>
      </div>

      {filterGenre !== 'all' ? (
        <div className="px-4 sm:px-8 md:px-12">
          <MovieRow
            title={`Kết quả lọc: ${filterGenre}`}
            movies={filterResults}
            type="standard"
          />
        </div>
      ) : (
        <div className="space-y-2">
          {tvShows.length > 0 && (
            <MovieRow
              title="TV Shows mới nhất (Nguồn C API)"
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
              type="portrait"
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
              type="portrait"
            />
          )}
        </div>
      )}
    </div>
  );
}
