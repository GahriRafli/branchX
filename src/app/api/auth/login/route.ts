import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { nip, password } = await request.json();

    if (!nip || !password) {
      return NextResponse.json(
        { error: 'NIP and password are required' },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(nip)) {
      return NextResponse.json({ error: 'NIP must contain only numbers' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { nip } as any });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, (user as any).password);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = await createToken({
      userId: user.id,
      nip: (user as any).nip,
      role: user.role,
      name: user.name,
      sessionId: '', // Simple login
      can_access_monitoring: (user as any).can_access_monitoring || user.role === 'ADMIN',
    });

    const userResp = {
      id: user.id,
      name: user.name,
      nip: (user as any).nip,
      role: user.role,
      can_access_monitoring: (user as any).can_access_monitoring || user.role === 'ADMIN',
    };

    const response = NextResponse.json({
      user: userResp,
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
