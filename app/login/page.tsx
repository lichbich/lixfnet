'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { NetflixLogo } from '@/components/ui/NetflixLogo';
import { useNetflix } from '@/context/NetflixContext';

export default function LoginPage() {
  const router = useRouter();
  const { loginUser } = useNetflix();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đăng nhập không thành công');
      }

      loginUser(data.user);
      setSuccessMessage('Đăng nhập thành công!');

      // Set flag for smooth fade-in when entering the home page
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('lixfnet_login_transition', 'true');
      }

      // Smooth cinema fade to black before redirect
      setIsFadingOut(true);

      setTimeout(() => {
        router.push('/');
      }, 650);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi kết nối với máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen w-full bg-[#141414] text-[#e5e5e5] flex flex-col justify-between selection:bg-red-600 selection:text-white relative overflow-x-hidden font-sans transition-all duration-700 ease-in-out ${
        isFadingOut ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
      }`}
    >
      {/* Full-screen Dark Transition Curtain on successful login */}
      <div
        className={`fixed inset-0 z-50 bg-[#141414] pointer-events-none transition-opacity duration-700 ease-in-out ${
          isFadingOut ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Cinematic Dark Ambient Glows */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-red-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[450px] h-[450px] bg-amber-600/5 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Header Bar - Minimalist branding only */}
      <header className="w-full max-w-[1720px] mx-auto px-6 sm:px-12 py-6 sm:py-8 flex items-center justify-between z-30">
        <div className="flex items-center">
          <NetflixLogo className="h-7 sm:h-8 w-auto text-[#E50914] drop-shadow-md" />
        </div>
      </header>

      {/* Main Canvas */}
      <main className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 md:px-12 flex-1 flex items-center justify-center py-6 sm:py-10 z-20">
        <div className="relative w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-0 items-center">
          {/* LEFT: Vietnamese Brocade Art Showcase with Fashion-Editorial Typography */}
          <div className="lg:col-span-7 relative flex flex-col items-center lg:items-start justify-center">
            {/* The Vietnamese Brocade Art Piece */}
            <div className="relative w-full max-w-md sm:max-w-lg lg:max-w-xl h-[460px] sm:h-[580px] lg:h-[680px] rounded-2xl md:rounded-3xl overflow-hidden shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)] border border-white/10 bg-zinc-950 group">
              <Image
                src="/images/vietnam_brocade.jpg"
                alt="Thổ cẩm Việt Nam"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover object-center group-hover:scale-105 transition-transform duration-1000 ease-out"
              />

              {/* Editorial Gradient Veil */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent pointer-events-none" />

              {/* Bold Layered Modern Typography */}
              <div className="absolute bottom-10 left-6 sm:left-10 z-10 text-white select-none pointer-events-none space-y-1">
                {/* Outline stroke title */}
                <h2
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tight text-transparent drop-shadow-lg"
                  style={{
                    WebkitTextStroke: '2px rgba(255,255,255,0.95)',
                    fontFamily: 'var(--font-bebas), sans-serif',
                    lineHeight: '0.9',
                  }}
                >
                  THỔ CẨM
                </h2>
                {/* Solid Title */}
                <h2
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black uppercase tracking-tight text-white drop-shadow-2xl"
                  style={{
                    fontFamily: 'var(--font-bebas), sans-serif',
                    lineHeight: '0.9',
                  }}
                >
                  VIỆT NAM
                </h2>
                <div className="pt-2 flex items-center gap-2">
                  <span className="h-0.5 w-6 bg-red-600 inline-block" />
                  <p className="text-[11px] sm:text-xs uppercase tracking-[0.2em] font-semibold text-zinc-300 drop-shadow">
                    Bản sắc dân tộc • Nghệ thuật dệt may
                  </p>
                </div>
              </div>

              {/* Badge top-left */}
              <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-white bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 shadow">
                  Haute Couture Heritage
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Floating Frosted Dark Glass Form */}
          <div className="lg:col-span-5 lg:-ml-16 z-30 w-full max-w-md mx-auto">
            <div className="bg-[#181818]/90 backdrop-blur-2xl border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.85)] rounded-2xl sm:rounded-3xl p-8 sm:p-10 space-y-6 transition-all">
              {/* Status Messages */}
              {errorMessage && (
                <div className="p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Username Field */}
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập tên đăng nhập"
                    className="w-full bg-transparent border-b-2 border-zinc-700 focus:border-red-600 px-0 py-2.5 text-sm sm:text-base text-white placeholder:text-zinc-500 focus:outline-none transition-colors duration-200 font-medium"
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                      Mật khẩu
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-zinc-400 hover:text-white transition flex items-center gap-1 cursor-pointer select-none"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Ẩn</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Hiện</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="w-full bg-transparent border-b-2 border-zinc-700 focus:border-red-600 px-0 py-2.5 text-sm sm:text-base text-white placeholder:text-zinc-500 focus:outline-none transition-colors duration-200 font-medium tracking-wide"
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#E50914] hover:bg-[#c90711] disabled:opacity-50 text-white font-bold py-3.5 rounded-lg text-xs sm:text-sm tracking-wider uppercase transition shadow-lg shadow-red-600/30 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang xác thực...</span>
                      </>
                    ) : (
                      <span>Đăng nhập</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Empty bottom spacer for perfect balance */}
      <div className="py-4" />
    </div>
  );
}
