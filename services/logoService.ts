const TMDB_API_KEY =
  process.env.TMDB_API_KEY || '58dba4066f4f36e49e5e769304442088';

export interface TMDBLogoItem {
  aspect_ratio: number;
  height: number;
  width: number;
  iso_639_1: string | null;
  file_path: string;
  vote_average?: number;
  vote_count?: number;
}

export interface TMDBSearchCandidate {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
}

// In-memory server-side cache for instant resolution
interface CacheEntry {
  url: string | null;
  timestamp: number;
}
const logoCache = new Map<string, CacheEntry>();

// Shared client-side in-memory logo cache across all components (Hero, Cards, Modals)
export const clientLogoCache = new Map<string, string>();

/**
 * Detect Vietnamese diacritics in a text string
 */
function hasVietnameseChars(str: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(str);
}

/**
 * Normalize text for accent-insensitive matching
 */
function normalizeText(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim();
}

/**
 * Thoroughly clean movie title for high-confidence TMDB search matching.
 * Preserves essential colons and hyphens (e.g. "Cyberpunk: Edgerunners", "Spider-Man").
 * Removes episodic/season/year/dubbing metadata (e.g. "(Phần 1)", "(Season 2)", "(2024)", "(Vietsub)").
 */
export function cleanMovieTitleForSearch(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\s*[\(\[\{](?:phần|mùa|season|tập|thuyết minh|lồng tiếng|vietsub|bản đặc biệt|chiếu rạp|\d{4})[^\)\]\}]*[\)\]\}]/gi, '')
    .replace(/\s*\(\s*\d+\s*\)\s*$/g, '')
    .replace(/\s*[-–—]\s*(?:phần|mùa|season)\s*\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format TMDB logo URL: SVG as original vector, PNG as crisp w500
 */
export function formatTmdbLogoUrl(filePath: string): string {
  if (!filePath) return '';
  if (filePath.endsWith('.svg')) {
    return `https://image.tmdb.org/t/p/original${filePath}`;
  }
  return `https://image.tmdb.org/t/p/w500${filePath}`;
}

/**
 * Strict priority selection for movie title logo:
 * 1. Tiếng Việt ('vi')
 * 2. Tiếng Anh ('en')
 * 3. Ngôn ngữ trung tính / Không lời (null hoặc "")
 * 4. Bất kỳ ngôn ngữ khả dụng nào của phim (ja, ko, zh, fr, v.v.)
 */
export function selectBestLogo(logos: TMDBLogoItem[]): string | null {
  if (!logos || logos.length === 0) return null;

  const valid = logos.filter((l) => Boolean(l.file_path));
  if (valid.length === 0) return null;

  const sortByQuality = (items: TMDBLogoItem[]) => {
    return [...items].sort((a, b) => {
      const scoreA = (a.vote_count || 0) * (a.vote_average || 1);
      const scoreB = (b.vote_count || 0) * (b.vote_average || 1);
      if (scoreB !== scoreA) return scoreB - scoreA;
      // Prefer horizontal aspect ratio for banner display
      if (b.aspect_ratio !== a.aspect_ratio) return b.aspect_ratio - a.aspect_ratio;
      return (b.width || 0) - (a.width || 0);
    });
  };

  // Priority 1: Vietnamese
  const viLogos = valid.filter((l) => l.iso_639_1 === 'vi');
  if (viLogos.length > 0) {
    const best = sortByQuality(viLogos)[0];
    return formatTmdbLogoUrl(best.file_path);
  }

  // Priority 2: English
  const enLogos = valid.filter((l) => l.iso_639_1 === 'en');
  if (enLogos.length > 0) {
    const best = sortByQuality(enLogos)[0];
    return formatTmdbLogoUrl(best.file_path);
  }

  // Priority 3: Neutral / language-agnostic
  const neutralLogos = valid.filter((l) => !l.iso_639_1);
  if (neutralLogos.length > 0) {
    const best = sortByQuality(neutralLogos)[0];
    return formatTmdbLogoUrl(best.file_path);
  }

  // Priority 4: Any available language for this movie
  const bestAny = sortByQuality(valid)[0];
  return formatTmdbLogoUrl(bestAny.file_path);
}

/**
 * Direct fetch logos for a known TMDB item ID
 */
async function fetchLogosForTMDBItem(
  id: number,
  mediaType: 'movie' | 'tv' = 'movie'
): Promise<string | null> {
  try {
    const url = `https://api.themoviedb.org/3/${mediaType}/${id}/images?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url, {
      next: { revalidate: 86400 },
    });

    if (res.ok) {
      const data = await res.json();
      const logo = selectBestLogo(data.logos || []);
      if (logo) return logo;
    }

    // If 404 or empty logos, attempt alternative media type
    const altType = mediaType === 'movie' ? 'tv' : 'movie';
    const altRes = await fetch(
      `https://api.themoviedb.org/3/${altType}/${id}/images?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 86400 } }
    );
    if (altRes.ok) {
      const altData = await altRes.json();
      const altLogo = selectBestLogo(altData.logos || []);
      if (altLogo) return altLogo;
    }

    return null;
  } catch (err) {
    console.warn(`Error fetching logos for TMDB ${mediaType} ${id}:`, err);
    return null;
  }
}

/**
 * Score candidate items from TMDB multi search
 */
function scoreCandidate(
  item: TMDBSearchCandidate,
  cleanSearch: string,
  targetYear?: number
): number {
  let score = 0;
  const itemTitle = normalizeText(cleanMovieTitleForSearch(item.title || item.name || ''));
  const origTitle = normalizeText(cleanMovieTitleForSearch(item.original_title || item.original_name || ''));
  const clean = normalizeText(cleanSearch);

  if (!clean) return 0;

  // Title match
  if (itemTitle === clean || origTitle === clean) {
    score += 100;
  } else if (itemTitle.startsWith(clean) || clean.startsWith(itemTitle)) {
    score += 60;
  } else if (origTitle.startsWith(clean) || clean.startsWith(origTitle)) {
    score += 55;
  } else if (itemTitle.includes(clean) || clean.includes(itemTitle)) {
    score += 35;
  }

  // Year match
  const relDate = item.release_date || item.first_air_date || '';
  const itemYear = parseInt(relDate.slice(0, 4), 10);
  if (targetYear && itemYear) {
    if (itemYear === targetYear) {
      score += 40;
    } else if (Math.abs(itemYear - targetYear) <= 1) {
      score += 20;
    } else if (Math.abs(itemYear - targetYear) >= 3) {
      score -= 80; // Heavily penalize different movie releases with the same title
    }
  }

  // Popularity boost
  if (item.popularity && item.popularity > 0) {
    score += Math.min(20, Math.log10(item.popularity + 1) * 4);
  }

  return score;
}

/**
 * Search TMDB and extract logo
 */
async function searchTMDBLogo(
  query: string,
  targetYear?: number
): Promise<{ logoUrl: string | null; tmdbId?: number } | null> {
  const clean = cleanMovieTitleForSearch(query);
  if (!clean || clean.length < 2) return null;

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
      clean
    )}&include_adult=false`;

    const res = await fetch(searchUrl, {
      next: { revalidate: 86400 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const items: TMDBSearchCandidate[] = data.results || [];

    const scoredCandidates = items
      .filter((it) => it.media_type === 'movie' || it.media_type === 'tv')
      .map((it) => ({
        item: it,
        score: scoreCandidate(it, clean, targetYear),
      }))
      .filter((cand) => cand.score >= 25)
      .sort((a, b) => b.score - a.score);

    if (scoredCandidates.length === 0) return null;

    // Try top 2 candidates if first candidate has no logo
    for (const cand of scoredCandidates.slice(0, 2)) {
      const mediaType = cand.item.media_type === 'tv' ? 'tv' : 'movie';
      const logoUrl = await fetchLogosForTMDBItem(cand.item.id, mediaType);
      if (logoUrl) {
        return {
          logoUrl,
          tmdbId: cand.item.id,
        };
      }
    }

    return null;
  } catch (err) {
    console.warn(`Error searching TMDB logo for "${query}":`, err);
    return null;
  }
}

export interface FetchLogoParams {
  tmdbId?: number | string;
  mediaType?: 'movie' | 'tv' | string;
  title?: string;
  subTitle?: string;
  slug?: string;
  year?: number;
}

/**
 * Universal helper to resolve the best Title Logo from TMDB with resilient caching
 */
export async function fetchTMDBLogo(params: FetchLogoParams): Promise<string | null> {
  const { tmdbId, mediaType, title, subTitle, slug, year } = params;

  const parsedTmdbId = tmdbId && !isNaN(Number(tmdbId)) && Number(tmdbId) > 0 ? Number(tmdbId) : undefined;
  const mediaTypeVal = mediaType === 'tv' ? 'tv' : 'movie';

  // Construct cache key - TMDB ID is globally unique and authoritative
  const cacheKey = parsedTmdbId
    ? `logo_id_${parsedTmdbId}_${mediaTypeVal}`
    : slug
    ? `logo_slug_${slug}`
    : `logo_q_${title || ''}_${subTitle || ''}_${year || ''}`;

  const cached = logoCache.get(cacheKey);
  const now = Date.now();
  if (cached) {
    // Permanent cache for successful logo, 30s cache for null
    if (cached.url) return cached.url;
    if (now - cached.timestamp < 30_000) return null;
  }

  let resolvedLogo: string | null = null;

  // 1. Direct TMDB ID lookup if provided
  if (parsedTmdbId) {
    resolvedLogo = await fetchLogosForTMDBItem(parsedTmdbId, mediaTypeVal);
  }

  // 2. Fallback search by subTitle / title
  if (!resolvedLogo) {
    // Collect search query candidates in optimal order
    const queriesToTry: string[] = [];

    // If subTitle exists (often the authentic English/original title e.g. "Cyberpunk: Edgerunners")
    if (subTitle && subTitle.trim()) {
      queriesToTry.push(cleanMovieTitleForSearch(subTitle));
      if (subTitle.includes('/')) {
        subTitle.split('/').forEach((p) => queriesToTry.push(cleanMovieTitleForSearch(p)));
      }
    }

    // Vietnamese or main title
    if (title && title.trim()) {
      queriesToTry.push(cleanMovieTitleForSearch(title));
      if (title.includes('/')) {
        title.split('/').forEach((p) => queriesToTry.push(cleanMovieTitleForSearch(p)));
      }
    }

    // Try each unique clean query
    const seenQueries = new Set<string>();
    for (const q of queriesToTry) {
      const cleanQ = q.trim();
      if (!cleanQ || seenQueries.has(cleanQ.toLowerCase())) continue;
      seenQueries.add(cleanQ.toLowerCase());

      const searchRes = await searchTMDBLogo(cleanQ, year);
      if (searchRes?.logoUrl) {
        resolvedLogo = searchRes.logoUrl;
        break;
      }
    }
  }

  // Update in-memory caches
  logoCache.set(cacheKey, { url: resolvedLogo, timestamp: now });
  if (slug) {
    logoCache.set(`logo_slug_${slug}`, { url: resolvedLogo, timestamp: now });
    if (resolvedLogo) {
      clientLogoCache.set(slug, resolvedLogo);
    }
  }
  if (parsedTmdbId) {
    logoCache.set(`logo_id_${parsedTmdbId}_${mediaTypeVal}`, { url: resolvedLogo, timestamp: now });
  }

  return resolvedLogo;
}
