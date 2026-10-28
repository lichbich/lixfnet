import { NextResponse } from 'next/server';

interface NetflixTop10Response {
  films: string[];
  series: string[];
  week: string;
  source: 'live' | 'fallback' | 'cache';
}

// Fallback seed data in case of upstream network latency or throttling (Week 10/19/26 - 10/25/26)
const FALLBACK_FILMS: string[] = [
  'Evil Dead Burn',
  'Bunny!',
  'Animals',
  'Fish, Fists and Ambergris',
  'Tomb Raider',
  'Black Adam',
  'Mai',
  'Surviving Hurricane Otis',
  'The 4 Rascals',
  'Blackout',
];

const FALLBACK_SERIES: string[] = [
  'Doctor X: Mafia in White: Limited Series',
  'Where the Mask Ends: Season 1',
  '100 Days of Deception: Limited Series',
  'Cyberpunk: Edgerunners 2',
  'Take Charge of My Heart: Limited Series',
  'Dragon Ball Super: Beerus: Season 1',
  'Below: Limited Series',
  'The Apothecary Diaries: Season 3',
  'Firefly Wedding: Season 1',
  'Extraordinary Attorney Minami: Season 1',
];

let serverCache: {
  data: NetflixTop10Response;
  expiresAt: number;
} | null = null;

/**
 * Netflix releases official Top 10 rankings once a week on Tuesday afternoon (around 20:00 UTC / 03:00 AM Wed VN).
 * Returns the timestamp of the next expected Tuesday release.
 */
function getNextTuesdayUpdateTimestamp(): number {
  const now = new Date();
  const nextTuesday = new Date(now);
  const day = now.getUTCDay(); // 0 = Sun, 1 = Mon, 2 = Tue, ...
  let daysUntilTuesday = (2 - day + 7) % 7;
  
  // If today is Tuesday, check if 20:00 UTC has passed
  if (daysUntilTuesday === 0 && now.getUTCHours() >= 20) {
    daysUntilTuesday = 7;
  }
  
  nextTuesday.setUTCDate(now.getUTCDate() + daysUntilTuesday);
  nextTuesday.setUTCHours(20, 0, 0, 0);
  return nextTuesday.getTime();
}

/**
 * Scrapes official Netflix Tudum Top 10 Vietnam HTML pages.
 * Only runs ONCE A WEEK after Netflix releases new data on Tuesday.
 */
async function fetchTudumVietnam(): Promise<{ series: string[]; films: string[]; week: string } | null> {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const [tvRes, filmsRes] = await Promise.all([
      fetch('https://www.netflix.com/tudum/top10/vietnam/tv', {
        headers,
        signal: controller.signal,
        next: { revalidate: 604800 }, // 7 days (1 week)
      }),
      fetch('https://www.netflix.com/tudum/top10/vietnam', {
        headers,
        signal: controller.signal,
        next: { revalidate: 604800 }, // 7 days (1 week)
      }),
    ]);

    clearTimeout(timeout);

    if (!tvRes.ok || !filmsRes.ok) return null;

    const [tvHtml, filmsHtml] = await Promise.all([tvRes.text(), filmsRes.text()]);

    const extractTitles = (html: string): string[] => {
      const matches = [...html.matchAll(/alt="([^"]+)"\s+class="[^"]*cache-[^"]*"/g)].map((m) => m[1].trim());
      return matches.slice(0, 10);
    };

    const extractWeek = (html: string): string | null => {
      const match = html.match(/(\d{2}\/\d{2}\/\d{2}\s*-\s*\d{2}\/\d{2}\/\d{2})/);
      return match ? match[1] : null;
    };

    const series = extractTitles(tvHtml);
    const films = extractTitles(filmsHtml);
    const week = extractWeek(tvHtml) || extractWeek(filmsHtml) || 'current';

    if (series.length >= 5 && films.length >= 5) {
      return {
        series: Array.from({ length: 10 }, (_, i) => series[i] || FALLBACK_SERIES[i]),
        films: Array.from({ length: 10 }, (_, i) => films[i] || FALLBACK_FILMS[i]),
        week,
      };
    }
    return null;
  } catch (e) {
    clearTimeout(timeout);
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const forceFresh = url.searchParams.get('fresh') === 'true' || url.searchParams.get('force') === 'true';
  const now = Date.now();

  // Return server-side memory cache if valid until next Tuesday update
  if (!forceFresh && serverCache && now < serverCache.expiresAt) {
    return NextResponse.json(
      { ...serverCache.data, source: 'cache' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400',
        },
      }
    );
  }

  // 1. Primary Strategy: Live HTML scrape from Netflix Tudum Vietnam (runs only once a week)
  try {
    const tudumData = await fetchTudumVietnam();
    if (tudumData) {
      const responseData: NetflixTop10Response = {
        films: tudumData.films,
        series: tudumData.series,
        week: tudumData.week,
        source: 'live',
      };

      serverCache = {
        data: responseData,
        expiresAt: getNextTuesdayUpdateTimestamp(),
      };

      return NextResponse.json(responseData, {
        headers: {
          'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400',
        },
      });
    }
  } catch (err) {
    console.warn('Could not fetch Tudum HTML, falling back to seed data:', err);
  }

  // 2. Fallback return (in case of error, retry in 3 hours)
  const fallbackData: NetflixTop10Response = {
    films: FALLBACK_FILMS,
    series: FALLBACK_SERIES,
    week: 'current',
    source: 'fallback',
  };

  serverCache = {
    data: fallbackData,
    expiresAt: now + 3 * 60 * 60 * 1000,
  };

  return NextResponse.json(fallbackData, {
    headers: {
      'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=21600',
    },
  });
}
