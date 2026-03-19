import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';

export interface ParsedTask {
  title: string;
  description: string;
  priority: string;
  status: string;
}

export function parseExcel(buffer: Buffer): ParsedTask[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any>(sheet);
  
  console.log(`Parsing Excel: ${rows.length} rows found in sheet ${sheetName}`);

  if (rows.length === 0) return [];

  return rows.map((row: any, index: number) => {
    const keys = Object.keys(row);
    // Try to find columns by name, otherwise use index
    const title = row['title'] || row['Title'] || row['Name'] || row['name'] || row[keys[0]] || `Task ${index + 1}`;
    const description = row['description'] || row['Description'] || keys.map(k => `${k}: ${row[k]}`).join(' | ');
    const priority = normalizePriority(row['priority'] || row['Priority'] || 'MEDIUM');

    return {
      title: String(title),
      description: String(description),
      priority,
      status: 'TODO',
    };
  });
}

export function parseCSV(text: string): ParsedTask[] {
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return records.map((row) => {
    const keys = Object.keys(row);
    return {
      title: row[keys[0]] || 'Untitled Task',
      description: keys.slice(1).map((k) => `${k}: ${row[k]}`).join(' | '),
      priority: normalizePriority(row['priority'] || row['Priority'] || 'MEDIUM'),
      status: 'TODO',
    };
  });
}

export async function parsePDF(buffer: Buffer): Promise<ParsedTask[]> {
  // Dynamic import for pdf-parse to avoid SSR issues
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  const text = data.text;

  // Split PDF text into logical sections/lines and create tasks
  const lines = text
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 5);

  if (lines.length === 0) {
    return [
      {
        title: 'PDF Document Review',
        description: text.substring(0, 500),
        priority: 'MEDIUM',
        status: 'TODO',
      },
    ];
  }

  return lines.slice(0, 50).map((line: string, index: number) => ({
    title: line.substring(0, 100),
    description: line.length > 100 ? line : `Task ${index + 1} from PDF`,
    priority: 'MEDIUM',
    status: 'TODO',
  }));
}

function normalizePriority(value: string): string {
  const upper = value.toUpperCase();
  if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(upper)) return upper;
  return 'MEDIUM';
}
