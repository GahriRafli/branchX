import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const notifications = await (prisma as any).notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return NextResponse.json({ notifications });
  } catch (err: any) {
    console.error('GET Notifications error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    if (body.markAllAsRead) {
      await (prisma as any).notification.updateMany({
        where: { userId: session.userId, isRead: false },
        data: { isRead: true }
      });
      return NextResponse.json({ success: true });
    }

    const { id, isRead } = body;

    const notification = await (prisma as any).notification.update({
      where: { id, userId: session.userId },
      data: { isRead: !!isRead }
    });

    return NextResponse.json({ notification });
  } catch (err: any) {
    console.error('PATCH Notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
