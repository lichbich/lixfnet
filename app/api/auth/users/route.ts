import { NextRequest, NextResponse } from 'next/server';
import { listUsers, findUser } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('lixfnet_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Cần đăng nhập để xem danh sách tài khoản.' },
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

    // Verify caller in database to guarantee authentic role
    const caller = await findUser(sessionUser.username);
    const callerRole = caller?.role || sessionUser.role || 'member';
    const callerUsername = (caller?.username || sessionUser.username || '').toLowerCase();

    const allUsers = await listUsers();

    // If Admin: view all accounts
    // If Member: ONLY view accounts that they created (createdBy === callerUsername)
    let visibleUsers = allUsers;
    if (callerRole !== 'admin') {
      visibleUsers = allUsers.filter(
        (u) => (u.createdBy || '').toLowerCase() === callerUsername
      );
    }

    return NextResponse.json({
      users: visibleUsers,
      callerRole,
    });
  } catch (error: any) {
    console.error('List users error:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi khi tải danh sách tài khoản.' },
      { status: 500 }
    );
  }
}
