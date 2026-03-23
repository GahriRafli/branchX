import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await (prisma as any).user.findUnique({
      where: { id: session.userId },
      select: { role: true, can_access_monitoring: true }
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const canAccessAll = isAdmin || (user as any).can_access_monitoring;

    const where: any = {};
    if (!canAccessAll) {
      where.userId = session.userId;
    }

    const data = await (prisma as any).monitoringGMM.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('GET Monitoring error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await (prisma as any).user.findUnique({
      where: { id: session.userId },
      select: { role: true, can_access_monitoring: true }
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    console.log('Incoming GMM Request Body:', body);

    const { name, codeReferral, noAccount, product, amount, target, total } = body;

    // Use typed access now that generate is complete
    const entry = await (prisma as any).monitoringGMM.create({
      data: { 
        name: String(name || 'Unknown'), 
        codeReferral: String(codeReferral || ''), 
        noAccount: String(noAccount || ''),
        product: String(product || ''), 
        amount: parseFloat(String(amount)) || 0, 
        target: parseFloat(String(target)) || 0, 
        total: parseFloat(String(total)) || 0,
        userId: session.userId,
        status: 'PENDING'
      },
    });

    // Create notifications for all admins
    try {
      const admins = await (prisma as any).user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true }
      });

      if (admins.length > 0) {
        await (prisma as any).notification.createMany({
          data: admins.map((admin: any) => ({
            userId: admin.id,
            type: 'GMM_ENTRY',
            message: `${name} has submitted a new GMM entry for ${product}`,
            referenceId: entry.id,
            isRead: false
          }))
        });
      }
    } catch (notificationErr) {
      console.error('Failed to create notifications:', notificationErr);
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err: any) {
    console.error('POST Monitoring error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code,
      keys: Object.keys(prisma).filter(k => !k.startsWith('_'))
    });
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await (prisma as any).user.findUnique({
      where: { id: session.userId },
      select: { role: true, can_access_monitoring: true }
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const isAdmin = user.role === 'ADMIN';
    const canAccessAll = isAdmin || (user as any).can_access_monitoring;

    const { id, ...updateData } = await request.json();
    
    // Check ownership if not admin
    if (!isAdmin) {
      const existing = await (prisma as any).monitoringGMM.findUnique({ where: { id } });
      if (!existing || existing.userId !== session.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // If regular user, prevent manual status change
      delete updateData.status;
    }

    if (updateData.amount) updateData.amount = Number(updateData.amount);
    if (updateData.target) updateData.target = Number(updateData.target);
    if (updateData.total) updateData.total = Number(updateData.total);

    const entry = await (prisma as any).monitoringGMM.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ entry });
  } catch (err: any) {
    console.error('PATCH Monitoring error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await (prisma as any).user.findUnique({
      where: { id: session.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await (prisma as any).monitoringGMM.delete({ where: { id } });

    return NextResponse.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error('DELETE Monitoring error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
