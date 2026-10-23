import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '58dba4066f4f36e49e5e769304442088';

/** Generic placeholder names like "Episode 1", "Tập 1", "第1集" carry no real info */
const GENERIC_NAME = /^(episode|tập|tap|ep\.?|episodio|épisode|folge|эпизод|第)\s*\d+\s*(集|화|話)?$/i;

const isMeaningfulName = (name?: string | null): name is string =>
  Boolean(name && name.trim() && !GENERIC_NAME.test(name.trim()));

interface TmdbRawEpisode {
  episode_number: number;
  name?: string;
  overview?: string;
  still_path?: string | null;
  runtime?: number | null;
  air_date?: string | null;
  vote_average?: number;
}

async function fetchSeason(id: string, season: number, language: string) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}&language=${language}`,
      { next: { revalidate: 21600 } } as RequestInit
    );
    if (!res.ok) return null;
    return (await res.json()) as { name?: string; episodes?: TmdbRawEpisode[] };
  } catch {
    return null;
  }
}

/**
 * GET /api/tmdb/episodes?id=<tmdb tv id>&season=<n>
 * Returns compact per-episode metadata (still image, title, overview, runtime, air date).
 * Vietnamese is preferred; English fills in any missing titles / overviews.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  const season = Math.max(0, parseInt(searchParams.get('season') || '1', 10) || 1);

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid TMDB id' }, { status: 400 });
  }

  const [vi, en] = await Promise.all([fetchSeason(id, season, 'vi-VN'), fetchSeason(id, season, 'en-US')]);
  const base = vi?.episodes || en?.episodes || [];

  if (base.length === 0) {
    return NextResponse.json(
      { episodes: [] },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600' } }
    );
  }

  const enMap = new Map<number, TmdbRawEpisode>((en?.episodes || []).map((e) => [e.episode_number, e]));

  const episodes = base.map((ep) => {
    const enEp = enMap.get(ep.episode_number);
    const name = isMeaningfulName(ep.name) ? ep.name : isMeaningfulName(enEp?.name) ? enEp!.name! : null;
    return {
      number: ep.episode_number,
      name,
      overview: (ep.overview || enEp?.overview || '').trim(),
      still: ep.still_path || enEp?.still_path || null,
      runtime: ep.runtime || enEp?.runtime || null,
      airDate: ep.air_date || enEp?.air_date || null,
      vote: typeof ep.vote_average === 'number' && ep.vote_average > 0 ? ep.vote_average : null,
    };
  });

  return NextResponse.json(
    { seasonName: vi?.name || en?.name || null, episodes },
    { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } }
  );
}
