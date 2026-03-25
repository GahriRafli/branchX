import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET - Look up the customer/lead name for a given task ID
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    if (!taskId) return NextResponse.json({ customerName: '' });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { leadId: true } as any,
    });

    if (!task || !(task as any).leadId) {
      return NextResponse.json({ customerName: '' });
    }

    const lead = await (prisma as any).lead.findUnique({
      where: { id: (task as any).leadId },
      select: { lead_name: true },
    });

    return NextResponse.json({ customerName: lead?.lead_name || '' });
  } catch (err: any) {
    console.error('GET lead-name error:', err);
    return NextResponse.json({ customerName: '' });
  }
}
