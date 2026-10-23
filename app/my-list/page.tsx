'use client';

import React, { useState } from 'react';
import { MovieCard } from '@/components/cards/MovieCard';
import { ContinueWatchingCard } from '@/components/cards/ContinueWatchingCard';
import { SearchResults } from '@/components/search/SearchResults';
import { useNetflix } from '@/context/NetflixContext';
import { Clock, Bookmark, Sparkles, Film } from 'lucide-react';
import Link from 'next/link';
import { getCanonicalMovieId } from '@/lib/movieUtils';

type TabType = 'all' | 'watching' | 'saved';

export default function MyListPage() {
  const { myList, continueWatchingList, currentUser, searchQuery } = useNetflix();
  const [activeTab, setActiveTab] = useState<TabType>('all');

  if (searchQuery.trim()) {
    return <SearchResults />;
  }

  const watchingCount = continueWatchingList.length;
  const savedCount = myList.length;
  const totalCount = watchingCount + savedCount;

  const showWatching = (activeTab === 'all' || activeTab === 'watching') && watchingCount > 0;
  const showSaved = (activeTab === 'all' || activeTab === 'saved') && savedCount > 0;
  const isCompletelyEmpty = totalCount === 0;

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-8 md:px-12 max-w-[1920px] mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Danh sách của tôi
              </h1>
              {currentUser && (
                <div
                  title={`Đã đồng bộ thời gian thực với tài khoản @${currentUser.username}`}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Đồng bộ Cloud</span>
                </div>
              )}
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5">
              {currentUser ? (
                <>
                  Tài khoản <span className="text-zinc-200 font-medium">@{currentUser.username}</span> • {totalCount} nội dung ({watchingCount} đang xem dở, {savedCount} đã lưu xem sau)
                </>
              ) : (
                <>
                  {totalCount} nội dung ({watchingCount} đang xem dở, {savedCount} đã lưu xem sau) • Đăng nhập để đồng bộ trên mọi thiết bị
                </>
              )}
            </p>
          </div>

          {/* Filter Tabs */}
          {totalCount > 0 && (
            <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800 self-start md:self-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition ${
                  activeTab === 'all'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                Tất cả ({totalCount})
              </button>
              <button
                onClick={() => setActiveTab('watching')}
                className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'watching'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-[#E50914]" />
                Đang xem dở ({watchingCount})
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'saved'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 text-blue-400" />
                Đã lưu xem sau ({savedCount})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {isCompletelyEmpty || (!showWatching && !showSaved) ? (
        <div className="text-center py-20 px-4 text-zinc-400 bg-zinc-900/30 rounded-2xl border border-zinc-800/80 max-w-2xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center mx-auto mb-4 text-zinc-400 shadow-inner">
            {activeTab === 'watching' ? (
              <Clock className="w-8 h-8 text-zinc-500" />
            ) : activeTab === 'saved' ? (
              <Bookmark className="w-8 h-8 text-zinc-500" />
            ) : (
              <Film className="w-8 h-8 text-zinc-500" />
            )}
          </div>
          <h2 className="text-xl font-bold text-white">
            {activeTab === 'watching'
              ? 'Không có phim nào đang xem dở'
              : activeTab === 'saved'
              ? 'Danh sách xem sau đang trống'
              : 'Danh sách của bạn đang trống'}
          </h2>
          <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
            {activeTab === 'watching'
              ? 'Khi bạn bắt đầu xem bất kỳ bộ phim hay tập phim nào, tiến trình xem sẽ tự động lưu lại ở đây và đồng bộ trên mọi thiết bị.'
              : 'Khám phá các chương trình truyền hình và phim ảnh yêu thích, nhấn biểu tượng dấu cộng (+) để lưu vào danh sách xem sau.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            {activeTab !== 'all' && (
              <button
                onClick={() => setActiveTab('all')}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs sm:text-sm font-semibold rounded-md transition"
              >
                Xem tất cả
              </button>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#E50914] hover:bg-[#b80710] text-white font-bold rounded-md transition text-xs sm:text-sm shadow-lg shadow-red-900/20"
            >
              <Sparkles className="w-4 h-4" />
              Khám phá ngay
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Section 1: Phim Đang Xem Dở (Continue Watching) */}
          {showWatching && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-6 bg-[#E50914] rounded-sm" />
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Tiếp tục xem</h2>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded-full font-medium">
                    {watchingCount}
                  </span>
                </div>
                <p className="hidden sm:block text-xs text-zinc-500">
                  Tự động ghi nhớ thời gian &amp; tập phim đã xem
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {continueWatchingList.map((movie) => {
                  const keyId = getCanonicalMovieId(movie);
                  return (
                    <div key={`watching-${keyId}`} className="w-full">
                      <ContinueWatchingCard movie={movie} fillWidth />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section 2: Danh Sách Xem Sau (Bookmarked Movies) */}
          {showSaved && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-6 bg-blue-500 rounded-sm" />
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Phim đã lưu xem sau</h2>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded-full font-medium">
                    {savedCount}
                  </span>
                </div>
                <p className="hidden sm:block text-xs text-zinc-500">
                  Đã thêm thủ công bằng nút (+)
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {myList.map((movie) => {
                  const keyId = getCanonicalMovieId(movie);
                  return (
                    <div key={`saved-${keyId}`} className="w-full">
                      <MovieCard movie={movie} fillWidth />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
