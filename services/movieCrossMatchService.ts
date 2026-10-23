import { Movie, EpisodeServer } from '@/types';
import { getMovieDetail, formatEpisodeTitle } from '@/services/movieApi';
import { clientLogoCache, formatTmdbLogoUrl, cleanMovieTitleForSearch } from '@/services/logoService';
import { getCanonicalMovieId, mergeMovieData, normalizeTitle, cleanMovieDescription } from '@/lib/movieUtils';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '58dba4066f4f36e49e5e769304442088';
const PHIMAPI_BASE = 'https://phimapi.com';

const isServer = typeof window === 'undefined';
const getFetchOptions = (revalidateSec = 86400): RequestInit => {
  return isServer ? ({ next: { revalidate: revalidateSec } } as any) : {};
};

// Cache for enriched movies to prevent redundant network fetches
const enrichmentCache = new Map<string, { movie: Movie; timestamp: number }>();

/**
 * Score candidate match between PhimAPI and TMDB using:
 * 1. Title / Subtitle similarity
 * 2. Release Year
 * 3. Director matching (+90 points)
 * 4. Cast / Actor overlap (+70 points per matching actor)
 */
function scoreCandidateWithCredits(
  movie: Partial<Movie>,
  cand: {
    id: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    release_date?: string;
    first_air_date?: string;
    popularity?: number;
    cast?: string[];
    directors?: string[];
  }
): number {
  let score = 0;
  const candTitle = normalizeTitle(cand.title || cand.name);
  const candOrig = normalizeTitle(cand.original_title || cand.original_name);
  const mTitle = normalizeTitle(movie.title);
  const mSub = normalizeTitle(movie.subTitle);

  // 1. Direct title matching
  if (mSub && (mSub === candOrig || mSub === candTitle)) {
    score += 85;
  } else if (mTitle && (mTitle === candTitle || mTitle === candOrig)) {
    score += 80;
  } else if (mSub && candOrig && (mSub.includes(candOrig) || candOrig.includes(mSub))) {
    score += 55;
  } else if (mTitle && candTitle && (mTitle.includes(candTitle) || candTitle.includes(mTitle))) {
    score += 50;
  }

  // 2. Year matching
  const candDate = cand.release_date || cand.first_air_date || '';
  const candYear = parseInt(candDate.slice(0, 4), 10);
  if (movie.year && candYear) {
    if (movie.year === candYear) score += 30;
    else if (Math.abs(movie.year - candYear) <= 1) score += 15;
    else if (Math.abs(movie.year - candYear) >= 3) score -= 60;
  }

  // 3. Director matching (+90 points)
  if (movie.director && cand.directors && cand.directors.length > 0) {
    const movieDirs = (typeof movie.director === 'string' ? movie.director.split(/[,;/]+/) : Array.isArray(movie.director) ? movie.director : [])
      .map(normalizeTitle)
      .filter((d) => d && !d.includes('dang cap nhat') && !d.includes('updating'));

    for (const md of movieDirs) {
      for (const d of cand.directors) {
        const normCandDir = normalizeTitle(d);
        if (normCandDir && (normCandDir === md || normCandDir.includes(md) || md.includes(normCandDir))) {
          score += 90;
          break;
        }
      }
    }
  }

  // 4. Cast / Actor overlap (+70 points per matching actor, max 140)
  if (movie.cast && movie.cast.length > 0 && cand.cast && cand.cast.length > 0) {
    let matchCount = 0;
    const movieActors = movie.cast.map(normalizeTitle).filter(Boolean);
    for (const c of cand.cast) {
      const normC = normalizeTitle(c);
      if (!normC) continue;
      if (movieActors.some((a) => a === normC || a.includes(normC) || normC.includes(a))) {
        matchCount++;
        score += 70;
        if (matchCount >= 2) break;
      }
    }
  }

  return score;
}

/**
 * Bidirectional cross-matcher and enricher:
 * 1. Cross-checks PhimAPI item against TMDB to retrieve high-res Logo, Backdrop, Poster, Director, Cast, and Synopsis.
 * 2. Cross-checks TMDB item against PhimAPI to retrieve playable Streaming links (M3U8 / Embed / Episodes servers).
 * 3. Enforces strict verification of movie title, release year, director name, and participating cast.
 */
export async function crossMatchAndEnrichMovie(movie: Movie): Promise<Movie> {
  if (!movie) return movie;

  const canonicalId = getCanonicalMovieId(movie);
  const cached = enrichmentCache.get(canonicalId);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return cached.movie;
  }

  let enriched = { ...movie };

  // Step 1: Recover logo from client cache if currently missing
  if (!enriched.logoUrl) {
    const candidateKeys = [
      movie.id,
      movie.slug,
      canonicalId,
      movie.tmdb?.id ? `tmdb_${movie.tmdb.id}` : null,
      movie.tmdbId ? `tmdb_${movie.tmdbId}` : null,
    ].filter(Boolean) as string[];

    for (const k of candidateKeys) {
      const hit = clientLogoCache.get(k);
      if (hit) {
        enriched.logoUrl = hit;
        break;
      }
    }
  }

  // Step 2: Cross-reference with TMDB for rich metadata & Logo
  try {
    let tmdbId = movie.tmdb?.id || movie.tmdbId;
    let mediaType: 'movie' | 'tv' = movie.type === 'series' ? 'tv' : 'movie';

    // If no TMDB ID, search TMDB using Title, Subtitle, Director & Cast cross-matching
    if (!tmdbId) {
      const searchQueries: string[] = [];
      if (movie.subTitle) {
        searchQueries.push(cleanMovieTitleForSearch(movie.subTitle));
        if (movie.subTitle.includes('/')) {
          movie.subTitle.split('/').forEach((p) => searchQueries.push(cleanMovieTitleForSearch(p)));
        }
      }
      if (movie.title) {
        searchQueries.push(cleanMovieTitleForSearch(movie.title));
        if (movie.title.includes('/')) {
          movie.title.split('/').forEach((p) => searchQueries.push(cleanMovieTitleForSearch(p)));
        }
      }

      const uniqueQueries = Array.from(new Set(searchQueries.filter((q) => q && q.length >= 2)));

      for (const q of uniqueQueries) {
        try {
          const sRes = await fetch(
            `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}&include_adult=false`,
            getFetchOptions(86400)
          );
          if (!sRes.ok) continue;
          const sData = await sRes.json();
          const results = (sData.results || []).filter(
            (r: any) => r.media_type === 'movie' || r.media_type === 'tv'
          );

          if (results.length === 0) continue;

          // For the top candidates, fetch their credits to compare director and actors
          let bestScore = -999;
          let bestCand: any = null;

          for (const cand of results.slice(0, 3)) {
            const mType = cand.media_type === 'tv' ? 'tv' : 'movie';
            let candCast: string[] = [];
            let candDirectors: string[] = [];

            try {
              const cRes = await fetch(
                `https://api.themoviedb.org/3/${mType}/${cand.id}/credits?api_key=${TMDB_API_KEY}`,
                getFetchOptions(86400)
              );
              if (cRes.ok) {
                const cData = await cRes.json();
                candCast = (cData.cast || []).slice(0, 8).map((c: any) => c.name);
                candDirectors = (cData.crew || [])
                  .filter((c: any) => c.job === 'Director' || c.job === 'Creator' || c.department === 'Directing')
                  .map((c: any) => c.name);
              }
            } catch {}

            const score = scoreCandidateWithCredits(movie, {
              ...cand,
              cast: candCast,
              directors: candDirectors,
            });

            if (score > bestScore) {
              bestScore = score;
              bestCand = { ...cand, mType };
            }
          }

          if (bestCand && bestScore >= 50) {
            tmdbId = bestCand.id;
            mediaType = bestCand.mType;
            break;
          }
        } catch {}
      }
    }

    // If TMDB ID is resolved, fetch full detail + images + credits
    if (tmdbId) {
      const tmdbRes = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,images&include_image_language=vi,en,null,ko,ja`,
        getFetchOptions(86400)
      );

      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();

        // 1. High-Res Logo (prioritize transparent English or Vietnamese PNG/SVG)
        let resolvedLogo: string | undefined = undefined;
        const logos = tmdbData.images?.logos || [];
        if (logos.length > 0) {
          const sortedLogos = [...logos].sort((a: any, b: any) => {
            const aLang = a.iso_639_1 === 'vi' ? 3 : a.iso_639_1 === 'en' ? 2 : 1;
            const bLang = b.iso_639_1 === 'vi' ? 3 : b.iso_639_1 === 'en' ? 2 : 1;
            if (aLang !== bLang) return bLang - aLang;
            return (b.vote_average || 0) - (a.vote_average || 0);
          });
          const bestLogoItem = sortedLogos[0];
          if (bestLogoItem?.file_path) {
            resolvedLogo = formatTmdbLogoUrl(bestLogoItem.file_path);
          }
        }

        // Cache logo everywhere
        if (resolvedLogo) {
          enriched.logoUrl = resolvedLogo;
          clientLogoCache.set(canonicalId, resolvedLogo);
          if (movie.id) clientLogoCache.set(movie.id, resolvedLogo);
          if (movie.slug) clientLogoCache.set(movie.slug, resolvedLogo);
          clientLogoCache.set(`tmdb_${tmdbId}`, resolvedLogo);
        }

        // 2. High-res TMDB Backdrop & Poster
        let tmdbBackdrop = tmdbData.backdrop_path
          ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}`
          : undefined;
        let tmdbPoster = tmdbData.poster_path
          ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`
          : undefined;

        // 3. Director from crew
        const crew = tmdbData.credits?.crew || [];
        const dirItem = crew.find(
          (c: any) => c.job === 'Director' || c.job === 'Creator' || c.department === 'Directing'
        );
        const tmdbDirector = dirItem?.name || undefined;

        // 4. Cast from credits
        const tmdbCast = (tmdbData.credits?.cast || []).slice(0, 10).map((c: any) => c.name);

        // 5. TMDB Genres
        const tmdbGenres = (tmdbData.genres || []).map((g: any) => g.name);

        // Build TMDB synthetic movie object for clean merging
        const tmdbMovie: Partial<Movie> = {
          title: movie.title || tmdbData.name || tmdbData.title,
          subTitle: movie.subTitle || tmdbData.name || tmdbData.title || tmdbData.original_name || tmdbData.original_title,
          description: tmdbData.overview ? cleanMovieDescription(tmdbData.overview) : undefined,
          backdropUrl: tmdbBackdrop,
          posterUrl: tmdbPoster,
          logoUrl: resolvedLogo,
          director: tmdbDirector,
          cast: tmdbCast.length > 0 ? tmdbCast : undefined,
          genres: tmdbGenres.length > 0 ? tmdbGenres : undefined,
          year: tmdbData.release_date
            ? parseInt(tmdbData.release_date.slice(0, 4), 10)
            : tmdbData.first_air_date
            ? parseInt(tmdbData.first_air_date.slice(0, 4), 10)
            : movie.year,
          tmdb: {
            id: Number(tmdbId),
            type: mediaType,
            voteAverage: tmdbData.vote_average,
            voteCount: tmdbData.vote_count,
          },
          tmdbId: Number(tmdbId),
        };

        enriched = mergeMovieData(enriched, tmdbMovie as Movie);
      }
    }
  } catch (err) {
    console.warn('TMDB cross-match error:', err);
  }

  // Step 3: Cross-reference with PhimAPI for playable streaming servers if missing
  const hasPlayableStreams = Boolean(enriched.episodesServers?.length || enriched.m3u8Url);
  if (!hasPlayableStreams) {
    try {
      const searchQueries: string[] = [];
      if (enriched.title) searchQueries.push(cleanMovieTitleForSearch(enriched.title));
      if (enriched.subTitle) searchQueries.push(cleanMovieTitleForSearch(enriched.subTitle));

      let matchedSlug: string | null = enriched.slug || null;

      if (!matchedSlug) {
        for (const q of searchQueries) {
          const pRes = await fetch(`${PHIMAPI_BASE}/v1/api/tim-kiem?keyword=${encodeURIComponent(q)}&limit=10`, getFetchOptions(3600));
          if (!pRes.ok) continue;
          const pData = await pRes.json();
          const items = pData.data?.items || pData.items || [];
          if (items.length > 0) {
            // Find best candidate matching actors or title
            let bestScore = -999;
            let bestItem: any = null;

            for (const item of items) {
              const score = scoreCandidateWithCredits(enriched, {
                id: item._id || item.id,
                title: item.name,
                original_title: item.origin_name || item.original_name,
                release_date: item.year ? `${item.year}-01-01` : undefined,
                cast: Array.isArray(item.actor) ? item.actor : undefined,
                directors: Array.isArray(item.director) ? item.director : undefined,
              });

              if (score > bestScore) {
                bestScore = score;
                bestItem = item;
              }
            }

            if (bestItem && bestScore >= 40) {
              matchedSlug = bestItem.slug;
              break;
            }
          }
        }
      }

      if (matchedSlug) {
        const detail = await getMovieDetail(matchedSlug);
        if (detail) {
          enriched = mergeMovieData(enriched, detail);
        }
      }
    } catch (err) {
      console.warn('PhimAPI stream cross-match error:', err);
    }
  }

  // Cache final enriched movie
  enrichmentCache.set(canonicalId, { movie: enriched, timestamp: Date.now() });

  return enriched;
}
