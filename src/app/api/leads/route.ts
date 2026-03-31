import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { sendWhatsAppNotification } from '@/lib/whatsapp';

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
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }]
        } : false
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
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
    const { id, status, priority, owner_user_id, support_needed, keterangan } = body;

    if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 });

    const existingLead = await prisma.lead.findUnique({ where: { id } });
    if (!existingLead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // Users can only update their own leads, Admin can update anything
    if (session.role !== 'ADMIN' && existingLead.owner_user_id !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // [REMOVED] Auto-delete lead + tasks if status is CANCELLED or KICK
    // as per user request to keep "Keterangan" reasons.

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
    if (keterangan !== undefined) updateData.keterangan = keterangan;

    // Only Admin can reassign
    if (session.role === 'ADMIN' && owner_user_id !== undefined) {
      updateData.owner_user_id = owner_user_id === 'unassigned' ? null : owner_user_id;
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: { owner: { select: { name: true } } }
    });

    if (owner_user_id && lead.owner_user_id === owner_user_id && owner_user_id !== session.userId) {
      const owner = await (prisma as any).user.findUnique({ where: { id: owner_user_id }, select: { name: true, whatsapp: true } });
      if (owner?.whatsapp) {
        const leadCategory = lead.lead_category ? ` (Kategori: ${lead.lead_category})` : '';
        const message = `Halo ${owner.name}, Anda telah di-assign sebagai pemilik data Lead baru: ${lead.lead_name}${leadCategory}. Silakan cek pada website TheLeads.\nhttps://branch-x.vercel.app/`;
        await sendWhatsAppNotification(owner.whatsapp, message);
      }
    }

    return NextResponse.json({ lead });
  } catch (err: any) {
    console.error('PATCH Lead error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
