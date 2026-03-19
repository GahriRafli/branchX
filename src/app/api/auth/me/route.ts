import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({
      user: {
        id: session.userId,
        name: session.name,
        nip: session.nip,
        role: session.role,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
