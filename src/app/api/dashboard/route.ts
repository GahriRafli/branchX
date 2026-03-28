import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET dashboard stats (admin only)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role, userId } = session;
    const isUser = role !== 'ADMIN';

    // Base filter for regular users
    const baseLeadWhere = isUser ? { owner_user_id: userId } : {};

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    const [
      totalTasks, openTasks, inProgressTasks, doneTasks
    ] = await Promise.all([
      prisma.task.count({ where: isUser ? { assigneeId: userId } : {} }),
      prisma.task.count({ where: { ...(isUser ? { assigneeId: userId } : {}), status: 'OPEN' } }),
      prisma.task.count({ where: { ...(isUser ? { assigneeId: userId } : {}), status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...(isUser ? { assigneeId: userId } : {}), status: 'DONE' } }),
    ]);

    const [
      totalLeads, wonLeads, totalUsers
    ] = await Promise.all([
      prisma.lead.count({ where: baseLeadWhere }),
      prisma.lead.count({ where: { ...baseLeadWhere, status: 'WON' } }),
      prisma.user.count(),
    ]);

    const leadsList = await prisma.lead.findMany({ 
       where: baseLeadWhere, 
       select: { status: true, last_activity_at: true, createdAt: true, potential_amount: true, owner_user_id: true } 
    });

    const usersList = await prisma.user.findMany({ select: { id: true, name: true } });

    // Fetch all relevant activities for the month to sum in-memory (prevents Prisma aggregate P1001 bug with DateTime)
    const allActivities = await prisma.monitoringActivity.findMany({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
        select: { activityType: true, amount: true, status: true }
    });

    const gmmArr = allActivities.filter(a => a.activityType === 'GMM' && ['NEW CIF', 'NTB'].includes(a.status));
    const ksmArr = allActivities.filter(a => a.activityType === 'KSM' && ['Pengajuan Cair', 'Maintain Nasabah'].includes(a.status));
    const kprArr = allActivities.filter(a => a.activityType === 'KPR' && ['Pengajuan Cair', 'Maintain Nasabah'].includes(a.status));
    const ccArr = allActivities.filter(a => a.activityType === 'CC' && ['Pengajuan Cair', 'Maintain Nasabah'].includes(a.status));

    const activityStats = {
      GMM: { count: gmmArr.length, amount: gmmArr.reduce((sum: number, a: any) => sum + (a.amount || 0), 0) },
      KSM: { count: ksmArr.length, amount: ksmArr.reduce((sum: number, a: any) => sum + (a.amount || 0), 0) },
      KPR: { count: kprArr.length, amount: kprArr.reduce((sum: number, a: any) => sum + (a.amount || 0), 0) },
      CC: { count: ccArr.length, amount: ccArr.reduce((sum: number, a: any) => sum + (a.amount || 0), 0) },
      totalCount: allActivities.length,
      totalAmount: allActivities.reduce((sum: number, a: any) => sum + (a.amount || 0), 0)
    };
    activityStats.totalCount = activityStats.GMM.count + activityStats.KSM.count + activityStats.KPR.count + activityStats.CC.count;
    activityStats.totalAmount = activityStats.GMM.amount + activityStats.KSM.amount + activityStats.KPR.amount + activityStats.CC.amount;

    let fresh = 0;
    let warning = 0;
    let critical = 0;
    let pipelineAmount = 0;
    let wonAmount = 0;
    const now = Date.now();

    const leaderboardMap: Record<string, { id: string, name: string, wonCount: number, pipelineAmount: number }> = {};
    for (const u of usersList) leaderboardMap[u.id] = { id: u.id, name: u.name, wonCount: 0, pipelineAmount: 0 };

    for (const l of leadsList) {
       if (l.status !== 'WON' && l.status !== 'LOST') {
          pipelineAmount += (l.potential_amount || 0);
          const refDate = l.last_activity_at ? new Date(l.last_activity_at).getTime() : new Date(l.createdAt).getTime();
          const days = (now - refDate) / (1000 * 3600 * 24);
          if (days <= 3) fresh++;
          else if (days <= 7) warning++;
          else critical++;
       } else if (l.status === 'WON') {
          wonAmount += (l.potential_amount || 0);
       }

       if (l.owner_user_id && leaderboardMap[l.owner_user_id]) {
          if (l.status === 'WON') leaderboardMap[l.owner_user_id].wonCount++;
          if (l.status !== 'LOST' && l.status !== 'WON') leaderboardMap[l.owner_user_id].pipelineAmount += (l.potential_amount || 0);
       }
    }

    const leaderboard = Object.values(leaderboardMap)
       .filter(u => u.wonCount > 0 || u.pipelineAmount > 0)
       .sort((a,b) => b.wonCount - a.wonCount)
       .slice(0, 5);

    return NextResponse.json({
      stats: {
        totalTasks, openTasks, inProgressTasks, doneTasks,
        totalLeads, wonLeads, totalUsers,
        pipelineAmount, wonAmount,
        aging: { fresh, warning, critical },
        leaderboard,
        activityStats
      },
    });
  } catch(e: any) {
    console.error('Dashboard API Error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
