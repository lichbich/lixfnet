'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { HeroBanner } from '@/components/hero/HeroBanner';
import { MovieRow } from '@/components/rows/MovieRow';
import { RowSkeleton } from '@/components/rows/RowSkeleton';
import { SearchResults } from '@/components/search/SearchResults';
import { useNetflix } from '@/context/NetflixContext';
import {
  getNewUpdatedMovies,
  getMoviesByCountry,
  getMoviesByCategory,
  getMoviesByGenre,
  getVietnameseMovies,
  getChineseMovieSlugs,
  isChineseMovie,
} from '@/services/movieApi';
import {
  getNetflixTop10VN,
  getAppleTvTrending,
  getHboTrending,
  getDisneyTrending,
} from '@/services/trendingService';
import {
  buildTasteProfile,
  rankHomepageRows,
  curatePersonalizedRecommendations,
  CandidateRow,
} from '@/services/recommendationEngine';
import { Movie } from '@/types';

export default function HomePage() {
  const {
    searchQuery,
    continueWatchingList,
    watchProgressMap,
    currentUser,
    reconcileWatchProgressWithMovies,
  } = useNetflix();

  const [heroMovie, setHeroMovie] = useState<Movie | null>(null);
  const [heroBadge, setHeroBadge] = useState<string>('Mới cập nhật hôm nay');
  const [chinaSlugs, setChinaSlugs] = useState<Set<string>>(new Set());

  // Category & Country Pools (NguonC Core Content)
  const [newUpdatedPage1, setNewUpdatedPage1] = useState<Movie[]>([]);
  const [newUpdatedPage2, setNewUpdatedPage2] = useState<Movie[]>([]);
  const [vietnameseMovies, setVietnameseMovies] = useState<Movie[]>([]);
  const [koreanMovies, setKoreanMovies] = useState<Movie[]>([]);
  const [usMovies, setUsMovies] = useState<Movie[]>([]);
  const [thaiMovies, setThaiMovies] = useState<Movie[]>([]);
  const [japanMovies, setJapanMovies] = useState<Movie[]>([]);
  const [tvShows, setTvShows] = useState<Movie[]>([]);
  const [actionMovies, setActionMovies] = useState<Movie[]>([]);
  const [featureMovies, setFeatureMovies] = useState<Movie[]>([]);
  const [animeMovies, setAnimeMovies] = useState<Movie[]>([]);
  const [romanceMovies, setRomanceMovies] = useState<Movie[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<Movie[]>([]);

  // Platform Pools (Streaming Tops)
  const [netflixSeriesTop10, setNetflixSeriesTop10] = useState<Movie[]>([]);
  const [netflixFilmsTop10, setNetflixFilmsTop10] = useState<Movie[]>([]);
  const [appleTvTrending, setAppleTvTrending] = useState<Movie[]>([]);
  const [hboTrending, setHboTrending] = useState<Movie[]>([]);
  const [disneyTrending, setDisneyTrending] = useState<Movie[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Progressive Two-Stage Loading: Stage 1 delivers fast initial render (300ms); Stage 2 enriches platform tops in background
  useEffect(() => {
    let isMounted = true;

    async function loadAllContent() {
      // --- STAGE 1: Fast NguonC Native Content (~250-350ms) ---
      try {
        const [
          chinaSlugSet,
          latestPage1,
          latestPage2,
          vietnam,
          korea,
          us,
          thai,
          japan,
          shows,
          action1,
          features1,
          anime1,
          romance1,
          horror1,
        ] = await Promise.all([
          getChineseMovieSlugs(),
          getNewUpdatedMovies(1),
          getNewUpdatedMovies(2),
          getVietnameseMovies(),
          getMoviesByCountry('han-quoc', 1),
          getMoviesByCountry('my', 1),
          getMoviesByCountry('thai-lan', 1),
          getMoviesByCountry('nhat-ban', 1),
          getMoviesByCategory('tv-shows', 1),
          getMoviesByGenre('hanh-dong', 1),
          getMoviesByCategory('phim-le', 1),
          getMoviesByGenre('hoat-hinh', 1),
          getMoviesByGenre('tinh-cam', 1),
          getMoviesByGenre('kinh-di', 1),
        ]);

        if (!isMounted) return;

        setChinaSlugs(chinaSlugSet);

        // Filter out Chinese content from home pools
        const filterNoChina = (list: Movie[]) => {
          const seen = new Set<string>();
          const result: Movie[] = [];
          for (const m of list) {
            if (!m) continue;
            const key = m.slug || m.id;
            if (seen.has(key)) continue;
            seen.add(key);
            if (!isChineseMovie(m, chinaSlugSet)) {
              result.push(m);
            }
          }
          return result;
        };

        const cleanLatest1 = filterNoChina(latestPage1).slice(0, 10);
        const cleanLatest2 = filterNoChina(latestPage2).slice(0, 10);
        const cleanVietnam = filterNoChina(vietnam);
        const cleanKorea = filterNoChina(korea);
        const cleanUs = filterNoChina(us);
        const cleanThai = filterNoChina(thai);
        const cleanJapan = filterNoChina(japan);
        const cleanShows = filterNoChina(shows).slice(0, 10);
        const cleanAction = filterNoChina(action1).slice(0, 10);
        const cleanFeatures = filterNoChina(features1).slice(0, 10);
        const cleanAnime = filterNoChina(anime1).slice(0, 10);
        const cleanRomance = filterNoChina(romance1).slice(0, 10);
        const cleanHorror = filterNoChina(horror1).slice(0, 10);

        // Pick Hero Banner immediately
        const heroCandidatePools: { badge: string; list: Movie[] }[] = [
          { badge: 'Mới cập nhật hôm nay', list: cleanLatest1 },
          { badge: 'Phim điện ảnh Việt Nam mới nhất', list: cleanVietnam },
          { badge: 'Điện ảnh & Series Hàn Quốc', list: cleanKorea },
          { badge: 'Phim điện ảnh Âu Mỹ bom tấn', list: cleanUs },
          { badge: 'Điện ảnh & Series Thái Lan', list: cleanThai },
          { badge: 'Phim & Anime Nhật Bản đặc sắc', list: cleanJapan },
          { badge: 'Phim Kinh dị & Giật gân rùng rợn', list: cleanHorror },
          { badge: 'Phim Hành động kịch tính', list: cleanAction },
          { badge: 'Hoạt hình & Anime đỉnh cao', list: cleanAnime },
          { badge: 'Phim điện ảnh chọn lọc', list: cleanFeatures },
          { badge: 'Chương trình truyền hình & TV Shows', list: cleanShows },
          { badge: 'Phim Tình cảm & Tâm lý hấp dẫn', list: cleanRomance },
        ];

        const validPools = heroCandidatePools.filter((p) => p.list && p.list.length > 0);
        let chosenHero: Movie | null = null;
        let chosenBadge = 'Mới cập nhật hôm nay';

        if (validPools.length > 0) {
          const randomPool = validPools[Math.floor(Math.random() * validPools.length)];
          const topSlice = randomPool.list.slice(0, Math.min(5, randomPool.list.length));
          chosenHero = topSlice[Math.floor(Math.random() * topSlice.length)];
          chosenBadge = randomPool.badge;

          setHeroMovie(chosenHero);
          setHeroBadge(chosenBadge);
        }

        const filterHero = (list: Movie[]) => (chosenHero ? list.filter((m) => m.id !== chosenHero.id) : list);

        setNewUpdatedPage1(filterHero(cleanLatest1));
        if (cleanLatest2.length > 0) setNewUpdatedPage2(filterHero(cleanLatest2));
        if (cleanVietnam.length > 0) setVietnameseMovies(filterHero(cleanVietnam));
        if (cleanKorea.length > 0) setKoreanMovies(filterHero(cleanKorea));
        if (cleanUs.length > 0) setUsMovies(filterHero(cleanUs));
        if (cleanThai.length > 0) setThaiMovies(filterHero(cleanThai));
        if (cleanJapan.length > 0) setJapanMovies(filterHero(cleanJapan));
        if (cleanShows.length > 0) setTvShows(filterHero(cleanShows));
        if (cleanAction.length > 0) setActionMovies(filterHero(cleanAction));
        if (cleanFeatures.length > 0) setFeatureMovies(filterHero(cleanFeatures));
        if (cleanAnime.length > 0) setAnimeMovies(filterHero(cleanAnime));
        if (cleanRomance.length > 0) setRomanceMovies(filterHero(cleanRomance));
        if (cleanHorror.length > 0) setHorrorMovies(filterHero(cleanHorror));

        // UI reveals immediately — zero black screen!
        setIsLoading(false);

        // Instant reconciliation with fresh catalog
        reconcileWatchProgressWithMovies([
          ...cleanLatest1,
          ...cleanLatest2,
          ...cleanKorea,
          ...cleanShows,
          ...cleanVietnam,
          ...cleanUs,
          ...cleanAction,
          ...cleanRomance,
        ]);

        // --- STAGE 2: Progressive background enrichment for Streaming Platform Tops ---
        getNetflixTop10VN()
          .then((netflixTop10) => {
            if (!isMounted) return;
            if (netflixTop10.series?.length > 0) {
              setNetflixSeriesTop10(netflixTop10.series);
              reconcileWatchProgressWithMovies(netflixTop10.series);
            }
            if (netflixTop10.films?.length > 0) setNetflixFilmsTop10(netflixTop10.films);
          })
          .catch(() => {});

        getAppleTvTrending()
          .then((appleTrending) => {
            if (!isMounted) return;
            if (appleTrending?.length > 0) setAppleTvTrending(filterNoChina(appleTrending));
          })
          .catch(() => {});

        getHboTrending()
          .then((hboTrendingData) => {
            if (!isMounted) return;
            if (hboTrendingData?.length > 0) setHboTrending(filterNoChina(hboTrendingData));
          })
          .catch(() => {});

        getDisneyTrending()
          .then((disneyTrendingData) => {
            if (!isMounted) return;
            if (disneyTrendingData?.length > 0) setDisneyTrending(filterNoChina(disneyTrendingData));
          })
          .catch(() => {});
      } catch (err) {
        console.error('Error loading API content for home:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    loadAllContent();

    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Analyze User Taste Profile from user-scoped watch progress
  const tasteProfile = useMemo(() => {
    return buildTasteProfile(watchProgressMap);
  }, [watchProgressMap]);

  // 2. Curate Personalized Picks: matching genres/countries
  const personalizedPicks = useMemo(() => {
    if (tasteProfile.totalWatched === 0) return [];

    const allPoolMovies: Movie[] = [
      ...newUpdatedPage1,
      ...newUpdatedPage2,
      ...vietnameseMovies,
      ...koreanMovies,
      ...usMovies,
      ...thaiMovies,
      ...japanMovies,
      ...tvShows,
      ...actionMovies,
      ...featureMovies,
      ...animeMovies,
      ...romanceMovies,
      ...horrorMovies,
    ];

    return curatePersonalizedRecommendations(
      allPoolMovies,
      watchProgressMap,
      tasteProfile,
      chinaSlugs,
      12
    );
  }, [
    tasteProfile,
    watchProgressMap,
    chinaSlugs,
    newUpdatedPage1,
    newUpdatedPage2,
    vietnameseMovies,
    koreanMovies,
    usMovies,
    thaiMovies,
    japanMovies,
    tvShows,
    actionMovies,
    featureMovies,
    animeMovies,
    romanceMovies,
    horrorMovies,
  ]);

  // 3. Assemble and gracefully interleave all rows (All standard rows landscape, Top 10 portrait)
  const rankedRows = useMemo(() => {
    const candidateRows: CandidateRow[] = [];

    // --- ROW 1: Netflix Top 10 Series (Highest priority, portrait with rank numbers) ---
    if (netflixSeriesTop10.length > 0) {
      candidateRows.push({
        id: 'netflix-series-top10',
        title: 'Top 10 series tại Việt Nam tuần này',
        type: 'top10',
        movies: netflixSeriesTop10,
        priorityBoost: 10000,
      });
    }

    // --- ROW 2: Netflix Top 10 Films (High priority, portrait with rank numbers) ---
    if (netflixFilmsTop10.length > 0) {
      candidateRows.push({
        id: 'netflix-films-top10',
        title: 'Top 10 phim lẻ tại Việt Nam tuần này',
        type: 'top10',
        movies: netflixFilmsTop10,
        priorityBoost: 9800,
      });
    }

    // --- ROW 3: Newest updates of today (Landscape) ---
    if (newUpdatedPage1.length > 0) {
      candidateRows.push({
        id: 'new-updated-1',
        title: 'Phim mới cập nhật hôm nay',
        type: 'standard',
        movies: newUpdatedPage1,
        priorityBoost: 9500,
      });
    }

    // --- ROW 4: Apple TV+ Top 10 (Portrait with rank numbers & Apple logo badge) ---
    if (appleTvTrending.length > 0) {
      candidateRows.push({
        id: 'apple-tv',
        title: 'Top 10 Apple TV+ Originals',
        type: 'top10',
        movies: appleTvTrending,
        priorityBoost: 9000,
      });
    }

    // --- ROW 5: Personalized picks based on user taste (Landscape) ---
    if (personalizedPicks.length > 0) {
      const topGenreLabels = tasteProfile.favoriteGenreSlugs
        .map((s) => {
          if (s === 'tinh-cam') return 'Tình cảm';
          if (s === 'kinh-di') return 'Kinh dị';
          if (s === 'hanh-dong') return 'Hành động';
          if (s === 'hoat-hinh') return 'Hoạt hình';
          if (s === 'phim-hai') return 'Hài hước';
          return null;
        })
        .filter(Boolean)
        .join(', ');

      const rowTitle = topGenreLabels
        ? `Gợi ý theo gu của bạn: Phim ${topGenreLabels}`
        : currentUser?.displayName
        ? `Gợi ý dành riêng cho ${currentUser.displayName}`
        : 'Gợi ý dành riêng cho bạn';

      candidateRows.push({
        id: 'personalized-picks',
        title: rowTitle,
        type: 'standard',
        movies: personalizedPicks,
        priorityBoost: 8500,
      });
    }

    // --- ROW 6: HBO & Max Top 10 (Portrait with rank numbers & HBO badge) ---
    if (hboTrending.length > 0) {
      candidateRows.push({
        id: 'hbo-max',
        title: 'Top 10 HBO & Max Originals',
        type: 'top10',
        movies: hboTrending,
        priorityBoost: 8000,
      });
    }

    // --- ROW 8: Disney+ Top 10 (Portrait with rank numbers & Disney+ badge) ---
    if (disneyTrending.length > 0) {
      candidateRows.push({
        id: 'disney-plus',
        title: 'Top 10 Disney+ Universe',
        type: 'top10',
        movies: disneyTrending,
        priorityBoost: 7000,
      });
    }

    // --- ROW 9: Korean Cinema & Series (Landscape) ---
    if (koreanMovies.length > 0) {
      candidateRows.push({
        id: 'korea',
        title: 'Điện ảnh & Series Hàn Quốc được yêu thích',
        countrySlug: 'han-quoc',
        type: 'standard',
        movies: koreanMovies,
        priorityBoost: 6500,
      });
    }

    // --- ROW 10: Action & Adventure (Landscape) ---
    if (actionMovies.length > 0) {
      candidateRows.push({
        id: 'action',
        title: 'Phim hành động & Phiêu lưu kịch tính',
        genreSlug: 'hanh-dong',
        type: 'standard',
        movies: actionMovies,
        priorityBoost: 6000,
      });
    }

    // --- ROW 12: Vietnam Cinema (Landscape) ---
    if (vietnameseMovies.length > 0) {
      candidateRows.push({
        id: 'vietnam',
        title: 'Phim điện ảnh Việt Nam mới nhất',
        countrySlug: 'viet-nam',
        type: 'standard',
        movies: vietnameseMovies,
        priorityBoost: 3500,
      });
    }

    // --- ROW 14: Japan Cinema & Anime (Landscape) ---
    if (japanMovies.length > 0) {
      candidateRows.push({
        id: 'japan',
        title: 'Phim & Anime Nhật Bản đặc sắc',
        countrySlug: 'nhat-ban',
        type: 'standard',
        movies: japanMovies,
        priorityBoost: 3000,
      });
    }

    // --- ROW 15: US / Hollywood Cinema (Landscape) ---
    if (usMovies.length > 0) {
      candidateRows.push({
        id: 'us',
        title: 'Phim điện ảnh Âu Mỹ bom tấn',
        countrySlug: 'my',
        type: 'standard',
        movies: usMovies,
        priorityBoost: 2500,
      });
    }

    // --- ROW 16: Romance (Landscape) ---
    if (romanceMovies.length > 0) {
      candidateRows.push({
        id: 'romance',
        title: 'Phim tình cảm & Lãng mạn',
        genreSlug: 'tinh-cam',
        type: 'standard',
        movies: romanceMovies,
        priorityBoost: 2000,
      });
    }

    // --- ROW 17: Horror & Thriller (Landscape) ---
    if (horrorMovies.length > 0) {
      candidateRows.push({
        id: 'horror',
        title: 'Phim kinh dị & Giật gân rùng rợn',
        genreSlug: 'kinh-di',
        type: 'standard',
        movies: horrorMovies,
        priorityBoost: 1500,
      });
    }

    // --- ROW 18: Thailand Cinema & Series (Landscape) ---
    if (thaiMovies.length > 0) {
      candidateRows.push({
        id: 'thai',
        title: 'Điện ảnh & Phim truyền hình Thái Lan',
        countrySlug: 'thai-lan',
        type: 'standard',
        movies: thaiMovies,
        priorityBoost: 1000,
      });
    }

    // --- ROW 19: Animation & Anime (Landscape) ---
    if (animeMovies.length > 0) {
      candidateRows.push({
        id: 'anime',
        title: 'Thế giới Hoạt hình & Anime đỉnh cao',
        genreSlug: 'hoat-hinh',
        type: 'standard',
        movies: animeMovies,
        priorityBoost: 800,
      });
    }

    // --- ROW 20: TV Shows (Landscape) ---
    if (tvShows.length > 0) {
      candidateRows.push({
        id: 'shows',
        title: 'Chương trình truyền hình & TV Shows',
        type: 'standard',
        movies: tvShows,
        priorityBoost: 500,
      });
    }

    // --- ROW 21: Features / Phim lẻ (Landscape) ---
    if (featureMovies.length > 0) {
      candidateRows.push({
        id: 'features',
        title: 'Phim lẻ chọn lọc nổi bật',
        type: 'standard',
        movies: featureMovies,
        priorityBoost: 300,
      });
    }

    // --- ROW 22: Secondary batch of latest updates (Landscape) ---
    if (newUpdatedPage2.length > 0) {
      candidateRows.push({
        id: 'new-updated-2',
        title: 'Danh sách mới cập nhật tiếp theo',
        type: 'standard',
        movies: newUpdatedPage2,
        priorityBoost: 100,
      });
    }

    return rankHomepageRows(candidateRows, tasteProfile);
  }, [
    netflixSeriesTop10,
    netflixFilmsTop10,
    appleTvTrending,
    hboTrending,
    disneyTrending,
    personalizedPicks,
    tasteProfile,
    currentUser?.displayName,
    newUpdatedPage1,
    newUpdatedPage2,
    koreanMovies,
    romanceMovies,
    horrorMovies,
    vietnameseMovies,
    usMovies,
    thaiMovies,
    japanMovies,
    actionMovies,
    animeMovies,
    tvShows,
    featureMovies,
  ]);

  if (searchQuery.trim()) {
    return <SearchResults />;
  }

  return (
    <div className="min-h-screen pb-16 overflow-x-hidden">
      {/* Big Hero Card: Randomly picked among latest, Korea, US, Japan & popular categories */}
      <HeroBanner movie={heroMovie} badgeText={heroBadge} />

      {/* Dynamic API Movie Rows with generous breathing space from Hero */}
      <div className="mt-8 sm:mt-12 md:mt-16 relative z-20 space-y-4">
        {isLoading ? (
          <>
            <RowSkeleton title="Top 10 series tại Việt Nam tuần này" variant="portrait" />
            <RowSkeleton title="Top 10 phim lẻ tại Việt Nam tuần này" variant="portrait" />
            <RowSkeleton title="Phim mới cập nhật hôm nay" variant="landscape" />
            <RowSkeleton title="Top 10 Apple TV+ Originals" variant="portrait" />
            <RowSkeleton title="Top 10 HBO & Max Originals" variant="portrait" />
            <RowSkeleton title="Thịnh hành Châu Á: Hàn Quốc, Nhật Bản, Việt Nam" variant="landscape" />
          </>
        ) : (
          <>
            {/* Continue Watching Row (Personalized for current logged-in user) */}
            {continueWatchingList && continueWatchingList.length > 0 && (
              <MovieRow
                title="Tiếp tục xem cho bạn"
                movies={continueWatchingList.filter((m) => !isChineseMovie(m, chinaSlugs))}
                type="continue"
              />
            )}

            {/* Dynamically personalized, platform-separated, and ranked rows */}
            {rankedRows.map((row) => (
              <MovieRow
                key={row.id}
                title={row.title}
                movies={row.movies}
                type={row.type}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
