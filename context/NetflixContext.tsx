'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Movie, EpisodeServer, WatchProgress, EpisodeProgress } from '@/types';
import { getMovieDetail, getMovieDetailByTmdb, formatEpisodeTitle } from '@/services/movieApi';
import { findNguonCMatch } from '@/services/trendingService';

interface HoverRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface AuthUser {
  username: string;
  displayName: string;
  role: 'admin' | 'member';
}

interface NetflixContextType {
  selectedMovie: Movie | null;
  playingMovie: Movie | null;
  currentEpisodeEmbed: string | null;
  currentEpisodeTitle: string | null;
  currentEpisodeM3u8: string | null;
  myList: Movie[];
  searchQuery: string;
  isMuted: boolean;
  trailerVolume: number;
  setTrailerVolume: (volume: number) => void;
  isLoadingDetail: boolean;
  // Streaming Proxy for International Users (Saved per device)
  streamProxyUrl: string;
  isStreamProxyEnabled: boolean;
  setStreamProxyUrl: (url: string) => void;
  setIsStreamProxyEnabled: (enabled: boolean) => void;
  isProxySettingsOpen: boolean;
  openProxySettings: () => void;
  closeProxySettings: () => void;
  // Auth & Account Management
  currentUser: AuthUser | null;
  isCreateUserModalOpen: boolean;
  openCreateUserModal: () => void;
  closeCreateUserModal: () => void;
  loginUser: (user: AuthUser) => void;
  logoutUser: () => Promise<void>;
  // Watch Progress
  watchProgressMap: Record<string, WatchProgress>;
  continueWatchingList: Movie[];
  updateWatchProgress: (
    movie: Movie,
    currentTime: number,
    duration: number,
    episodeTitle?: string,
    episodeEmbed?: string,
    episodeM3u8?: string
  ) => void;
  getWatchProgress: (slugOrId: string) => WatchProgress | undefined;
  getEpisodeProgress: (slugOrId: string, episodeNameOrNumber: string) => EpisodeProgress | undefined;
  clearWatchProgress: (slugOrId: string) => void;
  // Hover Popout Card Coordination
  hoveredMovie: Movie | null;
  hoverRect: HoverRect | null;
  isCardTrailerPlaying: boolean;
  setIsCardTrailerPlaying: (playing: boolean) => void;
  onCardHover: (movie: Movie, rect: DOMRect) => void;
  onCardLeave: () => void;
  onPopoutEnter: () => void;
  onPopoutLeave: () => void;
  closeHoverPopoutNow: () => void;
  showHoverPopout: (movie: Movie, rect: DOMRect) => void;
  hideHoverPopout: () => void;
  // Actions
  openModal: (movie: Movie) => void;
  closeModal: () => void;
  startPlaying: (
    movie: Movie,
    episodeEmbedUrl?: string,
    episodeTitle?: string,
    episodeM3u8Url?: string
  ) => void;
  stopPlaying: () => void;
  setPlayingEpisode: (embedUrl: string, title?: string, m3u8Url?: string) => void;
  toggleMyList: (movie: Movie) => void;
  isInMyList: (id: string) => boolean;
  toggleMute: () => void;
  setSearchQuery: (q: string) => void;
}

const NetflixContext = createContext<NetflixContextType | undefined>(undefined);

export const NetflixProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [playingMovie, setPlayingMovie] = useState<Movie | null>(null);
  const [currentEpisodeEmbed, setCurrentEpisodeEmbed] = useState<string | null>(null);
  const [currentEpisodeTitle, setCurrentEpisodeTitle] = useState<string | null>(null);
  const [currentEpisodeM3u8, setCurrentEpisodeM3u8] = useState<string | null>(null);
  const [myList, setMyList] = useState<Movie[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Audio Mute Preference (Default: Unmuted / Sound ON, stored per user)
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('netflix_muted_pref');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false; // Mặc định bật tiếng
  });

  // Trailer Volume Preference (Default: 60%, stored in localStorage per user)
  const [trailerVolume, setTrailerVolumeState] = useState<number>(() => {
    if (typeof window === 'undefined') return 60;
    try {
      const saved = localStorage.getItem('netflix_trailer_volume');
      if (saved !== null) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
      }
    } catch {}
    return 60; // 60% default trailer volume
  });
  const trailerVolumeRef = useRef(trailerVolume);
  trailerVolumeRef.current = trailerVolume;

  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Auth & Account Management State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState<boolean>(false);

  // Streaming Proxy State (Per-device localStorage only)
  const [streamProxyUrl, setStreamProxyUrlState] = useState<string>('');
  const [isStreamProxyEnabled, setIsStreamProxyEnabledState] = useState<boolean>(false);
  const [isProxySettingsOpen, setIsProxySettingsOpen] = useState<boolean>(false);

  const openProxySettings = useCallback(() => setIsProxySettingsOpen(true), []);
  const closeProxySettings = useCallback(() => setIsProxySettingsOpen(false), []);

  const setStreamProxyUrl = useCallback((url: string) => {
    const clean = (url || '').trim();
    setStreamProxyUrlState(clean);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lixfnet_stream_proxy', clean);
    }
  }, []);

  const setIsStreamProxyEnabled = useCallback((enabled: boolean) => {
    setIsStreamProxyEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lixfnet_stream_proxy_enabled', enabled ? 'true' : 'false');
    }
  }, []);

  // Load proxy on mount (strictly from this device's localStorage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedProxy = localStorage.getItem('lixfnet_stream_proxy');
      const savedEnabled = localStorage.getItem('lixfnet_stream_proxy_enabled');
      if (savedProxy) {
        setStreamProxyUrlState(savedProxy);
        setIsStreamProxyEnabledState(savedEnabled !== 'false');
      }
    } catch {}
  }, []);

  // Sync user-specific mute and volume preference when user logs in or switches
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const user = currentUser?.username;
      const storageKey = user ? `netflix_muted_${user}` : 'netflix_muted_guest';
      const userSaved = localStorage.getItem(storageKey);
      if (userSaved !== null) {
        setIsMuted(userSaved === 'true');
      } else {
        const globalSaved = localStorage.getItem('netflix_muted_pref');
        if (globalSaved !== null) {
          setIsMuted(globalSaved === 'true');
        } else {
          setIsMuted(false); // Mặc định bật tiếng
        }
      }

      // Sync user-specific trailer volume
      const volStorageKey = user ? `netflix_trailer_volume_${user}` : 'netflix_trailer_volume_guest';
      const userVol = localStorage.getItem(volStorageKey);
      if (userVol !== null) {
        const parsed = Number(userVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) setTrailerVolumeState(parsed);
      } else {
        const globalVol = localStorage.getItem('netflix_trailer_volume');
        if (globalVol !== null) {
          const parsed = Number(globalVol);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) setTrailerVolumeState(parsed);
        } else {
          setTrailerVolumeState(60);
        }
      }
    } catch {}
  }, [currentUser?.username]);

  // Check existing session on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const openCreateUserModal = useCallback(() => {
    setIsCreateUserModalOpen(true);
  }, []);

  const closeCreateUserModal = useCallback(() => {
    setIsCreateUserModalOpen(false);
  }, []);

  const loginUser = useCallback((user: AuthUser) => {
    setCurrentUser(user);
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setCurrentUser(null);
    setWatchProgressMap({});
  }, []);

  // Watch Progress State
  const [watchProgressMap, setWatchProgressMap] = useState<Record<string, WatchProgress>>({});

  // Hover Popout State
  const [hoveredMovie, setHoveredMovie] = useState<Movie | null>(null);
  const [hoverRect, setHoverRect] = useState<HoverRect | null>(null);
  const [isCardTrailerPlaying, setIsCardTrailerPlaying] = useState<boolean>(false);

  // Initialize & sync user-scoped My List from localStorage and Firebase cloud
  useEffect(() => {
    if (!currentUser?.username) {
      setMyList([]);
      return;
    }

    const username = currentUser.username;
    const userStorageKey = `netflix_my_list_${username}`;

    // 1. Immediately hydrate from cached local storage for this user
    try {
      const cached = localStorage.getItem(userStorageKey);
      if (cached) {
        setMyList(JSON.parse(cached));
      } else {
        // Migration fallback: check legacy un-scoped key
        const legacy = localStorage.getItem('netflix_my_list');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          setMyList(parsed);
          localStorage.setItem(userStorageKey, legacy);
        } else {
          setMyList([]);
        }
      }
    } catch {
      setMyList([]);
    }

    // 2. Fetch cloud-synced My List from Firebase via /api/user/mylist
    fetch('/api/user/mylist')
      .then((res) => {
        if (!res.ok) throw new Error('Not logged in');
        return res.json();
      })
      .then((data) => {
        if (data.myList && Array.isArray(data.myList)) {
          setMyList((prev) => {
            const map = new Map<string, Movie>();
            // Add cloud items
            data.myList.forEach((m: Movie) => {
              const k = m.slug || m.id;
              if (k) map.set(k, m);
            });
            // Also preserve any local items not yet in cloud and sync them
            prev.forEach((m) => {
              const k = m.slug || m.id;
              if (k && !map.has(k)) {
                map.set(k, m);
                fetch('/api/user/mylist', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ key: k, movie: m }),
                }).catch(() => {});
              }
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem(userStorageKey, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});
  }, [currentUser?.username]);

  const openModal = useCallback(async (movie: Movie) => {
    setSelectedMovie(movie);

    let targetSlug = movie.slug;
    let detailed: Movie | null = null;

    const resolvedTmdbId = movie.tmdb?.id || movie.tmdbId;

    try {
      setIsLoadingDetail(true);

      // Stage 1: Try TMDB ID lookup if available (100% precision)
      if (resolvedTmdbId) {
        try {
          detailed = await getMovieDetailByTmdb(
            resolvedTmdbId,
            movie.type === 'series' ? 'tv' : 'movie'
          );
          if (detailed?.slug) {
            targetSlug = detailed.slug;
          }
        } catch {}
      }

      // Stage 2: Direct lookup by targetSlug if not resolved by TMDB
      if (!detailed && targetSlug) {
        try {
          detailed = await getMovieDetail(targetSlug);
        } catch {}
      }

      // Stage 3: Dynamic title search if no stream/episodes were found
      if (!detailed && (!movie.episodesServers || movie.episodesServers.length === 0)) {
        try {
          const match = await findNguonCMatch(movie.title, movie.subTitle, {
            year: movie.year,
            type: movie.type,
            tmdbId: resolvedTmdbId,
          });
          if (match?.slug && match.slug !== targetSlug) {
            targetSlug = match.slug;
            detailed = await getMovieDetail(targetSlug);
          }
        } catch (err) {
          console.warn('Fallback movie lookup error:', err);
        }
      }

      // If detailed movie data was retrieved, merge with high-fidelity UI properties
      if (detailed) {
        const foundDetail = detailed;
        setSelectedMovie((prev) => {
          if (!prev) return foundDetail;

          const hasEpisodes = Boolean(foundDetail.episodesServers && foundDetail.episodesServers.length > 0);

          return {
            ...foundDetail,
            ...prev, // Prev preserves high-fidelity title, posters, synopsis, logoUrl, year, rating
            slug: targetSlug || foundDetail.slug || prev.slug,
            embedUrl: foundDetail.embedUrl || prev.embedUrl,
            m3u8Url: foundDetail.m3u8Url || prev.m3u8Url,
            episodesServers: hasEpisodes ? foundDetail.episodesServers : prev.episodesServers,
            currentEpisode: foundDetail.currentEpisode || prev.currentEpisode,
            seasons: foundDetail.seasons || prev.seasons,
            duration: foundDetail.duration || prev.duration,
            durationMinutes: foundDetail.durationMinutes || prev.durationMinutes,
            isAvailable: hasEpisodes ? true : (prev.isAvailable ?? foundDetail.isAvailable),
            genres:
              foundDetail.genres && foundDetail.genres.length > 0 && foundDetail.genres[0] !== 'Phim hot'
                ? foundDetail.genres
                : prev.genres || foundDetail.genres,
            logoUrl: prev.logoUrl || foundDetail.logoUrl,
            badges: {
              ...foundDetail.badges,
              ...prev.badges,
              platform: prev.badges?.platform || foundDetail.badges?.platform,
              platformName: prev.badges?.platformName || foundDetail.badges?.platformName,
              isTop10: prev.badges?.isTop10 ?? foundDetail.badges?.isTop10,
              // Clear "Chưa có sẵn" ribbon if we actually have playable episodes
              ribbon: (hasEpisodes && prev.badges?.ribbon === 'Chưa có sẵn')
                ? undefined
                : (prev.badges?.ribbon || foundDetail.badges?.ribbon),
              subBadge: (hasEpisodes && (prev.badges?.subBadge === 'Trailer' || prev.badges?.subBadge === 'Sắp chiếu'))
                ? (prev.badges?.platformName || 'Phát hành')
                : (prev.badges?.subBadge || foundDetail.badges?.subBadge),
            },
            progress: prev.progress,
          };
        });
      }
    } catch (err) {
      console.warn('Modal movie detail resolution error:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setSelectedMovie(null);
  }, []);

  const startPlaying = useCallback(
    async (
      movie: Movie,
      episodeEmbedUrl?: string,
      episodeTitle?: string,
      episodeM3u8Url?: string
    ) => {
      if (!movie) return;

      const key = movie.slug || movie.id;
      const wp = watchProgressMapRef.current[key];

      // 1. If an episode was explicitly passed OR previously watched, resume that episode
      let targetEmbed = episodeEmbedUrl || wp?.episodeEmbed || movie.embedUrl || null;
      let targetTitle = episodeTitle || wp?.episodeTitle || movie.currentEpisode || null;
      let targetM3u8 = episodeM3u8Url || wp?.episodeM3u8 || movie.m3u8Url || null;

      if (targetTitle) {
        targetTitle = formatEpisodeTitle(targetTitle);
      }

      // If targetM3u8 is not directly provided, search within movie.episodesServers or movie.seasonsList
      if (!targetM3u8 && movie.episodesServers) {
        for (const srv of movie.episodesServers) {
          const found = srv.items?.find(
            (ep) =>
              ep.embed === targetEmbed ||
              formatEpisodeTitle(ep.name) === targetTitle ||
              ep.name === targetTitle
          );
          if (found?.m3u8) {
            targetM3u8 = found.m3u8;
            break;
          }
        }
      }
      if (!targetM3u8 && movie.seasonsList) {
        for (const s of movie.seasonsList) {
          const found = s.episodes?.find(
            (ep) =>
              ep.embedUrl === targetEmbed ||
              formatEpisodeTitle(ep.title) === targetTitle ||
              ep.title === targetTitle
          );
          if (found?.m3u8Url) {
            targetM3u8 = found.m3u8Url;
            break;
          }
        }
      }

      setPlayingMovie(movie);
      setCurrentEpisodeEmbed(targetEmbed);
      setCurrentEpisodeTitle(targetTitle);
      setCurrentEpisodeM3u8(targetM3u8);

      // Resolve slug dynamically if missing
      let activeSlug = movie.slug;
      if (!targetEmbed && !activeSlug) {
        try {
          const match = await findNguonCMatch(movie.title, movie.subTitle, {
            year: movie.year,
            type: movie.type,
          });
          if (match?.slug) {
            activeSlug = match.slug;
          }
        } catch {}
      }

      // 2. If movie has not been watched yet or missing m3u8/embed, and has slug:
      // Fetch full detail to resolve accurate stream URLs
      if ((!targetEmbed || !targetM3u8) && activeSlug) {
        try {
          setIsLoadingDetail(true);
          const detailed = await getMovieDetail(activeSlug);
          if (detailed) {
            setPlayingMovie((prev) => {
              if (!prev) return detailed;
              if (prev.slug === activeSlug || prev.id === movie.id) {
                return {
                  ...detailed,
                  ...prev,
                  slug: activeSlug || prev.slug,
                  episodesServers: detailed.episodesServers || prev.episodesServers,
                  embedUrl: detailed.embedUrl || prev.embedUrl,
                  m3u8Url: detailed.m3u8Url || prev.m3u8Url,
                };
              }
              return prev;
            });

            // Find matching episode in detailed
            let resolvedEp: any = null;
            if (detailed.episodesServers) {
              for (const srv of detailed.episodesServers) {
                const found = srv.items?.find(
                  (ep) =>
                    (targetEmbed && ep.embed === targetEmbed) ||
                    (targetTitle && formatEpisodeTitle(ep.name) === targetTitle) ||
                    (targetTitle && ep.name === targetTitle)
                );
                if (found) {
                  resolvedEp = found;
                  break;
                }
              }
            }

            const firstServer = detailed.episodesServers?.[0];
            const firstEp = resolvedEp || firstServer?.items?.[0];
            const resolvedEmbed = targetEmbed || firstEp?.embed || detailed.embedUrl || null;
            const resolvedM3u8 = targetM3u8 || firstEp?.m3u8 || detailed.m3u8Url || null;
            const resolvedTitle = targetTitle || (firstEp
              ? formatEpisodeTitle(firstEp.name)
              : (detailed.currentEpisode ? formatEpisodeTitle(detailed.currentEpisode) : 'Tập 1'));

            setCurrentEpisodeEmbed(resolvedEmbed);
            setCurrentEpisodeM3u8(resolvedM3u8);
            setCurrentEpisodeTitle(resolvedTitle);
          }
        } catch (err) {
          console.error('Failed to load movie stream for playback:', err);
        } finally {
          setIsLoadingDetail(false);
        }
      }
    },
    []
  );

  const stopPlaying = useCallback(() => {
    setPlayingMovie(null);
    setCurrentEpisodeEmbed(null);
    setCurrentEpisodeTitle(null);
    setCurrentEpisodeM3u8(null);
  }, []);

  const playingMovieRef = useRef<Movie | null>(null);
  playingMovieRef.current = playingMovie;

  const setPlayingEpisode = useCallback((embedUrl: string, title?: string, m3u8Url?: string) => {
    setCurrentEpisodeEmbed(embedUrl);
    const cleanedTitle = title ? formatEpisodeTitle(title) : null;
    if (cleanedTitle) setCurrentEpisodeTitle(cleanedTitle);

    if (m3u8Url !== undefined) {
      setCurrentEpisodeM3u8(m3u8Url);
    } else {
      let foundM3u8: string | null = null;
      if (playingMovieRef.current?.episodesServers) {
        for (const srv of playingMovieRef.current.episodesServers) {
          const match = srv.items?.find(
            (ep) =>
              ep.embed === embedUrl ||
              (cleanedTitle && formatEpisodeTitle(ep.name) === cleanedTitle)
          );
          if (match?.m3u8) {
            foundM3u8 = match.m3u8;
            break;
          }
        }
      }
      if (!foundM3u8 && playingMovieRef.current?.m3u8Url) {
        foundM3u8 = playingMovieRef.current.m3u8Url;
      }
      setCurrentEpisodeM3u8(foundM3u8);
    }
  }, []);

  const toggleMyList = useCallback((movie: Movie) => {
    if (!movie) return;
    const movieKey = movie.slug || movie.id;
    const activeUser = currentUserRef.current;
    const userStorageKey = activeUser?.username
      ? `netflix_my_list_${activeUser.username}`
      : 'netflix_my_list_guest';

    setMyList((prev) => {
      const exists = prev.some((item) => item.id === movie.id || (item.slug && item.slug === movie.slug));
      let nextList: Movie[];
      if (exists) {
        nextList = prev.filter((item) => item.id !== movie.id && item.slug !== movie.slug);
        if (activeUser?.username) {
          fetch('/api/user/mylist', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: movieKey }),
          }).catch(() => {});
        }
      } else {
        nextList = [movie, ...prev];
        if (activeUser?.username) {
          fetch('/api/user/mylist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: movieKey, movie }),
          }).catch(() => {});
        }
      }
      try {
        localStorage.setItem(userStorageKey, JSON.stringify(nextList));
      } catch {
        // ignore
      }
      return nextList;
    });
  }, []);

  const isInMyList = useCallback(
    (id: string) => {
      return myList.some((item) => item.id === id || item.slug === id);
    },
    [myList]
  );

  // Reference to current user for callbacks
  const currentUserRef = useRef<AuthUser | null>(null);
  currentUserRef.current = currentUser;

  // Initialize & sync user-scoped watch progress from localStorage and Firebase cloud
  useEffect(() => {
    if (!currentUser?.username) {
      setWatchProgressMap({});
      return;
    }

    const username = currentUser.username;
    const userStorageKey = `netflix_watch_progress_${username}`;

    // 1. Immediately hydrate from cached local storage for this user
    try {
      const cached = localStorage.getItem(userStorageKey);
      if (cached) {
        setWatchProgressMap(JSON.parse(cached));
      } else {
        setWatchProgressMap({});
      }
    } catch {
      setWatchProgressMap({});
    }

    // 2. Fetch cloud-synced progress from Firebase via /api/user/progress
    fetch('/api/user/progress')
      .then((res) => {
        if (!res.ok) throw new Error('Not logged in');
        return res.json();
      })
      .then((data) => {
        if (data.progress && typeof data.progress === 'object') {
          setWatchProgressMap((prev) => {
            const merged = { ...prev, ...data.progress };
            try {
              localStorage.setItem(userStorageKey, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});
  }, [currentUser?.username]);

  // Update Watch Progress (User-scoped & cloud synced)
  const updateWatchProgress = useCallback(
    (
      movie: Movie,
      currentTime: number,
      duration: number,
      episodeTitle?: string,
      episodeEmbed?: string,
      episodeM3u8?: string
    ) => {
      if (!movie) return;
      const key = movie.slug || movie.id;
      const movieSecs = movie.durationMinutes ? movie.durationMinutes * 60 : 45 * 60;
      const validDuration = duration > 0 && duration !== 45 * 60 ? duration : movieSecs;
      const percent = Math.min(100, Math.max(1, Math.round((currentTime / validDuration) * 100)));
      const rawTitle = episodeTitle || movie.currentEpisode || 'Tập 1';
      const epTitle = formatEpisodeTitle(rawTitle);
      const epMatch = epTitle.match(/\d+/);
      const epNumStr = epMatch ? epMatch[0] : epTitle;
      const epNumPadded = epMatch ? epMatch[0].padStart(2, '0') : epTitle;

      // Resolve m3u8 if not passed
      let resolvedM3u8 = episodeM3u8 || null;
      if (!resolvedM3u8 && movie.episodesServers) {
        for (const srv of movie.episodesServers) {
          const match = srv.items?.find(
            (ep) =>
              (episodeEmbed && ep.embed === episodeEmbed) ||
              formatEpisodeTitle(ep.name) === epTitle ||
              ep.name === epTitle
          );
          if (match?.m3u8) {
            resolvedM3u8 = match.m3u8;
            break;
          }
        }
      }
      if (!resolvedM3u8) {
        resolvedM3u8 = movie.m3u8Url || null;
      }

      const activeUser = currentUserRef.current;
      const userStorageKey = activeUser?.username
        ? `netflix_watch_progress_${activeUser.username}`
        : 'netflix_watch_progress_guest';

      setWatchProgressMap((prev) => {
        const existing = prev[key];
        const existingEpisodes = existing?.episodesProgress || {};

        const epData: EpisodeProgress = {
          currentTime: Math.round(currentTime),
          duration: Math.round(validDuration),
          progressPercent: percent,
          updatedAt: Date.now(),
          isCompleted: percent >= 90,
          embedUrl: episodeEmbed || existing?.episodeEmbed || movie.embedUrl,
          m3u8Url: resolvedM3u8 || existing?.episodeM3u8 || movie.m3u8Url,
        };

        const updatedEpisodes: Record<string, EpisodeProgress> = {
          ...existingEpisodes,
          [epTitle]: epData,
          [rawTitle]: epData,
          [epNumStr]: epData,
          [epNumPadded]: epData,
          [`Tập ${epNumStr}`]: epData,
          [`Tập ${epNumPadded}`]: epData,
        };

        const progressItem: WatchProgress = {
          movieId: movie.id,
          movieSlug: movie.slug,
          movie,
          episodeTitle: epTitle,
          episodeEmbed: episodeEmbed || existing?.episodeEmbed || movie.embedUrl,
          episodeM3u8: resolvedM3u8 || existing?.episodeM3u8 || movie.m3u8Url,
          currentTime: Math.round(currentTime),
          duration: Math.round(validDuration),
          progressPercent: percent,
          updatedAt: Date.now(),
          episodesProgress: updatedEpisodes,
        };

        const next: Record<string, WatchProgress> = {
          ...prev,
          [key]: progressItem,
        };

        try {
          localStorage.setItem(userStorageKey, JSON.stringify(next));
        } catch {
          // ignore
        }

        // Sync to cloud Firebase in background
        if (activeUser?.username) {
          fetch('/api/user/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, progress: progressItem }),
          }).catch(() => {});
        }

        return next;
      });
    },
    []
  );

  const watchProgressMapRef = useRef<Record<string, WatchProgress>>({});
  useEffect(() => {
    watchProgressMapRef.current = watchProgressMap;
  }, [watchProgressMap]);

  const getWatchProgress = useCallback((slugOrId: string) => {
    return watchProgressMapRef.current[slugOrId];
  }, []);

  const getEpisodeProgress = useCallback(
    (slugOrId: string, episodeNameOrNumber: string): EpisodeProgress | undefined => {
      const wp = watchProgressMapRef.current[slugOrId];
      if (!wp) return undefined;

      const normKey = episodeNameOrNumber.toString().trim();
      const formattedTitle = formatEpisodeTitle(normKey);
      const match = normKey.match(/\d+/);
      const num = match ? parseInt(match[0], 10) : null;
      const numStr = match ? match[0] : null;
      const numPadded = match ? match[0].padStart(2, '0') : null;

      // 1. Direct match in episodesProgress
      if (wp.episodesProgress) {
        if (wp.episodesProgress[formattedTitle]) return wp.episodesProgress[formattedTitle];
        if (wp.episodesProgress[normKey]) return wp.episodesProgress[normKey];
        if (numStr && wp.episodesProgress[numStr]) return wp.episodesProgress[numStr];
        if (numPadded && wp.episodesProgress[numPadded]) return wp.episodesProgress[numPadded];
        if (numStr && wp.episodesProgress[`Tập ${numStr}`]) return wp.episodesProgress[`Tập ${numStr}`];
        if (numPadded && wp.episodesProgress[`Tập ${numPadded}`]) return wp.episodesProgress[`Tập ${numPadded}`];
      }

      // 2. Match against current in-progress episode
      if (wp.episodeTitle) {
        const wpTitleFormatted = formatEpisodeTitle(wp.episodeTitle);
        if (wpTitleFormatted === formattedTitle) {
          return {
            currentTime: wp.currentTime,
            duration: wp.duration,
            progressPercent: wp.progressPercent,
            updatedAt: wp.updatedAt,
            isCompleted: wp.progressPercent >= 90,
            embedUrl: wp.episodeEmbed,
            m3u8Url: wp.episodeM3u8,
          };
        }

        const wpMatch = wp.episodeTitle.match(/\d+/);
        const wpNum = wpMatch ? parseInt(wpMatch[0], 10) : null;

        if (num !== null && wpNum !== null) {
          if (num === wpNum) {
            return {
              currentTime: wp.currentTime,
              duration: wp.duration,
              progressPercent: wp.progressPercent,
              updatedAt: wp.updatedAt,
              isCompleted: wp.progressPercent >= 90,
              embedUrl: wp.episodeEmbed,
              m3u8Url: wp.episodeM3u8,
            };
          } else if (num < wpNum) {
            // Previous episode already completed
            return {
              currentTime: wp.duration,
              duration: wp.duration,
              progressPercent: 100,
              updatedAt: wp.updatedAt,
              isCompleted: true,
            };
          }
        }
      }

      return undefined;
    },
    []
  );

  const clearWatchProgress = useCallback((slugOrId: string) => {
    const activeUser = currentUserRef.current;
    const userStorageKey = activeUser?.username
      ? `netflix_watch_progress_${activeUser.username}`
      : 'netflix_watch_progress_guest';

    setWatchProgressMap((prev) => {
      const copy = { ...prev };
      delete copy[slugOrId];
      try {
        localStorage.setItem(userStorageKey, JSON.stringify(copy));
      } catch {
        // ignore
      }
      return copy;
    });

    if (activeUser?.username) {
      fetch('/api/user/progress', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: slugOrId }),
      }).catch(() => {});
    }
  }, []);

  // Derive continueWatchingList
  const continueWatchingList = Object.values(watchProgressMap)
    .filter((wp) => wp && wp.movie && (wp.progressPercent || 0) < 95)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map((wp) => ({
      ...wp.movie,
      progress: wp.progressPercent,
      currentEpisode: wp.episodeTitle ? formatEpisodeTitle(wp.episodeTitle) : (wp.movie?.currentEpisode ? formatEpisodeTitle(wp.movie.currentEpisode) : undefined),
      embedUrl: wp.episodeEmbed || wp.movie?.embedUrl,
      m3u8Url: wp.episodeM3u8 || wp.movie?.m3u8Url,
    }));

  // Hover Popout Coordination State & Timers
  const hoveredMovieRef = useRef<Movie | null>(null);
  hoveredMovieRef.current = hoveredMovie;

  const hoverOpenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTimeRef = useRef<number>(0);

  const clearHoverTimers = useCallback(() => {
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  const closeHoverPopoutNow = useCallback(() => {
    clearHoverTimers();
    setHoveredMovie(null);
    setHoverRect(null);
    setIsCardTrailerPlaying(false);
  }, [clearHoverTimers]);

  const onCardHover = useCallback((movie: Movie, rect: DOMRect) => {
    // 1. If user was actively scrolling or wheeling in the last 250ms, ignore hover triggers
    if (Date.now() - lastScrollTimeRef.current < 250) {
      return;
    }

    // 2. Immediately cancel any scheduled close timer
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }

    // 3. Clear any pending open timer
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }

    const currentActive = hoveredMovieRef.current;

    // If already showing this exact movie, nothing to do
    if (currentActive && currentActive.id === movie.id) {
      return;
    }

    // Record starting scroll position to verify user hasn't scrolled away when timer fires
    const startScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    const startScrollX = typeof window !== 'undefined' ? window.scrollX : 0;

    // Smooth deliberate hover delay (300ms when switching between cards; 420ms for initial hover)
    // Prevents jitter and rapid unmount/mount thrashing when moving mouse across grid cards
    const delay = currentActive ? 300 : 420;

    hoverOpenTimerRef.current = setTimeout(() => {
      // Abort if user scrolled or moved while waiting for delay
      const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
      const currentScrollX = typeof window !== 'undefined' ? window.scrollX : 0;
      const hasScrolled =
        Math.abs(currentScrollY - startScrollY) > 5 ||
        Math.abs(currentScrollX - startScrollX) > 5 ||
        Date.now() - lastScrollTimeRef.current < 200;

      if (hasScrolled) {
        hoverOpenTimerRef.current = null;
        return;
      }

      setHoveredMovie(movie);
      setHoverRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      hoverOpenTimerRef.current = null;
    }, delay);
  }, []);

  const onCardLeave = useCallback(() => {
    // Cancel open timer if user moved away before delay elapsed
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }

    // If a card is currently popped out, give a grace period (280ms)
    // so moving into the popout itself or into an adjacent card will cancel this close
    if (hoveredMovieRef.current) {
      if (hoverCloseTimerRef.current) {
        clearTimeout(hoverCloseTimerRef.current);
      }
      hoverCloseTimerRef.current = setTimeout(() => {
        setHoveredMovie(null);
        setHoverRect(null);
        hoverCloseTimerRef.current = null;
      }, 280);
    }
  }, []);

  const onPopoutEnter = useCallback(() => {
    // Mouse entered popout: cancel scheduled close
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  const onPopoutLeave = useCallback(() => {
    // Mouse left popout: schedule close after 280ms grace period
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
    }
    hoverCloseTimerRef.current = setTimeout(() => {
      setHoveredMovie(null);
      setHoverRect(null);
      hoverCloseTimerRef.current = null;
    }, 280);
  }, []);

  // Any scroll/wheel/resize immediately kills pending open timers and dismisses active popouts
  useEffect(() => {
    const handleScrollOrResize = () => {
      lastScrollTimeRef.current = Date.now();

      // Immediately cancel any pending open timer so a scrolled-away card never pops up
      if (hoverOpenTimerRef.current) {
        clearTimeout(hoverOpenTimerRef.current);
        hoverOpenTimerRef.current = null;
      }

      // Immediately close any open popout card
      if (hoveredMovieRef.current) {
        closeHoverPopoutNow();
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('wheel', handleScrollOrResize, { passive: true });
    window.addEventListener('touchmove', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('wheel', handleScrollOrResize);
      window.removeEventListener('touchmove', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      clearHoverTimers();
    };
  }, [closeHoverPopoutNow, clearHoverTimers]);

  const setTrailerVolume = useCallback((val: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(val)));
    setTrailerVolumeState(clamped);
    if (clamped === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
    try {
      const user = currentUserRef.current?.username;
      const storageKey = user ? `netflix_trailer_volume_${user}` : 'netflix_trailer_volume_guest';
      localStorage.setItem(storageKey, String(clamped));
      localStorage.setItem('netflix_trailer_volume', String(clamped));
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        const user = currentUserRef.current?.username;
        const storageKey = user ? `netflix_muted_${user}` : 'netflix_muted_guest';
        localStorage.setItem(storageKey, String(next));
        localStorage.setItem('netflix_muted_pref', String(next));
      } catch {}
      // If unmuting when volume was 0, restore to default 60%
      if (!next && trailerVolumeRef.current === 0) {
        setTrailerVolume(60);
      }
      return next;
    });
  }, [setTrailerVolume]);

  return (
    <NetflixContext.Provider
      value={{
        currentUser,
        isCreateUserModalOpen,
        openCreateUserModal,
        closeCreateUserModal,
        loginUser,
        logoutUser,
        // Streaming Proxy
        streamProxyUrl,
        isStreamProxyEnabled,
        setStreamProxyUrl,
        setIsStreamProxyEnabled,
        isProxySettingsOpen,
        openProxySettings,
        closeProxySettings,
        selectedMovie,
        playingMovie,
        currentEpisodeEmbed,
        currentEpisodeTitle,
        currentEpisodeM3u8,
        myList,
        searchQuery,
        isMuted,
        trailerVolume,
        setTrailerVolume,
        isLoadingDetail,
        watchProgressMap,
        continueWatchingList,
        updateWatchProgress,
        getWatchProgress,
        getEpisodeProgress,
        clearWatchProgress,
        hoveredMovie,
        hoverRect,
        isCardTrailerPlaying,
        setIsCardTrailerPlaying,
        onCardHover,
        onCardLeave,
        onPopoutEnter,
        onPopoutLeave,
        closeHoverPopoutNow,
        showHoverPopout: onCardHover,
        hideHoverPopout: closeHoverPopoutNow,
        openModal,
        closeModal,
        startPlaying,
        stopPlaying,
        setPlayingEpisode,
        toggleMyList,
        isInMyList,
        toggleMute,
        setSearchQuery,
      }}
    >
      {children}
    </NetflixContext.Provider>
  );
};

export const useNetflix = () => {
  const context = useContext(NetflixContext);
  if (!context) {
    throw new Error('useNetflix must be used within a NetflixProvider');
  }
  return context;
};
