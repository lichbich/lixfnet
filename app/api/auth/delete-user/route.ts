import { NextRequest, NextResponse } from 'next/server';
import { findUser, deleteUser } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller session
    const sessionCookie = req.cookies.get('lixfnet_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Bạn cần đăng nhập để thực hiện thao tác này.' },
        { status: 401 }
      );
    }

    let sessionUser: any = null;
    try {
      sessionUser = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json(
        { error: 'Phiên đăng nhập không hợp lệ.' },
        { status: 401 }
      );
    }

    // 2. Verify caller has admin role in database
    const caller = await findUser(sessionUser.username);
    if (!caller || caller.role !== 'admin') {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên mới có quyền xóa tài khoản.' },
        { status: 403 }
      );
    }

    // 3. Parse target username
    const body = await req.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { error: 'Tên tài khoản cần xóa không được để trống.' },
        { status: 400 }
      );
    }

    const cleanTarget = String(username).trim().toLowerCase();

    // Prevent self-deletion
    if (cleanTarget === caller.username.toLowerCase()) {
      return NextResponse.json(
        { error: 'Không thể tự xóa tài khoản của chính mình.' },
        { status: 400 }
      );
    }

    // Protect primary admin 'tronglich'
    if (cleanTarget === 'tronglich') {
      return NextResponse.json(
        { error: 'Không thể xóa tài khoản Quản trị viên gốc.' },
        { status: 403 }
      );
    }

    // Check if target user exists
    const targetUser = await findUser(cleanTarget);
    if (!targetUser) {
      return NextResponse.json(
        { error: `Tài khoản '${cleanTarget}' không tồn tại hoặc đã bị xóa.` },
        { status: 404 }
      );
    }

    // 4. Delete user
    await deleteUser(cleanTarget);

    return NextResponse.json({
      success: true,
      message: `Đã xóa tài khoản '${cleanTarget}' thành công.`,
    });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi xóa tài khoản.' },
      { status: 500 }
    );
  }
}
