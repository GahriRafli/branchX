import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';

export interface ParsedTask {
  title: string;
  description: string;
  priority: string;
  status: string;
}

type RowValue = string | number | boolean | null | undefined;
type RowRecord = Record<string, RowValue>;

type PdfParseResult = {
  text: string;
};

type PdfParseFn = (buffer: Buffer) => Promise<PdfParseResult>;

export function parseExcel(buffer: Buffer): ParsedTask[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RowRecord>(sheet);

  console.log(`Parsing Excel: ${rows.length} rows found in sheet ${sheetName}`);

  if (rows.length === 0) return [];

  return rows.map((row, index) => {
    const keys = Object.keys(row);

    const title =
      row.title ??
      row.Title ??
      row.Name ??
      row.name ??
      (keys[0] ? row[keys[0]] : undefined) ??
      `Task ${index + 1}`;

    const description =
      row.description ??
      row.Description ??
      keys.map((k) => `${k}: ${String(row[k] ?? '')}`).join(' | ');

    const priority = normalizePriority(
      String(row.priority ?? row.Priority ?? 'MEDIUM')
    );

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
      priority: normalizePriority(row.priority || row.Priority || 'MEDIUM'),
      status: 'TODO',
    };
  });
}

export async function parsePDF(buffer: Buffer): Promise<ParsedTask[]> {
  const pdfModule = await import('pdf-parse');
  const pdfParse = getPdfParse(pdfModule);

  const data = await pdfParse(buffer);
  const text = data.text ?? '';

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 5);

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

  return lines.slice(0, 50).map((line, index) => ({
    title: line.substring(0, 100),
    description: line.length > 100 ? line : `Task ${index + 1} from PDF`,
    priority: 'MEDIUM',
    status: 'TODO',
  }));
}

function getPdfParse(module: unknown): PdfParseFn {
  if (typeof module === 'function') {
    return module as PdfParseFn;
  }

  if (
    typeof module === 'object' &&
    module !== null &&
    'default' in module &&
    typeof (module as { default?: unknown }).default === 'function'
  ) {
    return (module as { default: PdfParseFn }).default;
  }

  throw new Error('Failed to load pdf-parse module.');
}

function normalizePriority(value: string): string {
  const upper = value.toUpperCase();
  if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(upper)) return upper;
  return 'MEDIUM';
}
