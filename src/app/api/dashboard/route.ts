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

    // Base filter for regular users: tasks assigned to them
    const baseWhere = isUser ? { assigneeId: userId } : {};
    const baseLeadWhere = isUser ? { owner_user_id: userId } : {};

    const [
      totalTasks, openTasks, inProgressTasks, doneTasks,
      totalLeads, wonLeads, totalUsers,
      leadsList,
      usersList
    ] = await Promise.all([
      prisma.task.count({ where: baseWhere }),
      prisma.task.count({ where: { ...baseWhere, status: 'OPEN' } }),
      prisma.task.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...baseWhere, status: 'DONE' } }),
      
      prisma.lead.count({ where: baseLeadWhere }),
      prisma.lead.count({ where: { ...baseLeadWhere, status: 'WON' } }),
      prisma.user.count(),

      prisma.lead.findMany({ 
         where: baseLeadWhere, 
         select: { status: true, last_activity_at: true, createdAt: true, potential_amount: true, owner_user_id: true } 
      }),
      prisma.user.findMany({ select: { id: true, name: true } })
    ]);

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
        leaderboard
      },
    });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
