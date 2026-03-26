import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET all tasks (admin sees all, user sees only assigned)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const where = session.role === 'ADMIN' ? {} : { assigneeId: session.userId };

    const tasks = await prisma.task.findMany({
      where,
      include: { assignee: { select: { id: true, name: true, nip: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    return NextResponse.json({ tasks });
  } catch (err: any) {
    console.error('GET Tasks error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// POST create a task (admin only)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title, description, priority, status, assigneeId, leadId } = await request.json();

    const task = await prisma.task.create({
      data: {
        title,
        description: description || '',
        priority: priority || 'MEDIUM',
        status: status || 'OPEN',
        assigneeId: assigneeId || null,
        leadId: leadId || null,
      },
      include: { assignee: { select: { id: true, name: true, nip: true } } },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err: any) {
    console.error('POST Task error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// PATCH update task(s) - bulk or single
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status, assigneeId, title, description, priority } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    // Standard users can only update status
    const updateData: Record<string, string | null> = {};
    if (status) updateData.status = status;

    if (session.role === 'ADMIN') {
      if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
      if (title) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (priority) updateData.priority = priority;
    }

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: { assignee: { select: { name: true } } }
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Auto-delete task if status is CANCELLED
    if (status === 'CANCELLED') {
      await prisma.task.delete({ where: { id } });
      return NextResponse.json({ deleted: true, message: 'Task telah dihapus karena status CANCELLED' });
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { assignee: { select: { id: true, name: true, nip: true } } },
    });

    if (task.leadId && status) {
       const leadUpdateData: any = { last_activity_at: new Date() };
       
       if (status === 'IN_PROGRESS' || status === 'COMPLETED' || status === 'DONE') {
          const parentLead = await prisma.lead.findUnique({ where: { id: task.leadId } });
          if (parentLead && (parentLead.status === 'NEW' || parentLead.status === 'READY_TO_FOLLOW_UP')) {
             leadUpdateData.status = 'CONTACTED';
          }
       }
       await prisma.lead.update({
          where: { id: task.leadId },
          data: leadUpdateData
       });
    }

    if (status === 'DONE' && existingTask.status !== 'DONE') {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
      const assigneeName = existingTask.assignee?.name || 'Seorang user';
      // Look up customer/lead name for the notification
      let customerName = '';
      if ((task as any).leadId) {
        try {
          const parentLead = await (prisma as any).lead.findUnique({ where: { id: (task as any).leadId }, select: { lead_name: true } });
          if (parentLead?.lead_name) customerName = parentLead.lead_name;
        } catch { /* ignore */ }
      }
      const message = customerName
        ? `${assigneeName} menyelesaikan task untuk ${customerName}: ${existingTask.title}`
        : `${assigneeName} merubah status task menjadi DONE: ${existingTask.title}`;
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((admin: any) => ({
            userId: admin.id,
            type: 'TASK_DONE',
            message,
            referenceId: task.id,
            isRead: false
          }))
        });
      }
    }

    return NextResponse.json({ task });
  } catch (err: any) {
    console.error('PATCH Task error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE a task (admin only)
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ message: 'Task deleted' });
  } catch (err: any) {
    console.error('DELETE Task error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
