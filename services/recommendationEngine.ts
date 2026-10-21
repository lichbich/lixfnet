import { Movie, WatchProgress } from '@/types';
import { isChineseMovie } from './movieApi';

export interface UserTasteProfile {
  topCountries: Record<string, number>;
  topGenres: Record<string, number>;
  topActors: Record<string, number>;
  favoriteCountrySlug: string | null;
  favoriteGenreSlugs: string[];
  totalWatched: number;
}

export interface CandidateRow {
  id: string;
  title: string;
  countrySlug?: string;
  genreSlug?: string;
  type: 'standard' | 'portrait' | 'continue';
  movies: Movie[];
  priorityBoost?: number;
}

/**
 * Builds a taste profile by analyzing user's watch progress history
 */
export function buildTasteProfile(
  watchProgressMap: Record<string, WatchProgress>
): UserTasteProfile {
  const topCountries: Record<string, number> = {};
  const topGenres: Record<string, number> = {};
  const topActors: Record<string, number> = {};

  const entries = Object.values(watchProgressMap || {});
  const now = Date.now();

  for (const entry of entries) {
    const movie = entry.movie;
    if (!movie) continue;

    // Weight recent watches more heavily (within 7 days = 1.5x, 30 days = 1.2x)
    const daysAgo = (now - (entry.updatedAt || now)) / (1000 * 60 * 60 * 24);
    const recencyWeight = daysAgo <= 7 ? 1.5 : daysAgo <= 30 ? 1.2 : 1.0;

    // Track Country
    if (movie.countrySlug) {
      topCountries[movie.countrySlug] = (topCountries[movie.countrySlug] || 0) + 3 * recencyWeight;
    } else if (movie.country) {
      const lower = movie.country.toLowerCase();
      if (lower.includes('hàn')) topCountries['han-quoc'] = (topCountries['han-quoc'] || 0) + 3 * recencyWeight;
      else if (lower.includes('mỹ') || lower.includes('anh')) topCountries['my'] = (topCountries['my'] || 0) + 3 * recencyWeight;
      else if (lower.includes('việt')) topCountries['viet-nam'] = (topCountries['viet-nam'] || 0) + 3 * recencyWeight;
      else if (lower.includes('nhật')) topCountries['nhat-ban'] = (topCountries['nhat-ban'] || 0) + 3 * recencyWeight;
      else if (lower.includes('thái')) topCountries['thai-lan'] = (topCountries['thai-lan'] || 0) + 3 * recencyWeight;
    }

    // Track Genres
    if (movie.genres && Array.isArray(movie.genres)) {
      for (const g of movie.genres) {
        const lower = g.toLowerCase().trim();
        let slug = 'khac';
        if (lower.includes('tình cảm') || lower.includes('lãng mạn')) slug = 'tinh-cam';
        else if (lower.includes('kinh dị') || lower.includes('giật gân') || lower.includes('ma')) slug = 'kinh-di';
        else if (lower.includes('hành động') || lower.includes('võ thuật')) slug = 'hanh-dong';
        else if (lower.includes('hoạt hình') || lower.includes('anime')) slug = 'hoat-hinh';
        else if (lower.includes('hài')) slug = 'phim-hai';
        else if (lower.includes('tâm lý') || lower.includes('chính kịch')) slug = 'tam-ly';
        else if (lower.includes('viễn tưởng')) slug = 'khoa-hoc-vien-tuong';

        topGenres[slug] = (topGenres[slug] || 0) + 2.5 * recencyWeight;
      }
    }

    // Track Cast / Actors
    if (movie.cast && Array.isArray(movie.cast)) {
      for (const actor of movie.cast) {
        if (actor && actor.trim()) {
          const cleanActor = actor.trim();
          topActors[cleanActor] = (topActors[cleanActor] || 0) + 1 * recencyWeight;
        }
      }
    }
  }

  // Determine top favorite country
  let favoriteCountrySlug: string | null = null;
  let maxCountryScore = 0;
  for (const [cSlug, score] of Object.entries(topCountries)) {
    if (score > maxCountryScore) {
      maxCountryScore = score;
      favoriteCountrySlug = cSlug;
    }
  }

  // Determine top favorite genres (sorted by score descending)
  const favoriteGenreSlugs = Object.entries(topGenres)
    .sort((a, b) => b[1] - a[1])
    .filter(([slug]) => slug !== 'khac')
    .slice(0, 3)
    .map(([slug]) => slug);

  return {
    topCountries,
    topGenres,
    topActors,
    favoriteCountrySlug,
    favoriteGenreSlugs,
    totalWatched: entries.length,
  };
}

/**
 * Calculates a recency score for a row based on its movies' release years and update dates
 * Nước nào có phim mới thì điểm cao hơn và được đẩy lên trên, nước lâu rồi không có phim mới sẽ chìm dần
 */
function calculateRowRecency(row: CandidateRow): number {
  if (!row.movies || row.movies.length === 0) return 0;

  let maxYear = 2020;
  let hasCurrentYear = false;
  const currentYear = new Date().getFullYear();

  for (const m of row.movies) {
    if (m.year && m.year > maxYear) {
      maxYear = m.year;
    }
    if (m.year && m.year >= currentYear) {
      hasCurrentYear = true;
    }
  }

  // Base recency points from newest movie year
  let recency = (maxYear - 2020) * 10;
  if (hasCurrentYear) recency += 25;

  // Extra recency if row contains freshly tagged movies ("Tập mới", "Mới thêm")
  const recentBadgesCount = row.movies.filter(
    (m) => m.badges?.ribbon === 'Tập mới' || m.badges?.ribbon === 'Mới thêm'
  ).length;
  recency += recentBadgesCount * 3;

  return recency;
}

/**
 * Ranks and arranges homepage rows based on:
 * 1. User Affinity (Favorite country & genres prioritized at top)
 * 2. Country / Category Newness (Newest movie updates rise, older sink)
 * 3. Controlled Diversity Randomization for other countries
 */
export function rankHomepageRows(
  rows: CandidateRow[],
  profile: UserTasteProfile
): CandidateRow[] {
  if (!rows || rows.length === 0) return [];

  const hasPreferences = profile.totalWatched > 0;

  // Filter only rows that have actual movies
  const validRows = rows.filter((r) => r.movies && r.movies.length > 0);

  // Score each row
  const scoredRows = validRows.map((row) => {
    let affinityScore = 0;

    if (hasPreferences) {
      // 1. Country affinity match (e.g. Hàn Quốc +100pts)
      if (row.countrySlug && profile.topCountries[row.countrySlug]) {
        affinityScore += profile.topCountries[row.countrySlug] * 20;
        if (row.countrySlug === profile.favoriteCountrySlug) {
          affinityScore += 50; // Super bonus for #1 favorite country
        }
      }

      // 2. Genre affinity match (e.g. Tình cảm, Kinh dị +80pts)
      if (row.genreSlug && profile.topGenres[row.genreSlug]) {
        affinityScore += profile.topGenres[row.genreSlug] * 18;
        if (profile.favoriteGenreSlugs.includes(row.genreSlug)) {
          affinityScore += 40; // Super bonus for top 3 genres
        }
      }

      // 3. Match rate inside movies in row
      let matchedMoviesCount = 0;
      for (const m of row.movies.slice(0, 5)) {
        if (m.genres?.some((g) => profile.favoriteGenreSlugs.some((fav) => g.toLowerCase().includes(fav)))) {
          matchedMoviesCount++;
        }
      }
      affinityScore += matchedMoviesCount * 10;
    }

    // Recency score (Nước có phim mới thì cao, lâu không có phim mới thì chìm xuống)
    const recencyScore = calculateRowRecency(row);

    // Controlled random factor (bên dưới random những thể loại tương tự của các nước khác)
    const randomFactor = Math.random() * 8;

    // Explicit priority boost if specified (e.g. continue watching or latest updates)
    const priorityBoost = row.priorityBoost || 0;

    // Total composite score:
    // If user has strong affinity, affinity dominates (100x multiplier).
    // Otherwise recency and controlled randomness dictate natural ranking.
    const totalScore = priorityBoost + affinityScore * 10 + recencyScore + randomFactor;

    return {
      row,
      affinityScore,
      recencyScore,
      totalScore,
    };
  });

  // Sort descending by total score
  scoredRows.sort((a, b) => b.totalScore - a.totalScore);

  return scoredRows.map((item) => item.row);
}

/**
 * Curates a personalized "Gợi ý dành riêng cho bạn" movie list
 * matching user's favorite genres, countries, and actors, excluding already watched items.
 */
export function curatePersonalizedRecommendations(
  allCandidateMovies: Movie[],
  watchProgressMap: Record<string, WatchProgress>,
  profile: UserTasteProfile,
  chinaSlugs: Set<string>,
  limit = 12
): Movie[] {
  if (profile.totalWatched === 0) return [];

  const watchedKeys = new Set<string>();
  for (const wp of Object.values(watchProgressMap)) {
    if (wp.movieSlug) watchedKeys.add(wp.movieSlug);
    if (wp.movieId) watchedKeys.add(wp.movieId);
  }

  const seen = new Set<string>();
  const candidates: { movie: Movie; score: number }[] = [];

  for (const m of allCandidateMovies) {
    if (!m) continue;
    const key = m.slug || m.id;
    if (seen.has(key) || watchedKeys.has(key)) continue;
    if (isChineseMovie(m, chinaSlugs)) continue;
    seen.add(key);

    let score = m.matchRate || 90;

    // Country match bonus
    if (m.countrySlug && profile.topCountries[m.countrySlug]) {
      score += profile.topCountries[m.countrySlug] * 5;
    }

    // Genre match bonus
    if (m.genres && Array.isArray(m.genres)) {
      for (const g of m.genres) {
        const lower = g.toLowerCase();
        for (const [favSlug, favScore] of Object.entries(profile.topGenres)) {
          if (lower.includes(favSlug)) {
            score += favScore * 4;
          }
        }
      }
    }

    // Actor match bonus
    if (m.cast && Array.isArray(m.cast)) {
      for (const actor of m.cast) {
        if (profile.topActors[actor]) {
          score += profile.topActors[actor] * 6;
        }
      }
    }

    // Recency bonus
    if (m.year && m.year >= new Date().getFullYear() - 1) {
      score += 5;
    }

    candidates.push({ movie: m, score });
  }

  // Sort by score descending and return top matches
  candidates.sort((a, b) => b.score - a.score);

  return candidates.slice(0, limit).map((c) => c.movie);
}
