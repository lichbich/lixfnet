'use client';

import React, { useEffect, useState } from 'react';
import { MovieRow } from '@/components/rows/MovieRow';
import { SearchResults } from '@/components/search/SearchResults';
import { useNetflix } from '@/context/NetflixContext';
import {
  getNewUpdatedMovies,
  getMoviesByCategory,
  getChineseMovieSlugs,
  isChineseMovie,
} from '@/services/movieApi';
import { Movie } from '@/types';

export default function LatestPage() {
  const { searchQuery } = useNetflix();

  const [newUpdatedPage1, setNewUpdatedPage1] = useState<Movie[]>([]);
  const [newUpdatedPage2, setNewUpdatedPage2] = useState<Movie[]>([]);
  const [newUpdatedPage3, setNewUpdatedPage3] = useState<Movie[]>([]);
  const [newShows, setNewShows] = useState<Movie[]>([]);
  const [newFeatures, setNewFeatures] = useState<Movie[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadLatest() {
      try {
        const [chinaSet, page1, page2, page3, page4, shows, features] = await Promise.all([
          getChineseMovieSlugs(),
          getNewUpdatedMovies(1),
          getNewUpdatedMovies(2),
          getNewUpdatedMovies(3),
          getNewUpdatedMovies(4),
          getMoviesByCategory('tv-shows', 1),
          getMoviesByCategory('phim-le', 1),
        ]);
        const clean = (arr: Movie[]) => arr.filter((m) => !isChineseMovie(m, chinaSet));
        const allClean = clean([...page1, ...page2, ...page3, ...page4]);
        if (isMounted) {
          setNewUpdatedPage1(allClean.slice(0, 10));
          setNewUpdatedPage2(allClean.slice(10, 20));
          setNewUpdatedPage3(allClean.slice(20, 30));
          if (shows.length > 0) setNewShows(clean(shows));
          if (features.length > 0) setNewFeatures(clean(features));
        }
      } catch (err) {
        console.error('Error loading latest movies:', err);
      }
    }
    loadLatest();
    return () => {
      isMounted = false;
    };
  }, []);

  if (searchQuery.trim()) {
    return <SearchResults />;
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="px-4 sm:px-8 md:px-12 mb-6">
        <h1 className="text-3xl font-extrabold text-white">Mới & Phổ biến</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Cập nhật trực tiếp danh sách phim mới nhất từng giờ từ máy chủ Nguồn C
        </p>
      </div>

      <div className="space-y-2">
        {newUpdatedPage1.length > 0 && (
          <MovieRow
            title="Vừa mới cập nhật hôm nay (Trang 1)"
            movies={newUpdatedPage1}
            type="standard"
          />
        )}

        {newUpdatedPage2.length > 0 && (
          <MovieRow
            title="Danh sách mới cập nhật tiếp theo (Trang 2)"
            movies={newUpdatedPage2}
            type="standard"
          />
        )}

        {newShows.length > 0 && (
          <MovieRow
            title="TV Shows mới lên sóng"
            movies={newShows}
            type="standard"
          />
        )}

        {newFeatures.length > 0 && (
          <MovieRow
            title="Phim lẻ mới phát hành"
            movies={newFeatures}
            type="standard"
          />
        )}

        {newUpdatedPage3.length > 0 && (
          <MovieRow
            title="Kho phim cập nhật trang 3"
            movies={newUpdatedPage3}
            type="standard"
          />
        )}
      </div>
    </div>
  );
}
