'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../layout';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const { isAdmin, showToast } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);
  const [selectedFilename, setSelectedFilename] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 5;

  const fetchHistory = useCallback(async () => {
    const res = await fetch('/api/upload-leads/history');
    const data = await res.json();
    if (data.batches) {
      setHistory(data.batches);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/dashboard/dashboard');
      return;
    }
    fetchHistory();
  }, [isAdmin, router, fetchHistory]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-leads/preview', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        showToast('Upload Error', data.error || 'Parsing failed', 'error');
      } else {
        setPreviewData(data);
        setSelectedFilename(file.name);
        showToast('Success', 'File parsed successfully. Please review the preview.', 'success');
      }
    } catch {
      showToast('Error', 'An unexpected error occurred during upload', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
     setConfirming(true);
     
     try {
        const res = await fetch('/api/upload-leads/confirm', { 
           method: 'POST', 
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ leads: previewData.allData, filename: selectedFilename }) 
        });
        const data = await res.json();
        
        if (!res.ok) {
           showToast('Import Error', data.error || 'Import failed', 'error');
        } else {
           showToast('Import Complete', data.message || 'Leads imported successfully', 'success');
           setPreviewData(null);
           fetchHistory();
        }
     } catch(e) {
        showToast('Error', 'An unexpected error occurred during import', 'error');
     } finally {
        setConfirming(false);
     }
  };

  const paginatedHistory = history.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);
  const historyTotalPages = Math.ceil(history.length / historyPageSize);

  if (!isAdmin) return null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Files</h1>
          <p className="page-subtitle">Upload Excel or CSV files to auto-generate tasks</p>
        </div>
      </div>


      {!previewData ? (
        <div className="upload-zone" id="tour-upload-zone" style={{ position: 'relative' }}>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={uploading} />
          <div className="upload-icon">{uploading ? '⏳' : '☁️'}</div>
          <div className="upload-title">{uploading ? 'Processing file...' : 'Drop Excel Leads file here or click to browse'}</div>
          <div className="upload-desc">Required templates: Potensi Intensifikasi, Potensi Ekstensifikasi, Akuisisi BottomUp</div>
        </div>
      ) : (
        <div className="preview-section" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginBottom: '32px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                 <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0' }}>Preview Data Import</h2>
                 <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: 0 }}>File: {selectedFilename}</p>
                 
                 <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                    <div style={{ background: 'var(--accent-blue-light)', color: 'var(--accent-blue)', padding: '12px 16px', borderRadius: '8px' }}>
                       <div style={{ fontSize: '24px', fontWeight: 700 }}>{previewData.summary.totalFound}</div>
                       <div style={{ fontSize: '12px', fontWeight: 500 }}>Total Leads Found</div>
                    </div>
                    <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-green)', padding: '12px 16px', borderRadius: '8px' }}>
                       <div style={{ fontSize: '24px', fontWeight: 700 }}>{previewData.summary.validCount}</div>
                       <div style={{ fontSize: '12px', fontWeight: 500 }}>Valid to Import</div>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', padding: '12px 16px', borderRadius: '8px' }}>
                       <div style={{ fontSize: '24px', fontWeight: 700 }}>{previewData.summary.duplicateCount}</div>
                       <div style={{ fontSize: '12px', fontWeight: 500 }}>Duplicates (Skipped)</div>
                    </div>
                 </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                 <button className="btn btn-secondary" onClick={() => setPreviewData(null)} disabled={confirming}>Cancel</button>
                 <button className="btn btn-primary" onClick={handleConfirmImport} disabled={confirming || previewData.summary.validCount === 0}>
                    {confirming ? 'Importing...' : 'Confirm Import'}
                 </button>
              </div>
           </div>

           <div className="table-container" style={{ marginTop: '20px', maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table">
                 <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                       <th>Status</th>
                       <th>Lead Name</th>
                       <th>CIF</th>
                       <th>Type</th>
                       <th>Potential Amt</th>
                       <th>Matched PIC</th>
                    </tr>
                 </thead>
                 <tbody>
                    {previewData.preview.map((row: any, i: number) => (
                       <tr key={i} style={{ opacity: row.isDuplicate ? 0.6 : 1 }}>
                          <td>
                             {row.isDuplicate ? 
                                <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)' }}>Duplicate</span> : 
                                <span className="status-badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-green)' }}>Valid</span>
                             }
                          </td>
                          <td style={{ fontWeight: 500 }}>{row.lead_name}</td>
                          <td>{row.cif || '-'}</td>
                          <td><span className="priority-badge priority-medium" style={{ fontSize: '10px' }}>{row.lead_type.replace('_', ' ')}</span></td>
                          <td>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(row.potential_amount)}</td>
                          <td>{row.matchedUserName || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Unassigned</span>}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
           {previewData.allData.length > 50 && (
              <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-tertiary)', fontSize: '12px', background: 'var(--bg-main)' }}>
                 Showing top 50 leads in preview.
              </div>
           )}
        </div>
      )}

      <div className="history-section" id="tour-upload-history" style={{ marginTop: '48px' }}>
        <h2 className="table-title">Upload History</h2>
        <div className="table-container">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Filename</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {paginatedHistory.length === 0 ? (
                  <tr><td colSpan={2} style={{ textAlign: 'center', padding: '24px' }}>No upload history</td></tr>
                ) : (
                  paginatedHistory.map((batch, i) => (
                    <tr key={i}>
                      <td>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontWeight: 600 }}><span className="file-icon">📄</span> {batch.filename}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{new Date(batch.created_at).toLocaleString()} • Imported {batch.valid_rows} Leads</span>
                         </div>
                      </td>
                      <td><button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard/tasks')}>View Tasks</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {historyTotalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Page <strong>{historyPage}</strong> of <strong>{historyTotalPages}</strong>
              </div>
              <div className="pagination-numbers">
                <button className="pagination-btn" disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)}>
                  &laquo; Prev
                </button>
                {[...Array(historyTotalPages)].map((_, i) => (
                  <button
                    key={i}
                    className={`pagination-btn ${historyPage === i + 1 ? 'active' : ''}`}
                    onClick={() => setHistoryPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button className="pagination-btn" disabled={historyPage === historyTotalPages} onClick={() => setHistoryPage(p => p + 1)}>
                  Next &raquo;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
