export interface Episode {
  id: string;
  number: number | string;
  title: string;
  duration?: string;
  description?: string;
  thumbnail?: string;
  embedUrl?: string;
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
}

export interface EpisodeProgress {
  currentTime: number; // in seconds
  duration: number; // in seconds
  progressPercent: number; // 0 - 100
  updatedAt: number; // timestamp
  isCompleted?: boolean;
}

export interface WatchProgress {
  movieId: string;
  movieSlug?: string;
  movie: Movie;
  episodeTitle?: string;
  episodeEmbed?: string;
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

// API Response Models for phim.nguonc.com
export interface NguonCPaginate {
  current_page: number;
  total_page: number;
  total_items: number;
  items_per_page: number;
}

export interface NguonCItem {
  id?: string;
  name: string;
  original_name?: string;
  slug: string;
  year?: number | string;
  description?: string;
  total_episodes?: number;
  current_episode?: string;
  time?: string;
  quality?: string;
  language?: string;
  director?: string;
  casts?: string;
  tmdb?: {
    id: number | string;
    type?: string;
    season?: number | null;
    url?: string;
  };
  imdb?: {
    id: string;
    url?: string;
  };
  thumb_url?: string;
  poster_url?: string;
  created?: string;
  modified?: string;
}

export interface NguonCListResponse {
  status: string;
  paginate: NguonCPaginate;
  items: NguonCItem[];
}

export interface NguonCDetailMovie extends NguonCItem {
  category?: Record<
    string,
    {
      group: { id: string; name: string };
      list: Array<{ id: string; name: string }>;
    }
  >;
  episodes?: EpisodeServer[];
}

export interface NguonCDetailResponse {
  status: string;
  movie: NguonCDetailMovie;
}
