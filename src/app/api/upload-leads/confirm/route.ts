import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { leads, filename } = await request.json();

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No valid leads to import' }, { status: 400 });
    }

    const validLeadsToInsert = leads.filter(l => !l.isDuplicate);

    if (validLeadsToInsert.length === 0) {
       return NextResponse.json({ message: 'No new leads to import (all selected were duplicates).' });
    }

    const batch = await prisma.uploadBatch.create({
      data: {
        filename: filename || 'import_leads.xlsx',
        uploader_id: session.userId,
        total_rows: leads.length,
        valid_rows: validLeadsToInsert.length,
        invalid_rows: leads.length - validLeadsToInsert.length,
      }
    });

    let createdCount = 0;
    await prisma.$transaction(async (tx) => {
       const mappedLeads = validLeadsToInsert.map(item => ({
           lead_name: item.lead_name,
           cif: item.cif,
           lead_type: item.lead_type,
           branch: item.branch,
           potential_amount: item.potential_amount || 0,
           owner_user_id: item.matchedUserId || null,
           status: item.status || 'READY_TO_FOLLOW_UP',
           lead_category: item.lead_category || null,
           area: item.area || null,
           area_name: item.area_name || null,
           branch_code: item.branch_code || null,
           three_p: item.three_p || 'Pebisnis',
           closing_amount: item.closing_amount || 0,
           keterangan: item.keterangan || null,
           source_upload_batch: batch.id,
           support_needed: item.support_needed || null
       }));

        await tx.lead.createMany({
            data: mappedLeads
        });

        // Retrieve created leads to generate tasks
        const createdLeads = await tx.lead.findMany({
            where: { source_upload_batch: batch.id },
            select: { id: true, owner_user_id: true }
        });

        const tasksToInsert = createdLeads.map((lead) => ({
            title: `Initial Follow Up`,
            description: `Tugas follow-up otomatis yang ter-generate dari upload data Lead.`,
            leadId: lead.id,
            status: 'OPEN',
            priority: 'MEDIUM',
            assigneeId: lead.owner_user_id || null,
            sourceFile: batch.filename
        }));

        await tx.task.createMany({
            data: tasksToInsert
        });
        
        createdCount = createdLeads.length;
    }, {
       maxWait: 15000,
       timeout: 60000 
    });

    return NextResponse.json({ 
       message: `Successfully imported ${createdCount} new Leads and automatically generated their follow-up Tasks!` 
    });

  } catch (err: any) {
    console.error('Confirm import error:', err);
    return NextResponse.json({ error: err.message || 'Failed to import leads' }, { status: 500 });
  }
}
