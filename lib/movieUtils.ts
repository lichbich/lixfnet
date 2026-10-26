import { Movie, WatchProgress } from '@/types';

/**
 * Default fallback images for movies without cover or with broken 404 links.
 * Features an obsidian dark background, film grid texture and titanium gray LIXFNET ribbon logo.
 */
export const DEFAULT_BACKDROP_IMAGE = '/images/backdrop-placeholder.svg';
export const DEFAULT_POSTER_IMAGE = '/images/poster-placeholder.svg';

/**
 * Returns a guaranteed valid horizontal backdrop URL (16:9) or fallback placeholder
 */
export function getSafeBackdropUrl(url?: string | null): string {
  if (!url || typeof url !== 'string' || !url.trim()) return DEFAULT_BACKDROP_IMAGE;
  return url.trim();
}

/**
 * Returns a guaranteed valid vertical poster URL (2:3) or fallback placeholder
 */
export function getSafePosterUrl(url?: string | null): string {
  if (!url || typeof url !== 'string' || !url.trim()) return DEFAULT_POSTER_IMAGE;
  return url.trim();
}

/**
 * Strips Vietnamese diacritics, punctuation and normalizes spaces for reliable comparison.
 */
export function normalizeTitle(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts unique image filename hash from PhimAPI CDN image URLs
 * e.g. "https://phimimg.com/upload/vod/20240306-1/59357599cb51c05d7618991fe6217462.jpg" -> "59357599cb51c05d7618991fe6217462"
 */
export function extractImageHash(url?: string): string | null {
  if (!url || url.includes('unsplash') || url.includes('placeholder')) return null;
  const match = url.match(/([a-f0-9]{24,32})\.(?:jpg|png|webp|jpeg)/i);
  if (match) return match[1].toLowerCase();
  const filenameMatch = url.match(/\/([^\/?#]+\.(?:jpg|png|webp|jpeg))/i);
  return filenameMatch ? filenameMatch[1].toLowerCase() : null;
}

/**
 * Determines a canonical, stable ID for database indexing and deduplication.
 * Firebase keys cannot contain ".", "#", "$", "/", "[", or "]".
 */
export function getCanonicalMovieId(movie: Partial<Movie> | string | null | undefined): string {
  if (!movie) return 'unknown';
  if (typeof movie === 'string') {
    return movie.trim().toLowerCase().replace(/[\/\.\#\$\[\]]/g, '_');
  }

  // 1. PhimAPI MongoDB _id (24 hex characters)
  const rawId = (movie as any)._id || movie.id;
  if (rawId && /^[a-f0-9]{24}$/i.test(String(rawId))) {
    return String(rawId).toLowerCase();
  }

  // 2. TMDB ID if present
  const tmdbId = movie.tmdbId || movie.tmdb?.id;
  if (tmdbId && String(tmdbId).trim()) {
    return `tmdb_${String(tmdbId).trim()}`;
  }

  // 3. IMDb ID if present
  const imdbId = movie.imdb?.id;
  if (imdbId && String(imdbId).trim()) {
    return `imdb_${String(imdbId).trim()}`;
  }

  // 4. Stable API Slug
  if (movie.slug && movie.slug.trim()) {
    return movie.slug.trim().toLowerCase().replace(/[\/\.\#\$\[\]]/g, '_');
  }

  // 5. Fallback ID
  if (movie.id && movie.id.trim()) {
    return movie.id.trim().toLowerCase().replace(/[\/\.\#\$\[\]]/g, '_');
  }

  return 'unknown';
}

/**
 * Robust cross-comparison to determine whether two movie representations refer to the exact same film.
 * Works seamlessly across TMDB top lists, PhimAPI searches, and detail modals.
 */
export function isSameMovie(
  a?: Partial<Movie> | string | null,
  b?: Partial<Movie> | string | null
): boolean {
  if (!a || !b) return false;
  if (a === b) return true;

  // Handle string vs string
  if (typeof a === 'string' && typeof b === 'string') {
    const cleanA = a.trim().toLowerCase();
    const cleanB = b.trim().toLowerCase();
    if (cleanA === cleanB) return true;
    const normA = normalizeTitle(cleanA);
    const normB = normalizeTitle(cleanB);
    return Boolean(normA && normB && (normA === normB || normA.replace(/\s+/g, '-') === normB.replace(/\s+/g, '-')));
  }

  // Normalize to objects
  const objA: Partial<Movie> = typeof a === 'string' ? { id: a, slug: a, title: a } : a;
  const objB: Partial<Movie> = typeof b === 'string' ? { id: b, slug: b, title: b } : b;

  // 1. Direct ID & _id match
  const aId = (objA as any)._id || objA.id;
  const bId = (objB as any)._id || objB.id;
  if (aId && bId && String(aId).toLowerCase() === String(bId).toLowerCase()) {
    // Avoid false positives on generic fallback IDs like "unknown"
    if (aId !== 'unknown' && !String(aId).startsWith('movie-0.')) return true;
  }

  // 2. TMDB ID match
  const aTmdb = objA.tmdbId || objA.tmdb?.id;
  const bTmdb = objB.tmdbId || objB.tmdb?.id;
  if (aTmdb && bTmdb && String(aTmdb) === String(bTmdb)) return true;

  // 3. IMDb ID match
  const aImdb = objA.imdb?.id;
  const bImdb = objB.imdb?.id;
  if (aImdb && bImdb && String(aImdb).toLowerCase() === String(bImdb).toLowerCase()) return true;

  // 4. Slug match
  if (objA.slug && objB.slug) {
    const sA = objA.slug.trim().toLowerCase();
    const sB = objB.slug.trim().toLowerCase();
    if (sA === sB) return true;
  }

  // 5. Unique CDN Image Hash Match (PhimAPI CDN upload files)
  const aPosterHash = extractImageHash(objA.posterUrl) || extractImageHash(objA.backdropUrl);
  const bPosterHash = extractImageHash(objB.posterUrl) || extractImageHash(objB.backdropUrl);
  if (aPosterHash && bPosterHash && aPosterHash === bPosterHash) {
    return true;
  }

  // 6. Title similarity matching
  const titleA = normalizeTitle(objA.title);
  const titleB = normalizeTitle(objB.title);
  if (titleA && titleB) {
    if (titleA === titleB) return true;

    // e.g. "tung buoc ben nhau" vs "tung buoc ben nhau tien si yeu dau"
    if (titleA.length >= 8 && titleB.length >= 8) {
      if (titleA.startsWith(titleB) || titleB.startsWith(titleA)) {
        if (!objA.year || !objB.year || Math.abs(objA.year - objB.year) <= 1) {
          return true;
        }
      }
    }
  }

  // 7. Subtitle / Original title match
  const subA = normalizeTitle(objA.subTitle);
  const subB = normalizeTitle(objB.subTitle);
  if (subA && subB && subA.length >= 6 && subB.length >= 6) {
    if (subA === subB) return true;
  }

  return false;
}

function isRealImage(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (!clean) return false;
  if (clean.includes('unsplash.com') || clean.includes('placeholder')) return false;
  return clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('/');
}

/**
 * Strips all raw HTML tags (e.g. <p>, </p>, <br>, <span>, <div>, etc.)
 * and unescapes common HTML entities from movie descriptions.
 */
export function cleanMovieDescription(str?: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<br\s*[\/]?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRealDescription(desc?: string): boolean {
  if (!desc || typeof desc !== 'string') return false;
  const clean = cleanMovieDescription(desc);
  if (clean.length < 15) return false;
  if (clean.includes('Không có mô tả chi tiết') || clean.includes('Đang cập nhật')) return false;
  return true;
}

function isRealDirector(dir?: string): boolean {
  if (!dir || typeof dir !== 'string') return false;
  const clean = dir.trim();
  if (!clean || clean.toLowerCase().includes('đang cập nhật') || clean.toLowerCase().includes('updating')) return false;
  return true;
}

/**
 * Cleanly merges two Movie objects representing the same movie, keeping the richest data.
 * Guarantees zero loss of logos, TMDB backdrops, posters, synopses, directors, and actors.
 */
export function mergeMovieData(a: Movie, b: Movie): Movie {
  if (!a && !b) return {} as Movie;
  if (!a) return b;
  if (!b) return a;

  const aHasStreams = Boolean(a.episodesServers?.length || a.m3u8Url);
  const bHasStreams = Boolean(b.episodesServers?.length || b.m3u8Url);

  // 1. Poster & Backdrop: ALWAYS prioritize real images (TMDB / PhimAPI) over Unsplash fallbacks
  let backdropUrl = a.backdropUrl;
  if (!isRealImage(backdropUrl)) {
    backdropUrl = b.backdropUrl;
  } else if (isRealImage(b.backdropUrl) && b.backdropUrl?.includes('image.tmdb.org') && !backdropUrl?.includes('image.tmdb.org')) {
    backdropUrl = b.backdropUrl;
  }

  let posterUrl = a.posterUrl;
  if (!isRealImage(posterUrl)) {
    posterUrl = b.posterUrl;
  } else if (isRealImage(b.posterUrl) && b.posterUrl?.includes('image.tmdb.org') && !posterUrl?.includes('image.tmdb.org')) {
    posterUrl = b.posterUrl;
  }

  // 2. Logo URL: NEVER lose a logo if either object has it!
  const logoUrl = a.logoUrl || b.logoUrl;

  // 3. Description: Pick the authentic, richer overview (prioritize Vietnamese over foreign text)
  const hasVietnamese = (str?: string) => Boolean(str && /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(str));
  let description = cleanMovieDescription(a.description);
  const bClean = cleanMovieDescription(b.description);
  const aReal = isRealDescription(description);
  const bReal = isRealDescription(bClean);
  const aVi = hasVietnamese(description);
  const bVi = hasVietnamese(bClean);

  if (!aReal) {
    description = bClean || description;
  } else if (bReal) {
    if (bVi && !aVi) {
      description = bClean;
    } else if (aVi && !bVi) {
      // Keep Vietnamese description
    } else if (bClean.length > description.length + 30) {
      description = bClean;
    }
  }

  // 4. Title & Subtitle: Keep full Vietnamese and original name
  const title = a.title || b.title;
  let subTitle = a.subTitle || b.subTitle;
  if (!subTitle && b.subTitle) subTitle = b.subTitle;

  // 5. Director
  let director = isRealDirector(a.director) ? a.director : (isRealDirector(b.director) ? b.director : (a.director || b.director));

  // 6. Cast: Union of unique actors
  const castSet = new Set<string>();
  (a.cast || []).forEach((c) => { if (c && c.trim() && !c.toLowerCase().includes('đang cập nhật')) castSet.add(c.trim()); });
  (b.cast || []).forEach((c) => { if (c && c.trim() && !c.toLowerCase().includes('đang cập nhật')) castSet.add(c.trim()); });
  const cast = castSet.size > 0 ? Array.from(castSet) : (a.cast || b.cast);

  // 7. Genres: Merge unique valid genres, filter 'Phim hot'
  const genreSet = new Set<string>();
  const addGenre = (g?: string) => {
    if (!g) return;
    const cleanG = g.trim();
    if (!cleanG || cleanG.toLowerCase() === 'phim hot' || cleanG.toLowerCase() === 'xem ngay') return;
    genreSet.add(cleanG);
  };
  (a.genres || []).forEach(addGenre);
  (b.genres || []).forEach(addGenre);
  const genres = genreSet.size > 0 ? Array.from(genreSet) : (a.genres || b.genres || ['Phim']);

  // 8. Streaming servers & video: STRICTLY prioritize direct m3u8 streams (PhimAPI) over empty or embed-only streams
  const countM3u8Episodes = (movie: Movie) => {
    let count = 0;
    if (movie.episodesServers) {
      for (const s of movie.episodesServers) {
        for (const item of s.items || []) {
          if (item.m3u8 && item.m3u8.trim().length > 0) count++;
        }
      }
    }
    if (movie.seasonsList) {
      for (const s of movie.seasonsList) {
        for (const ep of s.episodes || []) {
          if (ep.m3u8Url && ep.m3u8Url.trim().length > 0) count++;
        }
      }
    }
    return count;
  };

  const aM3u8Count = countM3u8Episodes(a);
  const bM3u8Count = countM3u8Episodes(b);
  const prioritizeBStreams = bM3u8Count > aM3u8Count || (!aHasStreams && bHasStreams);

  const episodesServers = prioritizeBStreams
    ? (b.episodesServers || a.episodesServers)
    : (a.episodesServers || b.episodesServers);

  const seasonsList = prioritizeBStreams
    ? ((b.seasonsList && b.seasonsList.length > 0) ? b.seasonsList : a.seasonsList)
    : ((a.seasonsList && a.seasonsList.length > 0) ? a.seasonsList : b.seasonsList);

  const m3u8Url = prioritizeBStreams
    ? (b.m3u8Url || a.m3u8Url)
    : (a.m3u8Url || b.m3u8Url);

  const embedUrl = prioritizeBStreams
    ? (b.embedUrl || a.embedUrl)
    : (a.embedUrl || b.embedUrl);

  const currentEpisode = (prioritizeBStreams && b.currentEpisode) ? b.currentEpisode : (a.currentEpisode || b.currentEpisode);

  // 9. IDs & Identifiers (prioritize slug matching playable stream)
  const fixedId = (a as any)._id || (b as any)._id || a.id || b.id;
  const fixed_id = (a as any)._id || (b as any)._id;
  const slug = (prioritizeBStreams && b.slug && bM3u8Count > 0) ? b.slug : (a.slug || b.slug);

  // 10. TMDB & IMDb data
  const tmdb = a.tmdb || b.tmdb;
  const tmdbId = a.tmdbId || b.tmdbId || tmdb?.id;
  const imdb = a.imdb || b.imdb;

  // 11. Additional properties
  const country = a.country || b.country;
  const countrySlug = a.countrySlug || b.countrySlug;
  const year = a.year || b.year;
  const rating = a.rating || b.rating || 'T16';
  const duration = a.duration || b.duration;
  const durationMinutes = a.durationMinutes || b.durationMinutes;
  const quality = a.quality || b.quality || 'HD';
  const audioTags = (a.audioTags && a.audioTags.length > 0) ? a.audioTags : b.audioTags;
  const badges = {
    ...b.badges,
    ...a.badges,
    platform: a.badges?.platform || b.badges?.platform,
    platformName: a.badges?.platformName || b.badges?.platformName,
    isTop10: a.badges?.isTop10 ?? b.badges?.isTop10,
    ribbon: a.badges?.ribbon || b.badges?.ribbon,
    subBadge: a.badges?.subBadge || b.badges?.subBadge,
  };
  const trailerUrl = a.trailerUrl || b.trailerUrl;
  const trailerYoutubeKey = a.trailerYoutubeKey || b.trailerYoutubeKey;

  return {
    ...b,
    ...a,
    id: fixedId,
    _id: fixed_id,
    slug,
    title,
    subTitle,
    backdropUrl,
    posterUrl,
    logoUrl,
    description,
    director,
    cast,
    genres,
    country,
    countrySlug,
    year,
    rating,
    duration,
    durationMinutes,
    quality,
    audioTags,
    badges,
    tmdb,
    tmdbId,
    imdb,
    episodesServers,
    m3u8Url,
    embedUrl,
    seasonsList,
    currentEpisode,
    trailerUrl,
    trailerYoutubeKey,
  };
}

/**
 * Deduplicates an array of movies using isSameMovie.
 */
export function deduplicateMovies(movies: Movie[]): Movie[] {
  if (!Array.isArray(movies) || movies.length <= 1) return movies || [];

  const result: Movie[] = [];
  for (const m of movies) {
    if (!m) continue;
    const existingIndex = result.findIndex((item) => isSameMovie(item, m));
    if (existingIndex >= 0) {
      result[existingIndex] = mergeMovieData(result[existingIndex], m);
    } else {
      result.push(m);
    }
  }
  return result;
}

/**
 * Deduplicates a WatchProgress dictionary, merging duplicate progress items for the same movie.
 * Keeps the most recently watched timestamp and combines episode progress maps.
 */
export function deduplicateWatchProgressMap(
  progressMap: Record<string, WatchProgress>
): Record<string, WatchProgress> {
  if (!progressMap || typeof progressMap !== 'object') return {};

  const entries = Object.entries(progressMap);
  const canonicalMap: Record<string, WatchProgress> = {};

  for (const [_key, wp] of entries) {
    if (!wp || !wp.movie) continue;
    const canonicalKey = getCanonicalMovieId(wp.movie);

    // Look for existing item matching the same movie
    let targetKey = canonicalKey;
    const existingKey = Object.keys(canonicalMap).find((k) =>
      isSameMovie(canonicalMap[k].movie, wp.movie)
    );

    if (existingKey) {
      targetKey = existingKey;
      const existing = canonicalMap[existingKey];
      // Merge: prefer higher updatedAt for latest position
      const isNewer = (wp.updatedAt || 0) >= (existing.updatedAt || 0);
      const latest = isNewer ? wp : existing;
      const older = isNewer ? existing : wp;

      canonicalMap[targetKey] = {
        ...latest,
        movieId: latest.movieId || older.movieId || targetKey,
        movieSlug: latest.movieSlug || older.movieSlug,
        movie: mergeMovieData(latest.movie, older.movie),
        episodesProgress: {
          ...(older.episodesProgress || {}),
          ...(latest.episodesProgress || {}),
        },
      };
    } else {
      canonicalMap[targetKey] = {
        ...wp,
        movieId: wp.movieId || targetKey,
      };
    }
  }

  return canonicalMap;
}

/**
 * Cleanly format episode title, preventing duplicated 'Tập' prefixes (e.g. 'Tập Tập 04' -> 'Tập 04', '04' -> 'Tập 04', 'Full' -> 'Bản Full')
 */
export function formatEpisodeTitle(title?: string): string {
  if (!title || !title.trim()) return 'Tập 1';
  const clean = title.trim();
  const stripped = clean.replace(/^(tập\s*)+/i, '').trim();
  if (!stripped) return 'Tập 1';
  if (/^full$/i.test(stripped)) return 'Bản Full';
  return `Tập ${stripped}`;
}

/**
 * Extract numeric episode index from labels like "Tập 01", "01", "Tập 12 - END", "Tập 4"
 */
export function extractEpisodeNumber(name: string | number | undefined | null): number | null {
  if (name === undefined || name === null) return null;
  const m = String(name).match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

export interface NextEpisodeTarget {
  episodeTitle: string;
  episodeNumber: number | null;
  embedUrl?: string;
  m3u8Url?: string;
  isNewEpisode: boolean;
}

/**
 * For series movies, determines if there is a next unwatched episode when the user
 * has completed the previous episode and a new episode is available.
 */
export function findNextEpisodeTarget(
  movie: Movie,
  wp: WatchProgress
): NextEpisodeTarget | null {
  if (!movie || !wp) return null;

  // 1. Collect all playable episode items from episodesServers or seasonsList
  let items: { name: string; slug?: string; embed?: string; m3u8?: string }[] = [];
  if (movie.episodesServers && movie.episodesServers.length > 0) {
    const serverWithM3u8 = movie.episodesServers.find((s) =>
      s.items?.some((it) => it.m3u8 && it.m3u8.trim().length > 0)
    );
    const server = serverWithM3u8 || movie.episodesServers[0];
    items = server?.items || [];
  } else if (movie.seasonsList && movie.seasonsList.length > 0) {
    for (const season of movie.seasonsList) {
      for (const ep of season.episodes || []) {
        items.push({
          name: ep.title || (typeof ep.number === 'number' ? `Tập ${ep.number}` : String(ep.number)),
          slug: ep.slug || `tap-${ep.number}`,
          embed: ep.embedUrl || '',
          m3u8: ep.m3u8Url || '',
        });
      }
    }
  }

  if (items.length === 0) return null;

  const episodesProgress = wp.episodesProgress || {};

  // Helper: check if a specific item is considered watched/completed
  const isItemCompleted = (item: { name: string }, idx: number): boolean => {
    const epNum = extractEpisodeNumber(item.name) ?? (idx + 1);
    const epTitle = formatEpisodeTitle(item.name);
    const rawName = item.name.trim();
    const epPadded = epNum !== null ? String(epNum).padStart(2, '0') : null;

    // Check against individual episode progress history
    const candidates = [
      epTitle,
      rawName,
      epNum !== null ? String(epNum) : null,
      epPadded,
      epNum !== null ? `Tập ${epNum}` : null,
      epPadded !== null ? `Tập ${epPadded}` : null,
    ].filter(Boolean) as string[];

    for (const c of candidates) {
      const prog = episodesProgress[c];
      if (prog) {
        if (prog.isCompleted || (prog.progressPercent || 0) >= 90) return true;
      }
    }

    // Check against current top-level watched episode in wp
    if (wp.episodeTitle) {
      const wpNum = extractEpisodeNumber(wp.episodeTitle);
      const wpTitle = formatEpisodeTitle(wp.episodeTitle);
      const wpCompleted = (wp.progressPercent || 0) >= 90;

      if (wpNum !== null && epNum !== null) {
        if (epNum < wpNum) return true; // Prior episodes completed
        if (epNum === wpNum && wpCompleted) return true; // Current episode completed
      } else if (wpTitle === epTitle && wpCompleted) {
        return true;
      }
    }

    return false;
  };

  const currentEpCompleted = (wp.progressPercent || 0) >= 90;

  // Find the first unwatched episode index
  let firstUnwatchedIdx = -1;
  for (let i = 0; i < items.length; i++) {
    if (!isItemCompleted(items[i], i)) {
      firstUnwatchedIdx = i;
      break;
    }
  }

  // If all episodes in items are completed, the user has watched everything available
  if (firstUnwatchedIdx === -1) {
    return null;
  }

  // If user completed their last watched episode and there is a next episode available
  if (currentEpCompleted && firstUnwatchedIdx > 0) {
    const nextItem = items[firstUnwatchedIdx];
    const nextNum = extractEpisodeNumber(nextItem.name) ?? (firstUnwatchedIdx + 1);
    return {
      episodeTitle: formatEpisodeTitle(nextItem.name),
      episodeNumber: nextNum,
      embedUrl: nextItem.embed || undefined,
      m3u8Url: nextItem.m3u8 || undefined,
      isNewEpisode: true,
    };
  }

  return null;
}

