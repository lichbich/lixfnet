import { Movie } from '@/types';

/** Per-episode metadata pulled from TMDB (still image, title, synopsis, runtime) */
export interface TmdbEpisodeMeta {
  number: number;
  name: string | null;
  overview: string;
  still: string | null;
  runtime: number | null;
  airDate: string | null;
  vote: number | null;
}

const CACHE_PREFIX = 'netlix_tmdb_eps_v1_';
const memoryCache = new Map<string, Promise<TmdbEpisodeMeta[]>>();

/** Returns the TMDB TV id for a series, or null if the movie is not a TV show on TMDB */
export function resolveTmdbTvId(movie: Movie | null | undefined): string | null {
  if (!movie) return null;
  const rawId = movie.tmdb?.id ?? movie.tmdbId;
  if (rawId === undefined || rawId === null || rawId === '') return null;
  const tmdbType = movie.tmdb?.type;
  if (tmdbType && tmdbType !== 'tv') return null;
  if (!tmdbType && movie.type !== 'series') return null;
  const id = String(rawId).trim();
  return /^\d+$/.test(id) ? id : null;
}

/** Resolve season number: TMDB season field -> "Phần N" / "Season N" in slug/title -> 1 */
export function resolveTmdbSeason(movie: Movie | null | undefined): number {
  if (!movie) return 1;
  const s = Number(movie.tmdb?.season);
  if (Number.isFinite(s) && s > 0) return s;

  const sources = [movie.slug, movie.subTitle, movie.title].filter(Boolean) as string[];
  const patterns = [/phan-(\d+)/i, /season\s*(\d+)/i, /phần\s*(\d+)/i, /mùa\s*(\d+)/i];
  for (const src of sources) {
    for (const p of patterns) {
      const m = src.match(p);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > 0 && n < 100) return n;
      }
    }
  }
  return 1;
}

/** Extract numeric episode index from labels like "Tập 01", "01", "Tập 12 - END" */
export function extractEpisodeNumber(name: string | number | undefined | null): number | null {
  if (name === undefined || name === null) return null;
  const m = String(name).match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

/** 66 -> "1g 6ph", 57 -> "57ph" (Netflix VN style) */
export function formatRuntime(minutes: number | null | undefined): string | undefined {
  if (!minutes || minutes <= 0) return undefined;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}ph`;
  return m > 0 ? `${h}g ${m}ph` : `${h}g`;
}

/** "2026-10-23" -> "23 tháng 10" (adds year if not the current year) */
export function formatAirDate(date: string | null | undefined): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  const base = `${d.getDate()} tháng ${d.getMonth() + 1}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

export function isFutureDate(date: string | null | undefined): boolean {
  if (!date) return false;
  const d = new Date(`${date}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
}

export function tmdbStillUrl(path: string | null | undefined, size: 'w300' | 'w500' = 'w300'): string | undefined {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
}

/** Fetch TMDB episodes for a season with in-memory + sessionStorage caching */
export function fetchTmdbEpisodes(tvId: string, season: number): Promise<TmdbEpisodeMeta[]> {
  const key = `${tvId}_${season}`;
  const cached = memoryCache.get(key);
  if (cached) return cached;

  if (typeof window !== 'undefined') {
    try {
      const stored =
        localStorage.getItem(CACHE_PREFIX + key) ||
        sessionStorage.getItem(CACHE_PREFIX + key);
      if (stored) {
        const parsed = JSON.parse(stored) as TmdbEpisodeMeta[];
        const p = Promise.resolve(parsed);
        memoryCache.set(key, p);
        return p;
      }
    } catch {}
  }

  const promise = fetch(`/api/tmdb/episodes?id=${encodeURIComponent(tvId)}&season=${season}`)
    .then((res) => (res.ok ? res.json() : { episodes: [] }))
    .then((data) => {
      const list: TmdbEpisodeMeta[] = Array.isArray(data?.episodes) ? data.episodes : [];
      if (list.length > 0 && typeof window !== 'undefined') {
        try {
          localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(list));
          sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(list));
        } catch {}
      }
      return list;
    })
    .catch(() => {
      memoryCache.delete(key);
      return [] as TmdbEpisodeMeta[];
    });

  memoryCache.set(key, promise);
  return promise;
}
