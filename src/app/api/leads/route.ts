import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET all leads
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const ownerId = searchParams.get('ownerId');
    const includeTasks = searchParams.get('includeTasks') === 'true';

    // Build the query
    const where: any = {};
    if (status) where.status = status;
    
    // Normal users see leads they own OR leads with tasks assigned to them. Admin sees all.
    if (session.role !== 'ADMIN') {
      where.OR = [
        { owner_user_id: session.userId },
        { tasks: { some: { assigneeId: session.userId } } }
      ];
    } else if (ownerId) {
      where.owner_user_id = ownerId === 'unassigned' ? null : ownerId;
    }

    const leads = await prisma.lead.findMany({
      where,
      include: { 
        owner: { select: { id: true, name: true } },
        tasks: includeTasks ? {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' }
        } : false
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ leads });
  } catch (err: any) {
    console.error('GET Leads error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// PATCH update lead
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, status, priority, owner_user_id, support_needed } = body;

    if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 });

    const existingLead = await prisma.lead.findUnique({ where: { id } });
    if (!existingLead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // Users can only update their own leads, Admin can update anything
    if (session.role !== 'ADMIN' && existingLead.owner_user_id !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: any = { last_activity_at: new Date() };
    if (status) {
      updateData.status = status;
      // Auto-cancel tasks if WON/LOST
      if (status === 'WON' || status === 'LOST') {
         await prisma.task.updateMany({
            where: { leadId: id, status: { notIn: ['COMPLETED', 'CANCELLED', 'DONE'] } },
            data: { status: 'CANCELLED' }
         });
      }
    }
    if (priority) updateData.priority = priority;
    if (support_needed !== undefined) updateData.support_needed = support_needed;
    
    // Only Admin can reassign
    if (session.role === 'ADMIN' && owner_user_id !== undefined) {
      updateData.owner_user_id = owner_user_id === 'unassigned' ? null : owner_user_id;
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: { owner: { select: { name: true } } }
    });

    return NextResponse.json({ lead });
  } catch (err: any) {
    console.error('PATCH Lead error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
