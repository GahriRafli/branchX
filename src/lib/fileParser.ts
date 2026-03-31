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

export function parseExcel(buffer: Buffer): ParsedTask[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RowRecord>(sheet);

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

function normalizePriority(value: string): string {
  const upper = value.toUpperCase();
  if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(upper)) return upper;
  return 'MEDIUM';
}
