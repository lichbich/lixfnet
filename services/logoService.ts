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
 * In-memory luminance cache so each TMDB logo thumbnail is analyzed at most once
 */
const logoLuminanceCache = new Map<string, number>();

/**
 * Fast in-memory luminance calculation for a TMDB logo PNG thumbnail (w92, ~2-4KB).
 * Decompresses the PNG IDAT chunk with Node zlib and computes average luminance of visible pixels.
 * Returns luminance (0.0 = pitch black, 255.0 = pure white), or null if analysis fails.
 */
export async function getPngLuminance(filePath: string): Promise<number | null> {
  if (!filePath || filePath.endsWith('.svg')) return null;
  if (logoLuminanceCache.has(filePath)) {
    return logoLuminanceCache.get(filePath)!;
  }

  // Only run in server-side Node.js environment
  if (typeof window !== 'undefined') return null;

  try {
    const zlib = await import('zlib');
    const url = `https://image.tmdb.org/t/p/w92${filePath}`;
    const res = await fetch(url, { next: { revalidate: 604800 } });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 33 || buffer.readUInt32BE(0) !== 0x89504e47) {
      return null;
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const colorType = buffer.readUInt8(25);

    const idatChunks: Buffer[] = [];
    let offset = 8;
    while (offset < buffer.length) {
      const len = buffer.readUInt32BE(offset);
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      if (type === 'IDAT') {
        idatChunks.push(buffer.subarray(offset + 8, offset + 8 + len));
      } else if (type === 'IEND') {
        break;
      }
      offset += 12 + len;
    }

    if (idatChunks.length === 0) return null;
    const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
    const bytesPerPixel =
      colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
    const rowSize = 1 + width * bytesPerPixel;

    let totalLum = 0;
    let count = 0;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * rowSize;
      // Sample every 2nd pixel for instant processing
      for (let x = 0; x < width; x += 2) {
        const px = rowOffset + 1 + x * bytesPerPixel;
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 255;
        if (colorType === 6) {
          r = decompressed[px];
          g = decompressed[px + 1];
          b = decompressed[px + 2];
          a = decompressed[px + 3];
        } else if (colorType === 4) {
          r = g = b = decompressed[px];
          a = decompressed[px + 1];
        } else if (colorType === 2) {
          r = decompressed[px];
          g = decompressed[px + 1];
          b = decompressed[px + 2];
        } else if (colorType === 0) {
          r = g = b = decompressed[px];
        }

        if (a > 40) {
          totalLum += 0.299 * r + 0.587 * g + 0.114 * b;
          count++;
        }
      }
    }

    const lum = count > 0 ? totalLum / count : 0;
    logoLuminanceCache.set(filePath, lum);
    return lum;
  } catch {
    return null;
  }
}

/**
 * Strict priority selection for movie title logo:
 * 1. Tiếng Việt ('vi')
 * 2. Tiếng Anh ('en')
 * 3. Ngôn ngữ trung tính / Không lời (null hoặc "")
 * 4. Bất kỳ ngôn ngữ khả dụng nào của phim (ja, ko, zh, fr, v.v.)
 *
 * ANTI-BLACK LOGO ALGORITHM:
 * Analyzes the luminance of candidate logos. If a candidate is very dark (luminance < 80),
 * and a brighter candidate exists in the same priority group, the bright/white/colored logo
 * is chosen so it remains clearly legible on dark backdrops!
 */
export async function selectBestLogo(logos: TMDBLogoItem[]): Promise<string | null> {
  if (!logos || logos.length === 0) return null;

  const valid = logos.filter((l) => Boolean(l.file_path));
  if (valid.length === 0) return null;

  const pickBestFromGroup = async (items: TMDBLogoItem[]): Promise<TMDBLogoItem | null> => {
    if (items.length === 0) return null;
    if (items.length === 1) return items[0];

    // Measure luminance of the top 6 candidates in parallel
    const candidates = items.slice(0, 6);
    const withLum = await Promise.all(
      candidates.map(async (c) => {
        const lum = await getPngLuminance(c.file_path);
        return { item: c, lum: lum ?? 128 };
      })
    );

    // If there are bright options (lum >= 80), filter out dark ones (lum < 80)
    const brights = withLum.filter((c) => c.lum >= 80);
    const pool = brights.length > 0 ? brights : withLum;

    pool.sort((a, b) => {
      // 1. Prefer bright over dark
      const aIsBright = a.lum >= 80 ? 1 : 0;
      const bIsBright = b.lum >= 80 ? 1 : 0;
      if (bIsBright !== aIsBright) return bIsBright - aIsBright;

      // 2. Score (vote count * vote average)
      const scoreA = (a.item.vote_count || 0) * (a.item.vote_average || 1);
      const scoreB = (b.item.vote_count || 0) * (b.item.vote_average || 1);
      if (Math.abs(scoreB - scoreA) > 10) return scoreB - scoreA;

      // 3. Aspect ratio suitability (prefer horizontal banner 1.5 to 6.0)
      const arA = a.item.aspect_ratio || 1;
      const arB = b.item.aspect_ratio || 1;
      const arFitA = arA >= 1.5 && arA <= 6.0 ? 1 : 0;
      const arFitB = arB >= 1.5 && arB <= 6.0 ? 1 : 0;
      if (arFitB !== arFitA) return arFitB - arFitA;

      // 4. Resolution
      return (b.item.width || 0) - (a.item.width || 0);
    });

    return pool[0].item;
  };

  // Priority 1: Vietnamese
  const viLogos = valid.filter((l) => l.iso_639_1 === 'vi');
  if (viLogos.length > 0) {
    const best = await pickBestFromGroup(viLogos);
    if (best) return formatTmdbLogoUrl(best.file_path);
  }

  // Priority 2: English
  const enLogos = valid.filter((l) => l.iso_639_1 === 'en');
  if (enLogos.length > 0) {
    const best = await pickBestFromGroup(enLogos);
    if (best) return formatTmdbLogoUrl(best.file_path);
  }

  // Priority 3: Neutral / language-agnostic
  const neutralLogos = valid.filter((l) => !l.iso_639_1);
  if (neutralLogos.length > 0) {
    const best = await pickBestFromGroup(neutralLogos);
    if (best) return formatTmdbLogoUrl(best.file_path);
  }

  // Priority 4: Any available language for this movie
  const bestAny = await pickBestFromGroup(valid);
  return bestAny ? formatTmdbLogoUrl(bestAny.file_path) : null;
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
      const logo = await selectBestLogo(data.logos || []);
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
      const altLogo = await selectBestLogo(altData.logos || []);
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
