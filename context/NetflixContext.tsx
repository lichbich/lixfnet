'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Movie, EpisodeServer, WatchProgress, EpisodeProgress } from '@/types';
import { getMovieDetail } from '@/services/movieApi';

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
  myList: Movie[];
  searchQuery: string;
  isMuted: boolean;
  isLoadingDetail: boolean;
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
    episodeEmbed?: string
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
  startPlaying: (movie: Movie, episodeEmbedUrl?: string, episodeTitle?: string) => void;
  stopPlaying: () => void;
  setPlayingEpisode: (embedUrl: string, title?: string) => void;
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
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Auth & Account Management State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState<boolean>(false);

  // Sync user-specific mute preference when user logs in or switches
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

  // Initialize My List from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('netflix_my_list');
      if (saved) {
        setMyList(JSON.parse(saved));
      } else {
        setMyList([]);
      }
    } catch {
      setMyList([]);
    }
  }, []);

  const openModal = useCallback(async (movie: Movie) => {
    setSelectedMovie(movie);

    // If the movie has a slug, fetch full API detail to get real episodes and streaming servers
    if (movie.slug) {
      try {
        setIsLoadingDetail(true);
        const detailed = await getMovieDetail(movie.slug);
        if (detailed) {
          setSelectedMovie((prev) => {
            if (!prev) return prev;
            if (prev.slug === movie.slug) {
              return {
                ...prev,
                ...detailed,
                logoUrl: prev.logoUrl || detailed.logoUrl,
                // keep previous custom badges or progress if any
                badges: prev.badges || detailed.badges,
                progress: prev.progress,
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Failed to load movie detail:', err);
      } finally {
        setIsLoadingDetail(false);
      }
    }
  }, []);

  const closeModal = useCallback(() => {
    setSelectedMovie(null);
  }, []);

  const startPlaying = useCallback(
    async (movie: Movie, episodeEmbedUrl?: string, episodeTitle?: string) => {
      if (!movie) return;

      const key = movie.slug || movie.id;
      const wp = watchProgressMapRef.current[key];

      // 1. If an episode was explicitly passed OR previously watched, resume that episode
      let targetEmbed = episodeEmbedUrl || wp?.episodeEmbed || movie.embedUrl || null;
      let targetTitle = episodeTitle || wp?.episodeTitle || movie.currentEpisode || null;

      setPlayingMovie(movie);
      setCurrentEpisodeEmbed(targetEmbed);
      setCurrentEpisodeTitle(targetTitle);

      // 2. If movie has not been watched yet (or missing embed) and has slug:
      // Fetch full detail to start from Episode 1 (Tập 1)
      if (!targetEmbed && movie.slug) {
        try {
          setIsLoadingDetail(true);
          const detailed = await getMovieDetail(movie.slug);
          if (detailed) {
            setPlayingMovie((prev) => {
              if (!prev) return detailed;
              if (prev.slug === movie.slug || prev.id === movie.id) {
                return { ...prev, ...detailed };
              }
              return prev;
            });

            const firstServer = detailed.episodesServers?.[0];
            const firstEp = firstServer?.items?.[0];
            const resolvedEmbed = firstEp?.embed || detailed.embedUrl || null;
            const resolvedTitle = firstEp
              ? `Tập ${firstEp.name}`
              : (detailed.currentEpisode || 'Tập 1');

            setCurrentEpisodeEmbed(resolvedEmbed);
            if (!targetTitle) {
              setCurrentEpisodeTitle(resolvedTitle);
            }
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
  }, []);

  const setPlayingEpisode = useCallback((embedUrl: string, title?: string) => {
    setCurrentEpisodeEmbed(embedUrl);
    if (title) setCurrentEpisodeTitle(title);
  }, []);

  const toggleMyList = useCallback((movie: Movie) => {
    setMyList((prev) => {
      const exists = prev.some((item) => item.id === movie.id || (item.slug && item.slug === movie.slug));
      let nextList: Movie[];
      if (exists) {
        nextList = prev.filter((item) => item.id !== movie.id && item.slug !== movie.slug);
      } else {
        nextList = [movie, ...prev];
      }
      try {
        localStorage.setItem('netflix_my_list', JSON.stringify(nextList));
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
      episodeEmbed?: string
    ) => {
      if (!movie) return;
      const key = movie.slug || movie.id;
      const movieSecs = movie.durationMinutes ? movie.durationMinutes * 60 : 45 * 60;
      const validDuration = duration > 0 && duration !== 45 * 60 ? duration : movieSecs;
      const percent = Math.min(100, Math.max(1, Math.round((currentTime / validDuration) * 100)));
      const epTitle = episodeTitle || movie.currentEpisode || 'Tập 1';
      const epMatch = epTitle.match(/\d+/);
      const epNumStr = epMatch ? epMatch[0] : epTitle;

      const activeUser = currentUserRef.current;
      const userStorageKey = activeUser?.username
        ? `netflix_watch_progress_${activeUser.username}`
        : 'netflix_watch_progress_guest';

      setWatchProgressMap((prev) => {
        const existing = prev[key];
        const existingEpisodes = existing?.episodesProgress || {};

        const updatedEpisodes: Record<string, EpisodeProgress> = {
          ...existingEpisodes,
          [epTitle]: {
            currentTime: Math.round(currentTime),
            duration: Math.round(validDuration),
            progressPercent: percent,
            updatedAt: Date.now(),
            isCompleted: percent >= 90,
          },
          [epNumStr]: {
            currentTime: Math.round(currentTime),
            duration: Math.round(validDuration),
            progressPercent: percent,
            updatedAt: Date.now(),
            isCompleted: percent >= 90,
          },
        };

        const progressItem: WatchProgress = {
          movieId: movie.id,
          movieSlug: movie.slug,
          movie,
          episodeTitle: epTitle,
          episodeEmbed: episodeEmbed || movie.embedUrl,
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
      const match = normKey.match(/\d+/);
      const num = match ? parseInt(match[0], 10) : null;

      // 1. Direct match in episodesProgress
      if (wp.episodesProgress) {
        if (wp.episodesProgress[normKey]) return wp.episodesProgress[normKey];
        if (num !== null && wp.episodesProgress[num.toString()]) return wp.episodesProgress[num.toString()];
        if (wp.episodesProgress[`Tập ${normKey}`]) return wp.episodesProgress[`Tập ${normKey}`];
      }

      // 2. Match against current in-progress episode
      if (wp.episodeTitle) {
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
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((wp) => ({
      ...wp.movie,
      progress: wp.progressPercent,
      currentEpisode: wp.episodeTitle || wp.movie.currentEpisode,
      embedUrl: wp.episodeEmbed || wp.movie.embedUrl,
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

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        const user = currentUserRef.current?.username;
        const storageKey = user ? `netflix_muted_${user}` : 'netflix_muted_guest';
        localStorage.setItem(storageKey, String(next));
        localStorage.setItem('netflix_muted_pref', String(next));
      } catch {}
      return next;
    });
  }, []);

  return (
    <NetflixContext.Provider
      value={{
        currentUser,
        isCreateUserModalOpen,
        openCreateUserModal,
        closeCreateUserModal,
        loginUser,
        logoutUser,
        selectedMovie,
        playingMovie,
        currentEpisodeEmbed,
        currentEpisodeTitle,
        myList,
        searchQuery,
        isMuted,
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
