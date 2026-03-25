import * as XLSX from 'xlsx';

export interface ParsedLead {
  lead_name: string;
  cif: string | null;
  lead_type: 'INTENSIFICATION' | 'EXTENSIFICATION' | 'BOTTOM_UP';
  branch: string | null;
  potential_amount: number;
  pic_name: string | null;
  status: string;
  lead_category: string | null;
  area: string | null;
  area_name: string | null;
  branch_code: string | null;
  three_p: string | null;
  closing_amount: number;
  keterangan: string | null;
  support_needed: string | null;
}

export function parseLeadsExcel(buffer: Buffer): ParsedLead[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const results: ParsedLead[] = [];

  const typeConfig: Record<string, 'INTENSIFICATION' | 'EXTENSIFICATION' | 'BOTTOM_UP'> = {
    'Potensi Intensifikasi': 'INTENSIFICATION',
    'Potensi Ekstensifikasi': 'EXTENSIFICATION',
    'Akuisisi BottomUp': 'BOTTOM_UP'
  };

  for (const [sheetName, leadType] of Object.entries(typeConfig)) {
    if (!workbook.Sheets[sheetName]) continue;

    // Excel: Row 1 is title, Row 2 is column headers, Row 3+ is data
    // range:1 means skip 1 row (the title), use row 2 as headers
    const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheetName], { range: 1, defval: null });
    
    // Debug: log first row keys to help diagnose column name issues
    if (rows.length > 0) {
      console.log(`[LeadParser] Sheet "${sheetName}" columns:`, Object.keys(rows[0]));
      console.log(`[LeadParser] Sample row 0:`, JSON.stringify(rows[0]).substring(0, 500));
    }
    
    for (const rawRow of rows) {
      // Normalize all keys: trim whitespace, collapse newlines to spaces
      const row: Record<string, any> = {};
      for (const [key, val] of Object.entries(rawRow)) {
        row[key.trim().replace(/\n/g, ' ')] = val;
      }

      const name = cleanString(row['Nama'] || row['Nama Lead']);
      if (!name || name.toLowerCase() === 'nama' || name.toLowerCase() === 'name') continue;

      const cifRaw = row['CIF'] || row['No. CIF'];
      const cif = cifRaw ? String(cifRaw).trim() : null;

      // Precise column matching for potential amount - try exact names first
      const nominalRaw = row['Potensi Nominal'] ?? row['Potensi Nominal '] ?? row['Target/Potensi'] ?? row['Nominal'] ?? row['Jumlah'] ?? 0;
      
      let potential_amount = 0;
      if (typeof nominalRaw === 'number') {
        // Excel stored it as a real number - use directly
        potential_amount = nominalRaw;
      } else if (nominalRaw) {
        // It's a string - strip Rp prefix and thousands separators
        const cleaned = String(nominalRaw)
          .replace(/[Rr][Pp]\.?\s*/g, '')  // Remove "Rp" prefix 
          .replace(/\./g, '')               // Remove dots (thousands sep in ID format)
          .replace(/,/g, '.')               // Convert comma to decimal
          .trim();
        potential_amount = parseFloat(cleaned) || 0;
      }

      const branch = cleanString(row['Nama Cabang'] || row['Cabang']);
      const branch_code = cleanString(row['Cabang']) || null;
      const area = cleanString(row['Area']) || null;
      const area_name = cleanString(row['Nama Area']) || null;
      const three_p = cleanString(row['3P']) || 'Pebisnis';

      const pic = cleanString(row['PIC'] || row['Nama PIC'] || row['Sales']);

      const followUp = cleanString(row['Follow Up (Sudah/ Belum)'] || row['Follow Up (Sudah / Belum)']);
      const hasilFu = cleanString(row['Hasil F.U'] || row['Hasil FU'] || row['Hasil Follow Up']);
      const supportNeedRaw = cleanString(row['Support Needed']);
      const penjelasan = cleanString(row['Penjelasan Support'] || row['Keterangan']);
      const leadCategory = cleanString(row['Leads'] || row['Jenis Lead'] || row['Lead Category']);
      const keterangan = cleanString(row['Keterangan']) || null;
      const closing_amount_raw = row['Closing Tabungan'] || 0;
      const closing_amount = typeof closing_amount_raw === 'number' ? closing_amount_raw : parseFloat(String(closing_amount_raw).replace(/,/g, '')) || 0;

      let status = 'READY_TO_FOLLOW_UP';
      
      if (hasilFu && hasilFu.toLowerCase().includes('closing')) {
         status = 'WON';
      } else if (hasilFu && (hasilFu.toLowerCase().includes('gagal') || hasilFu.toLowerCase().includes('tidak berminat'))) {
         status = 'LOST';
      } else if (supportNeedRaw && (supportNeedRaw.toLowerCase() === 'ya' || supportNeedRaw.toLowerCase() === 'yes')) {
         status = 'NEED_SUPPORT';
      } else if (followUp && followUp.toLowerCase() === 'sudah') {
         status = 'CONTACTED';
      }

      results.push({
        lead_name: name,
        cif,
        lead_type: leadType,
        branch,
        potential_amount,
        pic_name: pic,
        status,
        lead_category: leadCategory,
        area,
        area_name,
        branch_code,
        three_p,
        closing_amount,
        keterangan,
        support_needed: penjelasan
      });
    }
  }

  return results;
}

function cleanString(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  return str === '' ? null : str;
}
