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
  buildTasteProfile,
  rankHomepageRows,
  curatePersonalizedRecommendations,
  CandidateRow,
} from '@/services/recommendationEngine';
import { Movie } from '@/types';

export default function HomePage() {
  const { searchQuery, continueWatchingList, watchProgressMap, currentUser } = useNetflix();

  const [heroMovie, setHeroMovie] = useState<Movie | null>(null);
  const [heroBadge, setHeroBadge] = useState<string>('Mới cập nhật hôm nay');
  const [chinaSlugs, setChinaSlugs] = useState<Set<string>>(new Set());

  // Category & Country Pools
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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch all real movies dynamically from phim.nguonc.com API
  useEffect(() => {
    let isMounted = true;

    async function loadAllContent() {
      try {
        setIsLoading(true);

        const [
          chinaSlugSet,
          latestPage1,
          latestPage2,
          latestPage3,
          vietnam,
          korea,
          us,
          thai,
          japan,
          shows,
          action1,
          action2,
          features1,
          features2,
          anime1,
          anime2,
          romance1,
          romance2,
          horror1,
        ] = await Promise.all([
          getChineseMovieSlugs(),
          getNewUpdatedMovies(1),
          getNewUpdatedMovies(2),
          getNewUpdatedMovies(3),
          getVietnameseMovies(),
          getMoviesByCountry('han-quoc', 1),
          getMoviesByCountry('my', 1),
          getMoviesByCountry('thai-lan', 1),
          getMoviesByCountry('nhat-ban', 1),
          getMoviesByCategory('tv-shows', 1),
          getMoviesByGenre('hanh-dong', 1),
          getMoviesByGenre('hanh-dong', 2),
          getMoviesByCategory('phim-le', 1),
          getMoviesByCategory('phim-le', 2),
          getMoviesByGenre('hoat-hinh', 1),
          getMoviesByGenre('hoat-hinh', 2),
          getMoviesByGenre('tinh-cam', 1),
          getMoviesByGenre('tinh-cam', 2),
          getMoviesByGenre('kinh-di', 1),
        ]);

        if (isMounted) {
          setChinaSlugs(chinaSlugSet);

          // Strictly filter out ANY Chinese movie from the home page
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

          const cleanLatest = filterNoChina([...latestPage1, ...latestPage2, ...latestPage3]);
          const cleanLatest1 = cleanLatest.slice(0, 10);
          const cleanLatest2 = cleanLatest.slice(10, 20);

          const cleanVietnam = filterNoChina(vietnam);
          const cleanKorea = filterNoChina(korea);
          const cleanUs = filterNoChina(us);
          const cleanThai = filterNoChina(thai);
          const cleanJapan = filterNoChina(japan);
          const cleanShows = filterNoChina(shows).slice(0, 10);
          const cleanAction = filterNoChina([...action1, ...action2]).slice(0, 10);
          const cleanFeatures = filterNoChina([...features1, ...features2]).slice(0, 10);
          const cleanAnime = filterNoChina([...anime1, ...anime2]).slice(0, 10);
          const cleanRomance = filterNoChina([...romance1, ...romance2]).slice(0, 10);
          const cleanHorror = filterNoChina(horror1).slice(0, 10);

          // Define candidate pools for dynamic random Hero banner selection (100% free of Chinese movies)
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

          // Filter only pools that have available movies
          const validPools = heroCandidatePools.filter((p) => p.list && p.list.length > 0);

          let chosenHero: Movie | null = null;
          let chosenBadge = 'Mới cập nhật hôm nay';

          if (validPools.length > 0) {
            // Pick a random category pool on each reload
            const randomPool = validPools[Math.floor(Math.random() * validPools.length)];
            const topSlice = randomPool.list.slice(0, Math.min(5, randomPool.list.length));
            chosenHero = topSlice[Math.floor(Math.random() * topSlice.length)];
            chosenBadge = randomPool.badge;

            setHeroMovie(chosenHero);
            setHeroBadge(chosenBadge);
          }

          // Populate row lists, filtering out the chosen hero from its row to avoid immediate duplication
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
        }
      } catch (err) {
        console.error('Error loading API content for home:', err);
      } finally {
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

  // 2. Candidate pool for generating personalized recommendations
  const allCandidateMovies = useMemo(() => {
    return [
      ...newUpdatedPage1,
      ...newUpdatedPage2,
      ...koreanMovies,
      ...romanceMovies,
      ...horrorMovies,
      ...vietnameseMovies,
      ...usMovies,
      ...thaiMovies,
      ...japanMovies,
      ...actionMovies,
      ...animeMovies,
      ...tvShows,
      ...featureMovies,
    ];
  }, [
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

  // 3. Curate personalized picks for the user
  const personalizedPicks = useMemo(() => {
    return curatePersonalizedRecommendations(
      allCandidateMovies,
      watchProgressMap,
      tasteProfile,
      chinaSlugs,
      12
    );
  }, [allCandidateMovies, watchProgressMap, tasteProfile, chinaSlugs]);

  // 4. Dynamically rank homepage rows based on:
  //    - User favorite country & genres prioritized at top
  //    - Other countries sorted by newest movie update recency
  //    - Random diversity across similar genres of other countries
  const rankedRows = useMemo(() => {
    const candidateRows: CandidateRow[] = [];

    // Row A: Personalized Picks (Only if user has watched at least 1 movie)
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
        type: 'portrait',
        movies: personalizedPicks,
        priorityBoost: 10000, // Top priority right below Continue Watching
      });
    }

    // Row B: Newest updates of today
    if (newUpdatedPage1.length > 0) {
      candidateRows.push({
        id: 'new-updated-1',
        title: 'Phim mới cập nhật hôm nay',
        type: 'standard',
        movies: newUpdatedPage1,
        priorityBoost: 8000,
      });
    }

    // Row C: Korean Cinema & Series
    if (koreanMovies.length > 0) {
      candidateRows.push({
        id: 'korea',
        title: 'Điện ảnh & Series Hàn Quốc được yêu thích',
        countrySlug: 'han-quoc',
        type: 'portrait',
        movies: koreanMovies,
      });
    }

    // Row D: Romance
    if (romanceMovies.length > 0) {
      candidateRows.push({
        id: 'romance',
        title: 'Phim tình cảm & Lãng mạn',
        genreSlug: 'tinh-cam',
        type: 'portrait',
        movies: romanceMovies,
      });
    }

    // Row E: Horror & Thriller
    if (horrorMovies.length > 0) {
      candidateRows.push({
        id: 'horror',
        title: 'Phim kinh dị & Giật gân rùng rợn',
        genreSlug: 'kinh-di',
        type: 'standard',
        movies: horrorMovies,
      });
    }

    // Row F: Vietnam Cinema
    if (vietnameseMovies.length > 0) {
      candidateRows.push({
        id: 'vietnam',
        title: 'Phim điện ảnh Việt Nam mới nhất',
        countrySlug: 'viet-nam',
        type: 'portrait',
        movies: vietnameseMovies,
      });
    }

    // Row G: US / Hollywood Cinema
    if (usMovies.length > 0) {
      candidateRows.push({
        id: 'us',
        title: 'Phim điện ảnh Âu Mỹ bom tấn',
        countrySlug: 'my',
        type: 'standard',
        movies: usMovies,
      });
    }

    // Row H: Thailand Cinema & Series
    if (thaiMovies.length > 0) {
      candidateRows.push({
        id: 'thai',
        title: 'Điện ảnh & Phim truyền hình Thái Lan',
        countrySlug: 'thai-lan',
        type: 'portrait',
        movies: thaiMovies,
      });
    }

    // Row I: Japan Cinema & Anime
    if (japanMovies.length > 0) {
      candidateRows.push({
        id: 'japan',
        title: 'Phim & Anime Nhật Bản đặc sắc',
        countrySlug: 'nhat-ban',
        type: 'portrait',
        movies: japanMovies,
      });
    }

    // Row J: Action & Adventure
    if (actionMovies.length > 0) {
      candidateRows.push({
        id: 'action',
        title: 'Phim hành động & Phiêu lưu kịch tính',
        genreSlug: 'hanh-dong',
        type: 'standard',
        movies: actionMovies,
      });
    }

    // Row K: Animation & Anime
    if (animeMovies.length > 0) {
      candidateRows.push({
        id: 'anime',
        title: 'Thế giới Hoạt hình & Anime đỉnh cao',
        genreSlug: 'hoat-hinh',
        type: 'portrait',
        movies: animeMovies,
      });
    }

    // Row L: TV Shows
    if (tvShows.length > 0) {
      candidateRows.push({
        id: 'shows',
        title: 'Chương trình truyền hình & TV Shows',
        type: 'standard',
        movies: tvShows,
      });
    }

    // Row M: Features / Phim lẻ
    if (featureMovies.length > 0) {
      candidateRows.push({
        id: 'features',
        title: 'Phim lẻ chọn lọc nổi bật',
        type: 'standard',
        movies: featureMovies,
      });
    }

    // Row N: Secondary batch of latest updates
    if (newUpdatedPage2.length > 0) {
      candidateRows.push({
        id: 'new-updated-2',
        title: 'Danh sách mới cập nhật tiếp theo',
        type: 'standard',
        movies: newUpdatedPage2,
      });
    }

    return rankHomepageRows(candidateRows, tasteProfile);
  }, [
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
            <RowSkeleton title="Phim mới cập nhật hôm nay" variant="landscape" />
            <RowSkeleton title="Điện ảnh & Series Hàn Quốc được yêu thích" variant="portrait" />
            <RowSkeleton title="Phim điện ảnh Việt Nam mới nhất" variant="portrait" />
            <RowSkeleton title="Phim điện ảnh Âu Mỹ bom tấn" variant="landscape" />
            <RowSkeleton title="Phim & Anime Nhật Bản đặc sắc" variant="portrait" />
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

            {/* Dynamically personalized and ranked rows */}
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
