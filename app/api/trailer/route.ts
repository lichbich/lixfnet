import { NextRequest, NextResponse } from 'next/server';
import { fetchTMDBLogo } from '@/services/logoService';

const TMDB_API_KEY =
  process.env.TMDB_API_KEY || '58dba4066f4f36e49e5e769304442088';

// Server-side in-memory cache to prevent redundant TMDB API calls
interface CachedTrailer {
  youtubeKey: string | null;
  backupKeys: string[];
  tmdbId?: number;
  source: string;
  logoUrl?: string | null;
}

const trailerCache = new Map<string, CachedTrailer>();

interface TMDBVideo {
  key: string;
  site: string;
  type: string;
  name: string;
  official?: boolean;
  published_at?: string;
  size?: number; // 2160, 1080, 720, 480, 360
}

interface TMDBSearchItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  original_language?: string;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
}

/**
 * Clean multi-title strings (e.g. "Chitose... / Ramune Bottle..." or "Doctor-X: Surgeon...")
 */
function cleanQueryTerm(raw: string): string {
  if (!raw) return '';
  const parts = raw.split(/[/|:]/).map((p) => p.trim()).filter(Boolean);
  return parts[0] || raw.trim();
}

/**
 * Detect Vietnamese diacritics in a text string
 */
function hasVietnameseChars(str: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(str);
}

/**
 * Fetch YouTube trailers directly from TMDB for a specific item ID
 */
async function fetchVideosForTMDBItem(
  id: number,
  mediaType: 'movie' | 'tv' = 'movie'
): Promise<{ key: string; backups: string[] } | null> {
  try {
    const videosUrl = `https://api.themoviedb.org/3/${mediaType}/${id}/videos?api_key=${TMDB_API_KEY}`;
    const res = await fetch(videosUrl, {
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      if (res.status === 404) {
        const altType = mediaType === 'movie' ? 'tv' : 'movie';
        const altRes = await fetch(
          `https://api.themoviedb.org/3/${altType}/${id}/videos?api_key=${TMDB_API_KEY}`,
          { next: { revalidate: 86400 } }
        );
        if (altRes.ok) {
          const altData = await altRes.json();
          return extractTrailers(altData.results || []);
        }
      }
      return null;
    }

    const data = await res.json();
    return extractTrailers(data.results || []);
  } catch (err) {
    console.warn(`Error fetching videos for TMDB ${mediaType} ${id}:`, err);
    return null;
  }
}

/**
 * Extract and sort YouTube trailers from TMDB raw videos array,
 * strictly prioritizing Full HD 1080p, 4K UHD, and Official Studio Trailers.
 */
function extractTrailers(rawVideos: TMDBVideo[]): { key: string; backups: string[] } | null {
  const ytVideos = rawVideos.filter((v) => v.site === 'YouTube' && v.key);
  if (ytVideos.length === 0) return null;

  // Quality scoring algorithm:
  // - Resolution: 2160 (4K) & 1080 (Full HD) get highest priority (+120), 720p (+60), 480p (+15)
  // - Official studio releases get +60 boost
  // - True "Trailer" gets +50, "Teaser" gets +25, "Clip" gets +5
  // - Title keywords ("1080p", "4K", "Official", "Main Trailer") get additional boosts
  // - Published date adds minor tiebreaker
  const scoreVideo = (v: TMDBVideo) => {
    let score = 0;
    const size = typeof v.size === 'number' ? v.size : 0;
    if (size >= 1080) {
      score += 120; // 1080p Full HD / 2160p 4K UHD
    } else if (size >= 720) {
      score += 60;  // 720p HD
    } else if (size >= 480) {
      score += 15;
    }

    if (v.official) score += 60;

    if (v.type === 'Trailer') score += 50;
    else if (v.type === 'Teaser') score += 25;
    else score += 5;

    const lowerName = (v.name || '').toLowerCase();
    if (lowerName.includes('official') || lowerName.includes('chính thức')) score += 30;
    if (lowerName.includes('1080') || lowerName.includes('4k') || lowerName.includes('uhd') || lowerName.includes('full hd')) score += 25;
    if (lowerName.includes('main trailer') || lowerName.includes('trailer 1')) score += 15;

    if (v.published_at) {
      const ts = new Date(v.published_at).getTime();
      if (!isNaN(ts)) {
        score += Math.min(10, (ts / 1e12) * 5);
      }
    }

    return score;
  };

  const sorted = [...ytVideos].sort((a, b) => scoreVideo(b) - scoreVideo(a));
  const allKeys = sorted.map((v) => v.key);
  if (allKeys.length === 0) return null;

  return {
    key: allKeys[0],
    backups: allKeys.slice(1),
  };
}

/**
 * Score candidate items from TMDB search
 */
function scoreCandidate(
  item: TMDBSearchItem,
  cleanSearch: string,
  targetYear?: number
): number {
  let score = 0;
  const itemTitle = (item.title || item.name || '').toLowerCase().trim();
  const origTitle = (item.original_title || item.original_name || '').toLowerCase().trim();
  const clean = cleanSearch.toLowerCase().trim();

  // Title match
  if (itemTitle === clean || origTitle === clean) {
    score += 80;
  } else if (itemTitle.startsWith(clean) || clean.startsWith(itemTitle)) {
    score += 50;
  } else if (itemTitle.includes(clean) || clean.includes(itemTitle)) {
    score += 30;
  }

  // Year match
  const relDate = item.release_date || item.first_air_date || '';
  const itemYear = parseInt(relDate.slice(0, 4), 10);
  if (targetYear && itemYear) {
    if (itemYear === targetYear) {
      score += 40;
    } else if (Math.abs(itemYear - targetYear) <= 1) {
      score += 20;
    }
  }

  // Popularity boost
  if (item.popularity && item.popularity > 0) {
    score += Math.min(15, Math.log10(item.popularity + 1) * 3);
  }

  return score;
}

/**
 * Search TMDB by text query
 */
async function searchTMDBTrailer(
  query: string,
  targetYear?: number
): Promise<{ key: string; backups: string[]; tmdbId: number } | null> {
  const clean = cleanQueryTerm(query);
  if (!clean) return null;

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
      clean
    )}&include_adult=false`;

    const res = await fetch(searchUrl, {
      next: { revalidate: 86400 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const items: TMDBSearchItem[] = data.results || [];

    const scoredCandidates = items
      .filter((it) => it.media_type === 'movie' || it.media_type === 'tv')
      .map((it) => ({
        item: it,
        score: scoreCandidate(it, clean, targetYear),
      }))
      .filter((cand) => cand.score >= 25)
      .sort((a, b) => b.score - a.score);

    if (scoredCandidates.length === 0) return null;

    // Check top candidate first
    const topCandidate = scoredCandidates[0];
    const topMediaType = topCandidate.item.media_type === 'tv' ? 'tv' : 'movie';
    const topVideos = await fetchVideosForTMDBItem(topCandidate.item.id, topMediaType);

    if (topVideos && topVideos.key) {
      return {
        key: topVideos.key,
        backups: topVideos.backups,
        tmdbId: topCandidate.item.id,
      };
    }

    // If top candidate is a strong match (e.g. score >= 50 like "Thỏ Ơi!!" -> "Bunny!!") but has 0 videos,
    // that means this movie simply has no trailer yet. Do NOT match unrelated candidates!
    if (topCandidate.score >= 50) {
      return null;
    }

    // Otherwise check candidates 2 and 3
    for (const { item } of scoredCandidates.slice(1, 3)) {
      const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
      const videoResult = await fetchVideosForTMDBItem(item.id, mediaType);

      if (videoResult && videoResult.key) {
        return {
          key: videoResult.key,
          backups: videoResult.backups,
          tmdbId: item.id,
        };
      }
    }

    return null;
  } catch (err) {
    console.warn(`TMDB search error for "${query}":`, err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tmdbIdParam = searchParams.get('tmdbId') || '';
  const mediaTypeParam = searchParams.get('mediaType') || '';
  const title = searchParams.get('title') || '';
  const subTitle = searchParams.get('subTitle') || '';
  const slug = searchParams.get('slug') || '';
  const yearStr = searchParams.get('year') || '';
  const year = yearStr ? parseInt(yearStr, 10) : undefined;

  const parsedTmdbId = tmdbIdParam ? parseInt(tmdbIdParam, 10) : undefined;

  // Cache key
  const cacheKey = parsedTmdbId
    ? `tmdb_id_${parsedTmdbId}_${mediaTypeParam || 'all'}`
    : slug || `${title}__${subTitle}__${year || ''}`;

  if (!cacheKey) {
    return NextResponse.json({ youtubeKey: null, backupKeys: [] }, { status: 400 });
  }

  // 1. Check in-memory server cache
  if (trailerCache.has(cacheKey)) {
    const cached = trailerCache.get(cacheKey)!;
    return NextResponse.json({
      youtubeKey: cached.youtubeKey,
      backupKeys: cached.backupKeys,
      tmdbId: cached.tmdbId,
      source: cached.source,
      logoUrl: cached.logoUrl || null,
      cached: true,
    });
  }

  let youtubeKey: string | null = null;
  let backupKeys: string[] = [];
  let tmdbId: number | undefined = parsedTmdbId;
  let source = 'none';

  // 2. Direct TMDB ID lookup (100% accurate when available from API)
  if (parsedTmdbId && !isNaN(parsedTmdbId)) {
    const mediaType = mediaTypeParam === 'tv' ? 'tv' : 'movie';
    const videoRes = await fetchVideosForTMDBItem(parsedTmdbId, mediaType);
    if (videoRes && videoRes.key) {
      youtubeKey = videoRes.key;
      backupKeys = videoRes.backups;
      source = 'tmdb_id';
    } else {
      // Movie exists on TMDB with known ID, but has 0 trailers (e.g. "Thỏ Ơi!!").
      // Return null so only cover image is displayed!
      source = 'tmdb_id_no_videos';
    }
  }

  // 3. Fallback to TMDB Search if tmdbId is not provided or not found
  if (!youtubeKey && source !== 'tmdb_id_no_videos') {
    // A. For Vietnamese titles, search Vietnamese title first (e.g. "Thỏ Ơi!!", "Lật Mặt 7", "Bố Già")
    if (hasVietnameseChars(title) && title.trim()) {
      const tmdbRes = await searchTMDBTrailer(title, year);
      if (tmdbRes) {
        youtubeKey = tmdbRes.key;
        backupKeys = tmdbRes.backups;
        tmdbId = tmdbRes.tmdbId;
        source = 'tmdb_title_vn';
      }
    }

    // B. Search by subTitle (original international / romanized title, e.g. "Doctor-X", "Queen of Tears", "Between Steps")
    if (!youtubeKey && subTitle && subTitle.trim()) {
      const tmdbRes = await searchTMDBTrailer(subTitle, year);
      if (tmdbRes) {
        youtubeKey = tmdbRes.key;
        backupKeys = tmdbRes.backups;
        tmdbId = tmdbRes.tmdbId;
        source = 'tmdb_subtitle';
      }
    }

    // C. Search by title if not already tried
    if (!youtubeKey && title && title.trim() && !hasVietnameseChars(title)) {
      const tmdbRes = await searchTMDBTrailer(title, year);
      if (tmdbRes) {
        youtubeKey = tmdbRes.key;
        backupKeys = tmdbRes.backups;
        tmdbId = tmdbRes.tmdbId;
        source = 'tmdb_title';
      }
    }
  }

  // 4. Resolve Title Logo from TMDB in parallel with Vietnamese-first priority
  const logoUrl = await fetchTMDBLogo({
    tmdbId: tmdbId || parsedTmdbId,
    mediaType: mediaTypeParam === 'tv' ? 'tv' : 'movie',
    title,
    subTitle,
    slug,
    year,
  });

  // Cache record
  const record: CachedTrailer = {
    youtubeKey,
    backupKeys,
    tmdbId,
    source,
    logoUrl,
  };
  trailerCache.set(cacheKey, record);

  return NextResponse.json(
    {
      youtubeKey,
      backupKeys,
      tmdbId,
      source,
      logoUrl,
      cached: false,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
      },
    }
  );
}
