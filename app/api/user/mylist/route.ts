import { NextRequest, NextResponse } from 'next/server';
import {
  getUserMyList,
  saveUserMyListItem,
  removeUserMyListItem,
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
 * GET /api/user/mylist
 * Retrieves cloud-synced My List for the current authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const myList = await getUserMyList(sessionUser.username);
    return NextResponse.json({
      success: true,
      username: sessionUser.username,
      myList,
    });
  } catch (error: any) {
    console.error('Error getting user My List:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi tải danh sách xem sau' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/mylist
 * Saves/updates a movie in the user's My List on Firebase
 */
export async function POST(req: NextRequest) {
  try {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await req.json();
    const { key, movie } = body;

    if (!key || !movie) {
      return NextResponse.json(
        { error: 'Thiếu key hoặc dữ liệu phim' },
        { status: 400 }
      );
    }

    await saveUserMyListItem(sessionUser.username, key, movie);

    return NextResponse.json({
      success: true,
      username: sessionUser.username,
      key,
    });
  } catch (error: any) {
    console.error('Error saving user My List item:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi lưu phim vào danh sách' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/mylist
 * Removes a movie from the user's My List on Firebase
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

    await removeUserMyListItem(sessionUser.username, key);

    return NextResponse.json({
      success: true,
      username: sessionUser.username,
      key,
    });
  } catch (error: any) {
    console.error('Error deleting user My List item:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi xóa phim khỏi danh sách' },
      { status: 500 }
    );
  }
}
