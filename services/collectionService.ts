import { Movie } from '@/types';
import { searchMovies, isChineseMovie, getChineseMovieSlugs } from './movieApi';

export interface MovieCollection {
  collectionTitle: string;
  movies: Movie[];
}

const KNOWN_FRANCHISES: {
  match: RegExp;
  collectionTitle: string;
  searchKeywords: string[];
}[] = [
  {
    match: /bác sĩ\s*x|doctor[\s-]x/i,
    collectionTitle: 'Bác sĩ X',
    searchKeywords: ['Bác sĩ X', 'Doctor X'],
  },
  {
    match: /batman|người dơi/i,
    collectionTitle: 'Batman',
    searchKeywords: ['Batman', 'Người Dơi'],
  },
  {
    match: /spider[\s-]*man|người nhện/i,
    collectionTitle: 'Spider-Man',
    searchKeywords: ['Spider-Man', 'Người Nhện'],
  },
  {
    match: /dragon\s*ball|bảy viên ngọc rồng/i,
    collectionTitle: 'Dragon Ball',
    searchKeywords: ['Dragon Ball', 'Bảy Viên Ngọc Rồng'],
  },
  {
    match: /john\s*wick/i,
    collectionTitle: 'John Wick',
    searchKeywords: ['John Wick'],
  },
  {
    match: /lật\s*mặt/i,
    collectionTitle: 'Lật Mặt',
    searchKeywords: ['Lật Mặt'],
  },
  {
    match: /conan|thám tử lừng danh conan/i,
    collectionTitle: 'Thám Tử Lừng Danh Conan',
    searchKeywords: ['Conan'],
  },
  {
    match: /siêu nhân\s*tiga|ultraman\s*tiga/i,
    collectionTitle: 'Siêu Nhân Tiga',
    searchKeywords: ['Tiga', 'Siêu Nhân Tiga'],
  },
  {
    match: /siêu nhân|ultraman/i,
    collectionTitle: 'Siêu Nhân (Ultraman)',
    searchKeywords: ['Siêu Nhân', 'Ultraman'],
  },
  {
    match: /fast\s*&\s*furious|quá nhanh quá nguy hiểm/i,
    collectionTitle: 'Fast & Furious',
    searchKeywords: ['Fast & Furious', 'Quá Nhanh Quá Nguy Hiểm'],
  },
  {
    match: /hương vị của biển/i,
    collectionTitle: 'Hương Vị Của Biển',
    searchKeywords: ['Hương Vị Của Biển'],
  },
  {
    match: /thế chất[\s:]*100/i,
    collectionTitle: 'Thế Chất: 100',
    searchKeywords: ['Thế Chất: 100'],
  },
  {
    match: /sân khấu đam mê/i,
    collectionTitle: 'Sân Khấu Đam Mê',
    searchKeywords: ['Sân Khấu Đam Mê'],
  },
  {
    match: /thám tử đã chết/i,
    collectionTitle: 'Thám Tử Đã Chết',
    searchKeywords: ['Thám Tử Đã Chết'],
  },
  {
    match: /cơm nguội|fap tv/i,
    collectionTitle: 'FAP TV',
    searchKeywords: ['FAP TV'],
  },
  {
    match: /doraemon|đôrêmon/i,
    collectionTitle: 'Doraemon',
    searchKeywords: ['Doraemon'],
  },
  {
    match: /one\s*piece|đảo hải tặc/i,
    collectionTitle: 'One Piece',
    searchKeywords: ['One Piece'],
  },
  {
    match: /naruto/i,
    collectionTitle: 'Naruto',
    searchKeywords: ['Naruto'],
  },
  {
    match: /harry\s*potter/i,
    collectionTitle: 'Harry Potter',
    searchKeywords: ['Harry Potter'],
  },
  {
    match: /avatar/i,
    collectionTitle: 'Avatar',
    searchKeywords: ['Avatar'],
  },
  {
    match: /cớm già vào nghề/i,
    collectionTitle: 'Cớm Già Vào Nghề',
    searchKeywords: ['Cớm Già Vào Nghề'],
  },
];

// In-memory cache for fast instant rendering
const collectionCache = new Map<string, MovieCollection | null>();

/**
 * Normalizes title string for substring comparison
 */
function normalizeTitle(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Automatically discovers and curates movies belonging to the same franchise/collection
 */
export async function getMovieCollection(movie: Movie): Promise<MovieCollection | null> {
  if (!movie || !movie.title) return null;

  const movieKey = movie.slug || movie.id;
  if (collectionCache.has(movieKey)) {
    return collectionCache.get(movieKey)!;
  }

  const title = movie.title;
  const subTitle = movie.subTitle || '';
  const fullTitle = `${title} ${subTitle}`;

  let targetFranchise: { collectionTitle: string; searchKeywords: string[] } | null = null;

  // 1. Check curated franchises
  for (const item of KNOWN_FRANCHISES) {
    if (item.match.test(fullTitle)) {
      targetFranchise = item;
      break;
    }
  }

  // 2. Dynamic Franchise Detection for series / sequels (e.g. "Phim X (Phần 2)", "Phim Y 2", "Phim Z: Subtitle")
  if (!targetFranchise) {
    // Check pattern: "Title (Phần X)", "Title Phần X", "Title Season X"
    const partMatch = title.match(/^(.*?)(?:\s*\(Phần\s*\d+\)|\s*\(Mùa\s*\d+\)|\s*\(Season\s*\d+\)|\s*Phần\s*\d+|\s*Mùa\s*\d+)/i);
    if (partMatch && partMatch[1] && partMatch[1].trim().length >= 3) {
      const baseName = partMatch[1].trim();
      targetFranchise = {
        collectionTitle: baseName,
        searchKeywords: [baseName],
      };
    } else {
      // Check trailing number pattern (e.g. "Sân Khấu Đam Mê 2" -> "Sân Khấu Đam Mê")
      const numMatch = title.match(/^(.*?)(\s+\d+)$/);
      if (numMatch && numMatch[1] && numMatch[1].trim().length >= 4) {
        const baseName = numMatch[1].trim();
        targetFranchise = {
          collectionTitle: baseName,
          searchKeywords: [baseName],
        };
      } else {
        // Check colon separator: "Franchise: Subtitle"
        const colonMatch = title.match(/^(.*?):\s+(.+)$/);
        if (colonMatch && colonMatch[1] && colonMatch[1].trim().length >= 4) {
          const baseName = colonMatch[1].trim();
          targetFranchise = {
            collectionTitle: baseName,
            searchKeywords: [baseName],
          };
        }
      }
    }
  }

  if (!targetFranchise) {
    collectionCache.set(movieKey, null);
    return null;
  }

  try {
    const chinaSlugs = await getChineseMovieSlugs();
    const queryPromises = targetFranchise.searchKeywords.map((kw) => searchMovies(kw, 1));
    const queryResults = await Promise.all(queryPromises);

    const candidates = queryResults.flat();
    const normBase = normalizeTitle(targetFranchise.collectionTitle);

    const seenSlugs = new Set<string>();
    const matchedMovies: Movie[] = [];

    // Always include current movie in collection
    seenSlugs.add(movieKey);
    matchedMovies.push(movie);

    for (const cand of candidates) {
      if (!cand) continue;
      const candKey = cand.slug || cand.id;
      if (seenSlugs.has(candKey)) continue;

      // Filter Chinese movies if present
      if (isChineseMovie(cand, chinaSlugs)) continue;

      const candTitleNorm = normalizeTitle(cand.title);
      const candSubNorm = normalizeTitle(cand.subTitle || '');

      // Check if candidate matches franchise base
      const isMatch =
        candTitleNorm.includes(normBase) ||
        candSubNorm.includes(normBase) ||
        targetFranchise.searchKeywords.some((kw) => {
          const normKw = normalizeTitle(kw);
          return candTitleNorm.includes(normKw) || candSubNorm.includes(normKw);
        });

      if (isMatch) {
        seenSlugs.add(candKey);
        matchedMovies.push(cand);
      }
    }

    // A collection must contain at least 2 movies (e.g. the movie and its sequels/spinoffs)
    if (matchedMovies.length < 2) {
      collectionCache.set(movieKey, null);
      return null;
    }

    // Sort chronologically by year ascending, then title
    matchedMovies.sort((a, b) => {
      const yearDiff = (a.year || 0) - (b.year || 0);
      if (yearDiff !== 0) return yearDiff;
      return a.title.localeCompare(b.title);
    });

    const result: MovieCollection = {
      collectionTitle: targetFranchise.collectionTitle,
      movies: matchedMovies,
    };

    collectionCache.set(movieKey, result);
    return result;
  } catch (err) {
    console.error('Failed to get movie collection:', err);
    collectionCache.set(movieKey, null);
    return null;
  }
}
