import { NextRequest, NextResponse } from 'next/server';
import { findUser, saveUser } from '@/lib/firebaseAdmin';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify user is logged in
    const sessionCookie = req.cookies.get('lixfnet_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Bạn cần đăng nhập vào hệ thống để có quyền cấp tài khoản mới.' },
        { status: 401 }
      );
    }

    let currentUser: any = null;
    try {
      currentUser = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json(
        { error: 'Phiên đăng nhập không hợp lệ.' },
        { status: 401 }
      );
    }

    // 2. Validate input
    const body = await req.json();
    const { username, password, displayName, role } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Vui lòng điền tên đăng nhập và mật khẩu.' },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();

    // Username format check (letters, numbers, underscore, 3-24 chars)
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: 'Tên đăng nhập chỉ được gồm chữ cái, số và dấu gạch dưới (3 - 24 ký tự).' },
        { status: 400 }
      );
    }

    if (String(password).length < 4) {
      return NextResponse.json(
        { error: 'Mật khẩu phải có tối thiểu 4 ký tự.' },
        { status: 400 }
      );
    }

    // 3. Check if user already exists
    const existing = await findUser(cleanUsername);
    if (existing) {
      return NextResponse.json(
        { error: `Tài khoản '${cleanUsername}' đã tồn tại trong hệ thống!` },
        { status: 409 }
      );
    }

    // 4. Determine role (Only existing admins can grant admin role)
    const callerInDb = await findUser(currentUser.username);
    const callerIsAdmin = callerInDb?.role === 'admin';
    const targetRole: 'admin' | 'member' = (callerIsAdmin && role === 'admin') ? 'admin' : 'member';

    // Hash password and save to Firebase lixfnet/users
    const passwordHash = await bcrypt.hash(String(password), 10);
    const newUserData = {
      username: cleanUsername,
      passwordHash,
      displayName: displayName ? String(displayName).trim() : cleanUsername,
      role: targetRole,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.username || 'admin',
    };

    await saveUser(newUserData);

    return NextResponse.json({
      success: true,
      message: `Đã cấp tài khoản '${cleanUsername}' thành công!`,
      user: {
        username: newUserData.username,
        displayName: newUserData.displayName,
        role: newUserData.role,
        createdAt: newUserData.createdAt,
        createdBy: newUserData.createdBy,
      },
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi tạo tài khoản trên Firebase' },
      { status: 500 }
    );
  }
}
