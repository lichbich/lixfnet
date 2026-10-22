import { Movie } from '@/types';
import { fetchTMDBLogo } from '@/services/logoService';

const TMDB_API_KEY =
  process.env.TMDB_API_KEY || '58dba4066f4f36e49e5e769304442088';
const NGUONC_API_BASE = 'https://phim.nguonc.com/api';

// In-memory cache to prevent redundant external queries
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cacheStore = new Map<string, CacheEntry<any>>();

function getFromCache<T>(key: string, ttlMs: number): T | null {
  const entry = cacheStore.get(key);
  if (entry && Date.now() - entry.timestamp < ttlMs) {
    return entry.data;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cacheStore.set(key, { data, timestamp: Date.now() });
}

/**
 * Async request queue to throttle concurrent NguonC API requests.
 * Prevents 429 throttling and dropped responses when 80+ movies load simultaneously.
 */
class AsyncQueue {
  private concurrency: number;
  private running = 0;
  private queue: (() => void)[] = [];

  constructor(concurrency = 3) {
    this.concurrency = concurrency;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const nguonCQueue = new AsyncQueue(3);

/**
 * 24-hour match cache for NguonC title lookups to eliminate duplicate API requests
 */
const matchCache = new Map<
  string,
  { result: { slug?: string; name?: string; original_name?: string } | null; timestamp: number }
>();

/**
 * Official Netflix Vietnam Tudum Dictionary
 * Maps English / International TSV weekly titles to exact Vietnamese titles, TMDB IDs, and known NguonC slugs.
 */
export const NETFLIX_VN_TUDUM_DICTIONARY: Record<
  string,
  {
    vietnameseTitle: string;
    originalTitle?: string;
    slug?: string;
    tmdbId?: number;
    year?: number;
    type: 'movie' | 'series';
  }
> = {
  'Bunny!': {
    vietnameseTitle: 'Thỏ Ơi!!',
    originalTitle: 'Hey, Bunny!',
    slug: 'tho-oi',
    tmdbId: 1528577,
    year: 2026,
    type: 'movie',
  },
  'Fish, Fists and Ambergris': {
    vietnameseTitle: 'Truy Tìm Long Diên Hương',
    originalTitle: 'Fish, Fists and Ambergris',
    slug: 'truy-tim-long-dien-huong',
    tmdbId: 1569555,
    year: 2025,
    type: 'movie',
  },
  'Animals': {
    vietnameseTitle: 'Bản Năng Thú',
    originalTitle: 'Animals',
    slug: 'ban-nang-thu',
    tmdbId: 1236045,
    year: 2026,
    type: 'movie',
  },
  'Tomb Raider': {
    vietnameseTitle: 'Tomb Raider: Huyền Thoại Bắt Đầu',
    originalTitle: 'Tomb Raider',
    slug: 'tomb-raider-huyen-thoai-bat-dau',
    tmdbId: 338970,
    year: 2018,
    type: 'movie',
  },
  'Evil Dead Burn': {
    vietnameseTitle: 'Ma Cây: Lửa Địa Ngục',
    originalTitle: 'Evil Dead Burn',
    tmdbId: 1212763,
    year: 2026,
    type: 'movie',
  },
  'Kong: Skull Island': {
    vietnameseTitle: 'Kong: Đảo Đầu Lâu',
    originalTitle: 'Kong: Skull Island',
    slug: 'kong-dao-dau-lau',
    tmdbId: 293167,
    year: 2017,
    type: 'movie',
  },
  'Mai': {
    vietnameseTitle: 'Mai',
    originalTitle: 'Mai',
    slug: 'mai',
    tmdbId: 1210973,
    year: 2024,
    type: 'movie',
  },
  'The Silence of the Lambs': {
    vietnameseTitle: 'Sự Im Lặng Của Bầy Cừu',
    originalTitle: 'The Silence of the Lambs',
    slug: 'su-im-lang-cua-bay-cuu',
    tmdbId: 274,
    year: 1991,
    type: 'movie',
  },
  'Ben-Hur': {
    vietnameseTitle: 'Ben-Hur',
    originalTitle: 'Ben-Hur',
    slug: 'ben-hur',
    tmdbId: 271969,
    year: 2016,
    type: 'movie',
  },
  'Crazy Rich Asians': {
    vietnameseTitle: 'Con Nhà Siêu Giàu Châu Á',
    originalTitle: 'Crazy Rich Asians',
    slug: 'con-nha-sieu-giau-chau-a',
    tmdbId: 455207,
    year: 2018,
    type: 'movie',
  },
  'Doctor X: Mafia in White': {
    vietnameseTitle: 'Bác Sĩ X: Mafia Áo Trắng',
    originalTitle: 'Doctor X: Mafia in White',
    slug: 'bac-si-x',
    tmdbId: 293610,
    year: 2026,
    type: 'series',
  },
  'Doctor X': {
    vietnameseTitle: 'Bác Sĩ X: Mafia Áo Trắng',
    originalTitle: 'Doctor X: Mafia in White',
    slug: 'bac-si-x',
    tmdbId: 293610,
    year: 2026,
    type: 'series',
  },
  'Doctor-X': {
    vietnameseTitle: 'Bác Sĩ X: Mafia Áo Trắng',
    originalTitle: 'Doctor X: Mafia in White',
    slug: 'bac-si-x',
    tmdbId: 293610,
    year: 2026,
    type: 'series',
  },
  '100 Days of Deception': {
    vietnameseTitle: '100 Ngày Lừa Dối',
    originalTitle: '100 Days of Deception',
    slug: '100-ngay-lua-doi',
    tmdbId: 293607,
    year: 2026,
    type: 'series',
  },
  'Take Charge of My Heart': {
    vietnameseTitle: 'Nạp Đầy Trái Tim',
    originalTitle: 'Take Charge of My Heart',
    slug: 'nap-day-trai-tim-phan-1',
    tmdbId: 289423,
    year: 2026,
    type: 'series',
  },
  'Below': {
    vietnameseTitle: 'Below: Ác Mộng Đại Dương',
    originalTitle: 'Below',
    tmdbId: 285322,
    year: 2026,
    type: 'series',
  },
  'Where the Mask Ends': {
    vietnameseTitle: 'Gả Kim Thoa',
    originalTitle: 'Where the Mask Ends',
    slug: 'ga-kim-thoa-ga-tram-vang',
    tmdbId: 300146,
    year: 2026,
    type: 'series',
  },
  'The Apothecary Diaries': {
    vietnameseTitle: 'Dược Sư Tự Sự',
    originalTitle: 'The Apothecary Diaries',
    slug: 'duoc-su-tu-su-phan-1',
    tmdbId: 220542,
    year: 2023,
    type: 'series',
  },
  'Irreplaceable': {
    vietnameseTitle: 'Không Thể Thay Thế',
    originalTitle: 'Irreplaceable',
    slug: 'khong-the-thay-the-2026',
    tmdbId: 297982,
    year: 2026,
    type: 'series',
  },
  'Irreplaceable: Season 1': {
    vietnameseTitle: 'Không Thể Thay Thế',
    originalTitle: 'Irreplaceable',
    slug: 'khong-the-thay-the-2026',
    tmdbId: 297982,
    year: 2026,
    type: 'series',
  },
  'Firefly Wedding': {
    vietnameseTitle: 'Đám Cưới Đom Đóm',
    originalTitle: 'Firefly Wedding',
    slug: 'dam-cuoi-dom-dom',
    tmdbId: 320909,
    year: 2026,
    type: 'series',
  },
  'The Early Spring': {
    vietnameseTitle: 'Đầu Xuân Tươi Sáng',
    originalTitle: 'The Early Spring',
    slug: 'dau-xuan-tuoi-sang',
    tmdbId: 299952,
    year: 2026,
    type: 'series',
  },
  'Doctor X Surgeon Michiko Daimon': {
    vietnameseTitle: 'Bác Sĩ X Ngoại Khoa: Daimon Michiko (Phần 1)',
    originalTitle: 'Doctor-X: Surgeon Michiko Daimon',
    slug: 'bac-si-x-ngoai-khoa-daimon-michiko-phan-1',
    tmdbId: 46052,
    year: 2012,
    type: 'series',
  },
};

/**
 * Pre-resolved dictionary for iconic streaming shows on Apple TV+ & HBO
 * Resolves slugs instantly in 0ms without hitting NguonC search API!
 */
export const STREAMING_PLATFORM_DICTIONARY: Record<
  string,
  {
    vietnameseTitle?: string;
    originalTitle?: string;
    slug: string;
    year?: number;
    type: 'series' | 'movie';
  }
> = {
  // Apple TV+ Originals
  'severance': {
    vietnameseTitle: 'Cắt Rời Ký Ức (Phần 1)',
    slug: 'cat-roi-ky-uc-phan-1',
    year: 2022,
    type: 'series',
  },
  'the morning show': {
    vietnameseTitle: 'Bản Tin Sáng (Phần 1)',
    slug: 'ban-tin-sang-phan-1',
    year: 2020,
    type: 'series',
  },
  'monarch: legacy of monsters': {
    vietnameseTitle: 'Monarch: Thế Giới Quái Thú (Phần 1)',
    slug: 'monarch-the-gioi-quai-thu-phan-1',
    year: 2023,
    type: 'series',
  },
  'silo': {
    vietnameseTitle: 'Hầm Silo (Phần 1)',
    slug: 'ham-silo-phan-1',
    year: 2023,
    type: 'series',
  },
  'ted lasso': {
    vietnameseTitle: 'Huấn Luyện Viên Ted Lasso (Phần 2)',
    slug: 'huan-luyen-vien-ted-lasso-phan-2',
    year: 2021,
    type: 'series',
  },
  'shrinking': {
    vietnameseTitle: 'Liệu Pháp Sự Thật (Phần 1)',
    slug: 'lieu-phap-su-that-phan-1',
    year: 2023,
    type: 'series',
  },
  'foundation': {
    vietnameseTitle: 'Lực Lượng Nền Móng (Phần 1)',
    slug: 'luc-luong-nen-mong-phan-1',
    year: 2022,
    type: 'series',
  },
  'black bird': {
    vietnameseTitle: 'Hắc Điểu',
    slug: 'hac-dieu',
    type: 'series',
  },
  'defending jacob': {
    vietnameseTitle: 'Bảo Vệ Jacob',
    slug: 'bao-ve-jacob',
    year: 2020,
    type: 'series',
  },
  'see': {
    vietnameseTitle: 'Thấy (Phần 1)',
    slug: 'thay-phan-1',
    year: 2019,
    type: 'series',
  },

  // HBO / Max Originals
  'house of the dragon': {
    vietnameseTitle: 'Gia Tộc Rồng (Phần 1)',
    slug: 'gia-toc-rong-phan-1',
    year: 2022,
    type: 'series',
  },
  'the last of us': {
    vietnameseTitle: 'Những Người Còn Sót Lại (Phần 1)',
    slug: 'nhung-nguoi-con-sot-lai-phan-1',
    year: 2023,
    type: 'series',
  },
  'the white lotus': {
    vietnameseTitle: 'Khu Nghỉ Dưỡng Hoa Sen Trắng (Phần 1)',
    slug: 'khu-nghi-duong-hoa-sen-trang-phan-1',
    year: 2021,
    type: 'series',
  },
  'game of thrones': {
    vietnameseTitle: 'Trò Chơi Vương Quyền (Phần 6)',
    slug: 'tro-choi-vuong-quyen-phan-6',
    year: 2016,
    type: 'series',
  },
  'chernobyl': {
    vietnameseTitle: 'Thảm Họa Hạt Nhân Chernobyl',
    slug: 'tham-hoa-hat-nhan-chernobyl',
    year: 2021,
    type: 'series',
  },
  'lanterns': {
    vietnameseTitle: 'Lực Lượng Lanterns (Phần 1)',
    slug: 'luc-luong-lanterns-phan-1',
    year: 2026,
    type: 'series',
  },
  'true detective': {
    vietnameseTitle: 'Thám Tử Chân Chính (Phần 1)',
    slug: 'tham-tu-chan-chinh-phan-1',
    year: 2014,
    type: 'series',
  },
  'succession': {
    vietnameseTitle: 'Kẻ Kế Vị (Phần 1)',
    slug: 'ke-ke-vi-phan-1',
    year: 2018,
    type: 'series',
  },
  'euphoria': {
    vietnameseTitle: 'Sự Phấn Khích (Phần 1)',
    slug: 'su-phan-khich-phan-1',
    year: 2019,
    type: 'series',
  },
};

/**
 * Standard TMDB Genre to Vietnamese NguonC Category mapping
 */
export const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Hành động',
  12: 'Phiêu lưu',
  16: 'Hoạt hình',
  35: 'Hài hước',
  80: 'Hình sự',
  99: 'Tài liệu',
  18: 'Chính kịch',
  10751: 'Gia đình',
  14: 'Viễn tưởng',
  36: 'Lịch sử',
  27: 'Kinh dị',
  10402: 'Âm nhạc',
  9648: 'Bí ẩn',
  10749: 'Tình cảm',
  878: 'Khoa học viễn tưởng',
  10770: 'Phim truyền hình',
  53: 'Gây cấn',
  10752: 'Chiến tranh',
  37: 'Miền Tây',
  10759: 'Hành động',
  10762: 'Hoạt hình',
  10763: 'Tin tức',
  10764: 'Truyền hình thực tế',
  10765: 'Khoa học viễn tưởng',
  10766: 'Tập phim',
  10767: 'Tọa đàm',
  10768: 'Chính trị',
};

function normalizeSearchText(str?: string): string {
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
 * Strict cross-validation score between a target movie and an NguonC candidate item.
 * Evaluates: Release Year, Media Type (Movie vs Series), Original Title, Vietnamese Title.
 * Year discrepancy >= 3 years results in an immediate rejection (-100).
 */
function scoreCandidate(
  target: { title: string; originalTitle?: string; year?: number; type?: 'movie' | 'series' },
  cand: any
): number {
  const tYear = target.year || 0;
  const cYear = typeof cand.year === 'number' ? cand.year : parseInt(cand.year || '0', 10);

  // 1. Year check: >= 3 years difference is an immediate rejection!
  // (Prevents 1982 horror film "Đèn Lồng Da Người" from matching 2026 DC series "Lanterns")
  if (tYear && cYear) {
    const diff = Math.abs(tYear - cYear);
    if (diff >= 3) return -100;
  }

  let score = 0;

  // Year bonus
  if (tYear && cYear) {
    const diff = Math.abs(tYear - cYear);
    if (diff === 0) score += 40;
    else if (diff === 1) score += 25;
    else if (diff === 2) score += 10;
  }

  // Type check (Movie vs Series)
  const candIsSeries = Boolean(
    (cand.total_episodes && cand.total_episodes > 1) ||
    (cand.current_episode && !cand.current_episode.toLowerCase().includes('full')) ||
    (cand.slug && (cand.slug.includes('phan-') || cand.slug.includes('tap-'))) ||
    (cand.name && (cand.name.toLowerCase().includes('phần') || cand.name.toLowerCase().includes('tập')))
  );

  if (target.type === 'series') {
    if (candIsSeries) score += 25;
    else score -= 25;
  } else if (target.type === 'movie') {
    if (!candIsSeries) score += 20;
    else score -= 25;
  }

  const normTargetTitle = normalizeSearchText(target.title);
  const normTargetOrig = normalizeSearchText(target.originalTitle);
  const normCandName = normalizeSearchText(cand.name);
  const normCandOrig = normalizeSearchText(cand.original_name);
  const normCandSlug = normalizeSearchText((cand.slug || '').replace(/-/g, ' '));

  // Match original title
  if (normTargetOrig) {
    if (
      normCandOrig &&
      (normCandOrig === normTargetOrig ||
        normCandOrig.includes(normTargetOrig) ||
        normTargetOrig.includes(normCandOrig))
    ) {
      score += 45;
    } else if (normCandName.includes(normTargetOrig) || normCandSlug.includes(normTargetOrig)) {
      score += 40;
    }
  }

  // Match Vietnamese / display title
  if (normTargetTitle) {
    if (
      normCandName &&
      (normCandName === normTargetTitle ||
        normCandName.includes(normTargetTitle) ||
        normTargetTitle.includes(normCandName))
    ) {
      score += 40;
    } else if (
      normCandOrig &&
      (normCandOrig.includes(normTargetTitle) || normTargetTitle.includes(normCandOrig))
    ) {
      score += 30;
    }
  }

  return score;
}

/**
 * Searches NguonC by keyword candidates with strict cross-validation.
 * Returns only high-confidence matching items (score >= 60).
 */
export async function findNguonCMatch(
  title: string,
  originalTitle?: string,
  extra?: { year?: number; type?: 'movie' | 'series' }
): Promise<{ slug?: string; embedUrl?: string; name?: string; original_name?: string } | null> {
  const clean = (s: string) =>
    (s || '')
      .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
      .replace(/[:\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const cacheKey = `${clean(title)}__${clean(originalTitle || '')}__${extra?.year || ''}__${extra?.type || ''}`;
  const cached = matchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 24 * 3600 * 1000) {
    return cached.result;
  }

  // 1. Instant check in STREAMING_PLATFORM_DICTIONARY for iconic platform shows (0ms network cost)
  const normTitle = normalizeSearchText(title);
  const normOrig = normalizeSearchText(originalTitle);

  for (const [key, val] of Object.entries(STREAMING_PLATFORM_DICTIONARY)) {
    const normKey = normalizeSearchText(key);
    if (
      (normOrig && (normOrig === normKey || normOrig.includes(normKey) || normKey.includes(normOrig))) ||
      (normTitle && (normTitle === normKey || normTitle.includes(normKey) || normKey.includes(normTitle)))
    ) {
      const match = {
        slug: val.slug,
        name: val.vietnameseTitle,
        original_name: val.originalTitle || originalTitle,
      };
      matchCache.set(cacheKey, { result: match, timestamp: Date.now() });
      return match;
    }
  }

  // Prioritize Latin/English original title first (for Western series like Lanterns, Severance, etc.)
  const queries: string[] = [];
  const isLatin = (s: string) => /^[a-zA-Z0-9\s.,!?:'-]+$/.test(s);

  if (originalTitle && isLatin(originalTitle)) {
    queries.push(clean(originalTitle));
  }
  if (title) {
    queries.push(clean(title));
    if (title.includes(' - ')) {
      title.split(' - ').forEach((p) => queries.push(clean(p)));
    }
    if (title.includes(': ')) {
      title.split(': ').forEach((p) => queries.push(clean(p)));
    }
  }
  if (originalTitle && !isLatin(originalTitle)) {
    queries.push(clean(originalTitle));
  }

  const uniqueQueries = Array.from(new Set(queries.filter((q) => q && q.length >= 2)));

  const target = {
    title,
    originalTitle,
    year: extra?.year,
    type: extra?.type,
  };

  let bestCandidate: any = null;
  let bestScore = -999;

  for (const q of uniqueQueries) {
    try {
      const items = await nguonCQueue.run(async () => {
        const res = await fetch(`${NGUONC_API_BASE}/films/search?keyword=${encodeURIComponent(q)}`, {
          next: { revalidate: 3600 },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
      });

      for (const item of items) {
        const score = scoreCandidate(target, item);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = item;
        }
      }

      // Early exit on exceptional match
      if (bestScore >= 120) {
        break;
      }
    } catch {
      // ignore network errors and try next query
    }
  }

  let finalResult: { slug?: string; embedUrl?: string; name?: string; original_name?: string } | null = null;
  if (bestScore >= 60 && bestCandidate?.slug) {
    finalResult = {
      slug: bestCandidate.slug,
      name: bestCandidate.name,
      original_name: bestCandidate.original_name,
    };
  }

  matchCache.set(cacheKey, { result: finalResult, timestamp: Date.now() });
  return finalResult;
}

/**
 * Convert TMDB item into application Movie object with accurate NguonC matching
 */
async function tmdbItemToMovie(
  item: any,
  mediaType: 'movie' | 'series',
  options: {
    rank?: number;
    isTop10?: boolean;
    platform?: 'netflix' | 'apple' | 'disney' | 'hbo' | 'prime';
    platformName?: string;
    preResolvedSlug?: string;
  }
): Promise<Movie> {
  const title = item.title || item.name || 'Phim';
  const subTitle = item.original_title || item.original_name;
  const yearStr = item.release_date || item.first_air_date || '';
  const parsedYear = yearStr ? parseInt(yearStr.slice(0, 4), 10) : undefined;
  const ratingScore = item.vote_average ? (item.vote_average * 10).toFixed(0) : '95';

  const posterUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop';

  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
    : posterUrl;

  // Standardize Vietnamese genres matching NguonC category taxonomy
  const rawGenreIds: number[] = Array.isArray(item.genre_ids)
    ? item.genre_ids
    : Array.isArray(item.genres)
    ? item.genres.map((g: any) => (typeof g === 'number' ? g : g.id)).filter(Boolean)
    : [];

  const mappedGenres: string[] = rawGenreIds
    .map((gid) => TMDB_GENRE_MAP[gid])
    .filter(Boolean);

  const finalGenres =
    mappedGenres.length > 0
      ? Array.from(new Set(mappedGenres)).slice(0, 3)
      : [options.platformName || 'Chính kịch', 'Đặc sắc'];

  // Attempt to match with NguonC playable item with strict cross-validation
  let matchSlug: string | undefined = options.preResolvedSlug;
  if (!matchSlug) {
    const match = await findNguonCMatch(title, subTitle, {
      year: parsedYear,
      type: mediaType,
    });
    matchSlug = match?.slug;
  }

  const isAvailable = Boolean(matchSlug);
  const isUpcoming = (parsedYear || 2024) >= 2026;

  // Ribbon & badge resolution
  let ribbon: string | undefined = undefined;
  let subBadge: string | undefined = options.platformName || 'Hot';

  if (!isAvailable) {
    ribbon = 'Chưa có sẵn';
    subBadge = isUpcoming ? 'Sắp chiếu' : 'Trailer';
  } else if (options.rank) {
    ribbon = `#${options.rank}`;
  } else if (options.isTop10) {
    ribbon = 'TOP 10';
  }

  // Logo fetch (best effort)
  let logoUrl: string | undefined = undefined;
  if (item.id) {
    try {
      const res = await fetchTMDBLogo({
        tmdbId: item.id,
        mediaType: mediaType === 'series' ? 'tv' : 'movie',
        title,
        subTitle,
      });
      logoUrl = res || undefined;
    } catch {}
  }

  return {
    id: matchSlug || `tmdb-${item.id || Math.random()}`,
    slug: matchSlug,
    title,
    subTitle,
    type: mediaType,
    year: parsedYear || 2024,
    seasons: mediaType === 'series' ? 'Nhiều tập' : 'Phim lẻ',
    duration: mediaType === 'series' ? '45 phút/tập' : '110 phút',
    durationMinutes: mediaType === 'series' ? 45 : 110,
    rating: 'T16',
    genres: finalGenres,
    matchRate: Math.min(99, Math.max(90, parseInt(ratingScore, 10))),
    quality: '4K Ultra HD',
    audioTags: ['5.1', 'Dolby Vision'],
    description: item.overview || 'Bộ phim đang làm mưa làm gió trên các bảng xếp hạng streaming thế giới.',
    backdropUrl,
    posterUrl,
    logoUrl,
    rank: options.rank,
    isAvailable,
    badges: {
      isTop10: options.isTop10,
      platform: options.platform,
      platformName: options.platformName,
      ribbon,
      subBadge,
    },
    tmdb: {
      id: item.id,
      type: mediaType === 'series' ? 'tv' : 'movie',
      voteAverage: item.vote_average,
      voteCount: item.vote_count,
    },
  };
}

/**
 * 1. Fetch Official Netflix Top 10 for Vietnam via server API route
 * Updates weekly, 100% official from Netflix Tudum.
 * Enriched with NETFLIX_VN_TUDUM_DICTIONARY for perfect accuracy on titles, TMDB IDs, and NguonC slugs.
 */
export async function getNetflixTop10VN(): Promise<{ series: Movie[]; films: Movie[] }> {
  const cached = getFromCache<{ series: Movie[]; films: Movie[] }>('netflix_top10_vn_v4', 4 * 3600 * 1000);
  if (cached && cached.series.length > 0 && cached.films.length > 0) return cached;

  try {
    const apiUrl = typeof window !== 'undefined' ? '/api/netflix-top10' : 'http://localhost:3000/api/netflix-top10';
    const res = await fetch(apiUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API status ${res.status}`);
    const data = await res.json();

    const filmsRaw: string[] = data.films || [];
    const seriesRaw: string[] = data.series || [];

    // Parallel enrichment using dictionary and TMDB with strict cross-validation
    const enrichTitles = async (titles: string[], defaultMediaType: 'movie' | 'series'): Promise<Movie[]> => {
      const promises = titles.map(async (rawTitle, i) => {
        // Strip common Netflix Tudum suffixes like ": Season 1", ": Limited Series", ": Season 3"
        const cleanTitle = rawTitle.replace(/:\s*(Season\s*\d+|Limited\s*Series|\d+)$/i, '').trim();
        const dictEntry =
          NETFLIX_VN_TUDUM_DICTIONARY[rawTitle] ||
          NETFLIX_VN_TUDUM_DICTIONARY[cleanTitle] ||
          Object.entries(NETFLIX_VN_TUDUM_DICTIONARY).find(
            ([k]) => cleanTitle.toLowerCase() === k.toLowerCase() || rawTitle.toLowerCase().includes(k.toLowerCase())
          )?.[1];
        const searchTitle = dictEntry?.vietnameseTitle || cleanTitle || rawTitle;
        const mediaType = dictEntry?.type || defaultMediaType;
        const targetYear = dictEntry?.year;
        const preResolvedSlug = dictEntry?.slug;

        // 1. If dictionary specifies exact TMDB ID: fetch directly by TMDB ID
        if (dictEntry?.tmdbId) {
          try {
            const tmdbRes = await fetch(
              `https://api.themoviedb.org/3/${mediaType === 'series' ? 'tv' : 'movie'}/${dictEntry.tmdbId}?api_key=${TMDB_API_KEY}&language=vi-VN`
            );
            if (tmdbRes.ok) {
              const tmdbData = await tmdbRes.json();
              const movie = await tmdbItemToMovie(tmdbData, mediaType, {
                rank: i + 1,
                isTop10: true,
                platform: 'netflix',
                platformName: 'Netflix',
                preResolvedSlug,
              });
              if (dictEntry.vietnameseTitle) {
                movie.title = dictEntry.vietnameseTitle;
              }
              if (dictEntry.originalTitle) {
                movie.subTitle = dictEntry.originalTitle;
              }
              return movie;
            }
          } catch {}
        }

        // 2. Search TMDB with cross-data candidate scoring
        try {
          const tmdbRes = await fetch(
            `https://api.themoviedb.org/3/search/${mediaType === 'series' ? 'tv' : 'movie'}?api_key=${TMDB_API_KEY}&language=vi-VN&query=${encodeURIComponent(
              searchTitle
            )}`
          );
          if (tmdbRes.ok) {
            const resData = await tmdbRes.json();
            const candidates = (resData.results || []) as any[];
            if (candidates.length > 0) {
              const scored = candidates
                .map((cand) => {
                  let s = 0;
                  const cYear = cand.release_date || cand.first_air_date
                    ? parseInt((cand.release_date || cand.first_air_date).slice(0, 4), 10)
                    : 0;
                  if (targetYear && cYear) {
                    const diff = Math.abs(targetYear - cYear);
                    if (diff >= 3) return { cand, score: -100 };
                    if (diff === 0) s += 50;
                    else if (diff === 1) s += 30;
                    else if (diff === 2) s += 10;
                  }
                  const candOrig = normalizeSearchText(cand.original_title || cand.original_name);
                  const candName = normalizeSearchText(cand.title || cand.name);
                  const targetOrigNorm = normalizeSearchText(dictEntry?.originalTitle || rawTitle);
                  const searchTitleNorm = normalizeSearchText(searchTitle);

                  if (targetOrigNorm && candOrig) {
                    if (candOrig === targetOrigNorm || candOrig.includes(targetOrigNorm) || targetOrigNorm.includes(candOrig)) s += 45;
                  }
                  if (searchTitleNorm && candName) {
                    if (candName === searchTitleNorm || candName.includes(searchTitleNorm) || searchTitleNorm.includes(candName)) s += 40;
                  }
                  if (cand.popularity) s += Math.min(20, Math.log10(cand.popularity + 1) * 4);
                  return { cand, score: s };
                })
                .sort((a, b) => b.score - a.score);

              const best = scored[0]?.score >= 10 ? scored[0].cand : null;
              if (best) {
                const movie = await tmdbItemToMovie(best, mediaType, {
                  rank: i + 1,
                  isTop10: true,
                  platform: 'netflix',
                  platformName: 'Netflix',
                  preResolvedSlug,
                });
                if (dictEntry?.vietnameseTitle) {
                  movie.title = dictEntry.vietnameseTitle;
                }
                if (dictEntry?.originalTitle) {
                  movie.subTitle = dictEntry.originalTitle;
                }
                return movie;
              }
            }
          }
        } catch {
          // fallback below
        }

        // 3. Fallback: query NguonC directly with cross-validation
        let matchSlug = preResolvedSlug;
        if (!matchSlug) {
          const match = await findNguonCMatch(searchTitle, dictEntry?.originalTitle || rawTitle, {
            year: targetYear,
            type: mediaType,
          });
          matchSlug = match?.slug;
        }

        const isAvail = Boolean(matchSlug);
        const fallbackMovie: Movie = {
          id: matchSlug || `netflix-${i + 1}-${encodeURIComponent(rawTitle)}`,
          slug: matchSlug,
          title: dictEntry?.vietnameseTitle || rawTitle,
          subTitle: dictEntry?.originalTitle || rawTitle,
          type: mediaType,
          year: targetYear || 2024,
          rating: 'T16',
          genres: ['Chính kịch', 'Đặc sắc'],
          matchRate: 98,
          quality: '4K Ultra HD',
          description: `Bộ phim đang đứng thứ ${i + 1} trên bảng xếp hạng Netflix Việt Nam hôm nay.`,
          backdropUrl: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=1920&auto=format&fit=crop',
          posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop',
          rank: i + 1,
          isAvailable: isAvail,
          badges: {
            isTop10: true,
            platform: 'netflix',
            platformName: 'Netflix',
            ribbon: isAvail ? `#${i + 1}` : 'Chưa có sẵn',
            subBadge: isAvail ? 'Top 10' : 'Trailer',
          },
        };
        return fallbackMovie;
      });

      return Promise.all(promises);
    };

    const [films, series] = await Promise.all([
      enrichTitles(filmsRaw.slice(0, 10), 'movie'),
      enrichTitles(seriesRaw.slice(0, 10), 'series'),
    ]);

    const finalResult = { films, series };
    if (films.length > 0 || series.length > 0) {
      setCache('netflix_top10_vn_v4', finalResult);
    }
    return finalResult;
  } catch (err) {
    console.error('Failed to load Netflix Top 10 VN:', err);
    return { series: [], films: [] };
  }
}

/**
 * 2. Fetch Apple TV+ Originals (Strict Top 10)
 */
export async function getAppleTvTrending(): Promise<Movie[]> {
  const cached = getFromCache<Movie[]>('apple_tv_trending', 4 * 3600 * 1000);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=vi-VN&sort_by=popularity.desc&with_networks=2552&page=1`,
      { next: { revalidate: 14400 } }
    );
    const data = await res.json();
    const items = (data.results || []).slice(0, 10);
    const movies = await Promise.all(
      items.map((item: any, idx: number) =>
        tmdbItemToMovie(item, 'series', {
          rank: idx + 1,
          isTop10: true,
          platform: 'apple',
          platformName: 'Apple TV+',
        })
      )
    );
    setCache('apple_tv_trending', movies);
    return movies;
  } catch (err) {
    console.error('Failed to load Apple TV trending:', err);
    return [];
  }
}

/**
 * 3. Fetch HBO / Max Originals & Movies (Strict Top 10)
 */
export async function getHboTrending(): Promise<Movie[]> {
  const cached = getFromCache<Movie[]>('hbo_trending', 4 * 3600 * 1000);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=vi-VN&sort_by=popularity.desc&with_networks=49&page=1`,
      { next: { revalidate: 14400 } }
    );
    const data = await res.json();
    const items = (data.results || []).slice(0, 10);
    const movies = await Promise.all(
      items.map((item: any, idx: number) =>
        tmdbItemToMovie(item, 'series', {
          rank: idx + 1,
          isTop10: true,
          platform: 'hbo',
          platformName: 'HBO',
        })
      )
    );
    setCache('hbo_trending', movies);
    return movies;
  } catch (err) {
    console.error('Failed to load HBO trending:', err);
    return [];
  }
}

/**
 * 4. Fetch Disney+ Originals (Strict Top 10)
 */
export async function getDisneyTrending(): Promise<Movie[]> {
  const cached = getFromCache<Movie[]>('disney_trending', 4 * 3600 * 1000);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=vi-VN&sort_by=popularity.desc&with_networks=2739&page=1`,
      { next: { revalidate: 14400 } }
    );
    const data = await res.json();
    const items = (data.results || []).slice(0, 10);
    const movies = await Promise.all(
      items.map((item: any, idx: number) =>
        tmdbItemToMovie(item, 'series', {
          rank: idx + 1,
          isTop10: true,
          platform: 'disney',
          platformName: 'Disney+',
        })
      )
    );
    setCache('disney_trending', movies);
    return movies;
  } catch (err) {
    console.error('Failed to load Disney trending:', err);
    return [];
  }
}

/**
 * 5. Fetch Amazon Prime Video Originals (Deprecated by user request)
 */
export async function getPrimeTrending(): Promise<Movie[]> {
  return [];
}

/**
 * 6. Fetch Asian Trending: Prioritizing Korea (KR), Japan (JP), Vietnam (VN) (Strict 10 items)
 */
export async function getAsianTrending(timeWindow: 'day' | 'week' = 'week'): Promise<Movie[]> {
  const cacheKey = `asian_trending_${timeWindow}`;
  const cached = getFromCache<Movie[]>(cacheKey, 2 * 3600 * 1000);
  if (cached) return cached;

  try {
    const [resTv, resMov] = await Promise.all([
      fetch(
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=vi-VN&sort_by=popularity.desc&with_origin_country=KR|JP|VN&page=1`,
        { next: { revalidate: 7200 } }
      ),
      fetch(
        `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=vi-VN&sort_by=popularity.desc&with_origin_country=KR|JP|VN&page=1`,
        { next: { revalidate: 7200 } }
      ),
    ]);

    const [dataTv, dataMov] = await Promise.all([resTv.json(), resMov.json()]);

    const tvItems = (dataTv.results || []).slice(0, 5);
    const movItems = (dataMov.results || []).slice(0, 5);

    const [tvMovies, movMovies] = await Promise.all([
      Promise.all(tvItems.map((item: any) => tmdbItemToMovie(item, 'series', {}))),
      Promise.all(movItems.map((item: any) => tmdbItemToMovie(item, 'movie', {}))),
    ]);

    const combined = [...tvMovies, ...movMovies].sort((a, b) => b.matchRate - a.matchRate).slice(0, 10);
    setCache(cacheKey, combined);
    return combined;
  } catch (err) {
    console.error('Failed to load Asian trending:', err);
    return [];
  }
}

/**
 * 7. Fetch Global Trending (Hollywood, UK, World) (Strict 10 items)
 */
export async function getGlobalTrending(timeWindow: 'day' | 'week' = 'day'): Promise<Movie[]> {
  const cacheKey = `global_trending_${timeWindow}`;
  const cached = getFromCache<Movie[]>(cacheKey, 2 * 3600 * 1000);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/trending/all/${timeWindow}?api_key=${TMDB_API_KEY}&language=vi-VN`,
      { next: { revalidate: 7200 } }
    );
    const data = await res.json();
    const items = (data.results || []).slice(0, 10);

    const movies = await Promise.all(
      items.map((item: any) =>
        tmdbItemToMovie(item, item.media_type === 'movie' ? 'movie' : 'series', {})
      )
    );
    setCache(cacheKey, movies);
    return movies;
  } catch (err) {
    console.error('Failed to load Global trending:', err);
    return [];
  }
}
