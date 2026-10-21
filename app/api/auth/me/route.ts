import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('lixfnet_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ user: null });
    }

    const user = JSON.parse(sessionCookie);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
