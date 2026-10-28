'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Movie, EpisodeServer, WatchProgress, EpisodeProgress } from '@/types';
import { getMovieDetail, getMovieDetailByTmdb, formatEpisodeTitle } from '@/services/movieApi';
import { findNguonCMatch } from '@/services/trendingService';
import {
  getCanonicalMovieId,
  isSameMovie,
  deduplicateMovies,
  deduplicateWatchProgressMap,
  mergeMovieData,
  findNextEpisodeTarget,
  extractEpisodeNumber,
} from '@/lib/movieUtils';
import { crossMatchAndEnrichMovie } from '@/services/movieCrossMatchService';
import { clientLogoCache } from '@/services/logoService';
import {
  directGetUserWatchProgress,
  directSaveUserWatchProgress,
  directRemoveUserWatchProgress,
  directGetUserMyList,
  directSaveUserMyListItem,
  directRemoveUserMyListItem,
} from '@/lib/firebaseDirectClient';

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
    episodeM3u8?: string,
    syncToCloud?: boolean
  ) => void;
  getWatchProgress: (slugOrId: string, movieObj?: Movie) => WatchProgress | undefined;
  getEpisodeProgress: (slugOrId: string, episodeNameOrNumber: string, movieObj?: Movie) => EpisodeProgress | undefined;
  clearWatchProgress: (slugOrId: string) => void;
  reconcileWatchProgressWithMovies: (movies: Movie[]) => void;
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
  isInMyList: (id: string, movieObj?: Movie) => boolean;
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

  // User & Watch Progress references for callbacks
  const currentUserRef = useRef<AuthUser | null>(null);
  currentUserRef.current = currentUser;

  const watchProgressMapRef = useRef<Record<string, WatchProgress>>({});
  watchProgressMapRef.current = watchProgressMap;

  const getWatchProgress = useCallback(
    (slugOrId: string, movieObj?: Movie): WatchProgress | undefined => {
      const map = watchProgressMapRef.current;
      if (!slugOrId && !movieObj) return undefined;

      // 1. Direct match by slugOrId
      if (slugOrId && map[slugOrId]) {
        return map[slugOrId];
      }

      // 2. Canonical ID match if movieObj provided
      if (movieObj) {
        const canonicalKey = getCanonicalMovieId(movieObj);
        if (canonicalKey && map[canonicalKey]) {
          return map[canonicalKey];
        }
      }

      // 3. Search across all entries using isSameMovie or matching IDs
      const entries = Object.values(map);
      for (const wp of entries) {
        if (!wp) continue;
        if (
          (slugOrId && (wp.movieId === slugOrId || wp.movieSlug === slugOrId)) ||
          (movieObj && wp.movie && isSameMovie(wp.movie, movieObj))
        ) {
          return wp;
        }
        if (movieObj) {
          const fakeMovie: Partial<Movie> = {
            id: wp.movieId,
            slug: wp.movieSlug,
            title: wp.movie?.title,
            subTitle: wp.movie?.subTitle,
            tmdbId: wp.movie?.tmdbId,
            posterUrl: wp.movie?.posterUrl,
            backdropUrl: wp.movie?.backdropUrl,
          };
          if (isSameMovie(fakeMovie as Movie, movieObj)) {
            return wp;
          }
        }
      }

      return undefined;
    },
    []
  );

  const getEpisodeProgress = useCallback(
    (
      slugOrId: string,
      episodeNameOrNumber: string,
      movieObj?: Movie
    ): EpisodeProgress | undefined => {
      const wp = getWatchProgress(slugOrId, movieObj);
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
    [getWatchProgress]
  );

  // Hover Popout State
  const [hoveredMovie, setHoveredMovie] = useState<Movie | null>(null);
  const [hoverRect, setHoverRect] = useState<HoverRect | null>(null);
  const [isCardTrailerPlaying, setIsCardTrailerPlaying] = useState<boolean>(false);

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

  // Initialize & sync user-scoped My List from Firebase cloud (DATABASE IS AUTHORITY)
  useEffect(() => {
    if (!currentUser?.username) {
      setMyList([]);
      return;
    }

    const username = currentUser.username;
    const userStorageKey = `netflix_my_list_${username}`;

    // 1. Initial quick hydrate from cached local storage
    try {
      const cached = localStorage.getItem(userStorageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setMyList(deduplicateMovies(parsed));
      } else {
        setMyList([]);
      }
    } catch {
      setMyList([]);
    }

    // 2. Fetch cloud-synced My List directly from Firebase (Bypasses Vercel)
    directGetUserMyList(currentUser.username)
      .then((items) => {
        if (items && Array.isArray(items)) {
          // Deduplicate all cloud items using isSameMovie
          const deduplicated = deduplicateMovies(items);
          setMyList(deduplicated);

          try {
            localStorage.setItem(userStorageKey, JSON.stringify(deduplicated));
          } catch {}

          // If duplicates existed in Firebase, clean them up from Firebase database
          if (deduplicated.length < items.length) {
            for (const raw of items) {
              const isKept = deduplicated.some(
                (d) => d.id === raw.id || (d.slug && raw.slug && d.slug === raw.slug)
              );
              if (!isKept) {
                const k = raw.id || raw.slug;
                if (k) {
                  directRemoveUserMyListItem(currentUser.username, k);
                }
              }
            }
          }
        }
      })
      .catch(() => {});
  }, [currentUser?.username]);

  const openModal = useCallback(async (movie: Movie) => {
    if (!movie) return;
    closeHoverPopoutNow();

    // Immediately resolve logo from client cache if currently missing on object
    const canonicalId = getCanonicalMovieId(movie);
    const initialMovie: Movie = { ...movie };
    if (!initialMovie.logoUrl) {
      const cachedLogo =
        clientLogoCache.get(canonicalId) ||
        (movie.slug ? clientLogoCache.get(movie.slug) : null) ||
        (movie.id ? clientLogoCache.get(movie.id) : null) ||
        (movie.tmdbId ? clientLogoCache.get(`tmdb_${movie.tmdbId}`) : null) ||
        (movie.tmdb?.id ? clientLogoCache.get(`tmdb_${movie.tmdb.id}`) : null);
      if (cachedLogo) {
        initialMovie.logoUrl = cachedLogo;
      }
    }

    setSelectedMovie(initialMovie);

    let targetSlug = initialMovie.slug;
    const resolvedTmdbId = initialMovie.tmdb?.id || initialMovie.tmdbId;

    try {
      setIsLoadingDetail(true);

      // 1. Cross-reference bidirectionally between PhimAPI and TMDB:
      // Verifies title, release year, director matching, and cast members overlap.
      // Retrieves transparent HD logo, 4K backdrops/posters, official synopsis, cast & crew.
      const enrichPromise = (async () => {
        const enrichCacheKey = `netlix_enrich_${targetSlug || initialMovie.slug || initialMovie.id}`;
        try {
          const cachedEnrich = localStorage.getItem(enrichCacheKey);
          if (cachedEnrich) {
            const parsed = JSON.parse(cachedEnrich);
            if (parsed && typeof parsed === 'object') {
              return parsed as Movie;
            }
          }
        } catch {}

        try {
          const res = await fetch('/api/movie/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(initialMovie),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.movie) {
              try {
                localStorage.setItem(enrichCacheKey, JSON.stringify(data.movie));
              } catch {}
              return data.movie as Movie;
            }
          }
        } catch {}
        const enrichedLocal = await crossMatchAndEnrichMovie(initialMovie);
        try {
          localStorage.setItem(enrichCacheKey, JSON.stringify(enrichedLocal));
        } catch {}
        return enrichedLocal;
      })().catch((err) => {
        console.warn('Cross-match enrichment error:', err);
        return initialMovie;
      });

      // 2. Concurrently fetch PhimAPI detail for playable streaming servers / episodes
      const detailPromise = (async () => {
        let det: Movie | null = null;
        if (resolvedTmdbId) {
          try {
            det = await getMovieDetailByTmdb(
              resolvedTmdbId,
              initialMovie.type === 'series' ? 'tv' : 'movie'
            );
            if (det?.slug) targetSlug = det.slug;
          } catch {}
        }

        if (!det && targetSlug) {
          try {
            det = await getMovieDetail(targetSlug);
          } catch {}
        }

        if (!det && (!initialMovie.episodesServers || initialMovie.episodesServers.length === 0)) {
          try {
            const match = await findNguonCMatch(initialMovie.title, initialMovie.subTitle, {
              year: initialMovie.year,
              type: initialMovie.type,
              tmdbId: resolvedTmdbId,
            });
            if (match?.slug && match.slug !== targetSlug) {
              targetSlug = match.slug;
              det = await getMovieDetail(targetSlug);
            }
          } catch (err) {
            console.warn('Fallback movie lookup error:', err);
          }
        }
        return det;
      })();

      const [enriched, detailed] = await Promise.all([enrichPromise, detailPromise]);

      let finalMovie = detailed ? mergeMovieData(enriched, detailed) : enriched;
      if (targetSlug) {
        finalMovie.slug = targetSlug;
      }

      // Propagate logo everywhere in clientLogoCache and sessionStorage
      if (finalMovie.logoUrl) {
        clientLogoCache.set(canonicalId, finalMovie.logoUrl);
        if (finalMovie.slug) clientLogoCache.set(finalMovie.slug, finalMovie.logoUrl);
        if (finalMovie.id) clientLogoCache.set(finalMovie.id, finalMovie.logoUrl);
        if (initialMovie.slug) clientLogoCache.set(initialMovie.slug, finalMovie.logoUrl);
        if (initialMovie.id) clientLogoCache.set(initialMovie.id, finalMovie.logoUrl);
        if (resolvedTmdbId) clientLogoCache.set(`tmdb_${resolvedTmdbId}`, finalMovie.logoUrl);
        try {
          sessionStorage.setItem(`netlix_logo_v3_${finalMovie.slug || canonicalId}`, finalMovie.logoUrl);
          sessionStorage.setItem(`netlix_logo_v3_${canonicalId}`, finalMovie.logoUrl);
        } catch {}
      }

      setSelectedMovie((prev) => {
        if (!prev) return finalMovie;
        return mergeMovieData(finalMovie, prev);
      });
    } catch (err) {
      console.warn('Modal movie detail resolution error:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    closeHoverPopoutNow();
    setSelectedMovie(null);
  }, [closeHoverPopoutNow]);

  const startPlaying = useCallback(
    async (
      movie: Movie,
      episodeEmbedUrl?: string,
      episodeTitle?: string,
      episodeM3u8Url?: string
    ) => {
      if (!movie) return;

      const key = movie.slug || movie.id;
      const wp = getWatchProgress(key, movie);

      // 1. If an episode was explicitly passed OR previously watched, resume that episode
      let targetEmbed = episodeEmbedUrl || wp?.episodeEmbed || movie.embedUrl || null;
      let targetTitle = episodeTitle || wp?.episodeTitle || movie.currentEpisode || null;
      if (targetTitle) {
        targetTitle = formatEpisodeTitle(targetTitle);
      }

      // Explicitly resolved m3u8 for target episode
      let targetM3u8: string | null = episodeM3u8Url || null;

      // If targetM3u8 is not directly provided, search within movie.episodesServers or movie.seasonsList for targetTitle or targetEmbed
      if (!targetM3u8 && movie.episodesServers) {
        for (const srv of movie.episodesServers) {
          const found = srv.items?.find(
            (ep) =>
              (targetEmbed && ep.embed === targetEmbed) ||
              (targetTitle && formatEpisodeTitle(ep.name) === targetTitle) ||
              (targetTitle && ep.name === targetTitle)
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
              (targetEmbed && ep.embedUrl === targetEmbed) ||
              (targetTitle && formatEpisodeTitle(ep.title) === targetTitle) ||
              (targetTitle && ep.title === targetTitle)
          );
          if (found?.m3u8Url) {
            targetM3u8 = found.m3u8Url;
            break;
          }
        }
      }

      // If still no targetM3u8, check watch progress matching the episode
      if (!targetM3u8 && wp?.episodeM3u8) {
        if (!targetTitle || formatEpisodeTitle(wp.episodeTitle || '') === targetTitle) {
          targetM3u8 = wp.episodeM3u8;
        }
      }

      // ONLY fallback to movie.m3u8Url if it's a single movie or we are on Episode 1!
      const isMovieOrEp1 = movie.type === 'movie' || !targetTitle || targetTitle === 'Tập 1' || targetTitle === 'Tập 01';
      if (!targetM3u8 && isMovieOrEp1 && movie.m3u8Url) {
        targetM3u8 = movie.m3u8Url;
      }

      setPlayingMovie(movie);
      setCurrentEpisodeEmbed(targetEmbed);
      setCurrentEpisodeTitle(targetTitle);
      setCurrentEpisodeM3u8(targetM3u8);

      // Resolve slug dynamically if missing
      let activeSlug = movie.slug;
      const resolvedTmdbId = movie.tmdb?.id || movie.tmdbId;

      if (!targetEmbed && !activeSlug) {
        try {
          const match = await findNguonCMatch(movie.title, movie.subTitle, {
            year: movie.year,
            type: movie.type,
            tmdbId: resolvedTmdbId,
          });
          if (match?.slug) {
            activeSlug = match.slug;
          }
        } catch {}
      }

      // 2. If target episode is missing m3u8 or movie lacks full streaming servers, fetch detail from PhimAPI
      if ((!targetM3u8 || !movie.episodesServers?.length) && (activeSlug || resolvedTmdbId)) {
        try {
          setIsLoadingDetail(true);
          let detailed: Movie | null = null;

          if (resolvedTmdbId) {
            try {
              detailed = await getMovieDetailByTmdb(
                resolvedTmdbId,
                movie.type === 'series' ? 'tv' : 'movie'
              );
              if (detailed?.slug) activeSlug = detailed.slug;
            } catch {}
          }

          if (!detailed && activeSlug) {
            detailed = await getMovieDetail(activeSlug);
          }

          if (detailed) {
            setPlayingMovie((prev) => {
              if (!prev) return detailed;
              return mergeMovieData(prev, detailed);
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
            const resolvedM3u8 = resolvedEp?.m3u8 || targetM3u8 || (isMovieOrEp1 ? (firstEp?.m3u8 || detailed.m3u8Url) : null);
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

    if (m3u8Url && m3u8Url.trim()) {
      setCurrentEpisodeM3u8(m3u8Url.trim());
    } else {
      let foundM3u8: string | null = null;
      if (playingMovieRef.current?.episodesServers) {
        for (const srv of playingMovieRef.current.episodesServers) {
          const match = srv.items?.find(
            (ep) =>
              (embedUrl && ep.embed === embedUrl) ||
              (cleanedTitle && formatEpisodeTitle(ep.name) === cleanedTitle)
          );
          if (match?.m3u8) {
            foundM3u8 = match.m3u8;
            break;
          }
        }
      }
      // ONLY fallback to playingMovieRef.current.m3u8Url if Episode 1 or Movie!
      const isMovieOrEp1 =
        playingMovieRef.current?.type === 'movie' ||
        !cleanedTitle ||
        cleanedTitle === 'Tập 1' ||
        cleanedTitle === 'Tập 01';

      if (!foundM3u8 && isMovieOrEp1 && playingMovieRef.current?.m3u8Url) {
        foundM3u8 = playingMovieRef.current.m3u8Url;
      }
      setCurrentEpisodeM3u8(foundM3u8);
    }
  }, []);

  const toggleMyList = useCallback((movie: Movie) => {
    if (!movie) return;
    const movieKey = getCanonicalMovieId(movie);
    const rawKey = movie.slug || movie.id;
    const activeUser = currentUserRef.current;
    const userStorageKey = activeUser?.username
      ? `netflix_my_list_${activeUser.username}`
      : 'netflix_my_list_guest';

    setMyList((prev) => {
      const exists = prev.some((item) => isSameMovie(item, movie));
      let nextList: Movie[];
      if (exists) {
        // Collect all keys/slugs/ids matching this movie to remove from Firebase
        const matchedItems = prev.filter((item) => isSameMovie(item, movie));
        nextList = prev.filter((item) => !isSameMovie(item, movie));
        if (activeUser?.username) {
          const keysToDelete = new Set<string>();
          keysToDelete.add(movieKey);
          if (rawKey) keysToDelete.add(rawKey);
          if (movie.id) keysToDelete.add(movie.id);
          if (movie.slug) keysToDelete.add(movie.slug);
          matchedItems.forEach((it) => {
            if (it.id) keysToDelete.add(it.id);
            if (it.slug) keysToDelete.add(it.slug);
            const cKey = getCanonicalMovieId(it);
            if (cKey) keysToDelete.add(cKey);
          });
          keysToDelete.forEach((k) => {
            directRemoveUserMyListItem(activeUser.username, k);
          });
        }
      } else {
        const canonicalMovie: Movie = {
          ...movie,
          id: movie.id || movieKey,
        };
        nextList = deduplicateMovies([canonicalMovie, ...prev]);
        if (activeUser?.username) {
          directSaveUserMyListItem(activeUser.username, movieKey, canonicalMovie);
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
    (id: string, movieObj?: Movie) => {
      if (!id && !movieObj) return false;
      return myList.some((item) => {
        if (movieObj && isSameMovie(item, movieObj)) return true;
        if (id && (item.id === id || item.slug === id)) return true;
        if (id && getCanonicalMovieId(item) === id) return true;
        return false;
      });
    },
    [myList]
  );

  // Initialize & sync user-scoped watch progress from Firebase cloud (DATABASE IS AUTHORITY)
  useEffect(() => {
    if (!currentUser?.username) {
      setWatchProgressMap({});
      return;
    }

    const username = currentUser.username;
    const userStorageKey = `netflix_watch_progress_${username}`;

    // 1. Initial hydrate from local storage as placeholder only
    try {
      const cached = localStorage.getItem(userStorageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setWatchProgressMap(deduplicateWatchProgressMap(parsed));
      } else {
        setWatchProgressMap({});
      }
    } catch {
      setWatchProgressMap({});
    }

    // 2. Fetch cloud-synced progress directly from Firebase (Bypasses Vercel)
    directGetUserWatchProgress(username)
      .then((progress) => {
        if (progress && typeof progress === 'object') {
          // Cloud records are the authority!
          const cloudMap: Record<string, WatchProgress> = progress;
          const dedupedCloud = deduplicateWatchProgressMap(cloudMap);

          setWatchProgressMap((prev) => {
            // Database is the authority: cloud overwrites local unless local timestamp is strictly newer
            const merged: Record<string, WatchProgress> = { ...dedupedCloud };
            for (const [k, localWp] of Object.entries(prev)) {
              if (!localWp) continue;
              // Check if cloud already has this movie
              let matchedCloudKey: string | null = null;
              for (const [ck, cWp] of Object.entries(merged)) {
                if (cWp?.movie && localWp?.movie && isSameMovie(cWp.movie, localWp.movie)) {
                  matchedCloudKey = ck;
                  break;
                }
              }

              if (matchedCloudKey) {
                // If local is strictly newer by at least 15s (actively played seconds ago), keep local and sync to cloud
                const cloudWp = merged[matchedCloudKey];
                if ((localWp.updatedAt || 0) > (cloudWp.updatedAt || 0) + 15000) {
                  merged[matchedCloudKey] = localWp;
                  directSaveUserWatchProgress(username, matchedCloudKey, localWp);
                }
              }
            }

            const finalMap = deduplicateWatchProgressMap(merged);
            try {
              localStorage.setItem(userStorageKey, JSON.stringify(finalMap));
            } catch {}

            // Clean up old duplicate keys in Firebase if any were consolidated
            const cloudKeys = Object.keys(cloudMap);
            const finalKeys = new Set(Object.keys(finalMap));
            for (const ck of cloudKeys) {
              if (!finalKeys.has(ck)) {
                directRemoveUserWatchProgress(username, ck);
              }
            }

            return finalMap;
          });
        }
      })
      .catch(() => {});
  }, [currentUser?.username]);

  // Reconcile watch progress with fresh catalog movies (Zero-latency instant sync)
  const reconcileWatchProgressWithMovies = useCallback((freshMovies: Movie[]) => {
    if (!freshMovies || freshMovies.length === 0) return;

    setWatchProgressMap((prev) => {
      let hasChanges = false;
      const nextMap = { ...prev };

      for (const [key, wp] of Object.entries(prev)) {
        if (!wp?.movie) continue;
        const matchedFresh = freshMovies.find((m) => isSameMovie(m, wp.movie));
        if (matchedFresh) {
          const freshEpsCount = matchedFresh.episodesServers?.[0]?.items?.length || 0;
          const currentEpsCount = wp.movie.episodesServers?.[0]?.items?.length || 0;

          const freshEpNum = extractEpisodeNumber(matchedFresh.currentEpisode);
          const currentEpNum = extractEpisodeNumber(wp.movie.currentEpisode || wp.episodeTitle);

          const hasMoreEpisodes = freshEpsCount > currentEpsCount;
          const hasHigherCurrentEp = freshEpNum !== null && currentEpNum !== null && freshEpNum > currentEpNum;

          if (hasMoreEpisodes || hasHigherCurrentEp || matchedFresh.badges?.ribbon === 'TẬP MỚI') {
            const merged = mergeMovieData(wp.movie, matchedFresh);
            nextMap[key] = {
              ...wp,
              movie: merged,
            };
            hasChanges = true;
          }
        }
      }

      if (!hasChanges) return prev;

      const activeUser = currentUserRef.current;
      const userStorageKey = activeUser?.username
        ? `netflix_watch_progress_${activeUser.username}`
        : 'netflix_watch_progress_guest';
      try {
        localStorage.setItem(userStorageKey, JSON.stringify(nextMap));
      } catch {}

      return nextMap;
    });
  }, []);

  // Background series freshness checker: Detect new episodes for series whose last episode was completed
  useEffect(() => {
    const timer = setTimeout(() => {
      const entries = Object.entries(watchProgressMapRef.current);
      const seriesToRefresh = entries.filter(([_, wp]) => {
        if (!wp?.movie) return false;
        const isSeries = wp.movie.type === 'series' || Boolean(wp.movie.episodesServers?.length);
        const isCurrentCompleted = (wp.progressPercent || 0) >= 90;
        return isSeries && isCurrentCompleted;
      });

      if (seriesToRefresh.length === 0) return;

      seriesToRefresh.slice(0, 5).forEach(async ([key, wp]) => {
        const targetSlug = wp.movieSlug || wp.movie.slug || wp.movieId || wp.movie.id;
        if (!targetSlug) return;
        try {
          const freshDetail = await getMovieDetail(targetSlug);
          if (freshDetail && freshDetail.episodesServers && freshDetail.episodesServers.length > 0) {
            const freshEpsCount = freshDetail.episodesServers[0]?.items?.length || 0;
            const currentEpsCount = wp.movie.episodesServers?.[0]?.items?.length || 0;

            if (freshEpsCount > currentEpsCount) {
              setWatchProgressMap((prev) => {
                const current = prev[key];
                if (!current) return prev;
                const merged = mergeMovieData(current.movie, freshDetail);
                const next = {
                  ...prev,
                  [key]: {
                    ...current,
                    movie: merged,
                  },
                };
                const activeUser = currentUserRef.current;
                const userStorageKey = activeUser?.username
                  ? `netflix_watch_progress_${activeUser.username}`
                  : 'netflix_watch_progress_guest';
                try {
                  localStorage.setItem(userStorageKey, JSON.stringify(next));
                } catch {}
                return next;
              });
            }
          }
        } catch {}
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentUser?.username]);

  // Update Watch Progress (User-scoped & cloud synced with fixed canonical ID)
  // syncToCloud: false during active playback (saves to localStorage only, 0 Vercel compute)
  // syncToCloud: true on Pause, Exit, Episode Switch, Ended, or safety heartbeat (5m)
  const updateWatchProgress = useCallback(
    (
      movie: Movie,
      currentTime: number,
      duration: number,
      episodeTitle?: string,
      episodeEmbed?: string,
      episodeM3u8?: string,
      syncToCloud: boolean = false
    ) => {
      if (!movie) return;
      const canonicalKey = getCanonicalMovieId(movie);
      const rawKey = movie.slug || movie.id;
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
        // Find existing record: direct key, canonicalKey, or isSameMovie
        let existingKey: string | null = null;
        let existing: WatchProgress | undefined = prev[canonicalKey] || (rawKey ? prev[rawKey] : undefined);
        if (existing) {
          existingKey = prev[canonicalKey] ? canonicalKey : rawKey;
        } else {
          for (const [k, v] of Object.entries(prev)) {
            if (v?.movie && isSameMovie(v.movie, movie)) {
              existing = v;
              existingKey = k;
              break;
            }
          }
        }

        // Safety check: if incoming currentTime is <= 5 (e.g. initialization glitch)
        // but existing already has progress for this same episode, do not overwrite with 0!
        const existingEpisodes = existing?.episodesProgress || {};
        const prevEpData =
          existingEpisodes[epTitle] ||
          existingEpisodes[rawTitle] ||
          (epNumStr ? existingEpisodes[epNumStr] : undefined);

        let finalCurrentTime = Math.round(currentTime);
        let finalPercent = percent;

        if (finalCurrentTime <= 5 && prevEpData && prevEpData.currentTime > 5 && !prevEpData.isCompleted) {
          finalCurrentTime = prevEpData.currentTime;
          finalPercent = prevEpData.progressPercent;
        }

        const epData: EpisodeProgress = {
          currentTime: finalCurrentTime,
          duration: Math.round(validDuration),
          progressPercent: finalPercent,
          updatedAt: Date.now(),
          isCompleted: finalPercent >= 90,
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

        // Merge movie metadata so rich episode/stream data is retained
        const mergedMovie = existing?.movie ? mergeMovieData(existing.movie, movie) : movie;

        const progressItem: WatchProgress = {
          movieId: mergedMovie.id || canonicalKey,
          movieSlug: mergedMovie.slug || movie.slug,
          movie: mergedMovie,
          episodeTitle: epTitle,
          episodeEmbed: episodeEmbed || existing?.episodeEmbed || movie.embedUrl,
          episodeM3u8: resolvedM3u8 || existing?.episodeM3u8 || movie.m3u8Url,
          currentTime: finalCurrentTime,
          duration: Math.round(validDuration),
          progressPercent: finalPercent,
          updatedAt: Date.now(),
          episodesProgress: updatedEpisodes,
        };

        const next: Record<string, WatchProgress> = { ...prev };
        if (existingKey && existingKey !== canonicalKey) {
          delete next[existingKey];
          if (activeUser?.username && syncToCloud) {
            directRemoveUserWatchProgress(activeUser.username, existingKey);
          }
        }
        if (rawKey && rawKey !== canonicalKey && next[rawKey]) {
          delete next[rawKey];
        }

        next[canonicalKey] = progressItem;

        try {
          localStorage.setItem(userStorageKey, JSON.stringify(next));
        } catch {
          // ignore
        }

        // Sync directly to cloud Firebase (Bypasses Vercel Serverless Function completely)
        if (activeUser?.username && syncToCloud) {
          directSaveUserWatchProgress(activeUser.username, canonicalKey, progressItem);
        }

        return next;
      });
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
      const keysToDelete: string[] = [];
      for (const [k, v] of Object.entries(copy)) {
        if (k === slugOrId || v?.movieId === slugOrId || v?.movieSlug === slugOrId) {
          keysToDelete.push(k);
        } else if (v?.movie && (v.movie.id === slugOrId || v.movie.slug === slugOrId)) {
          keysToDelete.push(k);
        }
      }
      if (!keysToDelete.includes(slugOrId)) {
        keysToDelete.push(slugOrId);
      }
      keysToDelete.forEach((k) => delete copy[k]);

      try {
        localStorage.setItem(userStorageKey, JSON.stringify(copy));
      } catch {
        // ignore
      }

      if (activeUser?.username) {
        keysToDelete.forEach((k) => {
          directRemoveUserWatchProgress(activeUser.username, k);
        });
      }

      return copy;
    });
  }, []);

  // Derive continueWatchingList (Deduplicated, smart series transition, ordered by latest update)
  const continueWatchingList = useMemo(() => {
    const dedupedMap = deduplicateWatchProgressMap(watchProgressMap);
    const sortedEntries = Object.values(dedupedMap)
      .filter((wp): wp is WatchProgress => Boolean(wp && wp.movie))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const movies: Movie[] = [];

    for (const wp of sortedEntries) {
      const movie = wp.movie;
      const isSeries = movie.type === 'series' || Boolean(movie.episodesServers?.length || movie.seasonsList?.length);

      // Check if series has a next unwatched episode (e.g. Episode 5 when Episode 4 completed)
      const nextTarget = isSeries ? findNextEpisodeTarget(movie, wp) : null;

      if (nextTarget && nextTarget.isNewEpisode) {
        // Series has a newly available or unwatched next episode!
        movies.push({
          ...movie,
          progress: 0,
          currentEpisode: nextTarget.episodeTitle,
          embedUrl: nextTarget.embedUrl || movie.embedUrl,
          m3u8Url: nextTarget.m3u8Url || movie.m3u8Url,
          badges: {
            ...movie.badges,
            ribbon: 'TẬP MỚI',
            subBadge: nextTarget.episodeNumber ? `Tập ${nextTarget.episodeNumber}` : movie.badges?.subBadge,
          },
        });
      } else if ((wp.progressPercent || 0) < 90) {
        // Movie or series episode still currently in-progress
        movies.push({
          ...movie,
          progress: wp.progressPercent,
          currentEpisode: wp.episodeTitle
            ? formatEpisodeTitle(wp.episodeTitle)
            : movie.currentEpisode
            ? formatEpisodeTitle(movie.currentEpisode)
            : undefined,
          embedUrl: wp.episodeEmbed || movie.embedUrl,
          m3u8Url: wp.episodeM3u8 || movie.m3u8Url,
        });
      }
      // Otherwise: movie finished (>= 90%) or series caught up completely -> hidden from continue watching
    }

    return deduplicateMovies(movies);
  }, [watchProgressMap]);

  const onCardHover = useCallback((movie: Movie, rect: DOMRect) => {
    // 0. Disable hover popouts completely on mobile/touch screens
    if (typeof window !== 'undefined') {
      const isTouch =
        window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
        window.innerWidth < 1024 ||
        navigator.maxTouchPoints > 0;
      if (isTouch) {
        return;
      }
    }

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
        reconcileWatchProgressWithMovies,
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
