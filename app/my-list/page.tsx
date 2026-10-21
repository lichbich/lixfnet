'use client';

import React from 'react';
import { MovieCard } from '@/components/cards/MovieCard';
import { SearchResults } from '@/components/search/SearchResults';
import { useNetflix } from '@/context/NetflixContext';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function MyListPage() {
  const { myList, searchQuery } = useNetflix();

  if (searchQuery.trim()) {
    return <SearchResults />;
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-8 md:px-12 max-w-[1920px] mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Danh sách của tôi</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {myList.length} nội dung đã lưu vào danh sách xem sau
          </p>
        </div>
      </div>

      {myList.length === 0 ? (
        <div className="text-center py-24 text-zinc-400 bg-zinc-900/40 rounded-xl border border-zinc-800">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-500">
            <Plus className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white">Danh sách của bạn đang trống</h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-md mx-auto">
            Khám phá các chương trình truyền hình và phim ảnh yêu thích, sau đó nhấn biểu tượng dấu cộng (+) để lưu vào đây.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 px-6 py-2.5 bg-white text-black font-bold rounded hover:bg-white/90 transition text-sm"
          >
            Khám phá ngay
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {myList.map((movie) => (
            <div key={movie.id} className="flex justify-center">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
