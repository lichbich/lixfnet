import {
  Movie,
  KKPhimItem,
  KKPhimListResponse,
  KKPhimDetailResponse,
  NguonCItem,
  NguonCListResponse,
  NguonCDetailResponse,
  NguonCDetailMovie,
  Season,
  EpisodeServer,
  EpisodeServerItem,
} from '@/types';

export const API_BASE_URL = 'https://phimapi.com';
export const CDN_IMAGE_BASE = 'https://phimimg.com';

/**
 * Normalizes image URLs from KKPhim (prepending CDN domain for relative paths)
 */
export function formatPhimImageUrl(url?: string, cdnBase = CDN_IMAGE_BASE): string {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanBase = cdnBase.replace(/\/+$/, '');
  const cleanPath = trimmed.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
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
 * Extract YouTube video ID (11 chars) from any YouTube URL (watch?v=, youtu.be, embed, shorts, or raw key)
 */
export function extractYoutubeKey(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match =
    trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i) ||
    trimmed.match(/^[a-zA-Z0-9_-]{11}$/);
  return match ? (match[1] || match[0]) : null;
}

/**
 * Robust duration parser for various Vietnamese time formats (e.g. "65 phút/tập", "1 giờ 45 phút", "118 phút")
 */
export function parseMovieDuration(timeStr?: string, isSeries?: boolean): { durationStr: string; durationMinutes: number } {
  if (!timeStr || !timeStr.trim()) {
    return {
      durationStr: isSeries ? '45 phút/tập' : '105 phút',
      durationMinutes: isSeries ? 45 : 105,
    };
  }

  const clean = timeStr.trim().toLowerCase();

  // Pattern 1: "1 giờ 45 phút", "1g 45p", "2h15m"
  const hourMatch = clean.match(/(\d+)\s*(?:giờ|g|h)/);
  const minMatch = clean.match(/(\d+)\s*(?:phút|p|m)/);

  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    const mins = minMatch ? parseInt(minMatch[1], 10) : 0;
    const totalMins = hours * 60 + mins;
    return {
      durationStr: timeStr,
      durationMinutes: totalMins,
    };
  }

  // Pattern 2: "65 phút/tập", "115 phút", "24 min", etc.
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    return {
      durationStr: timeStr,
      durationMinutes: mins,
    };
  }

  // Pattern 3: purely numeric e.g. "98"
  const numMatch = clean.match(/\d+/);
  if (numMatch) {
    const mins = parseInt(numMatch[0], 10);
    return {
      durationStr: `${mins} phút`,
      durationMinutes: mins,
    };
  }

  return {
    durationStr: timeStr,
    durationMinutes: isSeries ? 45 : 105,
  };
}

export function normalizeSearchText(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim();
}

export const VALID_COUNTRY_SLUGS = new Set<string>([
  'han-quoc',
  'my',
  'au-my',
  'nhat-ban',
  'trung-quoc',
  'viet-nam',
  'thai-lan',
  'anh',
  'hong-kong',
  'dai-loan',
  'phap',
  'duc',
  'tay-ban-nha',
  'italy',
  'y',
  'an-do',
  'canada',
  'uc',
  'philippines',
  'nga',
  'bi',
  'brazil',
  'ha-lan',
  'indonesia',
  'malaysia',
  'mexico',
  'na-uy',
  'nam-phi',
  'tho-nhi-ky',
  'thuy-si',
  'thuy-dien',
  'dan-mach',
  'ba-lan',
  'bo-dao-nha',
  'chau-phi',
  'uae',
  'ukraina',
  'a-rap-xe-ut',
  'quoc-gia-khac',
]);

export const COUNTRY_NAME_TO_SLUG: Record<string, string> = {
  'hàn quốc': 'han-quoc',
  'hàn': 'han-quoc',
  'korea': 'han-quoc',
  'south korea': 'han-quoc',
  'mỹ': 'au-my',
  'âu mỹ': 'au-my',
  'hoa kỳ': 'au-my',
  'bắc mỹ': 'au-my',
  'usa': 'au-my',
  'united states': 'au-my',
  'nhật bản': 'nhat-ban',
  'nhật': 'nhat-ban',
  'japan': 'nhat-ban',
  'trung quốc': 'trung-quoc',
  'trung': 'trung-quoc',
  'china': 'trung-quoc',
  'việt nam': 'viet-nam',
  'việt': 'viet-nam',
  'vietnam': 'viet-nam',
  'thái lan': 'thai-lan',
  'thái': 'thai-lan',
  'thailand': 'thai-lan',
  'anh': 'anh',
  'vương quốc anh': 'anh',
  'châu âu': 'anh',
  'uk': 'anh',
  'united kingdom': 'anh',
  'hồng kông': 'hong-kong',
  'hong kong': 'hong-kong',
  'đài loan': 'dai-loan',
  'taiwan': 'dai-loan',
  'pháp': 'phap',
  'france': 'phap',
  'đức': 'duc',
  'germany': 'duc',
  'tây ban nha': 'tay-ban-nha',
  'spain': 'tay-ban-nha',
  'ý': 'y',
  'italy': 'y',
  'italia': 'y',
  'ấn độ': 'an-do',
  'india': 'an-do',
  'canada': 'canada',
  'ca-na-đa': 'canada',
  'úc': 'uc',
  'australia': 'uc',
  'philippines': 'philippines',
  'nga': 'nga',
  'russia': 'nga',
  'bỉ': 'bi',
  'belgium': 'bi',
  'brazil': 'brazil',
};

export const GENRE_NAME_TO_SLUG: Record<string, string> = {
  'hài': 'hai-huoc',
  'phim hài': 'hai-huoc',
  'hài hước': 'hai-huoc',
  'hình sự': 'hinh-su',
  'chính kịch': 'chinh-kich',
  'bí ẩn': 'bi-an',
  'hành động': 'hanh-dong',
  'tình cảm': 'tinh-cam',
  'lãng mạn': 'tinh-cam',
  'khoa học viễn tưởng': 'vien-tuong',
  'viễn tưởng': 'vien-tuong',
  'khoa học': 'khoa-hoc',
  'kinh dị': 'kinh-di',
  'hoạt hình': 'hoat-hinh',
  'cổ trang': 'co-trang',
  'chiến tranh': 'chien-tranh',
  'tài liệu': 'tai-lieu',
  'tâm lý': 'tam-ly',
  'gia đình': 'gia-dinh',
  'phiêu lưu': 'phieu-luu',
  'thần thoại': 'than-thoai',
  'võ thuật': 'vo-thuat',
  'thể thao': 'the-thao',
  'học đường': 'hoc-duong',
  'âm nhạc': 'am-nhac',
};

export function normalizeCountrySlug(slug?: string): string {
  if (!slug) return 'han-quoc';
  if (slug === 'italy') return 'y';
  return slug;
}

export function normalizeGenreSlug(slug?: string): string {
  if (!slug) return 'hanh-dong';
  if (slug === 'phim-hai') return 'hai-huoc';
  if (slug === 'khoa-hoc-vien-tuong') return 'vien-tuong';
  return slug;
}

export function getCountrySlug(countryName?: string, fallbackSlug?: string): string | undefined {
  if (fallbackSlug && VALID_COUNTRY_SLUGS.has(fallbackSlug)) return normalizeCountrySlug(fallbackSlug);
  if (!countryName) return undefined;
  const lower = countryName.toLowerCase().trim();
  if (COUNTRY_NAME_TO_SLUG[lower]) return COUNTRY_NAME_TO_SLUG[lower];
  const candidate = normalizeSearchText(lower).replace(/\s+/g, '-');
  if (VALID_COUNTRY_SLUGS.has(candidate)) return normalizeCountrySlug(candidate);
  return undefined;
}

export function getGenreSlug(genreName?: string): string | undefined {
  if (!genreName) return undefined;
  const lower = genreName.toLowerCase().trim();
  if (GENRE_NAME_TO_SLUG[lower]) return GENRE_NAME_TO_SLUG[lower];
  const candidate = normalizeSearchText(lower).replace(/\s+/g, '-');
  return normalizeGenreSlug(candidate);
}

/**
 * Maps an item from phimapi.com (KKPhim API) to the application's Movie interface
 */
export function mapKKPhimToMovie(
  item: KKPhimItem,
  rank?: number,
  options?: {
    isTop10?: boolean;
    isNewAdded?: boolean;
    platform?: 'netflix' | 'apple' | 'disney' | 'hbo' | 'prime';
    platformName?: string;
  }
): Movie {
  let genres: string[] = [];
  let country: string | undefined;
  let countrySlug: string | undefined;

  // 1. Parse category
  if (Array.isArray(item.category)) {
    genres = item.category.map((c: any) => c.name).filter(Boolean);
  } else if (item.category && typeof item.category === 'object') {
    // Support legacy NguonC nested group format
    const cats = item.category as any;
    for (const key in cats) {
      if (cats[key]?.group?.name === 'Thể loại') {
        genres = cats[key].list.map((c: any) => c.name);
      }
      if (cats[key]?.group?.name === 'Quốc gia') {
        if (cats[key].list && cats[key].list.length > 0) {
          country = cats[key].list[0].name;
          countrySlug = getCountrySlug(cats[key].list[0].name, cats[key].list[0].slug);
        }
      }
    }
  }

  // 2. Parse country
  if (Array.isArray(item.country) && item.country.length > 0) {
    country = item.country[0].name;
    countrySlug = item.country[0].slug || getCountrySlug(item.country[0].name);
  }

  // Fallback country detection from language / slug if missing
  if (!countrySlug && (item.lang || item.language)) {
    const langLower = (item.lang || item.language || '').toLowerCase();
    if (langLower.includes('hàn')) {
      country = country || 'Hàn Quốc';
      countrySlug = 'han-quoc';
    } else if (langLower.includes('trung') || langLower.includes('quảng')) {
      country = country || 'Trung Quốc';
      countrySlug = 'trung-quoc';
    } else if (langLower.includes('nhật')) {
      country = country || 'Nhật Bản';
      countrySlug = 'nhat-ban';
    } else if (langLower.includes('thái')) {
      country = country || 'Thái Lan';
      countrySlug = 'thai-lan';
    } else if (langLower.includes('mỹ') || langLower.includes('anh')) {
      country = country || 'Âu Mỹ';
      countrySlug = 'au-my';
    } else if (langLower.includes('việt')) {
      country = country || 'Việt Nam';
      countrySlug = 'viet-nam';
    }
  }

  if (genres.length === 0) {
    genres = ['Phim hot', item.lang || item.language || 'Vietsub'];
  }

  // Determine media type (series vs movie)
  const itemType = String(item.type || '').toLowerCase();
  const epTotal = String(item.episode_total || '').toLowerCase();
  const epCurrent = String(item.episode_current || item.current_episode || '').toLowerCase();
  const timeStr = String(item.time || '').toLowerCase();

  const isSeries = Boolean(
    itemType === 'series' ||
    itemType === 'tvshows' ||
    (epTotal && !epTotal.includes('1 tập') && !epTotal.includes('full') && epTotal !== '1') ||
    (item.total_episodes && item.total_episodes > 1) ||
    (epCurrent && !epCurrent.includes('full') && epCurrent.includes('tập')) ||
    (timeStr && timeStr.includes('/tập'))
  );

  const { durationStr, durationMinutes } = parseMovieDuration(item.time, isSeries);

  // Parse Images (thumb_url = 16:9 backdrop, poster_url = 2:3 vertical poster)
  const backdropUrl =
    formatPhimImageUrl(item.thumb_url || item.poster_url) ||
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop';
  const posterUrl =
    formatPhimImageUrl(item.poster_url || item.thumb_url) ||
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop';

  // Parse episodes into Seasons & Episodes servers structure if available
  let seasonsList: Season[] | undefined;
  let firstEmbedUrl: string | undefined;
  let firstM3u8Url: string | undefined;
  let episodesServers: EpisodeServer[] | undefined;

  const rawEpisodes = item.episodes;
  if (Array.isArray(rawEpisodes) && rawEpisodes.length > 0) {
    episodesServers = rawEpisodes.map((srv: any) => {
      const rawData = srv.server_data || srv.items || [];
      const items: EpisodeServerItem[] = rawData.map((ep: any) => ({
        name: formatEpisodeTitle(ep.name),
        slug: ep.slug,
        embed: ep.link_embed || ep.embed || '',
        m3u8: ep.link_m3u8 || ep.m3u8 || '',
      }));
      return {
        server_name: srv.server_name || 'Vietsub',
        items,
      };
    });

    const mainServer = episodesServers[0];
    if (mainServer && mainServer.items.length > 0) {
      firstEmbedUrl = mainServer.items[0].embed || undefined;
      firstM3u8Url = mainServer.items[0].m3u8 || undefined;
    }

    seasonsList = episodesServers.map((srv, sIdx) => ({
      seasonNumber: sIdx + 1,
      title: srv.server_name || `Phần ${sIdx + 1}`,
      episodes: srv.items.map((ep, epIdx) => {
        const cleanNumber = ep.name.replace(/^Tập\s*/i, '').trim();
        return {
          id: `${item.slug}-ep-${ep.slug || epIdx + 1}`,
          number: cleanNumber || ep.name,
          title: formatEpisodeTitle(ep.name),
          duration: `${durationMinutes} phút`,
          description: (item.content || item.description || '').slice(0, 150) ? `${(item.content || item.description || '').slice(0, 150)}...` : '',
          thumbnail: backdropUrl,
          embedUrl: ep.embed,
          m3u8Url: ep.m3u8,
          slug: ep.slug,
        };
      }),
    }));
  }

  // Create badge & ribbon
  const currentEp = String(item.episode_current || item.current_episode || '');
  const hasNewEp = Boolean(
    currentEp &&
    currentEp.toUpperCase() !== 'FULL' &&
    !currentEp.toLowerCase().includes('hoàn tất')
  );

  let isRecent = options?.isNewAdded || false;
  if (!isRecent && item.modified) {
    const modTimeStr = typeof item.modified === 'object' ? item.modified.time : item.modified;
    if (modTimeStr) {
      const modTime = new Date(modTimeStr).getTime();
      if (!isNaN(modTime) && Date.now() - modTime < 10 * 24 * 60 * 60 * 1000) {
        isRecent = true;
      }
    }
  }

  let ribbon: string | undefined = undefined;
  let subBadge: string | undefined = undefined;
  if (hasNewEp) {
    ribbon = 'Tập mới';
    subBadge = currentEp;
  } else if (isRecent) {
    ribbon = 'Mới thêm';
    subBadge = 'Xem ngay';
  }

  const badges = {
    ribbon,
    subBadge,
    isTop10: options?.isTop10 || false,
    platform: options?.platform,
    platformName: options?.platformName,
  };

  // Year parsing
  let parsedYear = typeof item.year === 'number' ? item.year : parseInt(String(item.year || ''), 10);
  if (!parsedYear || isNaN(parsedYear)) {
    const yearMatch = `${item.name} ${item.origin_name || item.original_name || ''}`.match(/\b(19\d\d|20\d\d)\b/);
    parsedYear = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  }

  // Parse TMDB and IMDb
  let tmdbData: Movie['tmdb'] = undefined;
  if (item.tmdb && item.tmdb.id) {
    tmdbData = {
      id: item.tmdb.id,
      type: item.tmdb.type || (isSeries ? 'tv' : 'movie'),
      season: item.tmdb.season,
      voteAverage: item.tmdb.vote_average,
      voteCount: item.tmdb.vote_count,
    };
  }

  let imdbData: Movie['imdb'] = undefined;
  if (item.imdb && item.imdb.id) {
    imdbData = {
      id: item.imdb.id,
      url: `https://www.imdb.com/title/${item.imdb.id}`,
    };
  }

  // High match rate calculation
  let matchRate = 93 + Math.floor((item.name.length * 7) % 7);
  if (item.tmdb?.vote_average && item.tmdb.vote_average > 0) {
    matchRate = Math.min(99, Math.max(88, Math.round(item.tmdb.vote_average * 10 + 5)));
  }

  // Cast & Director
  let cast: string[] | undefined;
  if (Array.isArray(item.actor)) {
    cast = item.actor.filter(Boolean);
  } else if (item.casts) {
    cast = item.casts.split(',').map((c) => c.trim()).filter(Boolean);
  }

  let director: string | undefined;
  if (Array.isArray(item.director)) {
    director = item.director.filter(Boolean).join(', ');
  } else if (typeof item.director === 'string') {
    director = item.director;
  }

    const langTag = item.lang || item.language || 'Vietsub';
  const qualityTag = item.quality || 'HD';

  const rawTrailerUrl = item.trailer_url || (item as any).trailerUrl || undefined;
  const parsedTrailerKey = extractYoutubeKey(rawTrailerUrl) || undefined;

  return {
    id: item.slug || `movie-${Math.random()}`,
    slug: item.slug,
    title: item.name,
    subTitle: item.origin_name || item.original_name,
    type: isSeries ? 'series' : 'movie',
    year: parsedYear,
    seasons: currentEp ? currentEp : durationStr || (isSeries ? `${item.episode_total || item.total_episodes || 1} tập` : 'Phim lẻ'),
    duration: durationStr,
    durationMinutes,
    rating: 'T16',
    genres,
    country,
    countrySlug,
    matchRate,
    quality: qualityTag.includes('4K') ? '4K Ultra HD' : 'HD',
    audioTags: langTag ? [langTag, '5.1'] : ['5.1'],
    description: item.content || item.description || 'Không có mô tả chi tiết cho phim này.',
    heroTagline: `${isSeries ? 'Series' : 'Phim'} • ${genres[0] || 'Phổ biến'} • ${parsedYear} • ${qualityTag}`,
    backdropUrl,
    posterUrl,
    rank,
    badges,
    cast,
    director,
    tags: [langTag, qualityTag, genres[0] || 'Thịnh hành'],
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    embedUrl: firstEmbedUrl,
    m3u8Url: firstM3u8Url,
    episodesServers,
    seasonsList,
    tmdb: tmdbData,
    imdb: imdbData,
    logoUrl: (item as any).logoUrl,
    trailerUrl: rawTrailerUrl,
    trailerYoutubeKey: parsedTrailerKey,
  };
}

// Backward-compatibility alias
export const mapNguonCToMovie = mapKKPhimToMovie;

/**
 * Fetch newly updated movies (phim mới cập nhật)
 */
export async function getNewUpdatedMovies(page = 1): Promise<Movie[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/api/danh-sach/phim-moi-cap-nhat?page=${page}`, {
      next: { revalidate: 300 }, // Cache 5 minutes
    });
    if (!res.ok) return [];
    const data: KKPhimListResponse = await res.json();
    const items = data.data?.items || data.items || [];
    return items.map((item, idx) =>
      mapKKPhimToMovie(item, undefined, { isNewAdded: page === 1 && idx < 6 })
    );
  } catch (error) {
    console.warn('Error fetching new updated movies:', error);
    return [];
  }
}

/**
 * Fetch movies by category slug (phim-bo, phim-le, hoat-hinh, tv-shows, phim-chieu-rap)
 */
export async function getMoviesByCategory(slug: string, page = 1): Promise<Movie[]> {
  try {
    let catSlug = slug;
    if (catSlug === 'phim-dang-chieu') catSlug = 'phim-chieu-rap';

    const res = await fetch(`${API_BASE_URL}/v1/api/danh-sach/${catSlug}?page=${page}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data: KKPhimListResponse = await res.json();
    const items = data.data?.items || data.items || [];
    return items.map((item) => mapKKPhimToMovie(item));
  } catch {
    return [];
  }
}

/**
 * Fetch movies by genre slug (hanh-dong, tinh-cam, kinh-di, hai-huoc, vien-tuong, hoat-hinh)
 */
export async function getMoviesByGenre(slug: string, page = 1): Promise<Movie[]> {
  try {
    const genreSlug = normalizeGenreSlug(slug);
    const res = await fetch(`${API_BASE_URL}/v1/api/the-loai/${genreSlug}?page=${page}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data: KKPhimListResponse = await res.json();
    const items = data.data?.items || data.items || [];
    return items.map((item) => mapKKPhimToMovie(item));
  } catch {
    return [];
  }
}

/**
 * Fetch movies by genre slug with pagination details
 */
export async function getMoviesByGenrePaginated(
  slug: string,
  page = 1
): Promise<{ movies: Movie[]; totalPages: number; totalItems: number }> {
  const genreSlug = normalizeGenreSlug(slug);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/api/the-loai/${genreSlug}?page=${page}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        return { movies: [], totalPages: 0, totalItems: 0 };
      }
      const data: KKPhimListResponse = await res.json();
      const items = data.data?.items || data.items || [];
      const pagination = data.data?.params?.pagination;
      return {
        movies: items.map((item, idx) => mapKKPhimToMovie(item, (page - 1) * 24 + idx + 1)),
        totalPages: pagination?.totalPages || 1,
        totalItems: pagination?.totalItems || items.length,
      };
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      return { movies: [], totalPages: 0, totalItems: 0 };
    }
  }
  return { movies: [], totalPages: 0, totalItems: 0 };
}

/**
 * Unified filter query supporting both country and genre slugs with pagination
 */
export async function getFilterMoviesPaginated(
  slug: string,
  page = 1
): Promise<{ movies: Movie[]; totalPages: number; totalItems: number }> {
  const isCountry = [
    'han-quoc',
    'my',
    'au-my',
    'nhat-ban',
    'viet-nam',
    'thai-lan',
    'anh',
    'phap',
    'duc',
    'an-do',
    'nga',
    'hong-kong',
    'dai-loan',
    'tay-ban-nha',
    'italy',
    'y',
    'uc',
    'canada',
  ].includes(slug);

  if (isCountry) {
    return getMoviesByCountryPaginated(slug, page);
  }
  return getMoviesByGenrePaginated(slug, page);
}

export interface CountryOption {
  slug: string;
  name: string;
  language: string;
}

export const API_COUNTRIES: CountryOption[] = [
  { slug: 'han-quoc', name: 'Hàn Quốc', language: 'Tiếng Hàn' },
  { slug: 'au-my', name: 'Mỹ (Hollywood)', language: 'Tiếng Anh (Mỹ)' },
  { slug: 'nhat-ban', name: 'Nhật Bản', language: 'Tiếng Nhật' },
  { slug: 'trung-quoc', name: 'Trung Quốc', language: 'Tiếng Quan Thoại (Trung Quốc)' },
  { slug: 'viet-nam', name: 'Việt Nam', language: 'Tiếng Việt' },
  { slug: 'thai-lan', name: 'Thái Lan', language: 'Tiếng Thái' },
  { slug: 'anh', name: 'Anh', language: 'Tiếng Anh (Anh)' },
  { slug: 'hong-kong', name: 'Hồng Kông', language: 'Tiếng Quảng Đông (Hồng Kông)' },
  { slug: 'dai-loan', name: 'Đài Loan', language: 'Tiếng Đài Loan' },
  { slug: 'phap', name: 'Pháp', language: 'Tiếng Pháp' },
  { slug: 'duc', name: 'Đức', language: 'Tiếng Đức' },
  { slug: 'tay-ban-nha', name: 'Tây Ban Nha', language: 'Tiếng Tây Ban Nha' },
  { slug: 'y', name: 'Ý (Italy)', language: 'Tiếng Ý' },
  { slug: 'an-do', name: 'Ấn Độ', language: 'Tiếng Hindi (Ấn Độ)' },
  { slug: 'canada', name: 'Ca-na-đa (Canada)', language: 'Tiếng Anh (Canada)' },
  { slug: 'uc', name: 'Úc', language: 'Tiếng Anh (Úc)' },
  { slug: 'philippines', name: 'Philippines', language: 'Tiếng Philippines' },
  { slug: 'nga', name: 'Nga', language: 'Tiếng Nga' },
  { slug: 'bi', name: 'Bỉ', language: 'Tiếng Flemish / Pháp (Bỉ)' },
  { slug: 'brazil', name: 'Bra-xin (Brazil)', language: 'Tiếng Bồ Đào Nha (Brazil)' },
];

/**
 * Fetch movies by country slug (han-quoc, nhat-ban, au-my, viet-nam)
 */
export async function getMoviesByCountry(slug: string, page = 1): Promise<Movie[]> {
  const countrySlug = normalizeCountrySlug(slug);
  if (!countrySlug || !VALID_COUNTRY_SLUGS.has(countrySlug)) return [];
  try {
    const res = await fetch(`${API_BASE_URL}/v1/api/quoc-gia/${countrySlug}?page=${page}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data: KKPhimListResponse = await res.json();
    const items = data.data?.items || data.items || [];
    return items.map((item) => mapKKPhimToMovie(item));
  } catch {
    return [];
  }
}

/**
 * Fetch movies by country slug with pagination details
 */
export async function getMoviesByCountryPaginated(
  slug: string,
  page = 1
): Promise<{ movies: Movie[]; totalPages: number; totalItems: number }> {
  const countrySlug = normalizeCountrySlug(slug);
  if (!countrySlug || !VALID_COUNTRY_SLUGS.has(countrySlug)) {
    return { movies: [], totalPages: 0, totalItems: 0 };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/api/quoc-gia/${countrySlug}?page=${page}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        return { movies: [], totalPages: 0, totalItems: 0 };
      }
      const data: KKPhimListResponse = await res.json();
      const items = data.data?.items || data.items || [];
      const pagination = data.data?.params?.pagination;
      return {
        movies: items.map((item, idx) => mapKKPhimToMovie(item, (page - 1) * 24 + idx + 1)),
        totalPages: pagination?.totalPages || 1,
        totalItems: pagination?.totalItems || items.length,
      };
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      return { movies: [], totalPages: 0, totalItems: 0 };
    }
  }
  return { movies: [], totalPages: 0, totalItems: 0 };
}

/**
 * Fetch Vietnamese movies, prioritizing latest standalone feature films (phim lẻ Việt Nam mới nhất)
 */
export async function getVietnameseMovies(): Promise<Movie[]> {
  try {
    const [p1, p2] = await Promise.all([
      getMoviesByCountry('viet-nam', 1),
      getMoviesByCountry('viet-nam', 2),
    ]);

    const all = [...p1, ...p2];
    const seen = new Set<string>();
    const unique: Movie[] = [];

    for (const m of all) {
      const key = m.slug || m.id;
      if (!seen.has(key)) {
        seen.add(key);
        m.country = m.country || 'Việt Nam';
        m.countrySlug = m.countrySlug || 'viet-nam';
        unique.push(m);
      }
    }

    // Separate standalone feature films (phim lẻ) and series (phim bộ)
    const standalone: Movie[] = [];
    const series: Movie[] = [];

    for (const m of unique) {
      const isStandalone =
        m.type === 'movie' ||
        (m.seasons && m.seasons.toUpperCase().includes('FULL')) ||
        (m.duration && !m.seasons?.toLowerCase().includes('tập'));

      if (isStandalone) {
        standalone.push(m);
      } else {
        series.push(m);
      }
    }

    // Sort standalone movies by release year descending (2026, 2025, ...)
    standalone.sort((a, b) => (b.year || 0) - (a.year || 0));

    // Combine: Latest standalone feature films first, followed by series
    return [...standalone, ...series];
  } catch (error) {
    console.error('Error fetching Vietnamese movies:', error);
    return [];
  }
}

let cachedChinaSlugs: Set<string> | null = null;
let lastChinaFetchTime = 0;

/**
 * Fetch latest Chinese movie slugs from KKPhim country endpoint
 * Used to completely hide/filter all Chinese content from the Home Page.
 */
export async function getChineseMovieSlugs(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedChinaSlugs && now - lastChinaFetchTime < 10 * 60 * 1000) {
    return cachedChinaSlugs;
  }

  try {
    const pages = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((p) =>
        fetch(`${API_BASE_URL}/v1/api/quoc-gia/trung-quoc?page=${p}`, {
          next: { revalidate: 600 },
        })
          .then((r) => (r.ok ? r.json() : { data: { items: [] } }))
          .catch(() => ({ data: { items: [] } }))
      )
    );

    const slugSet = new Set<string>();
    for (const page of pages) {
      const items = page.data?.items || page.items || [];
      for (const item of items) {
        if (item.slug) slugSet.add(item.slug);
      }
    }

    cachedChinaSlugs = slugSet;
    lastChinaFetchTime = now;
    return slugSet;
  } catch (err) {
    console.error('Error fetching Chinese movie slugs:', err);
    return cachedChinaSlugs || new Set<string>();
  }
}

/**
 * Multi-layer check to identify if a movie is from China / Chinese production
 */
export function isChineseMovie(movie?: Movie | KKPhimItem | null, chinaSlugSet?: Set<string>): boolean {
  if (!movie) return false;

  const slug = 'slug' in movie && movie.slug ? movie.slug : ('id' in movie ? movie.id : '');
  if (slug && chinaSlugSet && chinaSlugSet.has(slug)) return true;

  if ('countrySlug' in movie && movie.countrySlug === 'trung-quoc') return true;
  if ('country' in movie) {
    if (typeof movie.country === 'string' && movie.country.toLowerCase().includes('trung')) return true;
    if (Array.isArray(movie.country) && movie.country.some((c: any) => c.slug === 'trung-quoc' || c.name?.toLowerCase().includes('trung'))) return true;
  }

  // Language check
  const lang = (
    ('lang' in movie && movie.lang ? movie.lang : '') +
    ' ' +
    ('language' in movie && (movie as any).language ? (movie as any).language : '') +
    ' ' +
    ('audioTags' in movie && Array.isArray(movie.audioTags) ? movie.audioTags.join(' ') : '')
  ).toLowerCase();

  if (lang.includes('trung') || lang.includes('quảng') || lang.includes('quan thoại') || lang.includes('mandarin')) {
    return true;
  }

  // Tags check
  if ('tags' in movie && Array.isArray(movie.tags)) {
    if (movie.tags.some((t) => t.toLowerCase().includes('trung quốc'))) return true;
  }

  const title = ('title' in movie && movie.title ? movie.title : ('name' in movie ? movie.name : '')) || '';
  const sub = ('subTitle' in movie && movie.subTitle ? movie.subTitle : ('origin_name' in movie ? movie.origin_name : ('original_name' in movie ? (movie as any).original_name : ''))) || '';
  const desc = ('description' in movie && movie.description ? movie.description : ('content' in movie ? (movie as any).content : '')) || '';

  // Has Hanzi without Japanese kana
  const combinedTitles = `${title} ${sub}`;
  const hasCJK = /[\u4e00-\u9fa5]/.test(combinedTitles);
  const hasKana = /[\u3040-\u30ff]/.test(combinedTitles);
  if (hasCJK && !hasKana) return true;

  // Keyword check in description & titles
  const text = `${title} ${sub} ${desc}`.toLowerCase();
  const chineseKeywords = [
    'trung quốc',
    'trung hoa',
    'bắc kinh',
    'thượng hải',
    'tử cấm thành',
    'đại lục',
    'tu tiên',
    'tiên hiệp',
    'kiếm hiệp',
    'huyền huyễn',
    'đan dược',
    'tông môn',
    'đấu khí',
    'đấu la đại lục',
    'đấu phá thương khung',
    'donghua',
    'hoàng cung',
    'cung đấu',
    'thái giám',
    'hoàng đế',
    'cẩm y vệ',
  ];

  for (const kw of chineseKeywords) {
    if (text.includes(kw)) {
      if (!hasKana && !lang.includes('nhật') && !lang.includes('hàn') && !lang.includes('việt')) {
        return true;
      }
    }
  }

  return false;
}

export interface SearchMoviesResponse {
  movies: Movie[];
  totalPages: number;
  currentPage: number;
  totalItems?: number;
}

/**
 * Search movies by keyword with KKPhim native search, embedded TMDB/IMDb metadata, and smart relevance ranking.
 */
export async function searchMoviesWithPagination(
  keyword: string,
  page = 1
): Promise<SearchMoviesResponse> {
  const clean = keyword?.trim();
  if (!clean) return { movies: [], totalPages: 1, currentPage: 1, totalItems: 0 };

  try {
    const res = await fetch(
      `${API_BASE_URL}/v1/api/tim-kiem?keyword=${encodeURIComponent(clean)}&page=${page}&limit=24`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return { movies: [], totalPages: 1, currentPage: 1, totalItems: 0 };
    const data: KKPhimListResponse = await res.json();
    const items = data.data?.items || data.items || [];
    const pagination = data.data?.params?.pagination;

    // Rank items by relevance to search term and TMDB quality
    const qNorm = normalizeSearchText(clean);
    const sortedItems = [...items].sort((a, b) => {
      const aName = normalizeSearchText(a.name);
      const aOrig = normalizeSearchText(a.origin_name || a.original_name);
      const bName = normalizeSearchText(b.name);
      const bOrig = normalizeSearchText(b.origin_name || b.original_name);

      let scoreA = 0;
      let scoreB = 0;

      // Exact title match
      if (aName === qNorm || aOrig === qNorm) scoreA += 100;
      if (bName === qNorm || bOrig === qNorm) scoreB += 100;

      // Contains query
      if (aName.includes(qNorm) || aOrig.includes(qNorm)) scoreA += 40;
      if (bName.includes(qNorm) || bOrig.includes(qNorm)) scoreB += 40;

      // TMDB Quality boost
      if (a.tmdb?.vote_average) scoreA += a.tmdb.vote_average * 5;
      if (b.tmdb?.vote_average) scoreB += b.tmdb.vote_average * 5;

      return scoreB - scoreA;
    });

    const movies = sortedItems.map((item) => mapKKPhimToMovie(item));

    return {
      movies,
      totalPages: pagination?.totalPages || 1,
      currentPage: page,
      totalItems: pagination?.totalItems || items.length,
    };
  } catch (error) {
    console.error('Error searching movies:', error);
    return { movies: [], totalPages: 1, currentPage: 1, totalItems: 0 };
  }
}

/**
 * Search movies by keyword
 */
export async function searchMovies(keyword: string, page = 1): Promise<Movie[]> {
  const res = await searchMoviesWithPagination(keyword, page);
  return res.movies;
}

/**
 * Fetch full movie detail with episodes and stream links
 */
export async function getMovieDetail(slug: string): Promise<Movie | null> {
  if (!slug) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/phim/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data: KKPhimDetailResponse = await res.json();
    const item = data.movie || data.data?.item;
    if (item) {
      if (data.episodes) {
        item.episodes = data.episodes;
      }
      return mapKKPhimToMovie(item);
    }
    return null;
  } catch (error) {
    console.warn(`Error fetching movie detail ${slug}:`, error);
    return null;
  }
}

/**
 * Direct lookup by TMDB ID (instantly resolves streaming links and movie details)
 */
export async function getMovieDetailByTmdb(
  tmdbId: number | string,
  mediaType: 'movie' | 'tv' = 'movie'
): Promise<Movie | null> {
  if (!tmdbId) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/tmdb/${mediaType}/${tmdbId}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data: KKPhimDetailResponse = await res.json();
    if (data.status === true && data.movie) {
      if (data.episodes) {
        data.movie.episodes = data.episodes;
      }
      return mapKKPhimToMovie(data.movie);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Recommendation algorithm strictly prioritizing:
 * 1. Country of origin (Quốc gia - Highest Priority)
 * 2. Genre match & themes (Thể loại)
 * 3. Main cast and director (Diễn viên chính & Đạo diễn)
 */
export async function getSimilarMovies(movie: Movie | null | undefined, limit = 6): Promise<Movie[]> {
  if (!movie) return [];

  try {
    let target = movie;

    // If target movie doesn't have country or cast or full genres, fetch detail to obtain rich metadata
    if ((!target.countrySlug || !target.cast?.length || (target.genres?.length || 0) <= 1) && target.slug) {
      const detailed = await getMovieDetail(target.slug);
      if (detailed) {
        target = { ...target, ...detailed };
      }
    }

    const countrySlug = (target.countrySlug && VALID_COUNTRY_SLUGS.has(target.countrySlug))
      ? target.countrySlug
      : getCountrySlug(target.country);
    const genres = target.genres || [];
    const cast = target.cast || [];
    const isSeries = target.type === 'series';

    // 1. Fetch Candidate Batches in Parallel
    const fetchPromises: Promise<{ items: Movie[]; sourceCountry?: string; sourceGenre?: string }>[] = [];

    // Source A: Same Country pages 1 & 2 (Guaranteed same country)
    if (countrySlug && VALID_COUNTRY_SLUGS.has(countrySlug)) {
      fetchPromises.push(
        getMoviesByCountry(countrySlug, 1).then((movies) => ({ items: movies, sourceCountry: countrySlug })),
        getMoviesByCountry(countrySlug, 2).then((movies) => ({ items: movies, sourceCountry: countrySlug }))
      );
    }

    // Source B: Primary genres (fetch page 1 for up to 2 genres)
    const validGenreSlugs = genres
      .map((g) => getGenreSlug(g))
      .filter((s): s is string => Boolean(s && s !== 'phim-hot' && s !== 'thinh-hanh'))
      .slice(0, 2);

    for (const gSlug of validGenreSlugs) {
      fetchPromises.push(
        getMoviesByGenre(gSlug, 1).then((movies) => ({ items: movies, sourceGenre: gSlug }))
      );
    }

    // Fallback if neither country nor genre was found: get updated movies
    if (fetchPromises.length === 0) {
      fetchPromises.push(
        getNewUpdatedMovies(1).then((movies) => ({ items: movies }))
      );
    }

    const results = await Promise.all(fetchPromises);

    // 2. Candidate Deduplication & Metadata Tagging
    interface CandidateData {
      movie: Movie;
      isSameCountry: boolean;
      matchedGenreSlugs: Set<string>;
    }

    const candidateMap = new Map<string, CandidateData>();

    for (const res of results) {
      for (const m of res.items) {
        // Exclude current movie
        if (m.slug === target.slug || m.id === target.id) continue;
        const key = m.slug || m.id;

        if (!candidateMap.has(key)) {
          candidateMap.set(key, {
            movie: m,
            isSameCountry: res.sourceCountry === countrySlug || (Boolean(m.countrySlug) && m.countrySlug === countrySlug),
            matchedGenreSlugs: new Set(),
          });
        }

        const cand = candidateMap.get(key)!;
        if (res.sourceCountry === countrySlug || (m.countrySlug && m.countrySlug === countrySlug)) {
          cand.isSameCountry = true;
        }
        if (res.sourceGenre) {
          cand.matchedGenreSlugs.add(res.sourceGenre);
        }
      }
    }

    // 3. Scoring Criteria
    const targetCastsNorm = cast.map((c) => normalizeSearchText(c));
    const targetDirectorNorm = normalizeSearchText(target.director);
    const targetGenresNorm = genres.map((g) => normalizeSearchText(g));

    const scoredCandidates: { movie: Movie; score: number }[] = [];

    for (const { movie: candMovie, isSameCountry, matchedGenreSlugs } of candidateMap.values()) {
      let score = 0;

      // === CRITERIA 1: COUNTRY OF ORIGIN ===
      if (isSameCountry) {
        score += 350;
      }

      // === CRITERIA 2: GENRE ALIGNMENT ===
      score += matchedGenreSlugs.size * 60;

      if (candMovie.genres?.length) {
        for (const cg of candMovie.genres) {
          const cgNorm = normalizeSearchText(cg);
          if (targetGenresNorm.includes(cgNorm)) {
            score += 45;
          }
        }
      }

      if ((candMovie.type === 'series') === isSeries) {
        score += 35;
      }

      // === CRITERIA 3: MAIN CAST & CREW ===
      if (candMovie.cast?.length && targetCastsNorm.length > 0) {
        for (const actor of candMovie.cast) {
          const actorNorm = normalizeSearchText(actor);
          if (actorNorm && targetCastsNorm.some((tc) => tc.includes(actorNorm) || actorNorm.includes(tc))) {
            score += 250;
          }
        }
      }

      if (candMovie.director && targetDirectorNorm) {
        const candDirNorm = normalizeSearchText(candMovie.director);
        if (candDirNorm && (candDirNorm.includes(targetDirectorNorm) || targetDirectorNorm.includes(candDirNorm))) {
          score += 100;
        }
      }

      // Recency
      const yearDiff = Math.abs((candMovie.year || 0) - (target.year || 0));
      if (yearDiff <= 1) {
        score += 20;
      } else if (yearDiff <= 3) {
        score += 10;
      }

      const dynamicMatchRate = Math.min(99, Math.max(90, 90 + Math.floor(score / 50)));
      candMovie.matchRate = dynamicMatchRate;

      scoredCandidates.push({ movie: candMovie, score });
    }

    scoredCandidates.sort((a, b) => b.score - a.score);

    const topMovies = scoredCandidates.slice(0, limit).map((s) => s.movie);

    if (topMovies.length < limit) {
      const fallback = await getNewUpdatedMovies(1);
      for (const m of fallback) {
        if (m.slug !== target.slug && !topMovies.some((t) => t.slug === m.slug)) {
          topMovies.push(m);
          if (topMovies.length >= limit) break;
        }
      }
    }

    return topMovies;
  } catch (error) {
    console.error('Error in getSimilarMovies:', error);
    return [];
  }
}
