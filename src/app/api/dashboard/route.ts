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

    const [totalTasks, todoCount, inProgressCount, blockerCount, doneCount, totalUsers] =
      await Promise.all([
        prisma.task.count({ where: baseWhere }),
        prisma.task.count({ where: { ...baseWhere, status: 'TODO' } }),
        prisma.task.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
        prisma.task.count({ where: { ...baseWhere, status: 'BLOCKER' } }),
        prisma.task.count({ where: { ...baseWhere, status: 'DONE' } }),
        prisma.user.count(),
      ]);

    const unassignedCount = isUser ? 0 : await prisma.task.count({ where: { assigneeId: null } });

    return NextResponse.json({
      stats: {
        totalTasks,
        todoCount,
        inProgressCount,
        blockerCount,
        doneCount,
        totalUsers,
        unassignedCount,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
