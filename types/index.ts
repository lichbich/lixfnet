export interface Episode {
  id: string;
  number: number | string;
  title: string;
  duration?: string;
  description?: string;
  thumbnail?: string;
  embedUrl?: string;
  m3u8Url?: string; // Direct HLS m3u8 stream from phimapi.com
  slug?: string;
}

export interface Season {
  seasonNumber: number;
  title: string;
  episodes: Episode[];
}

export interface EpisodeServerItem {
  name: string;
  slug: string;
  embed: string;
  m3u8?: string; // Direct HLS m3u8 link from phimapi.com
}

export interface EpisodeServer {
  server_name: string;
  items: EpisodeServerItem[];
}

export interface Movie {
  id: string;
  slug?: string; // API slug for fetching detail and episodes
  title: string;
  subTitle?: string;
  type: 'series' | 'movie';
  year: number;
  seasons?: string; // e.g. "2 mùa" or "1 giờ 45 phút" or "Tập 12"
  duration?: string; // e.g. "65 phút" or "115 phút" or "24 phút/tập"
  durationMinutes?: number; // parsed numeric minutes, e.g. 65, 115, 24
  rating: string; // e.g. "T18", "T16", "T13", "P"
  genres: string[];
  country?: string; // e.g. "Hàn Quốc", "Mỹ", "Nhật Bản", "Trung Quốc"
  countrySlug?: string;
  matchRate: number; // e.g. 98 (% phù hợp)
  quality?: 'HD' | '4K Ultra HD' | 'HDR';
  audioTags?: string[]; // e.g. ["5.1", "Dolby Vision"]
  description: string;
  heroTagline?: string;
  backdropUrl: string;
  posterUrl: string;
  logoUrl?: string;
  rank?: number; // for Top 10
  isAvailable?: boolean;
  badges?: {
    ribbon?: string; // e.g. "Tập mới", "Mùa mới", "Mới thêm", "Tập tiếp theo"
    subBadge?: string; // e.g. "Xem ngay", "Thứ Bảy", "Thứ Sáu"
    isTop10?: boolean;
    platform?: 'netflix' | 'apple' | 'disney' | 'hbo' | 'prime';
    platformName?: string;
    customPill?: {
      text: string;
      iconType?: 'calendar' | 'emmy';
    };
  };
  progress?: number; // percentage watched (0 - 100) for "Continue Watching"
  currentEpisode?: string; // e.g. "Tập 3: Lạc lối"
  cast?: string[];
  director?: string;
  tags?: string[];
  videoUrl?: string; // fallback demo video stream
  embedUrl?: string; // real iframe embed URL from API
  m3u8Url?: string; // direct HLS m3u8 stream from phimapi.com
  episodesServers?: EpisodeServer[];
  seasonsList?: Season[];
  tmdb?: {
    id: number | string;
    type?: string;
    season?: number | null;
    url?: string;
    voteAverage?: number;
    voteCount?: number;
  };
  imdb?: {
    id: string;
    url?: string;
  };
  tmdbId?: number | string;
  trailerUrl?: string; // Raw trailer URL from API (phimapi.com)
  trailerYoutubeKey?: string; // Parsed YouTube video ID (e.g. "3c68oabNkJs")
}

export interface EpisodeProgress {
  currentTime: number; // in seconds
  duration: number; // in seconds
  progressPercent: number; // 0 - 100
  updatedAt: number; // timestamp
  isCompleted?: boolean;
  embedUrl?: string;
  m3u8Url?: string;
}

export interface WatchProgress {
  movieId: string;
  movieSlug?: string;
  movie: Movie;
  episodeTitle?: string;
  episodeEmbed?: string;
  episodeM3u8?: string; // Direct HLS m3u8 stream
  currentTime: number; // in seconds
  duration: number; // in seconds
  progressPercent: number; // 0 - 100
  updatedAt: number; // timestamp
  episodesProgress?: Record<string, EpisodeProgress>;
}

export interface MovieCategory {
  id: string;
  title: string;
  movies: Movie[];
  type?: 'standard' | 'top10' | 'continue';
}

// ==========================================
// API Models for phimapi.com (KKPhim API)
// ==========================================

export interface KKPhimCategoryItem {
  id: string;
  name: string;
  slug: string;
}

export interface KKPhimCountryItem {
  id: string;
  name: string;
  slug: string;
}

export interface KKPhimEpisodeItem {
  name: string;
  slug: string;
  filename?: string;
  link_embed: string;
  link_m3u8: string;
}

export interface KKPhimEpisodeServer {
  server_name: string;
  is_ai?: boolean;
  server_data: KKPhimEpisodeItem[];
}

export interface KKPhimPagination {
  totalItems: number;
  totalItemsPerPage: number;
  currentPage: number;
  totalPages: number;
}

export interface KKPhimItem {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  origin_name?: string;
  original_name?: string;
  alternative_names?: string[];
  type?: 'series' | 'single' | 'hoathinh' | 'tvshows' | string;
  thumb_url?: string;
  poster_url?: string;
  sub_docquyen?: boolean;
  chieurap?: boolean;
  time?: string;
  episode_current?: string;
  current_episode?: string;
  episode_total?: string;
  total_episodes?: number;
  quality?: string;
  lang?: string;
  language?: string;
  lang_key?: string[];
  notify?: string;
  showtimes?: string;
  year?: number | string;
  view?: number;
  category?: KKPhimCategoryItem[] | Record<string, any>;
  country?: KKPhimCountryItem[] | Record<string, any>;
  tmdb?: {
    id: number | string | null;
    type?: string | null;
    season?: number | null;
    vote_average?: number;
    vote_count?: number;
    url?: string;
  };
  imdb?: {
    id: string | null;
    vote_average?: number;
    vote_count?: number;
    url?: string;
  };
  created?: { time?: string } | string;
  modified?: { time?: string } | string;
  content?: string;
  description?: string;
  trailer_url?: string;
  actor?: string[];
  casts?: string;
  director?: string[] | string;
  episodes?: KKPhimEpisodeServer[] | EpisodeServer[];
  last_episodes?: Array<{ server_name: string; is_ai?: boolean; name?: string }>;
}

export interface KKPhimListResponse {
  status: boolean | string;
  msg?: string;
  message?: string;
  data?: {
    items?: KKPhimItem[];
    params?: { pagination?: KKPhimPagination };
    type_list?: string;
    APP_DOMAIN_CDN_IMAGE?: string;
    APP_DOMAIN_FRONTEND?: string;
  };
  items?: KKPhimItem[];
  pagination?: KKPhimPagination;
  paginate?: NguonCPaginate;
}

export interface KKPhimDetailResponse {
  status: boolean | string;
  msg?: string;
  message?: string;
  data?: {
    item?: KKPhimItem;
    APP_DOMAIN_CDN_IMAGE?: string;
  };
  movie?: KKPhimItem;
  episodes?: KKPhimEpisodeServer[];
}

// Backward-compatibility aliases for existing code
export type NguonCItem = KKPhimItem;
export type NguonCDetailMovie = KKPhimItem;
export type NguonCListResponse = KKPhimListResponse;
export type NguonCDetailResponse = KKPhimDetailResponse;

export interface NguonCPaginate {
  current_page: number;
  total_page: number;
  total_items: number;
  items_per_page: number;
}
