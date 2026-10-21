import { NextRequest, NextResponse } from 'next/server';
import {
  getUserWatchProgress,
  saveUserWatchProgress,
  removeUserWatchProgress,
} from '@/lib/firebaseAdmin';

function getSessionUser(req: NextRequest) {
  const sessionCookie = req.cookies.get('lixfnet_session')?.value;
  if (!sessionCookie) return null;
  try {
    const user = JSON.parse(sessionCookie);
    return user?.username ? user : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/user/progress
 * Retrieves personalized watch progress for the current authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const progress = await getUserWatchProgress(sessionUser.username);
    return NextResponse.json({
      success: true,
      username: sessionUser.username,
      progress,
    });
  } catch (error: any) {
    console.error('Error getting user watch progress:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi tải tiến trình xem' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/progress
 * Saves/updates a movie's watch progress in Firebase for the current user
 */
export async function POST(req: NextRequest) {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await req.json();
    const { key, progress } = body;

    if (!key || !progress) {
      return NextResponse.json(
        { error: 'Thiếu key hoặc dữ liệu tiến trình' },
        { status: 400 }
      );
    }

    await saveUserWatchProgress(sessionUser.username, key, progress);

    return NextResponse.json({
      success: true,
      username: sessionUser.username,
      key,
    });
  } catch (error: any) {
    console.error('Error saving user watch progress:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi lưu tiến trình xem' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/progress
 * Removes a movie from the current user's watch progress
 */
export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await req.json();
    const { key } = body;

    if (!key) {
      return NextResponse.json({ error: 'Thiếu key' }, { status: 400 });
    }

    await removeUserWatchProgress(sessionUser.username, key);

    return NextResponse.json({
      success: true,
      username: sessionUser.username,
      key,
    });
  } catch (error: any) {
    console.error('Error deleting user watch progress:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi xóa tiến trình xem' },
      { status: 500 }
    );
  }
}
