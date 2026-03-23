import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { name, nip, password, role } = await request.json();

    if (!name || !nip || !password) {
      return NextResponse.json(
        { error: 'Name, NIP, and password are required' },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(nip)) {
      return NextResponse.json(
        { error: 'NIP must contain only numbers' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { nip } as any });

    if (existing) {
      return NextResponse.json(
        { error: 'User with this NIP already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        nip,
        password: hashedPassword,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
      } as any,
    });

    const token = await createToken({
      userId: user.id,
      nip: (user as any).nip,
      role: user.role,
      name: user.name,
      sessionId: '', // Simple login
      can_access_monitoring: (user as any).can_access_monitoring || false,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        nip: (user as any).nip,
        role: user.role,
      },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Register error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}