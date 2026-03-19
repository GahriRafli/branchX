import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { parseExcel, parseCSV } from '@/lib/fileParser';

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
      return NextResponse.json(
        { error: 'PDF upload is not supported yet. Please upload .xlsx, .xls, or .csv files.' },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload .xlsx, .xls, or .csv files.' },
        { status: 400 }
      );
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json(
        { error: 'No tasks could be parsed from the uploaded file.' },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(
      tasks.map((task) =>
        prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
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