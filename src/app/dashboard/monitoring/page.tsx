'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../layout';
import { useRouter, useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';

const ACTIVITY_TYPES = ['GMM', 'KSM', 'KPR', 'CC'] as const;
type ActivityType = typeof ACTIVITY_TYPES[number];

interface MonitoringData {
  id: string;
  activityType: string;
  name: string;
  codeReferral: string;
  noAccount: string;
  branchCode: string;
  product: string;
  amount: number;
  target: number;
  total: number;
  status: string;
  extraData?: any;
  createdAt: string;
  updatedAt: string;
}

export default function MonitoringPage() {
  const { user, loading: authLoading, isAdmin, showToast } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActivityType>('GMM');
  const [data, setData] = useState<MonitoringData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof MonitoringData, direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // CRUD State
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    action: () => void;
    type: 'success' | 'danger' | 'warning';
  }>({
    visible: false,
    title: '',
    message: '',
    action: () => { },
    type: 'success'
  });
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [bulkActionConfirm, setBulkActionConfirm] = useState<{ action: 'VERIFY' | 'REJECT' | 'DELETE', count: number } | null>(null);
  const [editingEntry, setEditingEntry] = useState<MonitoringData | null>(null);

  // Modal Form State
  const [formType, setFormType] = useState<ActivityType>('GMM');
  const [form, setForm] = useState({
    name: '',
    codeReferral: '',
    noAccounts: [''],
    product: '',
    amount: '0',
    target: '0',
    total: '0',
    branchCode: '',
    status: ''
  });
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState('');

  // Update formType when activeTab changes (for initialization)
  useEffect(() => {
    if (!showModal) setFormType(activeTab);
  }, [activeTab, showModal]);


  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/monitoring');
      const d = await res.json();
      if (d.activities) {
        setData(d.activities);
      } else if (d.data) {
        setData(d.data);
      }
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab') as ActivityType;
    if (tab && ACTIVITY_TYPES.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, dateRange]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/api/auth/login');
        return;
      }
      fetchData();
    }
  }, [user, authLoading, router, fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorDetails('');
    const method = editingEntry ? 'PATCH' : 'POST';

    // Status Logic: Non-GMM entries are VERIFIED, GMM is PENDING
    const status = (formType === 'GMM') ? 'PENDING' : 'VERIFIED';

    const body: any = {
      ...form,
      id: editingEntry?.id,
      activityType: formType,
      amount: parseFloat(form.amount) || 0,
      target: parseFloat(form.target) || 0,
      total: parseFloat(form.total) || 0,
      status: editingEntry ? editingEntry.status : status
    };

    if (editingEntry) {
      body.noAccount = form.noAccounts[0] || '';
    } else {
      body.noAccount = form.noAccounts.filter(Boolean);
    }
    
    // Add status if provided
    if (form.status) body.status = form.status;

    // Remove the array versions from the body
    delete body.noAccounts;

    try {
      const res = await fetch('/api/monitoring', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowModal(false);
        fetchData();
        showToast('Success', `Activity record ${editingEntry ? 'updated' : 'added'} successfully`, 'success');
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to save entry');
        if (d.details) setErrorDetails(d.details);
        showToast('Error', d.error || 'Failed to save entry', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error', 'An unexpected error occurred', 'error');
    }
  };

  const handleBulkVerify = async (status: string = 'VERIFIED') => {
    if (selectedIds.size === 0) return;
    setShowConfirmModal({
      visible: true,
      title: `Bulk Update to ${status}`,
      message: `Are you sure you want to update ${selectedIds.size} selected records to ${status}?`,
      type: 'success',
      action: async () => {
        const res = await fetch('/api/monitoring', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedIds), status }),
        });
        if (res.ok) {
          setSelectedIds(new Set());
          fetchData();
          showToast('Updated', `${selectedIds.size} activities have been updated to ${status}`, 'success');
        } else {
          showToast('Error', 'Failed to update activities', 'error');
        }
        setShowConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  };

  const handleBulkReject = async (status: string = 'REJECTED') => {
    if (selectedIds.size === 0) return;
    setShowConfirmModal({
      visible: true,
      title: `Bulk Update to ${status}`,
      message: `Are you sure you want to update ${selectedIds.size} selected records to ${status}?`,
      type: 'danger',
      action: async () => {
        const res = await fetch('/api/monitoring', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedIds), status }),
        });
        if (res.ok) {
          setSelectedIds(new Set());
          fetchData();
          showToast('Updated', `${selectedIds.size} activities have been updated to ${status}`, 'warning');
        } else {
          showToast('Error', 'Failed to update activities', 'error');
        }
        setShowConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setShowConfirmModal({
      visible: true,
      title: 'Delete Selected Activities',
      message: `Are you sure you want to permanently delete ${selectedIds.size} selected records? This action cannot be undone.`,
      type: 'danger',
      action: async () => {
        const res = await fetch('/api/monitoring', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        });
        if (res.ok) {
          setSelectedIds(new Set());
          fetchData();
          showToast('Deleted', `${selectedIds.size} records have been deleted`, 'warning');
        } else {
          showToast('Error', 'Failed to delete activities', 'error');
        }
        setShowConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  };

  const handleVerify = async (id: string, status: string = 'VERIFIED') => {
    const res = await fetch('/api/monitoring', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      fetchData();
      showToast('Verified', `Activity has been marked as ${status}`, 'success');
    } else {
      showToast('Error', 'Failed to verify activity', 'error');
    }
  };

  const handleReject = async (id: string) => {
    const res = await fetch('/api/monitoring', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'REJECTED' }),
    });
    if (res.ok) {
      fetchData();
      showToast('Rejected', 'Activity has been rejected', 'warning');
    } else {
      showToast('Error', 'Failed to reject activity', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setShowConfirmModal({
      visible: true,
      title: 'Delete Activity',
      message: 'Are you sure you want to delete this activity record? This action cannot be undone.',
      type: 'danger',
      action: async () => {
        const res = await fetch(`/api/monitoring?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchData();
          showToast('Deleted', 'Activity record deleted successfully', 'warning');
        } else {
          showToast('Error', 'Failed to delete activity record', 'error');
        }
        setShowConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = (currentPageIds: string[]) => {
    const allSelectedInPage = currentPageIds.every(id => selectedIds.has(id));
    const newSelected = new Set(selectedIds);
    if (allSelectedInPage) {
      currentPageIds.forEach(id => newSelected.delete(id));
    } else {
      currentPageIds.forEach(id => newSelected.add(id));
    }
    setSelectedIds(newSelected);
  };

  // Filter logic including date range and role
  const filteredData = useMemo(() => {
    let result = data.filter(item => item.activityType === activeTab);

    // Role-based filtering: Regular users only see their own entries
    if (!isAdmin) {
      result = result.filter(item => item.name === user?.name || item.codeReferral === user?.nip);
    }

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(s) ||
        item.codeReferral.toLowerCase().includes(s) ||
        (item.noAccount && item.noAccount.toLowerCase().includes(s)) ||
        item.product.toLowerCase().includes(s) ||
        (item.branchCode && item.branchCode.toLowerCase().includes(s))
      );
    }

    // Date Range Filter
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      result = result.filter(item => new Date(item.createdAt) >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      result = result.filter(item => new Date(item.createdAt) <= endDate);
    }

    // Sort logic
    if (sortConfig) {
      result.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, activeTab, search, dateRange, sortConfig, isAdmin, user]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: keyof MonitoringData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const exportToExcel = () => {
    let exportData;
    if (activeTab === 'GMM') {
      const summary: Record<string, { name: string, codeReferral: string, newCif: number, ntb: number, total: number }> = {};
      filteredData.forEach(item => {
        const key = item.codeReferral || item.name;
        if (!summary[key]) summary[key] = { name: item.name, codeReferral: item.codeReferral, newCif: 0, ntb: 0, total: 0 };
        if (item.status === 'NEW CIF') summary[key].newCif++;
        else if (item.status === 'NTB') summary[key].ntb++;
        summary[key].total++;
      });
      exportData = Object.values(summary).map(s => ({
        'Nama Employee': s.name,
        'Code Referral': s.codeReferral,
        'Total New CIF': s.newCif,
        'Total NTB': s.ntb,
        'Grand Total': s.total
      }));
    } else {
      exportData = filteredData.map(item => ({
        'Nama Employee': item.name,
        'Code Referral': item.codeReferral,
        'Code Cabang': item.branchCode || '-',
        'Date': new Date(item.createdAt).toLocaleDateString(),
        'No Account': item.noAccount,
        'Status': item.status
      }));
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Data ${activeTab}`);
    XLSX.writeFile(wb, `${activeTab}_Activity_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToCSV = () => {
    let csvContent;
    if (activeTab === 'GMM') {
      const headers = ['Nama Employee', 'Code Referral', 'Total New CIF', 'Total NTB', 'Grand Total'];
      const summary: Record<string, { name: string, codeReferral: string, newCif: number, ntb: number, total: number }> = {};
      filteredData.forEach(item => {
        const key = item.codeReferral || item.name;
        if (!summary[key]) summary[key] = { name: item.name, codeReferral: item.codeReferral, newCif: 0, ntb: 0, total: 0 };
        if (item.status === 'NEW CIF') summary[key].newCif++;
        else if (item.status === 'NTB') summary[key].ntb++;
        summary[key].total++;
      });
      const rows = Object.values(summary).map(s => [s.name, s.codeReferral, s.newCif, s.ntb, s.total]);
      csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    } else {
      const headers = ['Nama Employee', 'Code Referral', 'Code Cabang', 'Date', 'No Account', 'Status'];
      const rows = filteredData.map(item => [
        item.name, item.codeReferral, item.branchCode || '-', new Date(item.createdAt).toLocaleDateString(), item.noAccount, item.status
      ]);
      csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeTab}_Activity_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || authLoading) return <div className="loading-spinner" />;

  const isGMM = activeTab === 'GMM';
  const isCC = activeTab === 'CC';

  return (
    <div className="monitoring-page">
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '28px', fontWeight: 800, background: 'linear-gradient(135deg, var(--text-primary), #64748b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Activity Management</h1>
          <p className="page-subtitle" style={{ fontSize: '14px', marginTop: '4px' }}>Kelola dan pantau seluruh aktivitas tim secara real-time</p>
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        padding: '16px 20px',
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>📅</div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter Periode</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, padding: 0, width: '120px', cursor: 'pointer' }} />
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
                <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, padding: 0, width: '120px', cursor: 'pointer' }} />
              </div>
            </div>
          </div>
          <div style={{ height: '32px', width: '1px', background: 'var(--border-subtle)' }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} onClick={exportToCSV}>
              <span style={{ fontSize: '16px' }}>📄</span> Export CSV
            </button>
            <button className="btn" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} onClick={exportToExcel}>
              <span style={{ fontSize: '16px' }}>📗</span> Export Excel
            </button>
          </div>
        </div>
      </div>

      <div className="tabs-container" style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
          {ACTIVITY_TYPES.map(type => (
            <button
              key={type}
              onClick={() => {
                setActiveTab(type);
                setSelectedIds(new Set());
              }}
              className={`tab-btn ${activeTab === type ? 'active' : ''}`}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: activeTab === type ? 'none' : '1px solid #e2e8f0',
                background: activeTab === type ? 'white' : '#f8fafc',
                color: activeTab === type ? '#1e293b' : '#64748b',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: activeTab === type ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <span style={{ fontSize: '18px' }}>
                {type === 'GMM' ? '📊' : type === 'KSM' ? '🚗' : type === 'KPR' ? '🏠' : '💳'}
              </span>
              {type}
              <span style={{ fontSize: '11px', color: activeTab === type ? '#94a3b8' : '#cbd5e1', fontWeight: 500 }}>
                {data.filter(d => d.activityType === type).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: 'white', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>Data {activeTab}</h3>
            </div>
            <button
              onClick={() => {
                setEditingEntry(null);
                setFormType(activeTab);
                setForm({
                  name: user?.name || '',
                  codeReferral: user?.nip || '',
                  noAccounts: [''],
                  product: '',
                  amount: '1',
                  target: '1',
                  total: '1',
                  branchCode: '',
                  status: ''
                });
                setShowModal(true);
              }}
              style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}
            >
              ➕
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}>🔍</span>
            <input
              className="search-input"
              placeholder={`Cari di ${activeTab}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '36px', height: '36px', width: '220px', borderRadius: '10px', fontSize: '13px' }}
            />
          </div>
        </div>

        <div className="table-container" style={{ margin: 0, border: 'none', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: '40px' }}><input type="checkbox" 
                  checked={paginatedData.length > 0 && paginatedData.every(d => selectedIds.has(d.id))}
                  onChange={() => toggleSelectAll(paginatedData.map(d => d.id))} 
                /></th>
                {[
                  { label: 'NAMA EMPLOYEE', key: 'name' },
                  { label: 'CODE REFERRAL', key: 'codeReferral' },
                  { label: 'CODE CABANG', key: 'branchCode' },
                  { label: 'DATE', key: 'createdAt' },
                  ...(activeTab === 'GMM' ? [
                    { label: 'NO ACCOUNT', key: 'noAccount' },
                    { label: 'PRODUCT', key: 'product' }
                  ] : activeTab === 'KSM' || activeTab === 'KPR' || activeTab === 'CC' ? [
                    { label: 'NO ACCOUNT', key: 'noAccount' }
                  ] : []),
                  { label: 'STATUS', key: 'status' }
                ].map(col => (
                  <th
                    key={col.key}
                    style={{ fontSize: '11px', color: '#64748b', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort(col.key as any)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {col.label}
                      <span style={{ fontSize: '10px', opacity: sortConfig?.key === col.key ? 1 : 0.2 }}>
                        {sortConfig?.key === col.key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                ))}
                <th style={{ fontSize: '11px', color: '#64748b' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(item => (
                <tr key={item.id}>
                  <td style={{ height: '56px', verticalAlign: 'middle' }}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>
                  <td style={{ fontWeight: 600, color: '#1e293b', height: '56px', verticalAlign: 'middle' }}>{item.name}</td>
                  <td style={{ color: '#64748b', fontSize: '12px', height: '56px', verticalAlign: 'middle' }}>{item.codeReferral}</td>
                  <td style={{ color: '#64748b', height: '56px', verticalAlign: 'middle' }}>{item.branchCode || '-'}</td>
                  <td style={{ color: '#64748b', height: '56px', verticalAlign: 'middle' }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                  {activeTab === 'GMM' ? (
                    <>
                      <td style={{ color: '#1e293b', height: '56px', verticalAlign: 'middle' }}>{item.noAccount || '-'}</td>
                      <td style={{ color: '#1e293b', height: '56px', verticalAlign: 'middle' }}>{item.product || '-'}</td>
                    </>
                  ) : activeTab === 'KSM' || activeTab === 'KPR' || activeTab === 'CC' ? (
                    <td style={{ color: '#1e293b', height: '56px', verticalAlign: 'middle' }}>{item.noAccount || '-'}</td>
                  ) : null}
                  <td style={{ height: '56px', verticalAlign: 'middle' }}>
                    <span className={`status-badge ${
                      ['VERIFIED', 'Pengajuan Cair', 'Maintain Nasabah', 'NEW CIF', 'NTB'].includes(item.status) ? 'status-verified' :
                      ['REJECTED', 'TAKEOUT', 'Pengajuan Ditolak', 'Dalam Proses Pengajuan (Ditolak)', 'Pengajuan Tidak Tertarik'].includes(item.status) ? 'status-rejected' :
                      'status-pending'
                    }`}>
                      • {item.status}
                    </span>
                  </td>
                  <td style={{ height: '56px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', height: '100%' }}>
                      {isAdmin && item.status === 'PENDING' && (
                        <>
                          {item.activityType === 'GMM' ? (
                            <>
                              <button
                                onClick={() => handleVerify(item.id, 'NEW CIF')}
                                title="New CIF"
                                style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '6px', fontSize: '10px' }}
                                className="btn btn-sm"
                              >🆕 CIF</button>
                              <button
                                onClick={() => handleVerify(item.id, 'NTB')}
                                title="NTB"
                                style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '6px', fontSize: '10px' }}
                                className="btn btn-sm"
                              >🏛️ NTB</button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleVerify(item.id)}
                              title="Verify"
                              style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '6px' }}
                              className="btn btn-sm"
                            >✅</button>
                          )}
                          <button
                            onClick={() => handleReject(item.id)}
                            title="Reject"
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '6px' }}
                            className="btn btn-sm"
                          >❌</button>
                        </>
                      )}
                      <button className="btn btn-secondary btn-sm" style={{ padding: '6px' }} onClick={() => {
                        setEditingEntry(item);
                        setFormType(item.activityType as ActivityType);
                        setForm({
                          name: item.name,
                          codeReferral: item.codeReferral,
                          noAccounts: item.noAccount ? item.noAccount.split(', ') : [''],
                          product: item.product,
                          amount: String(item.amount),
                          target: String(item.target),
                          total: String(item.total),
                          branchCode: item.branchCode || '',
                          status: item.status
                        });
                        setShowModal(true);
                      }}>✏️</button>
                      <button className="btn btn-danger btn-sm" style={{ padding: '6px' }} onClick={() => handleDelete(item.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                    Tidak ada riwayat {activeTab}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredData.length > 0 && (
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'white'
          }}>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              Showing <b>{(page - 1) * pageSize + 1}</b> to <b>{Math.min(page * pageSize, filteredData.length)}</b> of <b>{filteredData.length}</b> activity
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  color: page === 1 ? '#cbd5e1' : '#64748b',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '13px'
                }}
              >
                First
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  color: page === 1 ? '#cbd5e1' : '#64748b',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '13px'
                }}
              >
                « Prev
              </button>

              <div style={{ display: 'flex', gap: '4px' }}>
                {(() => {
                  let start = Math.max(1, page - 1);
                  let end = Math.min(totalPages, start + 2);
                  if (end === totalPages) start = Math.max(1, end - 2);

                  const buttons = [];
                  for (let i = start; i <= end; i++) {
                    buttons.push(
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          border: page === i ? 'none' : '1px solid #e2e8f0',
                          background: page === i ? '#0052cc' : 'white',
                          color: page === i ? 'white' : '#64748b',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {i}
                      </button>
                    );
                  }
                  return buttons;
                })()}
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  color: page === totalPages ? '#cbd5e1' : '#64748b',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '13px'
                }}
              >
                Next »
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  color: page === totalPages ? '#cbd5e1' : '#64748b',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '13px'
                }}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Action Floating Bar */}
      {selectedIds.size > 0 && isAdmin && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: '#1e293b',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '95vw',
          width: 'max-content'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>{selectedIds.size}</div>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Tindakan Terpilih</span>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeTab === 'GMM' ? (
              <>
                <button className="btn" style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: 600 }} onClick={() => handleBulkVerify('NEW CIF')}>🆕 NEW CIF</button>
                <button className="btn" style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: 600 }} onClick={() => handleBulkVerify('NTB')}>🏛️ NTB</button>
                <button className="btn" style={{ background: '#f43f5e', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: 600 }} onClick={() => handleBulkReject('REJECTED')}>Reject</button>
              </>
            ) : (
              <>
                <button className="btn" style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: 600 }} onClick={() => handleBulkVerify('Pengajuan Cair')}>💎 Pengajuan Cair</button>
                <button className="btn" style={{ background: '#f43f5e', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: 600 }} onClick={() => handleBulkReject('Pengajuan Ditolak')}>✖️ Pengajuan Ditolak</button>
              </>
            )}
            <button className="btn" style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: 600 }} onClick={handleBulkDelete}>Delete All</button>
          </div>
          <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px', padding: '4px' }} onClick={() => setSelectedIds(new Set())}>✕</button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px', borderRadius: '20px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', marginBottom: '20px' }}>Input {formType} Baru</h2>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', display: 'block' }}>Tipe Activity</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                {ACTIVITY_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormType(type)}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: formType === type ? 'none' : '1px solid #e2e8f0',
                      background: formType === type ? '#00abc6' : 'white',
                      color: formType === type ? 'white' : '#64748b',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>
                      {type === 'GMM' ? '📊' : type === 'KSM' ? '🚗' : type === 'KPR' ? '🏠' : '💳'}
                    </span>
                    {type}
                  </button>
                ))}
              </div>
              <div style={{ height: '8px' }} />
            </div>

            <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>NAMA EMPLOYEE</label>
                <input className="form-input" style={{ background: '#f8fafc', fontWeight: 600 }} value={form.name} readOnly />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>CODE REFERRAL</label>
                  <input className="form-input" value={form.codeReferral} onChange={e => setForm({ ...form, codeReferral: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>CODE CABANG (OPTIONAL)</label>
                  <input className="form-input" placeholder="Masukkan kode cabang" value={form.branchCode} onChange={e => setForm({ ...form, branchCode: e.target.value })} />
                </div>
              </div>

              {formType === 'GMM' ? (
                <>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>NO ACCOUNT (GMM)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      {form.noAccounts.map((no, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                          <input className="form-input" style={{ flex: 1 }} value={no} placeholder={`No Account ${idx+1}`} onChange={e => {
                            const newNo = [...form.noAccounts];
                            newNo[idx] = e.target.value;
                            setForm({ ...form, noAccounts: newNo });
                          }} required={idx === 0} />
                          {idx === 0 ? (
                            <button type="button" onClick={() => setForm({ ...form, noAccounts: [...form.noAccounts, ''] })} style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '18px', fontWeight: 600, color: '#00abc6' }}> + </button>
                          ) : (
                            <button type="button" onClick={() => {
                              const newNo = [...form.noAccounts];
                              newNo.splice(idx, 1);
                              setForm({ ...form, noAccounts: newNo });
                            }} style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'white', cursor: 'pointer', fontSize: '14px', color: '#ef4444' }}> ✕ </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>PRODUCT</label>
                    <input className="form-input" placeholder="Contoh: Tabungan, Deposito, dll" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} required />
                  </div>
                </>
              ) : (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>NO ACCOUNT ({formType})</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      {form.noAccounts.map((no, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                          <input className="form-input" style={{ flex: 1 }} value={no} placeholder={`No Account ${idx+1}`} onChange={e => {
                            const newNo = [...form.noAccounts];
                            newNo[idx] = e.target.value;
                            setForm({ ...form, noAccounts: newNo });
                          }} required={idx === 0} />
                          {idx === 0 ? (
                            <button type="button" onClick={() => setForm({ ...form, noAccounts: [...form.noAccounts, ''] })} style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '18px', fontWeight: 600, color: '#00abc6' }}> + </button>
                          ) : (
                            <button type="button" onClick={() => {
                              const newNo = [...form.noAccounts];
                              newNo.splice(idx, 1);
                              setForm({ ...form, noAccounts: newNo });
                            }} style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'white', cursor: 'pointer', fontSize: '14px', color: '#ef4444' }}> ✕ </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
              )}

              {/* Status Section for KSM, KPR, CC (Admin only) */}
              {editingEntry && isAdmin && (formType === 'KSM' || formType === 'KPR' || formType === 'CC') && (
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>UPDATE STATUS</label>
                  <select 
                    className="form-input" 
                    value={form.status} 
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    style={{ marginTop: '4px', cursor: 'pointer' }}
                  >
                    {[
                      "Belum ada Pengajuan",
                      "Pengajuan Sudah (Tertarik)",
                      "Pengajuan Sudah (Custom (Tidak Respond), (Tertarik tp Entar, dll))",
                      "Pengajuan Tidak Tertarik",
                      "Dalam Proses Pengajuan (Lancar)",
                      "Dalam Proses Pengajuan (Perlu Ralat / Sendback)",
                      "Dalam Proses Pengajuan (Ditolak)",
                      "Pengajuan Diterima",
                      "Pengajuan Ditolak",
                      "Pengajuan Cair",
                      "TAKEOUT",
                      "Maintain Nasabah"
                    ].map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="modal-actions" style={{ gap: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, borderRadius: '10px', border: '1px solid #e2e8f0', color: '#1e293b' }} onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, borderRadius: '10px', background: '#00abc6', border: 'none' }}>Simpan Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}


      <style jsx>{`
        .tab-btn {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #64748b;
        }
        .tab-btn.active {
          background: white !important;
          color: #1e293b !important;
          border-color: #3b82f6 !important;
          border-width: 2px !important;
        }
        .tab-btn:hover {
          background: white;
        }
        .form-input {
          height: 40px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          padding: 0 12px;
          font-size: 13px;
          width: 100%;
        }
        .form-input:focus {
          border-color: #3b82f6;
          outline: none;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-verified {
          background: #ecfdf5 !important;
          color: #10b981 !important;
        }
        .status-rejected {
          background: #fef2f2 !important;
          color: #ef4444 !important;
        }
        .status-pending {
          background: #eff6ff !important;
          color: #3b82f6 !important;
        }
      `}</style>
      {showConfirmModal.visible && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 2000 }} onClick={() => setShowConfirmModal(prev => ({ ...prev, visible: false }))}>
          <div className="modal-content" style={{ maxWidth: '400px', borderRadius: '24px', padding: '32px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px',
              background: showConfirmModal.type === 'danger' ? 'rgba(244, 63, 94, 0.1)' :
                showConfirmModal.type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              {showConfirmModal.type === 'danger' ? '⚠️' : '❓'}
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>{showConfirmModal.title}</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>{showConfirmModal.message}</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, borderRadius: '12px', padding: '12px', fontWeight: 600 }}
                onClick={() => setShowConfirmModal(prev => ({ ...prev, visible: false }))}
              >Cancel</button>
              <button
                className="btn"
                style={{
                  flex: 1,
                  borderRadius: '12px',
                  padding: '12px',
                  fontWeight: 600,
                  background: showConfirmModal.type === 'danger' ? '#f43f5e' :
                    showConfirmModal.type === 'warning' ? '#f59e0b' : '#10b981',
                  color: 'white',
                  border: 'none'
                }}
                onClick={showConfirmModal.action}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
