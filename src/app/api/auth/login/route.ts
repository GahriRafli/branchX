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

    const user = await prisma.user.findUnique({ where: { nip } });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = await createToken({
      userId: user.id,
      nip: user.nip,
      role: user.role,
      name: user.name,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        nip: user.nip,
        role: user.role,
      },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
