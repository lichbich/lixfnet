import { Movie, NguonCListResponse, NguonCDetailResponse, NguonCItem, NguonCDetailMovie, Season } from '@/types';

const API_BASE_URL = 'https://phim.nguonc.com/api';

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
  'an-do',
  'canada',
  'uc',
  'philippines',
  'nga',
  'bi',
  'brazil',
]);

export const COUNTRY_NAME_TO_SLUG: Record<string, string> = {
  'hàn quốc': 'han-quoc',
  'hàn': 'han-quoc',
  'korea': 'han-quoc',
  'south korea': 'han-quoc',
  'mỹ': 'my',
  'hoa kỳ': 'my',
  'âu mỹ': 'my',
  'bắc mỹ': 'my',
  'usa': 'my',
  'united states': 'my',
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
  'ý': 'italy',
  'italy': 'italy',
  'italia': 'italy',
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
  'hài': 'phim-hai',
  'phim hài': 'phim-hai',
  'hài hước': 'phim-hai',
  'hình sự': 'hinh-su',
  'chính kịch': 'chinh-kich',
  'bí ẩn': 'bi-an',
  'hành động': 'hanh-dong',
  'tình cảm': 'tinh-cam',
  'lãng mạn': 'tinh-cam',
  'khoa học viễn tưởng': 'khoa-hoc-vien-tuong',
  'viễn tưởng': 'khoa-hoc-vien-tuong',
  'kinh dị': 'kinh-di',
  'hoạt hình': 'hoat-hinh',
  'cổ trang': 'co-trang',
  'chiến tranh': 'chien-tranh',
  'tài liệu': 'tai-lieu',
  'tâm lý': 'tam-ly',
  'gia đình': 'gia-dinh',
  'phiêu lưu': 'phieu-luu',
  'giả tưởng': 'gia-tuong',
};

export function getCountrySlug(countryName?: string, fallbackSlug?: string): string | undefined {
  if (fallbackSlug && VALID_COUNTRY_SLUGS.has(fallbackSlug)) return fallbackSlug;
  if (!countryName) return undefined;
  const lower = countryName.toLowerCase().trim();
  if (COUNTRY_NAME_TO_SLUG[lower]) return COUNTRY_NAME_TO_SLUG[lower];
  const candidate = normalizeSearchText(lower).replace(/\s+/g, '-');
  if (VALID_COUNTRY_SLUGS.has(candidate)) return candidate;
  return undefined;
}

export function getGenreSlug(genreName?: string): string | undefined {
  if (!genreName) return undefined;
  const lower = genreName.toLowerCase().trim();
  if (GENRE_NAME_TO_SLUG[lower]) return GENRE_NAME_TO_SLUG[lower];
  return normalizeSearchText(lower).replace(/\s+/g, '-');
}

/**
 * Maps an item from phim.nguonc.com API to the application's Movie interface
 */
export function mapNguonCToMovie(item: NguonCItem | NguonCDetailMovie, rank?: number): Movie {
  const isDetail = 'category' in item;
  let genres: string[] = [];
  let country: string | undefined;
  let countrySlug: string | undefined;

  if (isDetail && (item as NguonCDetailMovie).category) {
    const cats = (item as NguonCDetailMovie).category;
    for (const key in cats) {
      if (cats[key]?.group?.name === 'Thể loại') {
        genres = cats[key].list.map((c) => c.name);
      }
      if (cats[key]?.group?.name === 'Quốc gia') {
        if (cats[key].list && cats[key].list.length > 0) {
          country = cats[key].list[0].name;
          countrySlug = getCountrySlug(cats[key].list[0].name);
        }
      }
    }
  }

  // Fallback country detection from language if missing
  if (!countrySlug && item.language) {
    const langLower = item.language.toLowerCase();
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
      country = country || 'Mỹ';
      countrySlug = 'my';
    } else if (langLower.includes('việt')) {
      country = country || 'Việt Nam';
      countrySlug = 'viet-nam';
    }
  }

  if (genres.length === 0) {
    genres = ['Phim hot', item.language || 'Vietsub'];
  }

  const isSeries = Boolean(
    (item.total_episodes && item.total_episodes > 1) ||
    (item.current_episode && !item.current_episode.toLowerCase().includes('full'))
  );

  const { durationStr, durationMinutes } = parseMovieDuration(item.time, isSeries);

  // Calculate high match rate between 92% and 99%
  const randomMatch = 93 + Math.floor((item.name.length * 7) % 7);

  // Parse episodes into Seasons structure if available
  let seasonsList: Season[] | undefined;
  let firstEmbedUrl: string | undefined;

  if (isDetail && (item as NguonCDetailMovie).episodes) {
    const detail = item as NguonCDetailMovie;
    const episodesServers = detail.episodes || [];

    if (episodesServers.length > 0) {
      // Pick first server's items
      const mainServer = episodesServers[0];
      if (mainServer?.items?.length > 0) {
        firstEmbedUrl = mainServer.items[0].embed;
        seasonsList = [
          {
            seasonNumber: 1,
            title: mainServer.server_name || 'Phần 1',
            episodes: mainServer.items.map((ep, idx) => ({
              id: `${item.slug}-ep-${ep.slug || idx + 1}`,
              number: ep.name,
              title: `Tập ${ep.name}`,
              duration: `${durationMinutes} phút`,
              description: item.description?.slice(0, 150) + '...' || '',
              thumbnail: item.poster_url || item.thumb_url || '',
              embedUrl: ep.embed,
              slug: ep.slug,
            })),
          },
        ];
      }
    }
  }

  // Create badge
  const hasNewEp = item.current_episode && item.current_episode !== 'FULL';
  const badges = {
    ribbon: hasNewEp ? 'Tập mới' : 'Mới thêm',
    subBadge: hasNewEp ? item.current_episode : 'Xem ngay',
    isTop10: rank !== undefined ? rank <= 10 : false,
  };

  let parsedYear = typeof item.year === 'number' ? item.year : parseInt(String(item.year || ''), 10);
  if (!parsedYear || isNaN(parsedYear)) {
    const yearMatch = `${item.name} ${item.original_name || ''}`.match(/\b(19\d\d|20\d\d)\b/);
    parsedYear = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  }

  return {
    id: item.slug || `movie-${Math.random()}`,
    slug: item.slug,
    title: item.name,
    subTitle: item.original_name,
    type: isSeries ? 'series' : 'movie',
    year: parsedYear,
    seasons: item.current_episode ? item.current_episode : durationStr || (isSeries ? `${item.total_episodes || 1} tập` : 'Phim lẻ'),
    duration: durationStr,
    durationMinutes,
    rating: 'T16',
    genres,
    country,
    countrySlug,
    matchRate: randomMatch,
    quality: item.quality?.includes('4K') ? '4K Ultra HD' : 'HD',
    audioTags: item.language ? [item.language, '5.1'] : ['5.1'],
    description: item.description || 'Không có mô tả chi tiết cho phim này.',
    heroTagline: `${isSeries ? 'Series' : 'Phim'} • ${genres[0] || 'Phổ biến'} • ${parsedYear} • ${item.quality || 'HD'}`,
    backdropUrl: item.poster_url || item.thumb_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
    posterUrl: item.thumb_url || item.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop',
    rank,
    badges,
    cast: item.casts ? item.casts.split(',').map((c) => c.trim()) : undefined,
    director: item.director,
    tags: [item.language || 'Vietsub', item.quality || 'HD', genres[0] || 'Thịnh hành'],
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    embedUrl: firstEmbedUrl,
    episodesServers: isDetail ? (item as NguonCDetailMovie).episodes : undefined,
    seasonsList,
    tmdb: item.tmdb,
    imdb: item.imdb,
    logoUrl: (item as any).logoUrl,
  };
}

/**
 * Fetch newly updated movies
 */
export async function getNewUpdatedMovies(page = 1): Promise<Movie[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/films/phim-moi-cap-nhat?page=${page}`, {
      next: { revalidate: 300 }, // Cache 5 minutes
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data: NguonCListResponse = await res.json();
    return (data.items || []).map((item, idx) => mapNguonCToMovie(item, idx + 1));
  } catch (error) {
    console.error('Error fetching new updated movies:', error);
    return [];
  }
}

/**
 * Fetch movies by category slug (tv-shows, phim-bo, phim-le, phim-dang-chieu)
 */
export async function getMoviesByCategory(slug: string, page = 1): Promise<Movie[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/films/danh-sach/${slug}?page=${page}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data: NguonCListResponse = await res.json();
    return (data.items || []).map((item, idx) => mapNguonCToMovie(item, idx + 1));
  } catch {
    return [];
  }
}

/**
 * Fetch movies by genre slug (phim-hai, hanh-dong, tinh-cam, kinh-di, hoat-hinh)
 */
export async function getMoviesByGenre(slug: string, page = 1): Promise<Movie[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/films/the-loai/${slug}?page=${page}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data: NguonCListResponse = await res.json();
    return (data.items || []).map((item, idx) => mapNguonCToMovie(item, idx + 1));
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
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${API_BASE_URL}/films/the-loai/${slug}?page=${page}`, {
        headers: {
          Accept: 'application/json',
        },
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        return { movies: [], totalPages: 0, totalItems: 0 };
      }
      const data: NguonCListResponse = await res.json();
      return {
        movies: (data.items || []).map((item, idx) => mapNguonCToMovie(item, (page - 1) * 10 + idx + 1)),
        totalPages: data.paginate?.total_page || 1,
        totalItems: data.paginate?.total_items || 0,
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
  { slug: 'my', name: 'Mỹ', language: 'Tiếng Anh (Mỹ)' },
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
  { slug: 'italy', name: 'Ý (Italy)', language: 'Tiếng Ý' },
  { slug: 'an-do', name: 'Ấn Độ', language: 'Tiếng Hindi (Ấn Độ)' },
  { slug: 'canada', name: 'Ca-na-đa (Canada)', language: 'Tiếng Anh (Canada)' },
  { slug: 'uc', name: 'Úc', language: 'Tiếng Anh (Úc)' },
  { slug: 'philippines', name: 'Philippines', language: 'Tiếng Philippines' },
  { slug: 'nga', name: 'Nga', language: 'Tiếng Nga' },
  { slug: 'bi', name: 'Bỉ', language: 'Tiếng Flemish / Pháp (Bỉ)' },
  { slug: 'brazil', name: 'Bra-xin (Brazil)', language: 'Tiếng Bồ Đào Nha (Brazil)' },
];

/**
 * Fetch movies by country slug (han-quoc, nhat-ban, my, viet-nam)
 */
export async function getMoviesByCountry(slug: string, page = 1): Promise<Movie[]> {
  if (!slug || !VALID_COUNTRY_SLUGS.has(slug)) return [];
  try {
    const res = await fetch(`${API_BASE_URL}/films/quoc-gia/${slug}?page=${page}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      // 404 or non-200: gracefully return empty array without throwing console error
      return [];
    }
    const data: NguonCListResponse = await res.json();
    return (data.items || []).map((item, idx) => mapNguonCToMovie(item, idx + 1));
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
  if (!slug || !VALID_COUNTRY_SLUGS.has(slug)) {
    return { movies: [], totalPages: 0, totalItems: 0 };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${API_BASE_URL}/films/quoc-gia/${slug}?page=${page}`, {
        headers: {
          Accept: 'application/json',
        },
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        return { movies: [], totalPages: 0, totalItems: 0 };
      }
      const data: NguonCListResponse = await res.json();
      return {
        movies: (data.items || []).map((item, idx) => mapNguonCToMovie(item, (page - 1) * 10 + idx + 1)),
        totalPages: data.paginate?.total_page || 1,
        totalItems: data.paginate?.total_items || 0,
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
 * Fetch Vietnamese movies, prioritizing the latest standalone feature films (phim lẻ Việt Nam mới nhất)
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
 * Fetch latest Chinese movie slugs from NguonC country endpoint
 * Used to completely hide/filter all Chinese content from the Home Page.
 */
export async function getChineseMovieSlugs(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedChinaSlugs && now - lastChinaFetchTime < 10 * 60 * 1000) {
    return cachedChinaSlugs;
  }

  try {
    const pages = await Promise.all(
      [1, 2, 3, 4, 5, 6, 7, 8].map((p) =>
        fetch(`${API_BASE_URL}/films/quoc-gia/trung-quoc?page=${p}`, {
          next: { revalidate: 600 },
        })
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .catch(() => ({ items: [] }))
      )
    );

    const slugSet = new Set<string>();
    for (const page of pages) {
      for (const item of page.items || []) {
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
export function isChineseMovie(movie?: Movie | NguonCItem | null, chinaSlugSet?: Set<string>): boolean {
  if (!movie) return false;

  const slug = 'slug' in movie && movie.slug ? movie.slug : ('id' in movie ? movie.id : '');
  if (slug && chinaSlugSet && chinaSlugSet.has(slug)) return true;

  if ('countrySlug' in movie && movie.countrySlug === 'trung-quoc') return true;
  if ('country' in movie && movie.country?.toLowerCase().includes('trung')) return true;

  // Language check
  const lang = (
    ('language' in movie && movie.language ? movie.language : '') +
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
  const sub = ('subTitle' in movie && movie.subTitle ? movie.subTitle : ('original_name' in movie ? movie.original_name : '')) || '';
  const desc = ('description' in movie && movie.description ? movie.description : '') || '';

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

const TMDB_API_KEY =
  process.env.TMDB_API_KEY || '58dba4066f4f36e49e5e769304442088';

export interface SearchMoviesResponse {
  movies: Movie[];
  totalPages: number;
  currentPage: number;
  totalItems?: number;
}

interface TMDBSearchCandidate {
  id: number;
  title: string;
  original_title?: string;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  score: number;
}

// In-memory cache for direct TMDB movie lookups across searches
const tmdbMovieScoreCache = new Map<string, TMDBSearchCandidate>();

function cleanSearchTitle(str?: string): string {
  if (!str) return '';
  return normalizeSearchText(str)
    .replace(/^(phim|movie|batman\s*\d*|nguoi\s*doi\s*\d*|nguoi\s*nhen\s*\d*)\s*[:\-]\s*/i, '')
    .trim();
}

/**
 * High-confidence matcher to link an NguonC item with a TMDB movie candidate.
 * Strictly avoids false positives caused by common 1-2 word franchise names like 'Người Dơi' or 'Batman'.
 */
function isHighConfidenceMatch(item: NguonCItem, candidate: any): boolean {
  const normItemName = normalizeSearchText(item.name);
  const normItemOrig = normalizeSearchText(item.original_name);
  const cleanItemName = cleanSearchTitle(item.name);
  const cleanItemOrig = cleanSearchTitle(item.original_name);

  const normCandTitle = normalizeSearchText(candidate.title || candidate.name);
  const normCandOrig = normalizeSearchText(candidate.original_title || candidate.original_name);
  const cleanCandTitle = cleanSearchTitle(candidate.title || candidate.name);
  const cleanCandOrig = cleanSearchTitle(candidate.original_title || candidate.original_name);

  // 1. Exact match on original English titles (e.g. 'The Dark Knight Rises' === 'The Dark Knight Rises')
  if (normItemOrig && normCandOrig && normItemOrig === normCandOrig) return true;
  if (cleanItemOrig && cleanCandOrig && cleanItemOrig === cleanCandOrig) return true;

  // 2. Exact match on Vietnamese titles
  if (normItemName && normCandTitle && normItemName === normCandTitle) return true;
  if (cleanItemName && cleanCandTitle && cleanItemName === cleanCandTitle) return true;

  // 3. Cross exact match (sometimes English title is stored in Vietnamese name field or vice versa)
  if (normItemName && normCandOrig && normItemName === normCandOrig) return true;
  if (normItemOrig && normCandTitle && normItemOrig === normCandTitle) return true;

  // 4. Release year proximity check (within 1 year) with substantial title phrase matching
  const itemYear = typeof item.year === 'number' ? item.year : parseInt(item.year || '0', 10);
  const candYear = parseInt(((candidate.release_date || candidate.first_air_date || '')).slice(0, 4), 10);

  if (itemYear && candYear && Math.abs(itemYear - candYear) <= 1) {
    if (cleanItemName && cleanCandTitle && (cleanItemName.includes(cleanCandTitle) || cleanCandTitle.includes(cleanItemName))) {
      // Must be a distinct phrase, not a generic 1-2 word short name
      if (cleanCandTitle.length > 8 && cleanItemName.length > 8) return true;
    }
    if (cleanItemOrig && cleanCandOrig && (cleanItemOrig.includes(cleanCandOrig) || cleanCandOrig.includes(cleanItemOrig))) {
      if (cleanCandOrig.length > 8 && cleanItemOrig.length > 8) return true;
    }
  }

  return false;
}

function rankSearchItem(
  item: NguonCItem,
  query: string,
  tmdbCandidate?: TMDBSearchCandidate
): number {
  const qNorm = normalizeSearchText(query);
  const nameNorm = normalizeSearchText(item.name);
  const origNorm = normalizeSearchText(item.original_name);
  let score = 0;

  // 1. Relevance: Exact or strong containment of query
  if (nameNorm === qNorm || origNorm === qNorm) {
    score += 150;
  } else if (nameNorm.includes(qNorm) || origNorm.includes(qNorm)) {
    score += 80;
  } else {
    const qWords = qNorm.split(' ').filter(Boolean);
    const combined = `${nameNorm} ${origNorm}`;
    if (qWords.length > 0 && qWords.every((w) => combined.includes(w))) {
      score += 50;
    } else {
      score += 20; // Associated franchise or collection match
    }
  }

  // 2. TMDB Quality & Acclaim Booster (Dominant factor for people looking for great movies)
  // Quality Score = vote_average * log10(vote_count + 1)
  // Legendary films (e.g. The Dark Knight 8.5 with 37k votes -> 38.99 * 12 = +468 pts)
  // Blockbusters (e.g. The Dark Knight Rises 7.8 with 25k votes -> 34.3 * 12 = +412 pts)
  // Acclaimed animation (e.g. Under the Red Hood 7.8 with 1.8k votes -> 25.3 * 12 = +304 pts)
  // Minor cartoons (e.g. 6.7 with 200 votes -> 15.4 * 12 = +185 pts)
  // Unrated or obscure films -> +0 pts
  if (tmdbCandidate && tmdbCandidate.score > 0) {
    score += Math.round(tmdbCandidate.score * 12);
  }

  // 3. Modest recency tiebreaker (without penalizing classics)
  const year = typeof item.year === 'number' ? item.year : parseInt(item.year || '2020', 10);
  if (year >= 2024) score += 10;
  else if (year >= 2020) score += 5;

  return score;
}

/**
 * Search movies by keyword with TMDB Masterpiece Booster, multi-page aggregation, and smart relevance ranking.
 */
export async function searchMoviesWithPagination(
  keyword: string,
  page = 1
): Promise<SearchMoviesResponse> {
  const clean = keyword?.trim();
  if (!clean) return { movies: [], totalPages: 1, currentPage: 1, totalItems: 0 };

  try {
    // Determine NguonC pages to batch (5 pages per batch to give comprehensive results immediately)
    const BATCH_SIZE = 5;
    const startNguonCPage = (page - 1) * BATCH_SIZE + 1;

    // 1. Fetch initial page of this batch from NguonC
    const res = await fetch(`${API_BASE_URL}/films/search?keyword=${encodeURIComponent(clean)}&page=${startNguonCPage}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data: NguonCListResponse = await res.json();

    let allItems: NguonCItem[] = data.items || [];
    const totalNguonCPages = data.paginate?.total_page || 1;
    const totalItems = data.paginate?.total_items || allItems.length;

    // Concurrently fetch the remaining pages in this batch
    const extraPromises: Promise<NguonCListResponse>[] = [];
    const endNguonCPage = Math.min(startNguonCPage + BATCH_SIZE - 1, totalNguonCPages);

    for (let p = startNguonCPage + 1; p <= endNguonCPage; p++) {
      extraPromises.push(
        fetch(`${API_BASE_URL}/films/search?keyword=${encodeURIComponent(clean)}&page=${p}`)
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .catch(() => ({ items: [] }))
      );
    }

    // 2. Concurrently fetch TMDB movies, TV series, and franchise collections
    const tmdbMoviePromises = [1, 2, 3].map((p) =>
      fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=vi-VN&query=${encodeURIComponent(clean)}&page=${p}`
      )
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .catch(() => ({ results: [] }))
    );

    const tmdbTvPromise = fetch(
      `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&language=vi-VN&query=${encodeURIComponent(clean)}&page=1`
    )
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .catch(() => ({ results: [] }));

    const tmdbColPromise = fetch(
      `https://api.themoviedb.org/3/search/collection?api_key=${TMDB_API_KEY}&language=vi-VN&query=${encodeURIComponent(clean)}`
    )
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .catch(() => ({ results: [] }));

    const [extraResults, tmdbMovieResults, tmdbTvResult, tmdbColResult] = await Promise.all([
      Promise.all(extraPromises),
      Promise.all(tmdbMoviePromises),
      tmdbTvPromise,
      tmdbColPromise,
    ]);

    for (const resPage of extraResults) {
      if (resPage.items && Array.isArray(resPage.items)) {
        allItems.push(...resPage.items);
      }
    }

    // 3. Aggregate TMDB candidates (movies, series, and collection parts)
    const tmdbCandidatesRaw: any[] = [];
    for (const resP of tmdbMovieResults) {
      if (resP.results && Array.isArray(resP.results)) {
        tmdbCandidatesRaw.push(...resP.results);
      }
    }
    if (tmdbTvResult.results && Array.isArray(tmdbTvResult.results)) {
      tmdbCandidatesRaw.push(...tmdbTvResult.results);
    }

    // Expand top franchise collections (e.g. The Dark Knight collection -> The Dark Knight, The Dark Knight Rises)
    if (tmdbColResult.results && tmdbColResult.results.length > 0) {
      const topCols = tmdbColResult.results.slice(0, 15);
      const colDetails = await Promise.all(
        topCols.map((c: any) =>
          fetch(`https://api.themoviedb.org/3/collection/${c.id}?api_key=${TMDB_API_KEY}&language=vi-VN`)
            .then((r) => (r.ok ? r.json() : { parts: [] }))
            .catch(() => ({ parts: [] }))
        )
      );
      for (const cd of colDetails) {
        if (cd.parts && Array.isArray(cd.parts)) {
          tmdbCandidatesRaw.push(...cd.parts);
        }
      }
    }

    const tmdbCandidates: TMDBSearchCandidate[] = tmdbCandidatesRaw
      .map((item) => {
        const title = item.title || item.name || '';
        const original_title = item.original_title || item.original_name || '';
        const vote_average = typeof item.vote_average === 'number' ? item.vote_average : 0;
        const vote_count = typeof item.vote_count === 'number' ? item.vote_count : 0;
        const score = vote_average * Math.log10(vote_count + 1);
        return {
          id: item.id,
          title,
          original_title,
          vote_average,
          vote_count,
          release_date: item.release_date || item.first_air_date || '',
          score,
        };
      })
      .filter((c) => c.title && c.vote_count >= 20 && c.vote_average >= 6.0)
      .sort((a, b) => b.score - a.score);

    // 4. Identify top TMDB masterpieces that might be buried on later NguonC pages (e.g. Spirited Away, The Dark Knight)
    const topMasterpieces = tmdbCandidates.slice(0, 6);
    const missingMasterpieces = topMasterpieces.filter((tm) => {
      return !allItems.some((item) => isHighConfidenceMatch(item, tm));
    });

    if (missingMasterpieces.length > 0) {
      const pinpointPromises = missingMasterpieces.map((m) =>
        fetch(`${API_BASE_URL}/films/search?keyword=${encodeURIComponent(m.title || m.original_title || '')}&page=1`)
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .catch(() => ({ items: [] }))
      );
      const pinpointResults = await Promise.all(pinpointPromises);
      for (const pRes of pinpointResults) {
        if (pRes.items && Array.isArray(pRes.items)) {
          allItems.push(...pRes.items);
        }
      }
    }

    // 5. Deduplicate items by slug
    const seenSlugs = new Set<string>();
    const uniqueItems: NguonCItem[] = [];
    for (const item of allItems) {
      const key = item.slug || item.name;
      if (!seenSlugs.has(key)) {
        seenSlugs.add(key);
        uniqueItems.push(item);
      }
    }

    // 6. Enrich every item with TMDB score (matching against candidate pool, or cached direct lookup)
    const itemScoreMap = new Map<string, TMDBSearchCandidate>();
    const missingItems: NguonCItem[] = [];

    for (const item of uniqueItems) {
      // Check cache first
      const cacheKey = `${item.slug}_${item.original_name || item.name}`;
      if (tmdbMovieScoreCache.has(cacheKey)) {
        itemScoreMap.set(item.slug, tmdbMovieScoreCache.get(cacheKey)!);
        continue;
      }

      // Check candidate pool
      const matched = tmdbCandidates.find((c) => isHighConfidenceMatch(item, c));
      if (matched) {
        itemScoreMap.set(item.slug, matched);
        tmdbMovieScoreCache.set(cacheKey, matched);
      } else {
        missingItems.push(item);
      }
    }

    // Direct parallel TMDB lookup for items that didn't match candidate pool
    if (missingItems.length > 0) {
      await Promise.all(
        missingItems.map(async (item) => {
          const cacheKey = `${item.slug}_${item.original_name || item.name}`;
          const q = item.original_name || item.name;
          try {
            const resTmdb = await fetch(
              `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=vi-VN&query=${encodeURIComponent(q)}`
            ).then((r) => (r.ok ? r.json() : { results: [] }));

            const best = resTmdb.results?.[0];
            if (best) {
              const vAvg = typeof best.vote_average === 'number' ? best.vote_average : 0;
              const vCnt = typeof best.vote_count === 'number' ? best.vote_count : 0;
              const candidateInfo: TMDBSearchCandidate = {
                id: best.id,
                title: best.title || '',
                original_title: best.original_title || '',
                vote_average: vAvg,
                vote_count: vCnt,
                release_date: best.release_date || '',
                score: vAvg * Math.log10(vCnt + 1),
              };
              itemScoreMap.set(item.slug, candidateInfo);
              tmdbMovieScoreCache.set(cacheKey, candidateInfo);
            }
          } catch {}
        })
      );
    }

    // 7. Rank items by relevance and TMDB quality score
    uniqueItems.sort((a, b) => {
      const scoreA = rankSearchItem(a, clean, itemScoreMap.get(a.slug));
      const scoreB = rankSearchItem(b, clean, itemScoreMap.get(b.slug));
      return scoreB - scoreA;
    });

    // 8. Map to Movie objects with enriched TMDB match info and accurate match rates
    const movies = uniqueItems.map((item) => {
      const movie = mapNguonCToMovie(item);
      const matchedTmdb = itemScoreMap.get(item.slug);

      if (matchedTmdb) {
        const vote = matchedTmdb.vote_average;
        movie.matchRate = Math.min(99, Math.max(88, Math.round(vote * 10 + 5)));
        movie.tmdb = {
          id: matchedTmdb.id,
          type: 'movie',
          voteAverage: matchedTmdb.vote_average,
          voteCount: matchedTmdb.vote_count,
        };
      }
      return movie;
    });

    // Calculate total pages for client (each batch represents BATCH_SIZE NguonC pages)
    const clientTotalPages = Math.ceil(totalNguonCPages / BATCH_SIZE);

    return {
      movies,
      totalPages: clientTotalPages,
      currentPage: page,
      totalItems,
    };
  } catch (error) {
    console.error('Error searching movies:', error);
    return { movies: [], totalPages: 1, currentPage: 1, totalItems: 0 };
  }
}

/**
 * Search movies by keyword with multi-page aggregation and smart relevance ranking
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
    const res = await fetch(`${API_BASE_URL}/film/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data: NguonCDetailResponse = await res.json();
    if (data.status === 'success' && data.movie) {
      return mapNguonCToMovie(data.movie);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching movie detail ${slug}:`, error);
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

    // Thematic keywords for deep semantic genre match in title & description
    const genreKeywordMap: Record<string, string[]> = {
      'hinh-su': ['hinh su', 'canh sat', 'dieu tra', 'an mang', 'toi pham', 'pha an', 'nghi pham', 'trinh tham'],
      'bi-an': ['bi an', 'bi mat', 'su that', 'ky la', 'am muu', 'giau kin', 'giai ma'],
      'chinh-kich': ['chinh kich', 'tam ly', 'gia dinh', 'so phan', 'dau tranh', 'cam xuc', 'cuoc song', 'tinh cam'],
      'phim-hai': ['hai huoc', 'tieng cuoi', 'vui nhon', 'di dom', 'gay cuoi', 'hai huoc'],
      'hanh-dong': ['hanh dong', 'chien dau', 'doi dau', 'truy sat', 'sung', 'vo thuat', 'nguy hiem'],
      'khoa-hoc-vien-tuong': ['khoa hoc', 'vien tuong', 'vu tru', 'nguoi ngoai hanh tinh', 'sieu anh hung', 'tuong lai'],
      'kinh-di': ['kinh di', 'ma quai', 'rung ron', 'am anh', 'linh hon', 'ac quy'],
      'tinh-cam': ['tinh yeu', 'hen ho', 'ngot ngao', 'yeu duong', 'trai tim', 'rung dong', 'hon nhan'],
      'co-trang': ['co trang', 'trieu dai', 'hoang cung', 'kiem hiep', 'tien hiep', 'cung dau'],
    };

    const scoredCandidates: { movie: Movie; score: number }[] = [];

    for (const { movie: candMovie, isSameCountry, matchedGenreSlugs } of candidateMap.values()) {
      let score = 0;

      // === CRITERIA 1: COUNTRY OF ORIGIN (Quốc gia - Highest Priority) ===
      if (isSameCountry) {
        score += 350; // Dominant weight: guarantees same-country movies outrank foreign titles
      }

      // === CRITERIA 2: GENRE ALIGNMENT (Thể loại) ===
      // A. Matched from genre API endpoint
      score += matchedGenreSlugs.size * 60;

      // B. Candidate genres matching target genres
      if (candMovie.genres?.length) {
        for (const cg of candMovie.genres) {
          const cgNorm = normalizeSearchText(cg);
          if (targetGenresNorm.includes(cgNorm)) {
            score += 45;
          }
        }
      }

      // C. Description & title semantic thematic match
      const fullTextNorm = `${normalizeSearchText(candMovie.title)} ${normalizeSearchText(candMovie.description)}`;
      for (const gSlug of validGenreSlugs) {
        const keywords = genreKeywordMap[gSlug];
        if (keywords) {
          for (const kw of keywords) {
            if (fullTextNorm.includes(kw)) {
              score += 25;
              break;
            }
          }
        }
      }

      // Format alignment (series with series, movie with movie)
      if ((candMovie.type === 'series') === isSeries) {
        score += 35;
      }

      // === CRITERIA 3: MAIN CAST & CREW (Diễn viên chính & Đạo diễn) ===
      if (candMovie.cast?.length && targetCastsNorm.length > 0) {
        for (const actor of candMovie.cast) {
          const actorNorm = normalizeSearchText(actor);
          if (actorNorm && targetCastsNorm.some((tc) => tc.includes(actorNorm) || actorNorm.includes(tc))) {
            score += 250; // High bonus for shared lead actor!
          }
        }
      }

      if (candMovie.director && targetDirectorNorm) {
        const candDirNorm = normalizeSearchText(candMovie.director);
        if (candDirNorm && (candDirNorm.includes(targetDirectorNorm) || targetDirectorNorm.includes(candDirNorm))) {
          score += 100;
        }
      }

      // === RECENCY & TIME CONTEXT ===
      const yearDiff = Math.abs(candMovie.year - target.year);
      if (yearDiff <= 1) {
        score += 20;
      } else if (yearDiff <= 3) {
        score += 10;
      }

      // Dynamic match rate calculation (90% - 99%)
      const dynamicMatchRate = Math.min(99, Math.max(90, 90 + Math.floor(score / 50)));
      candMovie.matchRate = dynamicMatchRate;

      scoredCandidates.push({ movie: candMovie, score });
    }

    // Sort by descending score
    scoredCandidates.sort((a, b) => b.score - a.score);

    const topMovies = scoredCandidates.slice(0, limit).map((s) => s.movie);

    // If somehow fewer than limit (e.g. rare country), fill with updated
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

