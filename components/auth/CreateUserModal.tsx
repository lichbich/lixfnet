'use client';

import React, { useState, useEffect } from 'react';
import { X, UserPlus, Users, KeyRound, User, CheckCircle2, AlertCircle, Shield, Loader2, Trash2 } from 'lucide-react';
import { useNetflix } from '@/context/NetflixContext';

interface UserItem {
  username: string;
  displayName?: string;
  role: string;
  createdAt?: string;
  createdBy?: string;
}

export const CreateUserModal: React.FC = () => {
  const { isCreateUserModalOpen, closeCreateUserModal, currentUser } = useNetflix();

  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [callerRole, setCallerRole] = useState<'admin' | 'member'>('member');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Deletion state
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatusMessage, setDeleteStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const isAdmin = currentUser?.role === 'admin' || callerRole === 'admin';

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/auth/users');
      const data = await res.json();
      if (data.users && Array.isArray(data.users)) {
        setUsersList(data.users);
      }
      if (data.callerRole) {
        setCallerRole(data.callerRole);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isCreateUserModalOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setConfirmDeleteUser(null);
      setDeleteStatusMessage(null);
      fetchUsers();
    }
  }, [isCreateUserModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCreateUserModalOpen) {
        closeCreateUserModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateUserModalOpen, closeCreateUserModal]);

  if (!isCreateUserModalOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetUsername = username.trim();
      const targetPassword = password;

      const res = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUsername,
          displayName: displayName.trim() || targetUsername,
          password: targetPassword,
          role: isAdmin ? role : 'member',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể tạo tài khoản');
      }

      setSuccessMessage(`Cấp tài khoản thành công! Tài khoản: ${targetUsername} | Mật khẩu: ${targetPassword}`);
      setUsername('');
      setDisplayName('');
      setPassword('');
      setConfirmPassword('');
      fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi cấp tài khoản');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (targetUsername: string) => {
    setIsDeleting(true);
    setDeleteStatusMessage(null);
    try {
      const res = await fetch('/api/auth/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: targetUsername }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi xóa tài khoản');
      }

      setDeleteStatusMessage({
        type: 'success',
        text: `Đã xóa tài khoản '${targetUsername}' thành công.`,
      });
      setConfirmDeleteUser(null);
      fetchUsers();
    } catch (err: any) {
      setDeleteStatusMessage({
        type: 'error',
        text: err.message || 'Lỗi khi xóa tài khoản',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Quản lý & Cấp tài khoản LIXFNET
              </h3>
            </div>
          </div>
          <button
            onClick={closeCreateUserModal}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-zinc-900/30 px-5 pt-3 gap-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'create'
                ? 'border-red-600 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Cấp tài khoản mới
          </button>
          <button
            onClick={() => {
              setActiveTab('list');
              setDeleteStatusMessage(null);
              setConfirmDeleteUser(null);
            }}
            className={`pb-3 border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'list'
                ? 'border-red-600 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-4 h-4" />
            {isAdmin
              ? `Danh sách tài khoản (${usersList.length})`
              : `Tài khoản bạn đã tạo (${usersList.length})`}
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  Tên đăng nhập <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="ví dụ: hungdung, trangnguyen"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
                />
              </div>

              {/* Display Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Tên hiển thị (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="ví dụ: Nguyễn Hùng Dũng"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
                />
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                    Mật khẩu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 4 ký tự"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Xác nhận mật khẩu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
                  />
                </div>
              </div>

              {/* Role Select (Only Admin can grant admin role) */}
              {isAdmin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-zinc-400" />
                    Quyền hạn tài khoản
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('member')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        role === 'member'
                          ? 'border-red-600 bg-red-600/10 text-white'
                          : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Thành viên xem phim
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        role === 'admin'
                          ? 'border-red-600 bg-red-600/10 text-white'
                          : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Quản trị viên
                    </button>
                  </div>
                </div>
              )}

              {/* Submit button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-98 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu tài khoản...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Cấp tài khoản ngay</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* User List Tab */
            <div className="space-y-3">
              {deleteStatusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in ${
                    deleteStatusMessage.type === 'success'
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/15 border border-red-500/30 text-red-400'
                  }`}
                >
                  {deleteStatusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  )}
                  <span>{deleteStatusMessage.text}</span>
                </div>
              )}

              {isLoadingUsers ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3 text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                  <span className="text-xs">Đang tải danh sách tài khoản...</span>
                </div>
              ) : usersList.length === 0 ? (
                <div className="py-10 text-center text-zinc-500 text-xs">
                  {isAdmin
                    ? 'Chưa có tài khoản nào được tạo.'
                    : 'Bạn chưa cấp tài khoản nào cho người khác.'}
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {usersList.map((u) => (
                    <div
                      key={u.username}
                      className="py-3 flex items-center justify-between hover:bg-white/[0.02] px-2 rounded-lg transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-amber-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow shrink-0">
                          {u.username.substring(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{u.displayName || u.username}</span>
                            <span className="text-xs text-zinc-400">@{u.username}</span>
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            Cấp bởi: {u.createdBy || 'hệ thống'} • {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : 'Mới'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            u.role === 'admin'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-zinc-800 text-zinc-300 border border-white/10'
                          }`}
                        >
                          {u.role === 'admin' ? 'Quản trị' : 'Thành viên'}
                        </span>

                        {/* Delete Action (Admin Only) */}
                        {isAdmin && (
                          <>
                            {confirmDeleteUser === u.username ? (
                              <div className="flex items-center gap-1.5 bg-red-950/70 border border-red-500/40 px-2 py-1 rounded-lg animate-in fade-in">
                                <span className="text-[11px] text-red-300 font-medium">Xác nhận?</span>
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={() => handleDeleteUser(u.username)}
                                  className="px-2 py-0.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-[10px] rounded transition cursor-pointer"
                                >
                                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Xóa'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={() => setConfirmDeleteUser(null)}
                                  className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded transition cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : u.username === currentUser?.username ? (
                              <span className="text-[10px] text-zinc-500 px-2 py-0.5 rounded bg-zinc-900 border border-white/5 select-none">
                                Bạn
                              </span>
                            ) : u.username === 'tronglich' ? (
                              <span className="text-[10px] text-zinc-500 px-2 py-0.5 rounded bg-zinc-900 border border-white/5 select-none">
                                Gốc
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteStatusMessage(null);
                                  setConfirmDeleteUser(u.username);
                                }}
                                title={`Xóa tài khoản @${u.username}`}
                                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-white/5 hover:border-red-500/30 flex items-center justify-center transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
