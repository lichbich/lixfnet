'use client';

import React, { useState, useEffect } from 'react';
import { X, Globe, CheckCircle2, AlertCircle, RefreshCw, Power } from 'lucide-react';
import { useNetflix } from '@/context/NetflixContext';

export const ProxySettingsModal: React.FC = () => {
  const {
    isProxySettingsOpen,
    closeProxySettings,
    streamProxyUrl,
    setStreamProxyUrl,
    isStreamProxyEnabled,
    setIsStreamProxyEnabled,
  } = useNetflix();

  const [inputUrl, setInputUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latency?: number;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isProxySettingsOpen) {
      setInputUrl(streamProxyUrl || '');
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isProxySettingsOpen, streamProxyUrl]);

  if (!isProxySettingsOpen) return null;

  // Test proxy connection (Ping test)
  const handleTestConnection = async () => {
    const clean = inputUrl.trim().replace(/\/+$/, '');
    if (!clean) {
      setTestResult({
        success: false,
        message: 'Vui lòng nhập đường dẫn trước khi kiểm tra.',
      });
      return;
    }

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      setTestResult({
        success: false,
        message: 'Đường dẫn phải bắt đầu bằng https:// (hoặc http://).',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${clean}/health`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      const latency = Math.round(performance.now() - startTime);

      if (res.ok) {
        setTestResult({
          success: true,
          message: 'Kết nối thành công tới máy chủ Proxy!',
          latency,
        });
      } else {
        setTestResult({
          success: false,
          message: `Máy chủ phản hồi mã ${res.status}. Vui lòng kiểm tra lại file start-proxy.bat.`,
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Không thể kết nối! Hãy chắc chắn cửa sổ start-proxy.bat trên máy ở VN đang mở.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save proxy locally on this device
  const handleSave = () => {
    const clean = inputUrl.trim();
    setStreamProxyUrl(clean);
    if (clean) {
      setIsStreamProxyEnabled(true);
    }
    setSaveSuccess(true);
    setTimeout(() => {
      closeProxySettings();
    }, 600);
  };

  const handleToggle = () => {
    const nextState = !isStreamProxyEnabled;
    setIsStreamProxyEnabled(nextState);
    if (nextState && !streamProxyUrl && inputUrl.trim()) {
      setStreamProxyUrl(inputUrl.trim());
    }
  };

  return (
    <div
      onClick={closeProxySettings}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#161616] border border-zinc-700/80 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden text-white flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Cài Đặt Proxy Nước Ngoài</h3>
              <p className="text-xs text-zinc-400">Xem phim không bị chặn khi ở nước ngoài</p>
            </div>
          </div>

          <button
            onClick={closeProxySettings}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs sm:text-sm">
          {/* Status & Toggle */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
              isStreamProxyEnabled && streamProxyUrl
                ? 'bg-emerald-950/30 border-emerald-500/40'
                : 'bg-zinc-900/60 border-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isStreamProxyEnabled && streamProxyUrl
                    ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse'
                    : 'bg-zinc-600'
                }`}
              />
              <span className="font-semibold text-xs text-zinc-200">
                {isStreamProxyEnabled && streamProxyUrl ? 'Proxy đang BẬT' : 'Proxy đang TẮT'}
              </span>
            </div>

            <button
              onClick={handleToggle}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isStreamProxyEnabled
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isStreamProxyEnabled ? 'Tắt' : 'Bật'}</span>
            </button>
          </div>

          {/* Proxy URL Input */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300 text-xs block">
              Dán đường dẫn Proxy vào đây
            </label>

            <div className="relative flex items-center">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://xxxx-xxxx-xxxx.trycloudflare.com"
                className="w-full bg-black/60 border border-zinc-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-zinc-600 outline-none transition font-mono pr-24"
              />

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="absolute right-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Thử...' : 'Kiểm tra'}</span>
              </button>
            </div>

            {/* Test Feedback */}
            {testResult && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                    : 'bg-red-950/40 border border-red-500/30 text-red-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                )}
                <div>
                  <p>{testResult.message}</p>
                  {testResult.latency !== undefined && (
                    <p className="text-[10px] text-emerald-400/80 mt-0.5">
                      Ping: {testResult.latency}ms
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-black/40 flex items-center justify-between">
          <button
            onClick={closeProxySettings}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            Đóng
          </button>

          <button
            onClick={handleSave}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition shadow-md active:scale-95 cursor-pointer ${
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-black hover:bg-zinc-200'
            }`}
          >
            {saveSuccess ? 'Đã lưu!' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>
    </div>
  );
};
