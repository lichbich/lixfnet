'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bell, X, User, HelpCircle, Settings, LogOut, ChevronDown, UserPlus } from 'lucide-react';
import { NetflixLogo } from '@/components/ui/NetflixLogo';
import { useNetflix } from '@/context/NetflixContext';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { searchQuery, setSearchQuery, currentUser, openCreateUserModal, logoutUser } = useNetflix();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Click outside to close search, notifications & profile dropdowns
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  // Close search on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  // Focus input when search bar opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isSearchOpen]);

  // Hide main navigation on dedicated login page
  if (pathname === '/login') {
    return null;
  }

  const navLinks = [
    { label: 'Trang chủ', href: '/' },
    { label: 'Series', href: '/series' },
    { label: 'Phim', href: '/movies' },
    { label: 'Mới & Phổ biến', href: '/latest' },
    { label: 'LIXFNET của tôi', href: '/my-list' },
    { label: 'Duyệt tìm theo ngôn ngữ', href: '/original-audio' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        isScrolled
          ? 'bg-[#141414]/95 backdrop-blur-md shadow-2xl border-b border-white/5'
          : 'bg-gradient-to-b from-black/80 via-black/40 to-transparent'
      }`}
    >
      <div className="max-w-[1920px] mx-auto px-4 sm:px-8 md:px-12 h-16 flex items-center justify-between gap-4">
        {/* Left Side: Logo & Navigation */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link href="/" className="flex-shrink-0 transition-transform hover:scale-105">
            <NetflixLogo className="h-6 sm:h-7 w-auto" />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-2 lg:gap-3">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href === '/original-audio' && pathname?.includes('original-audio'));
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`text-xs lg:text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#2b2b2b] text-white px-3.5 py-1.5 rounded-full border border-white/10 shadow-sm'
                      : 'text-zinc-300 hover:text-white px-2 py-1'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Search, Notifications, Avatar */}
        <div className="flex items-center gap-4 sm:gap-5">
          {/* Animated Smooth Expanding Search Bar */}
          <div
            ref={searchContainerRef}
            className={`relative flex items-center transition-all duration-300 ease-out overflow-hidden ${
              isSearchOpen
                ? 'w-64 sm:w-80 md:w-96 bg-black/90 border border-white/60 shadow-2xl px-3.5 py-1.5 sm:py-2 rounded-full'
                : 'w-10 h-10 bg-transparent border border-transparent rounded-full justify-center'
            }`}
          >
            <button
              onClick={() => {
                setIsSearchOpen((prev) => !prev);
              }}
              aria-label="Tìm kiếm"
              className={`text-zinc-200 hover:text-white transition-all flex-shrink-0 cursor-pointer ${
                isSearchOpen ? 'mr-2.5 text-zinc-300' : 'p-2 hover:scale-110'
              }`}
            >
              <Search className="w-5 h-5" />
            </button>

            <input
              ref={searchInputRef}
              type="text"
              placeholder="Phim, diễn viên, thể loại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`bg-transparent text-white text-xs sm:text-sm w-full outline-none placeholder:text-zinc-400 transition-opacity duration-300 ${
                isSearchOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none w-0'
              }`}
            />

            {isSearchOpen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (searchQuery) {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  } else {
                    setIsSearchOpen(false);
                  }
                }}
                aria-label="Đóng tìm kiếm"
                className="text-zinc-400 hover:text-white flex-shrink-0 ml-1.5 p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Notifications */}
          <div ref={notificationsRef} className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileMenu(false);
              }}
              aria-label="Thông báo"
              className="relative text-zinc-200 hover:text-white p-1 transition-transform hover:scale-110 active:scale-95"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-[#E50914] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">
                1
              </span>
            </button>

            {/* Notification Dropdown with Caret and Smooth Animation */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 sm:w-88 bg-[#181818]/95 backdrop-blur-md border border-zinc-700/80 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 ease-out origin-top-right">
                {/* Arrow Caret */}
                <div className="absolute -top-1.5 right-3 w-3 h-3 bg-[#181818] border-t border-l border-zinc-700/80 rotate-45 z-10" />

                <div className="px-4 py-2 border-b border-zinc-700/60 font-semibold text-xs text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Thông báo gần đây</span>
                  <span className="text-[10px] text-zinc-500 font-normal">Mới nhất</span>
                </div>
                <div className="divide-y divide-zinc-800/80">
                  <div className="px-4 py-3 hover:bg-zinc-800/60 cursor-pointer flex gap-3 transition">
                    <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0 bg-zinc-800">
                      <img
                        src="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=200&auto=format&fit=crop"
                        alt="Nobody Wants This"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white line-clamp-1">
                        Mùa 3 sắp ra mắt!
                      </h4>
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                        Nobody Wants This sẽ có mùa mới vào Thứ Năm tuần này. Đừng bỏ lỡ!
                      </p>
                      <span className="text-[10px] text-zinc-500 mt-1 block">Hôm nay</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 hover:bg-zinc-800/60 cursor-pointer flex gap-3 transition">
                    <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0 bg-zinc-800">
                      <img
                        src="https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?q=80&w=200&auto=format&fit=crop"
                        alt="Bác Sĩ X"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white line-clamp-1">Tập mới vừa cập nhật</h4>
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                        Bác Sĩ X tập 7 đã có sẵn phụ đề tiếng Việt.
                      </p>
                      <span className="text-[10px] text-zinc-500 mt-1 block">Hôm qua</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar & Dropdown */}
          <div ref={profileMenuRef} className="relative">
            {currentUser ? (
              <button
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-1.5 group p-0.5 cursor-pointer"
              >
                {/* User Avatar with Monogram or Netflix yellow theme */}
                <div className="w-8 h-8 rounded bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white font-bold text-xs uppercase border border-transparent group-hover:border-white transition shadow-sm group-hover:scale-105 active:scale-95">
                  {currentUser.username.substring(0, 2)}
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-white/70 group-hover:text-white transition-transform duration-200 ${
                    showProfileMenu ? 'rotate-180' : ''
                  }`}
                />
              </button>
            ) : (
              <Link
                href="/login"
                className="bg-[#E50914] hover:bg-[#c90711] text-white text-xs font-bold px-3.5 py-1.5 rounded-md transition shadow-md shadow-red-600/20 active:scale-95"
              >
                Đăng nhập
              </Link>
            )}

            {/* Profile Dropdown Menu with Caret and Smooth Animation */}
            {showProfileMenu && currentUser && (
              <div className="absolute right-0 mt-3 w-60 bg-[#181818]/95 backdrop-blur-md border border-zinc-700/80 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] py-2 z-50 text-sm animate-in fade-in slide-in-from-top-2 duration-200 ease-out origin-top-right">
                {/* Arrow Caret */}
                <div className="absolute -top-1.5 right-4 w-3 h-3 bg-[#181818] border-t border-l border-zinc-700/80 rotate-45 z-10" />

                {/* Current User Header */}
                <div className="px-4 py-2.5 flex items-center gap-3 border-b border-white/5 bg-white/[0.02]">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white font-bold text-xs uppercase shrink-0 shadow">
                    {currentUser.username.substring(0, 2)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-white font-bold truncate text-xs">
                      {currentUser.displayName || currentUser.username}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      @{currentUser.username} • {currentUser.role === 'admin' ? 'Quản trị' : 'Thành viên'}
                    </p>
                  </div>
                </div>

                {/* Grant New Account Action (Any logged in user can grant accounts) */}
                <div className="py-1">
                  <div
                    onClick={() => {
                      setShowProfileMenu(false);
                      openCreateUserModal();
                    }}
                    className="px-4 py-2.5 text-zinc-200 hover:text-white hover:bg-red-600/20 cursor-pointer flex items-center gap-2.5 text-xs font-semibold transition"
                  >
                    <UserPlus className="w-4 h-4 text-red-500" />
                    <span>Cấp tài khoản mới</span>
                  </div>
                </div>

                <div className="h-px bg-zinc-800 my-1" />

                <div className="px-4 py-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer flex items-center gap-2.5 text-xs">
                  <User className="w-4 h-4" />
                  <span>Quản lý hồ sơ</span>
                </div>
                <div className="px-4 py-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer flex items-center gap-2.5 text-xs">
                  <Settings className="w-4 h-4" />
                  <span>Cài đặt</span>
                </div>

                <div className="h-px bg-zinc-800 my-1" />

                <div
                  onClick={async () => {
                    setShowProfileMenu(false);
                    await logoutUser();
                    window.location.href = '/login';
                  }}
                  className="px-4 py-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer flex items-center gap-2.5 text-xs transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
