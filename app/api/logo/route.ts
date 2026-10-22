import { NextRequest, NextResponse } from 'next/server';
import { fetchTMDBLogo } from '@/services/logoService';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const title = searchParams.get('title') || '';
  const subTitle = searchParams.get('subTitle') || '';
  const slug = searchParams.get('slug') || '';
  const tmdbId = searchParams.get('tmdbId') || undefined;
  const mediaType = searchParams.get('mediaType') || 'movie';
  const yearStr = searchParams.get('year') || '';
  const year = yearStr ? parseInt(yearStr, 10) : undefined;

  if (!title && !subTitle && !slug && !tmdbId) {
    return NextResponse.json({ logoUrl: null }, { status: 400 });
  }

  try {
    const logoUrl = await fetchTMDBLogo({
      tmdbId,
      mediaType,
      title,
      subTitle,
      slug,
      year: isNaN(year!) ? undefined : year,
    });

    return NextResponse.json(
      { logoUrl },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
        },
      }
    );
  } catch (error) {
    console.error('Error in /api/logo route:', error);
    return NextResponse.json({ logoUrl: null }, { status: 500 });
  }
}
