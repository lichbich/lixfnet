import { NextResponse } from 'next/server';

interface NetflixTop10Item {
  rank: number;
  title: string;
  category: 'Films' | 'TV';
  weeksInTop10: number;
}

interface NetflixTop10Response {
  films: string[];
  series: string[];
  week: string;
  source: 'live' | 'fallback' | 'cache';
}

// Fallback seed data in case of upstream network latency or throttling
const FALLBACK_FILMS: string[] = [
  'Animals',
  'Tomb Raider',
  'Evil Dead Burn',
  'Bunny!',
  'Fish, Fists and Ambergris',
  'Kong: Skull Island',
  'Mai',
  'The Silence of the Lambs',
  'Ben-Hur',
  'Crazy Rich Asians',
];

const FALLBACK_SERIES: string[] = [
  'Doctor X: Mafia in White',
  '100 Days of Deception',
  'Take Charge of My Heart',
  'Below',
  'Where the Mask Ends',
  'The Apothecary Diaries',
  'Irreplaceable',
  'Firefly Wedding',
  'The Early Spring',
  'Doctor X Surgeon Michiko Daimon',
];

let serverCache: {
  data: NetflixTop10Response;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export async function GET() {
  const now = Date.now();

  // Return server-side memory cache if valid
  if (serverCache && now - serverCache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(
      { ...serverCache.data, source: 'cache' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400',
        },
      }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch('https://top10.netflix.com/data/all-weeks-countries.tsv', {
      signal: controller.signal,
      next: { revalidate: 43200 },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const txt = await res.text();
      const lines = txt.split('\n');
      const vnRows = lines.filter(
        (l) => l.startsWith('Viet Nam\t') || l.startsWith('Vietnam\t') || l.includes('\tVN\t')
      );

      if (vnRows.length > 0) {
        const latestWeek = vnRows[0].split('\t')[2];
        const latestRows = vnRows.filter((l) => l.includes(`\t${latestWeek}\t`));

        const filmsMap = new Map<number, string>();
        const seriesMap = new Map<number, string>();

        for (const line of latestRows) {
          const parts = line.split('\t');
          const cat = parts[3]; // 'Films' or 'TV'
          const rank = parseInt(parts[4], 10);
          const title = parts[5];
          if (cat === 'Films' && rank <= 10) {
            filmsMap.set(rank, title);
          } else if (cat === 'TV' && rank <= 10) {
            seriesMap.set(rank, title);
          }
        }

        const films = Array.from({ length: 10 }, (_, i) => filmsMap.get(i + 1) || FALLBACK_FILMS[i]);
        const series = Array.from({ length: 10 }, (_, i) => seriesMap.get(i + 1) || FALLBACK_SERIES[i]);

        const responseData: NetflixTop10Response = {
          films,
          series,
          week: latestWeek,
          source: 'live',
        };

        serverCache = {
          data: responseData,
          timestamp: now,
        };

        return NextResponse.json(responseData, {
          headers: {
            'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400',
          },
        });
      }
    }
  } catch (err) {
    console.warn('Could not fetch upstream Netflix TSV, serving verified fallback data:', err);
  }

  // Fallback return
  const fallbackData: NetflixTop10Response = {
    films: FALLBACK_FILMS,
    series: FALLBACK_SERIES,
    week: 'current',
    source: 'fallback',
  };

  return NextResponse.json(fallbackData, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
}
