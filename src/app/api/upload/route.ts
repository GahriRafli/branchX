import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { parseExcel, parseCSV, parsePDF } from '@/lib/fileParser';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    let tasks;

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      tasks = parseExcel(buffer);
    } else if (fileName.endsWith('.csv')) {
      const text = buffer.toString('utf-8');
      tasks = parseCSV(text);
    } else if (fileName.endsWith('.pdf')) {
      tasks = await parsePDF(buffer);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload .xlsx, .csv, or .pdf files.' },
        { status: 400 }
      );
    }

    // Bulk create tasks in DB
    const created = await prisma.$transaction(
      tasks.map((t) =>
        prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: t.status,
            sourceFile: file.name,
          },
        })
      )
    );

    return NextResponse.json({
      message: `Successfully created ${created.length} tasks from ${file.name}`,
      count: created.length,
      tasks: created,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    );
  }
}
