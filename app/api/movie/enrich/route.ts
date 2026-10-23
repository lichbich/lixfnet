import { NextRequest, NextResponse } from 'next/server';
import { crossMatchAndEnrichMovie } from '@/services/movieCrossMatchService';
import { Movie } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const movie: Movie = await request.json();
    if (!movie || (!movie.id && !movie.slug && !movie.title)) {
      return NextResponse.json({ error: 'Invalid movie payload' }, { status: 400 });
    }

    const enriched = await crossMatchAndEnrichMovie(movie);

    return NextResponse.json(
      { movie: enriched },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
        },
      }
    );
  } catch (error) {
    console.error('Error in /api/movie/enrich route:', error);
    return NextResponse.json({ error: 'Failed to enrich movie' }, { status: 500 });
  }
}
