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

export const COUNTRY_NAME_TO_SLUG: Record<string, string> = {
  'hàn quốc': 'han-quoc',
  'mỹ': 'my',
  'hoa kỳ': 'my',
  'nhật bản': 'nhat-ban',
  'trung quốc': 'trung-quoc',
  'việt nam': 'viet-nam',
  'thái lan': 'thai-lan',
  'anh': 'anh',
  'vương quốc anh': 'anh',
  'hồng kông': 'hong-kong',
  'hong kong': 'hong-kong',
  'đài loan': 'dai-loan',
  'pháp': 'phap',
  'đức': 'duc',
  'tây ban nha': 'tay-ban-nha',
  'ý': 'italy',
  'italy': 'italy',
  'ấn độ': 'an-do',
  'canada': 'canada',
  'ca-na-đa': 'canada',
  'úc': 'uc',
  'philippines': 'philippines',
  'nga': 'nga',
  'bỉ': 'bi',
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
  if (fallbackSlug) return fallbackSlug;
  if (!countryName) return undefined;
  const lower = countryName.toLowerCase().trim();
  if (COUNTRY_NAME_TO_SLUG[lower]) return COUNTRY_NAME_TO_SLUG[lower];
  return normalizeSearchText(lower).replace(/\s+/g, '-');
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

  const parsedYear = typeof item.year === 'number' ? item.year : parseInt(item.year || '2026', 10) || 2026;

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
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data: NguonCListResponse = await res.json();
    return (data.items || []).map((item, idx) => mapNguonCToMovie(item, idx + 1));
  } catch (error) {
    console.error(`Error fetching category ${slug}:`, error);
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
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data: NguonCListResponse = await res.json();
    return (data.items || []).map((item, idx) => mapNguonCToMovie(item, idx + 1));
  } catch (error) {
    console.error(`Error fetching genre ${slug}:`, error);
    return [];
  }
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
  try {
    const res = await fetch(`${API_BASE_URL}/films/quoc-gia/${slug}?page=${page}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data: NguonCListResponse = await res.json();
    return (data.items || []).map((item, idx) => mapNguonCToMovie(item, idx + 1));
  } catch (error) {
    console.error(`Error fetching country ${slug}:`, error);
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
  try {
    const res = await fetch(`${API_BASE_URL}/films/quoc-gia/${slug}?page=${page}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data: NguonCListResponse = await res.json();
    return {
      movies: (data.items || []).map((item, idx) => mapNguonCToMovie(item, (page - 1) * 10 + idx + 1)),
      totalPages: data.paginate?.total_page || 1,
      totalItems: data.paginate?.total_items || 0,
    };
  } catch (error) {
    console.error(`Error fetching country paginated ${slug}:`, error);
    return { movies: [], totalPages: 1, totalItems: 0 };
  }
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

function rankSearchItem(item: NguonCItem, query: string): number {
  const qNorm = normalizeSearchText(query);
  const nameNorm = normalizeSearchText(item.name);
  const origNorm = normalizeSearchText(item.original_name);
  let score = 0;

  // 1. Exact match
  if (nameNorm === qNorm || origNorm === qNorm) {
    score += 200;
  }

  // 2. Starts with query (e.g. 'Lanterns' starts with 'Lantern')
  if (nameNorm.startsWith(qNorm) || origNorm.startsWith(qNorm)) {
    score += 120;
  }

  // 3. Word boundary match
  const words = `${nameNorm} ${origNorm}`.split(/\s+/);
  if (words.some((w) => w.startsWith(qNorm))) {
    score += 80;
  }

  // 4. Contains anywhere
  if (nameNorm.includes(qNorm) || origNorm.includes(qNorm)) {
    score += 40;
  }

  // 5. Recency boost (hot new releases like 2026 / 2025 rank higher)
  const year = typeof item.year === 'number' ? item.year : parseInt(item.year || '2020', 10);
  if (year >= 2026) score += 50;
  else if (year >= 2025) score += 40;
  else if (year >= 2024) score += 30;
  else if (year >= 2022) score += 15;

  return score;
}

/**
 * Search movies by keyword with multi-page aggregation and smart relevance ranking
 */
export async function searchMovies(keyword: string, page = 1): Promise<Movie[]> {
  const clean = keyword?.trim();
  if (!clean) return [];

  try {
    const res = await fetch(`${API_BASE_URL}/films/search?keyword=${encodeURIComponent(clean)}&page=${page}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data: NguonCListResponse = await res.json();

    let allItems: NguonCItem[] = data.items || [];
    const totalPages = data.paginate?.total_page || 1;

    // When on page 1, aggregate up to 3 pages in parallel so that relevant & recent movies
    // located on page 2 or 3 (like "Lực Lượng Lanterns") are not missed
    if (page === 1 && totalPages > 1) {
      const maxPages = Math.min(totalPages, 3);
      const extraPromises: Promise<NguonCListResponse>[] = [];

      for (let p = 2; p <= maxPages; p++) {
        extraPromises.push(
          fetch(`${API_BASE_URL}/films/search?keyword=${encodeURIComponent(clean)}&page=${p}`)
            .then((r) => (r.ok ? r.json() : { items: [] }))
            .catch(() => ({ items: [] }))
        );
      }

      const extraResults = await Promise.all(extraPromises);
      for (const resPage of extraResults) {
        if (resPage.items && Array.isArray(resPage.items)) {
          allItems.push(...resPage.items);
        }
      }
    }

    // Deduplicate items by slug / name
    const seenSlugs = new Set<string>();
    const uniqueItems: NguonCItem[] = [];
    for (const item of allItems) {
      const key = item.slug || item.name;
      if (!seenSlugs.has(key)) {
        seenSlugs.add(key);
        uniqueItems.push(item);
      }
    }

    // Rank items by relevance and release year
    uniqueItems.sort((a, b) => rankSearchItem(b, clean) - rankSearchItem(a, clean));

    return uniqueItems.map((item) => mapNguonCToMovie(item));
  } catch (error) {
    console.error('Error searching movies:', error);
    return [];
  }
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

    const countrySlug = target.countrySlug || getCountrySlug(target.country);
    const genres = target.genres || [];
    const cast = target.cast || [];
    const isSeries = target.type === 'series';

    // 1. Fetch Candidate Batches in Parallel
    const fetchPromises: Promise<{ items: Movie[]; sourceCountry?: string; sourceGenre?: string }>[] = [];

    // Source A: Same Country pages 1 & 2 (Guaranteed same country)
    if (countrySlug) {
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

