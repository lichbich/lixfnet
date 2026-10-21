import { NextRequest, NextResponse } from 'next/server';
import { findUser, saveUser } from '@/lib/firebaseAdmin';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập tên đăng nhập và mật khẩu' },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();

    // Auto-seed default admin if database is fresh and matching credentials
    let user = await findUser(cleanUsername);
    if (!user && cleanUsername === 'tronglich') {
      const defaultHash = await bcrypt.hash('389363', 10);
      await saveUser({
        username: 'tronglich',
        passwordHash: defaultHash,
        role: 'admin',
        displayName: 'Trọng Lịch',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
      });
      user = await findUser('tronglich');
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Tài khoản không tồn tại. Vui lòng liên hệ quản trị viên để được cấp tài khoản.' },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      // Fallback check in case password was stored in plain text during legacy setup
      if (user.passwordHash === password) {
        // upgrade to bcrypt
        const upgradedHash = await bcrypt.hash(password, 10);
        await saveUser({ ...user, passwordHash: upgradedHash });
      } else {
        return NextResponse.json(
          { error: 'Mật khẩu không chính xác' },
          { status: 401 }
        );
      }
    }

    const safeUser = {
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role || 'member',
    };

    const response = NextResponse.json({
      success: true,
      user: safeUser,
    });

    // Set authentication session cookie (valid for 30 days)
    response.cookies.set('lixfnet_session', JSON.stringify(safeUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi hệ thống khi đăng nhập' },
      { status: 500 }
    );
  }
}
