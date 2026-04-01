import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const activityType = searchParams.get('type') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const where: any = {};
    if (!canAccessAll) {
      where.userId = session.userId;
    }
    if (activityType) {
      where.activityType = activityType;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const data = await (prisma as any).monitoringActivity.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }
      ],
    });

    // Automatic Transitions Logic (1 day)
    const now = new Date();
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const updatedData = await Promise.all(data.map(async (item: any) => {
      let currentStatus = item.status;
      const timeSinceUpdate = now.getTime() - new Date(item.updatedAt).getTime();

      if (timeSinceUpdate > oneDayInMs) {
        if (currentStatus === 'Pengajuan Sudah (Custom / Tidak Respond)') {
          currentStatus = 'TAKEOUT';
        } else if (currentStatus === 'Dalam Proses Pengajuan (Perlu Ralat / Sendback)') {
          currentStatus = 'Dalam Proses Pengajuan (Ditolak)';
        } else if (currentStatus === 'Pengajuan Cair') {
          currentStatus = 'Maintain Nasabah';
        }

        if (currentStatus !== item.status) {
          await (prisma as any).monitoringActivity.update({
            where: { id: item.id },
            data: { status: currentStatus }
          });
          return { ...item, status: currentStatus };
        }
      }
      return item;
    }));

    return NextResponse.json({ data: updatedData });
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
    const { 
      name, 
      codeReferral, 
      noAccount, 
      product, 
      amount, 
      target, 
      total, 
      activityType, 
      branchCode,
      ktp
    } = body;

    const type = activityType || 'GMM';
    const isGMM = type === 'GMM';
    const status = isGMM ? 'PENDING' : 'Belum ada Pengajuan';
    
    // Logic for KTP and Tabungan Simpel
    let finalProduct = String(product || '');
    if (isGMM && (!ktp || String(ktp).trim() === "")) {
      finalProduct = "Tabungan Simpel";
    }
    
    const inputAmount = parseFloat(String(amount)) || 1;
    const inputTarget = parseFloat(String(target)) || 1;
    const inputTotal = parseFloat(String(total)) || 1;
    const activityDate = body.createdAt ? new Date(body.createdAt) : undefined;

    // Helper to parse bulk strings/arrays
    const parseBulk = (val: any) => {
      if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
      if (typeof val === 'string' && (val.includes('\n') || val.includes(','))) {
        return val.split(/[\n,]+/).map(v => v.trim()).filter(Boolean);
      }
      return val ? [String(val).trim()] : [];
    };

    const accountValues = parseBulk(noAccount);
    const ktpValues = parseBulk(ktp);
    
    const count = Math.max(accountValues.length, ktpValues.length);

    if (count > 1) {
      const dataToCreate = [];
      for (let i = 0; i < count; i++) {
        const currentAcc = accountValues[i] || accountValues[0] || "";
        const currentKtp = ktpValues[i] || ktpValues[0] || "";
        
        // Determine product for GMM
        let p = finalProduct;
        if (isGMM && (!currentKtp || currentKtp.trim() === "")) {
          p = "Tabungan Simpel";
        }

        dataToCreate.push({
          activityType: type,
          name: String(name || 'Unknown'),
          codeReferral: String(codeReferral || ''),
          noAccount: currentAcc,
          product: p,
          ktp: currentKtp,
          amount: inputAmount,
          target: inputTarget,
          total: inputTotal,
          branchCode: String(branchCode || ''),
          userId: session.userId,
          status,
          ...(activityDate && { createdAt: activityDate })
        });
      }

      const entries = await (prisma as any).monitoringActivity.createMany({
        data: dataToCreate
      });

      if (type === 'GMM') {
        const admins = await (prisma as any).user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        if (admins.length > 0) {
          await (prisma as any).notification.createMany({
            data: admins.map((admin: any) => ({
              userId: admin.id,
              type: 'GMM_ENTRY',
              message: `${name} has submitted ${count} bulk GMM entries`,
              isRead: false
            }))
          });
        }
      }

      return NextResponse.json({ count: entries.count }, { status: 201 });
    }

    const singleAcc = accountValues[0] || "";
    const singleKtp = ktpValues[0] || "";
    let p = finalProduct;
    if (isGMM && (!singleKtp || singleKtp.trim() === "")) {
      p = "Tabungan Simpel";
    }

    const entry = await (prisma as any).monitoringActivity.create({
      data: { 
        activityType: type,
        name: String(name || 'Unknown'), 
        codeReferral: String(codeReferral || ''), 
        noAccount: singleAcc,
        product: p, 
        ktp: singleKtp,
        amount: inputAmount, 
        target: inputTarget, 
        total: inputTotal,
        branchCode: String(branchCode || ''),
        userId: session.userId,
        status,
        ...(activityDate && { createdAt: activityDate })
      },
    });

    // Create notifications for admins only for GMM entries
    if (type === 'GMM') {
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
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err: any) {
    console.error('POST Monitoring error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const { id, ids, ...updateData } = await request.json();
    
    // Bulk update support
    if (ids && Array.isArray(ids) && updateData.status) {
      if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      
      const count = await (prisma as any).monitoringActivity.updateMany({
        where: { id: { in: ids } },
        data: { status: updateData.status }
      });
      return NextResponse.json({ count: count.count });
    }

    // Single update logic
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Check ownership if not admin
    if (!isAdmin) {
      const existing = await (prisma as any).monitoringActivity.findUnique({ where: { id } });
      if (!existing || existing.userId !== session.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // If regular user, prevent manual status change
      delete updateData.status;
    }

    // Only allow status changes if admin (except for GMM pending logic which is already restricted)
    if (updateData.status && !isAdmin) {
      delete updateData.status;
    }

    // GMM specific manual validation logic remains for admin
    if (updateData.status && (updateData.status === 'VERIFIED' || updateData.status === 'REJECTED')) {
      const existing = await (prisma as any).monitoringActivity.findUnique({ where: { id } });
      if (existing && existing.activityType !== 'GMM') {
        // Non-GMM entries cannot be manually verified/rejected via the GMM flow
        // but they can have their status updated if it's a valid status from the new flow
      }
    }

    if (updateData.amount) updateData.amount = Number(updateData.amount);
    if (updateData.target) updateData.target = Number(updateData.target);
    if (updateData.total) updateData.total = Number(updateData.total);

    if (updateData.activityType === 'GMM' && (!updateData.ktp || String(updateData.ktp).trim() === "")) {
      updateData.product = "Tabungan Simpel";
    }

    if (updateData.createdAt) {
      updateData.createdAt = new Date(updateData.createdAt);
    }

    const entry = await (prisma as any).monitoringActivity.update({
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
    
    // Bulk delete support
    const body = await request.json().catch(() => ({}));
    const { ids } = body;

    if (ids && Array.isArray(ids)) {
      const count = await (prisma as any).monitoringActivity.deleteMany({
        where: { id: { in: ids } }
      });
      return NextResponse.json({ count: count.count });
    }

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await (prisma as any).monitoringActivity.delete({ where: { id } });

    return NextResponse.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error('DELETE Monitoring error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
