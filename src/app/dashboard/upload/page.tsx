'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../layout';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 5;

  const fetchHistory = useCallback(async () => {
    const res = await fetch('/api/tasks');
    const data = await res.json();
    if (data.tasks) {
      const files = Array.from(new Set(data.tasks.map((t: any) => t.sourceFile).filter(Boolean))) as string[];
      setHistory(files);
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
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setUploadResult({ type: 'error', message: data.error });
      } else {
        setUploadResult({ type: 'success', message: data.message });
        fetchHistory();
        setTimeout(() => setUploadResult(null), 5000);
      }
    } catch {
      setUploadResult({ type: 'error', message: 'Upload failed' });
    } finally {
      setUploading(false);
      e.target.value = '';
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

      {uploadResult && (
        <div className={`notification ${uploadResult.type}`} style={{ marginBottom: '24px' }}>
          {uploadResult.type === 'success' ? '✅' : '❌'} {uploadResult.message}
        </div>
      )}

      <div className="upload-zone" style={{ position: 'relative' }}>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={uploading} />
        <div className="upload-icon">{uploading ? '⏳' : '☁️'}</div>
        <div className="upload-title">{uploading ? 'Processing file...' : 'Drop your file here or click to browse'}</div>
        <div className="upload-desc">Supported formats: Excel (.xlsx, .xls), CSV (.csv)</div>
      </div>

      <div className="history-section" style={{ marginTop: '48px' }}>
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
                  paginatedHistory.map((file, i) => (
                    <tr key={i}>
                      <td><span className="file-icon">📄</span> {file}</td>
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
