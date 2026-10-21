'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';

export const Footer: React.FC = () => {
  const pathname = usePathname();
  if (pathname === '/login') {
    return null;
  }
  const footerLinks = [
    { label: 'Câu hỏi thường gặp', href: '#' },
    { label: 'Trung tâm trợ giúp', href: '#' },
    { label: 'Tài khoản', href: '#' },
    { label: 'Trung tâm đa phương tiện', href: '#' },
    { label: 'Quan hệ với nhà đầu tư', href: '#' },
    { label: 'Việc làm', href: '#' },
    { label: 'Các cách xem', href: '#' },
    { label: 'Điều khoản sử dụng', href: '#' },
    { label: 'Quyền riêng tư', href: '#' },
    { label: 'Tùy chọn cookie', href: '#' },
    { label: 'Thông tin doanh nghiệp', href: '#' },
    { label: 'Liên hệ với chúng tôi', href: '#' },
    { label: 'Kiểm tra tốc độ', href: '#' },
    { label: 'Thông báo pháp lý', href: '#' },
    { label: 'Chỉ có trên LIXFNET', href: '#' },
  ];

  return (
    <footer className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 md:px-12 py-12 md:py-16 text-zinc-500 text-xs sm:text-sm">
      <div className="border-t border-zinc-800/80 pt-10">
        {/* Contact info */}
        <p className="mb-6 hover:underline cursor-pointer">
          Bạn có câu hỏi? Liên hệ với chúng tôi.
        </p>

        {/* Links Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-y-3 gap-x-4 mb-8">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="hover:underline hover:text-zinc-400 transition"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Language selector & compact TMDB icon badge */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex items-center gap-2 border border-zinc-700/80 rounded px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 transition cursor-pointer">
            <Globe className="w-4 h-4" />
            <span>Tiếng Việt</span>
          </div>

          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noopener noreferrer"
            title="The Movie Database (TMDB)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-zinc-800/80 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/60 transition group"
          >
            <span className="font-black text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r from-[#90cea1] via-[#01b4e4] to-[#0d253f] text-black shadow-sm group-hover:scale-105 transition-transform">
              TMDB
            </span>
          </a>
        </div>

        {/* Copyright */}
        <p className="text-[11px] text-zinc-600">
          © 2026 LIXFNET, Inc. Dành cho mục đích học tập và nghiên cứu giao diện.
        </p>
      </div>
    </footer>
  );
};
