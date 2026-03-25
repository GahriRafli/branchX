import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseLeadsExcel } from '@/lib/leadParser';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawLeads = parseLeadsExcel(buffer);

    if (rawLeads.length === 0) {
      return NextResponse.json({ error: 'No valid leads found in expected sheets. Please ensure sheets are named correctly and contain a "Nama" column.' }, { status: 400 });
    }

    // Load existing CIFs and Names from DB for duplicate detection
    const existingLeads = await prisma.lead.findMany({
      select: { cif: true, lead_name: true, branch: true, lead_type: true }
    });

    const cifKeys = new Set(existingLeads.filter(l => l.cif).map(l => `${l.cif}_${l.lead_type}`));
    const nameKeys = new Set(existingLeads.map(l => `${l.lead_name.toLowerCase()}_${l.branch?.toLowerCase() || ''}_${l.lead_type}`));

    // Load users to match PIC
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });

    let validCount = 0;
    let duplicateCount = 0;
    
    const previewData = rawLeads.map(lead => {
      // Duplicate detection
      let isDuplicate = false;
      if (lead.cif) {
         if (cifKeys.has(`${lead.cif}_${lead.lead_type}`)) isDuplicate = true;
      } else {
         if (nameKeys.has(`${lead.lead_name.toLowerCase()}_${lead.branch?.toLowerCase() || ''}_${lead.lead_type}`)) isDuplicate = true;
      }
      
      // PIC matching
      let matchedUserId = null;
      let matchedUserName = null;
      if (lead.pic_name) {
         const picLower = lead.pic_name.toLowerCase();
         const user = allUsers.find(u => u.name.toLowerCase().includes(picLower) || picLower.includes(u.name.toLowerCase()));
         if (user) {
           matchedUserId = user.id;
           matchedUserName = user.name;
         }
      }

      if (isDuplicate) duplicateCount++;
      else validCount++;

      return {
         ...lead,
         isDuplicate,
         matchedUserId,
         matchedUserName
      };
    });

    return NextResponse.json({
      summary: {
         totalFound: rawLeads.length,
         validCount,
         duplicateCount,
      },
      preview: previewData.slice(0, 50),
      allData: previewData 
    });

  } catch (err: any) {
    console.error('Preview error:', err);
    return NextResponse.json({ error: err.message || 'Failed to parse file' }, { status: 500 });
  }
}
