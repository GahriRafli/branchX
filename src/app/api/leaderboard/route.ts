import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activityType = searchParams.get('type') || 'GMM'; // GMM, KSM, KPR, CC
    
    const now = new Date();
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : now.getMonth();
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : now.getFullYear();

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Define successful statuses based on activity type
    // Any status included in this list counts as a "win" for the leaderboard
    const successfulStatuses = [
      'VERIFIED', 
      'NEW CIF', 
      'ETB', 
      'Pengajuan Cair', 
      'Maintain Nasabah', 
      'Pengajuan Disetujui',
      'Sudah Akad'
    ];

    // 1. Fetch all users (non-admins) to ensure everyone shows up
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      select: { id: true, name: true, nip: true }
    });

    // 2. Fetch successful activities with KTP
    const activities = await (prisma as any).monitoringActivity.findMany({
      where: {
        activityType: activityType,
        status: { in: successfulStatuses },
        ktp: { not: "" },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        codeReferral: true,
        userId: true,
      }
    });

    // 3. Map activities to users
    const activityCounts: Record<string, number> = {};
    activities.forEach((act: any) => {
      if (act.userId) {
        activityCounts[act.userId] = (activityCounts[act.userId] || 0) + 1;
      }
    });

    // 4. Build leaderboard with only active winners (count > 0)
    const leaderboard = users.map(u => ({
      name: u.name,
      codeReferral: u.nip, 
      count: activityCounts[u.id] || 0
    }))
    .filter(entry => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

    return NextResponse.json({ leaderboard });
  } catch (err: any) {
    console.error('Leaderboard API Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
