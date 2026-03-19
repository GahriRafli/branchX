import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.sessionId) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Verify session ID in DB
    const user = await prisma.user.findUnique({
      where: { id: session.userId }
    });

    if (!user || (user as any).currentSessionId !== session.sessionId) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        nip: (user as any).nip,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
