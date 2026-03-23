'use client';
import Pagination from '@/components/Pagination';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../layout';
import { useRouter } from 'next/navigation';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import * as XLSX from 'xlsx';

interface MonitoringData {
  id: string;
  name: string;
  codeReferral: string;
  noAccount: string;
  product: string;
  amount: number;
  target: number;
  total: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export default function MonitoringPage() {
  const { user, loading: authLoading, isAdmin, showToast } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MonitoringData[]>([]);
  const [loading, setLoading] = useState(true); // Kept original loading state
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof MonitoringData, direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // CRUD State
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [bulkActionConfirm, setBulkActionConfirm] = useState<{ action: 'VERIFY' | 'REJECT' | 'DELETE', count: number } | null>(null);
  const [editingEntry, setEditingEntry] = useState<MonitoringData | null>(null);
  const [form, setForm] = useState({ name: '', codeReferral: '', noAccount: '', product: '', amount: '0', target: '0', total: '0' });
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');

  // Auto-calculate total from amount and target
  useEffect(() => {
    setForm(prev => ({ ...prev, total: prev.amount }));
  }, [form.amount]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/monitoring');
      const d = await res.json();
      if (d.data) setData(d.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/api/auth/login');
        return;
      }
      fetchData();
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorDetails('');
    const method = editingEntry ? 'PATCH' : 'POST';
    const body = editingEntry ? { ...form, id: editingEntry.id } : form;

    const res = await fetch('/api/monitoring', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowModal(false);
      fetchData();
      showToast('Success', editingEntry ? 'Entry updated successfully' : 'New entry saved successfully');
    } else {
      const d = await res.json();
      setError(d.error || 'Failed to save entry');
      if (d.details) setErrorDetails(d.details);
      showToast('Error', d.error || 'Failed to save entry', 'error');
      console.error('Save error:', d);
    }
  };

  const handleVerify = async (id: string) => {
    try {
      const res = await fetch('/api/monitoring', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'VERIFIED' }),
      });
      if (res.ok) { fetchData(); showToast('Verified', 'Entry verified successfully'); }
      else throw new Error();
    } catch { showToast('Error', 'Failed to verify entry', 'error'); }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch('/api/monitoring', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'REJECTED' }),
      });
      if (res.ok) { fetchData(); showToast('Rejected', 'Entry rejected', 'warning'); }
      else throw new Error();
    } catch { showToast('Error', 'Failed to reject entry', 'error'); }
  };

  const confirmDelete = async () => {
    if (!showDeleteModal) return;
    try {
      const res = await fetch(`/api/monitoring?id=${showDeleteModal}`, { method: 'DELETE' });
      if (res.ok) {
        setShowDeleteModal(null);
        fetchData();
        showToast('Deleted', 'Entry deleted successfully', 'warning');
      } else throw new Error();
    } catch { showToast('Error', 'Failed to delete entry', 'error'); }
  };

  // Note: paginatedData will be defined below filteredData, but we can't reference it here yet.
  // We'll update handleSelectAll slightly later manually if needed, or we just reconstruct paginated array logic here.

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Quick calculation for current page data
    const sorted = [...data].filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.codeReferral.toLowerCase().includes(search.toLowerCase()) ||
      item.noAccount.includes(search)
    ).sort((a, b) => {
      // (simplified sort for select all isn't perfect, we can instead move filteredData/paginatedData up or move this function down)
      return 0; // We'll redefine handleSelectAll below filteredData to have access to paginatedData
    });
  };

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkVerify = () => {
    setBulkActionConfirm({ action: 'VERIFY', count: selectedIds.size });
  };

  const handleBulkReject = () => {
    setBulkActionConfirm({ action: 'REJECT', count: selectedIds.size });
  };

  const handleBulkDelete = () => {
    setBulkActionConfirm({ action: 'DELETE', count: selectedIds.size });
  };

  const executeBulkAction = async () => {
    if (!bulkActionConfirm) return;
    setLoading(true);
    try {
      if (bulkActionConfirm.action === 'DELETE') {
        await Promise.all(Array.from(selectedIds).map(id =>
          fetch(`/api/monitoring?id=${id}`, { method: 'DELETE' })
        ));
      } else {
        await Promise.all(Array.from(selectedIds).map(id =>
          fetch('/api/monitoring', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: bulkActionConfirm.action === 'VERIFY' ? 'VERIFIED' : 'REJECTED' }),
          })
        ));
      }
      showToast(`Bulk ${bulkActionConfirm.action}`, `${selectedIds.size} entries processed successfully.`, bulkActionConfirm.action === 'DELETE' || bulkActionConfirm.action === 'REJECT' ? 'warning' : 'success');
      setSelectedIds(new Set());
      setBulkActionConfirm(null);
      fetchData();
    } catch {
      showToast('Error', `Failed to execute bulk ${bulkActionConfirm.action.toLowerCase()}`, 'error');
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let result = [...data].filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.codeReferral.toLowerCase().includes(search.toLowerCase()) ||
      item.noAccount.toLowerCase().includes(search.toLowerCase()) ||
      item.product.toLowerCase().includes(search.toLowerCase())
    );

    if (sortConfig) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, search, sortConfig]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    return filteredData.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredData, currentPage]);

  const handleSelectAllPaginated = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedData.map(item => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const stats = useMemo(() => {
    const totalAmount = data.reduce((sum, item) => item.status !== 'REJECTED' ? sum + item.amount : sum, 0);
    const totalTarget = data.reduce((sum, item) => sum + item.target, 0);
    const achievement = totalTarget > 0 ? (totalAmount / totalTarget) * 100 : 0;
    // Count unique products
    const uniqueProducts = new Set(data.map(item => item.product)).size;

    return {
      totalAmount,
      totalTarget,
      achievement: Math.round(achievement) + '%',
      totalProducts: uniqueProducts
    };
  }, [data]);

  const aggregatedChartData = useMemo(() => {
    const grouped = data.reduce((acc: any, item: any) => {
      if (!acc[item.name]) {
        acc[item.name] = { ...item, amount: 0, target: 0, total: 0 };
      }
      
      if (item.status !== 'REJECTED') {
        acc[item.name].amount += item.amount;
        acc[item.name].total += item.total;
      }
      
      acc[item.name].target += item.target;
      return acc;
    }, {});
    return Object.values(grouped);
  }, [data]);

  const handleSort = (key: keyof MonitoringData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monitoring GMM");
    XLSX.writeFile(wb, `GMM_Monitoring_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToCSV = () => {
    const headers = ['Nama Employee', 'Code Refferal', 'No Account', 'Product', 'Amount', 'Target', 'Total', 'Status'];
    const rows = filteredData.map(item => [
      item.name, item.codeReferral, item.noAccount, item.product, item.amount, item.target, item.total, item.status
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `GMM_Monitoring_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || authLoading) return <div className="loading-spinner" />;

  return (
    <div className="monitoring-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAdmin ? 'Admin GMM Monitoring' : 'Entry GMM Saya'}</h1>
          <p className="page-subtitle">{isAdmin ? 'Kelola dan verifikasi pencapaian GMM tim' : 'Input pencapaian GMM harian kamu'}</p>
        </div>
      </div>

      {isAdmin && (
        <>
          <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card indigo">
              <div className="stat-label">Total Amount</div>
              <div className="stat-value">{stats.totalAmount.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Target</div>
              <div className="stat-value">{stats.totalTarget.toLocaleString()}</div>
            </div>
            <div className="stat-card emerald">
              <div className="stat-label">Achievement</div>
              <div className="stat-value">{stats.achievement}</div>
            </div>
            <div className="stat-card cyan">
              <div className="stat-label">Products (Unique)</div>
              <div className="stat-value">{stats.totalProducts}</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '24px', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
            <h3 style={{ marginBottom: '20px', fontSize: '15px' }}>Achievement Overview</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregatedChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)', borderRadius: '8px' }}
                    itemStyle={{ fontSize: 11 }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                  <Bar dataKey="amount" fill="var(--accent-blue)" name="Amount" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="target" fill="var(--text-tertiary)" name="Target" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <div className="card" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px' }}>{isAdmin ? 'Seluruh Data GMM' : 'Riwayat Input Saya'}</h3>
            {isAdmin && selectedIds.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'var(--bg-primary)', borderRadius: '20px', border: '1px solid var(--border-default)' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedIds.size} dipilih:</span>
                <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--accent-green)', color: 'white', border: 'none' }} onClick={handleBulkVerify}>Verify</button>
                <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--accent-red)', color: 'white', border: 'none' }} onClick={handleBulkReject}>Reject</button>
                <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: '11px', background: 'transparent', color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }} onClick={handleBulkDelete}>Delete</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={() => {
                setEditingEntry(null);
                setForm({ name: user?.name || '', codeReferral: '', noAccount: '', product: '', amount: '0', target: '0', total: '0' });
                setShowModal(true);
              }}
              title="Input GMM Baru"
              style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}
            >
              ➕
            </button>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={exportToCSV} 
                  title="Export CSV"
                  style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}
                >
                  📄
                </button>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={exportToExcel} 
                  title="Export Excel"
                  style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}
                >
                  📗
                </button>
              </div>
            )}
            <input 
              className="search-input" 
              placeholder="Cari employee, referral, atau account..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {isAdmin && (
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={paginatedData.length > 0 && selectedIds.size === paginatedData.length}
                        onChange={handleSelectAllPaginated}
                      />
                    </th>
                  )}
                  <th onClick={() => handleSort('name')}>Nama Employee {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('codeReferral')}>Code Refferal {sortConfig?.key === 'codeReferral' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('noAccount')}>No Account {sortConfig?.key === 'noAccount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('product')}>Product {sortConfig?.key === 'product' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('amount')}>Amount {sortConfig?.key === 'amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('target')}>Target {sortConfig?.key === 'target' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => handleSort('status')}>Status {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(item => (
                  <tr key={item.id} style={{ background: selectedIds.has(item.id) ? 'var(--bg-primary)' : 'transparent' }}>
                    {isAdmin && (
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(item.id)}
                          onChange={() => handleSelect(item.id)}
                        />
                      </td>
                    )}
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</td>
                    <td><code>{item.codeReferral}</code></td>
                    <td>{item.noAccount}</td>
                    <td><span className="status-badge status-todo" style={{ background: 'var(--bg-primary)' }}>{item.product}</span></td>
                    <td style={{ fontWeight: 500 }}>{item.amount.toLocaleString()}</td>
                    <td>{item.target.toLocaleString()}</td>
                    <td>
                      <span 
                        className={`status-badge ${item.status === 'VERIFIED' ? 'status-done' : item.status === 'REJECTED' ? 'status-rejected' : 'status-in-progress'}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isAdmin && item.status === 'PENDING' && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => handleVerify(item.id)}>Verify</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleReject(item.id)} style={{ padding: '0 12px' }}>Reject</button>
                          </>
                        )}
                        {(isAdmin || item.status === 'PENDING') && (
                          <button className="btn btn-secondary btn-sm" onClick={() => {
                            setEditingEntry(item);
                            setForm({ 
                              name: item.name, 
                              codeReferral: item.codeReferral, 
                              noAccount: item.noAccount,
                              product: item.product, 
                              amount: item.amount.toString(), 
                              target: item.target.toString(), 
                              total: item.total.toString() 
                            });
                            setShowModal(true);
                          }}>Edit</button>
                        )}
                        {isAdmin && (
                          <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(item.id)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                      Belum ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredData.length}
            itemsPerPage={itemsPerPage}
            itemName="entries"
          />
        </div>

      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editingEntry ? 'Edit Entry GMM' : 'Input Entry GMM Baru'}</h2>
            {error && (
              <div className="form-error" style={{ marginBottom: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <strong>Error: </strong> {error}
                {errorDetails && (
                  <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                    {errorDetails}
                  </div>
                )}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nama Employee</label>
                <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required readOnly={!isAdmin} />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Code Refferal</label>
                  <input className="form-input" value={form.codeReferral} onChange={e => setForm({...form, codeReferral: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>No Account</label>
                  <input className="form-input" value={form.noAccount} onChange={e => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) setForm({...form, noAccount: val});
                  }} required />
                </div>
              </div>
              <div className="form-group">
                <label>Produk</label>
                <input className="form-input" value={form.product} onChange={e => setForm({...form, product: e.target.value})} required />
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Amount</label>
                  <input type="number" min="0" className="form-input" value={form.amount} onChange={e => {
                    const val = e.target.value;
                    if (val === '' || Number(val) >= 0) setForm({...form, amount: val});
                  }} required />
                </div>
                <div className="form-group">
                  <label>Target</label>
                  <input type="number" min="0" className="form-input" value={form.target} onChange={e => {
                    const val = e.target.value;
                    if (val === '' || Number(val) >= 0) setForm({...form, target: val});
                  }} required />
                </div>
                <div className="form-group">
                  <label>Total (Auto)</label>
                  <input type="number" className="form-input" value={form.total} readOnly style={{ background: 'var(--bg-primary)', cursor: 'not-allowed' }} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary btn-sm">Simpan Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', color: 'var(--accent-red)', marginBottom: '16px' }}>⚠️</div>
            <h2 className="modal-title">Hapus Entry</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Apakah Anda yakin ingin menghapus data monitoring ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(null)}>Batal</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Hapus Permanen</button>
            </div>
          </div>
        </div>
      )}

      {/* Buk Action Confirmation Modal */}
      {bulkActionConfirm && (
        <div className="modal-overlay" onClick={() => setBulkActionConfirm(null)}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {bulkActionConfirm.action === 'DELETE' ? '⚠️' : bulkActionConfirm.action === 'VERIFY' ? '✅' : '❌'}
            </div>
            <h2 className="modal-title">Konfirmasi {bulkActionConfirm.action === 'DELETE' ? 'Penghapusan' : bulkActionConfirm.action === 'VERIFY' ? 'Verifikasi' : 'Penolakan'}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Apakah Anda yakin ingin {bulkActionConfirm.action === 'DELETE' ? 'menghapus secara permanen' : bulkActionConfirm.action === 'VERIFY' ? 'memverifikasi' : 'menolak'} <strong>{bulkActionConfirm.count} data</strong> sekaligus?
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" disabled={loading} onClick={() => setBulkActionConfirm(null)}>Batal</button>
              <button 
                className={`btn ${bulkActionConfirm.action === 'DELETE' || bulkActionConfirm.action === 'REJECT' ? 'btn-danger' : 'btn-primary'}`} 
                disabled={loading}
                onClick={executeBulkAction}
                style={bulkActionConfirm.action === 'VERIFY' ? { background: 'var(--accent-green)' } : {}}
              >
                {loading ? 'Memproses...' : 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
