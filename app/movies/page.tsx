'use client';

import React, { useEffect, useState } from 'react';
import { MovieRow } from '@/components/rows/MovieRow';
import { SearchResults } from '@/components/search/SearchResults';
import { useNetflix } from '@/context/NetflixContext';
import {
  getMoviesByCategory,
  getMoviesByGenre,
  getMoviesByCountry,
  getVietnameseMovies,
  getChineseMovieSlugs,
  isChineseMovie,
} from '@/services/movieApi';
import { Movie } from '@/types';
import { Loader2 } from 'lucide-react';

export default function MoviesPage() {
  const { searchQuery } = useNetflix();

  const [featureMovies, setFeatureMovies] = useState<Movie[]>([]);
  const [vietnameseMovies, setVietnameseMovies] = useState<Movie[]>([]);
  const [actionMovies, setActionMovies] = useState<Movie[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<Movie[]>([]);
  const [romanceMovies, setRomanceMovies] = useState<Movie[]>([]);
  const [usMovies, setUsMovies] = useState<Movie[]>([]);
  const [koreanMovies, setKoreanMovies] = useState<Movie[]>([]);
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [filterResults, setFilterResults] = useState<Movie[]>([]);
  const [isLoadingFilter, setIsLoadingFilter] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadMovies() {
      try {
        const [chinaSet, features, vietnam, actions, horrors, romance, us, korea] = await Promise.all([
          getChineseMovieSlugs(),
          getMoviesByCategory('phim-le', 1),
          getVietnameseMovies(),
          getMoviesByGenre('hanh-dong', 1),
          getMoviesByGenre('kinh-di', 1),
          getMoviesByGenre('tinh-cam', 1),
          getMoviesByCountry('my', 1),
          getMoviesByCountry('han-quoc', 1),
        ]);
        const clean = (arr: Movie[]) => arr.filter((m) => !isChineseMovie(m, chinaSet));
        if (isMounted) {
          if (features.length > 0) setFeatureMovies(clean(features));
          if (vietnam.length > 0) setVietnameseMovies(clean(vietnam));
          if (actions.length > 0) setActionMovies(clean(actions));
          if (horrors.length > 0) setHorrorMovies(clean(horrors));
          if (romance.length > 0) setRomanceMovies(clean(romance));
          if (us.length > 0) setUsMovies(clean(us));
          if (korea.length > 0) setKoreanMovies(clean(korea));
        }
      } catch (err) {
        console.error('Error loading movies:', err);
      }
    }
    loadMovies();
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
      if (val === 'my' || val === 'viet-nam' || val === 'han-quoc' || val === 'nhat-ban') {
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
      <div className="px-4 sm:px-8 md:px-12 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-extrabold text-white">Phim điện ảnh & Phim lẻ</h1>
          <div className="relative">
            <select
              value={filterGenre}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="bg-black/80 border border-zinc-700 text-white text-xs sm:text-sm font-semibold px-3 py-1.5 rounded outline-none cursor-pointer"
            >
              <option value="all">Tất cả thể loại</option>
              <option value="my">Điện ảnh Âu Mỹ</option>
              <option value="han-quoc">Điện ảnh Hàn Quốc</option>
              <option value="viet-nam">Điện ảnh Việt Nam</option>
              <option value="hanh-dong">Hành động & Phiêu lưu</option>
              <option value="kinh-di">Kinh dị & Giật gân</option>
              <option value="tinh-cam">Tình cảm & Lãng mạn</option>
              <option value="phim-hai">Hài hước</option>
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
          {featureMovies.length > 0 && (
            <MovieRow
              title="Phim lẻ mới cập nhật (Nguồn C API)"
              movies={featureMovies}
              type="standard"
            />
          )}

          {usMovies.length > 0 && (
            <MovieRow
              title="Phim điện ảnh Hollywood & Âu Mỹ"
              movies={usMovies}
              type="standard"
            />
          )}

          {koreanMovies.length > 0 && (
            <MovieRow
              title="Phim điện ảnh Hàn Quốc"
              movies={koreanMovies}
              type="portrait"
            />
          )}

          {vietnameseMovies.length > 0 && (
            <MovieRow
              title="Phim điện ảnh Việt Nam mới nhất"
              movies={vietnameseMovies}
              type="portrait"
            />
          )}

          {actionMovies.length > 0 && (
            <MovieRow
              title="Phim hành động kịch tính"
              movies={actionMovies}
              type="standard"
            />
          )}

          {horrorMovies.length > 0 && (
            <MovieRow
              title="Kinh dị rùng rợn"
              movies={horrorMovies}
              type="portrait"
            />
          )}

          {romanceMovies.length > 0 && (
            <MovieRow
              title="Tình cảm lãng mạn"
              movies={romanceMovies}
              type="standard"
            />
          )}
        </div>
      )}
    </div>
  );
}
