'use client';
import Pagination from '@/components/Pagination';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import { useAuth } from '../layout';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  sourceFile: string;
  assigneeId: string | null;
  assignee: { id: string; name: string; nip: string } | null;
  createdAt: string;
}

interface UserListItem {
  id: string;
  name: string;
  nip: string;
  role: string;
}

function TasksPageContent() {
  const { user, isAdmin, showToast } = useAuth();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'FLAT' | 'GROUPED'>('GROUPED');
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());
  
  // Sync filters with URL
  const initialStatus = searchParams.get('status') || '';
  const initialSearch = searchParams.get('search') || '';

  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  
  const [leadPage, setLeadPage] = useState(1);
  const leadPageSize = 10;
  
  const [leadSortField, setLeadSortField] = useState<'createdAt' | 'potential_amount'>('createdAt');
  const [leadSortOrder, setLeadSortOrder] = useState<'asc' | 'desc'>('desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting states
  const [sortField, setSortField] = useState<'title' | 'status' | 'priority' | 'assignee' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', assigneeId: '', leadId: '' });
  const [leadForm, setLeadForm] = useState({ status: 'NEW', priority: 'MEDIUM', owner_user_id: '', support_needed: '' });
  const [assignModal, setAssignModal] = useState<{ taskId: string; currentAssigneeId: string | null } | null>(null);
  const [bulkDeleteModal, setBulkDeleteModal] = useState<boolean>(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setStatusFilter(s);
    const q = searchParams.get('search');
    if (q) setSearch(q);
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    const [tasksRes, usersRes, leadsRes] = await Promise.all([
      fetch('/api/tasks'),
      isAdmin ? fetch('/api/users') : Promise.resolve({ json: () => ({ users: [] }) }),
      fetch('/api/leads?includeTasks=true')
    ]);
    const tasksData = await tasksRes.json();
    const usersData = await usersRes.json();
    const leadsData = await leadsRes.json();
    if (tasksData.tasks) setTasks(tasksData.tasks);
    if (usersData.users) setUsers(usersData.users);
    if (leadsData.leads) setLeads(leadsData.leads);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter and Sort logic
  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const date = new Date(t.createdAt);
        const matchStatus = !statusFilter || t.status === statusFilter;
        const matchPriority = !priorityFilter || t.priority === priorityFilter;
        const matchStart = !startDate || date >= new Date(startDate);
        const matchEnd = !endDate || date <= new Date(endDate + 'T23:59:59');
        const matchSearch = !search || 
          t.title.toLowerCase().includes(search.toLowerCase()) || 
          t.description.toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchPriority && matchSearch && matchStart && matchEnd;
      })
      .sort((a, b) => {
        let valA: any, valB: any;
        
        switch (sortField) {
          case 'title': valA = a.title; valB = b.title; break;
          case 'status': valA = a.status; valB = b.status; break;
          case 'priority': 
            const pMap: any = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
            valA = pMap[a.priority] || 0;
            valB = pMap[b.priority] || 0;
            break;
          case 'assignee': 
            valA = a.assignee?.name || 'zzzz'; 
            valB = b.assignee?.name || 'zzzz'; 
            break;
          case 'createdAt': valA = new Date(a.createdAt).getTime(); valB = new Date(b.createdAt).getTime(); break;
          default: return 0;
        }
        
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [tasks, statusFilter, priorityFilter, search, sortField, sortOrder]);

  const paginatedTasks = filteredTasks.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredTasks.length / pageSize);

  const filteredLeads = useMemo(() => {
    return leads
      .filter(l => {
         const date = new Date(l.createdAt);
         const matchStart = !startDate || date >= new Date(startDate);
         const matchEnd = !endDate || date <= new Date(endDate + 'T23:59:59');
         const matchSearch = !search || 
            l.lead_name.toLowerCase().includes(search.toLowerCase()) || 
            (l.branch && l.branch.toLowerCase().includes(search.toLowerCase()));
         return matchSearch && matchStart && matchEnd;
      })
      .sort((a, b) => {
         let valA, valB;
         if (leadSortField === 'potential_amount') {
            valA = a.potential_amount || 0;
            valB = b.potential_amount || 0;
         } else {
            valA = new Date(a.createdAt).getTime(); 
            valB = new Date(b.createdAt).getTime();
         }
         
         if (valA < valB) return leadSortOrder === 'asc' ? -1 : 1;
         if (valA > valB) return leadSortOrder === 'asc' ? 1 : -1;
         return 0;
      });
  }, [leads, search, leadSortField, leadSortOrder]);

  const paginatedLeads = filteredLeads.slice((leadPage - 1) * leadPageSize, leadPage * leadPageSize);
  const totalLeadPages = Math.ceil(filteredLeads.length / leadPageSize);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      fetchData();
      showToast('Status Updated', `Task status changed to ${newStatus}`);
    } catch {
      showToast('Error', 'Failed to update task status', 'error');
    }
  };

  const handleLeadUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    try {
       const res = await fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingLead.id, ...leadForm })
       });
       if (res.ok) {
          setShowLeadModal(false);
          fetchData();
          showToast('Success', 'Lead updated successfully');
       } else throw new Error();
    } catch { showToast('Error', 'Failed to update Lead', 'error'); }
  };

  const handleAssign = async (taskId: string, assigneeId: string | null) => {
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, assigneeId }),
      });
      setAssignModal(null);
      fetchData();
      showToast('Assigned', 'Task assignment updated successfully');
    } catch { showToast('Error', 'Failed to assign task', 'error'); }
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;
    try {
      await fetch(`/api/tasks?id=${showDeleteModal}`, { method: 'DELETE' });
      setShowDeleteModal(null);
      fetchData();
      showToast('Task Deleted', 'The task has been deleted.', 'warning');
    } catch { showToast('Error', 'Failed to delete task', 'error'); }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTaskIds(new Set(paginatedTasks.map(task => task.id)));
    } else {
      setSelectedTaskIds(new Set());
    }
  };

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedTaskIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTaskIds(newSet);
  };

  const handleBulkDelete = async () => {
    setLoading(true);
    try {
      await Promise.all(Array.from(selectedTaskIds).map(id =>
        fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
      ));
      showToast('Bulk Delete', `${selectedTaskIds.size} tasks have been deleted.`, 'warning');
      setSelectedTaskIds(new Set());
      setBulkDeleteModal(false);
      fetchData();
    } catch { showToast('Error', 'Failed to delete tasks', 'error'); setLoading(false); }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (!newStatus) return;
    setLoading(true);
    try {
      await Promise.all(Array.from(selectedTaskIds).map(id =>
        fetch('/api/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: newStatus }),
        })
      ));
      showToast('Bulk Update', `Status of ${selectedTaskIds.size} tasks updated to ${newStatus}.`);
      setSelectedTaskIds(new Set());
      fetchData();
    } catch { showToast('Error', 'Failed to update tasks', 'error'); setLoading(false); }
  };

  const handleBulkAssign = async (assigneeId: string) => {
    if (!assigneeId) return;
    const payloadAssigneeId = assigneeId === 'unassigned' ? null : assigneeId;
    setLoading(true);
    try {
      await Promise.all(Array.from(selectedTaskIds).map(id =>
        fetch('/api/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, assigneeId: payloadAssigneeId }),
        })
      ));
      showToast('Bulk Assign', `${selectedTaskIds.size} tasks assigned successfully.`);
      setSelectedTaskIds(new Set());
      fetchData();
    } catch { showToast('Error', 'Failed to assign tasks', 'error'); setLoading(false); }
  };

  const handleExport = (format: 'excel' | 'csv') => {
    let workbook;
    
    if (viewMode === 'GROUPED') {
       const exportData = filteredLeads.map((l, idx) => {
          const isContacted = ['CONTACTED', 'IN_DISCUSSION', 'WAITING_CUSTOMER', 'WON', 'LOST'].includes(l.status) ? 'Sudah' : 'Belum';
          let hasilFU = '';
          if (l.status === 'WON') hasilFU = 'Closing';
          if (l.status === 'LOST') hasilFU = 'Gagal/Tidak Berminat';

          return {
             'No': idx + 1,
             'CIF': l.cif || '',
             'Nama': l.lead_name,
             'Area': l.area || '',
             'Nama Area': l.area_name || '',
             'Cabang': l.branch_code || '',
             'Nama Cabang': l.branch || '',
             '3P': l.three_p || 'Pebisnis', 
             'Eksten/ Inten': l.lead_type === 'INTENSIFICATION' ? 'Intensifikasi' : l.lead_type === 'EXTENSIFICATION' ? 'Ekstensifikasi' : 'BottomUp',
             'Leads': l.lead_category || '',
             'Potensi Nominal': l.potential_amount || 0,
             'Follow Up (Sudah/ Belum)': isContacted,
             'Jumlah F.U': l.tasks?.length || 0,
             'Tanggal F.U Terakhir': l.last_activity_at ? new Date(l.last_activity_at).toLocaleDateString('id-ID') : '',
             'Hasil F.U': hasilFU,
             'Closing Tabungan': l.closing_amount || 0, 
             'Keterangan': l.keterangan || (l.status === 'DORMANT' ? 'Dormant' : ''),
             'Support Needed': l.status === 'NEED_SUPPORT' ? 'Ya' : '',
             'Penjelasan Support': l.support_needed || ''
          };
       });
       
       const worksheet = XLSX.utils.json_to_sheet(exportData);
       workbook = XLSX.utils.book_new();
       XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads_Data');

       if (format === 'excel') XLSX.writeFile(workbook, `Data_Leads_CRM_${new Date().getTime()}.xlsx`);
       else XLSX.writeFile(workbook, `Data_Leads_CRM_${new Date().getTime()}.csv`, { bookType: 'csv' });
       
    } else {
       const dataToExport = filteredTasks.map(t => ({
         Title: t.title,
         Description: t.description,
         Status: t.status,
         Priority: t.priority,
         Assignee: t.assignee?.name || 'Unassigned',
         'Created At': new Date(t.createdAt).toLocaleString()
       }));

       const worksheet = XLSX.utils.json_to_sheet(dataToExport);
       workbook = XLSX.utils.book_new();
       XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

       if (format === 'excel') {
         XLSX.writeFile(workbook, `tasks_export_${new Date().getTime()}.xlsx`);
       } else {
         XLSX.writeFile(workbook, `tasks_export_${new Date().getTime()}.csv`, { bookType: 'csv' });
       }
    }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingTask ? 'PATCH' : 'POST';
    const body: any = { ...taskForm };
    if (editingTask) body.id = editingTask.id;
    if (body.assigneeId === '') body.assigneeId = null;

    try {
      const res = await fetch('/api/tasks', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowTaskModal(false);
        fetchData();
        showToast('Success', editingTask ? 'Task updated successfully' : 'New task created successfully');
      } else throw new Error();
    } catch { showToast('Error', 'Failed to save task', 'error'); }
  };

  if (loading) return <div className="loading-spinner" />;

   return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">{isAdmin ? 'All CRM Framework' : 'My Follow-Ups'}</h1>
          <p className="page-subtitle">{viewMode === 'FLAT' ? `${filteredTasks.length} tasks found` : `${filteredLeads.length} leads found`}</p>
        </div>
        <div id="tour-view-toggle" style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
           <button 
             className={`btn btn-sm ${viewMode === 'GROUPED' ? 'btn-primary' : 'btn-secondary'}`} 
             style={{ border: 'none', background: viewMode === 'GROUPED' ? 'var(--accent-blue)' : 'transparent', color: viewMode === 'GROUPED' ? '#fff' : 'var(--text-secondary)' }}
             onClick={() => setViewMode('GROUPED')}
           >🏢 Grouped by Leads</button>
           <button 
             className={`btn btn-sm ${viewMode === 'FLAT' ? 'btn-primary' : 'btn-secondary'}`} 
             style={{ border: 'none', background: viewMode === 'FLAT' ? 'var(--accent-blue)' : 'transparent', color: viewMode === 'FLAT' ? '#fff' : 'var(--text-secondary)' }}
             onClick={() => setViewMode('FLAT')}
           >📋 All Tasks List</button>
        </div>
      </div>

      {/* Export & Date Filter Toolbar */}
      <div id="tour-export-toolbar" className="export-toolbar" style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
        background: 'var(--bg-card)', borderRadius: '12px', padding: '14px 20px', 
        border: '1px solid var(--border-subtle)', marginTop: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>📅 Periode Export:</span>
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); setLeadPage(1); }} 
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
          <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>sampai</span>
          <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); setLeadPage(1); }} 
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              style={{ background: 'var(--accent-red)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '11px', padding: '4px 10px', borderRadius: '4px', fontWeight: 600 }}
            >✕ Reset</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => handleExport('excel')} style={{ 
            padding: '8px 16px', background: 'linear-gradient(135deg, #107c41, #1a9e54)', color: '#fff', border: 'none', 
            borderRadius: '8px', fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer', 
            fontSize: '13px', boxShadow: '0 2px 6px rgba(16,124,65,0.3)', transition: 'all 0.2s'
          }}>
            📊 Export Excel
          </button>
        </div>
      </div>

      {viewMode === 'GROUPED' ? (
        <div className="leads-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <div className="table-actions" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <select className="filter-input" style={{ width: '220px' }} value={leadSortField} onChange={e => { setLeadSortField(e.target.value as any); setLeadPage(1); }}>
               <option value="createdAt">Sort by Date Added</option>
               <option value="potential_amount">Sort by Potential Amount</option>
            </select>
            <select className="filter-input" style={{ width: '220px' }} value={leadSortOrder} onChange={e => { setLeadSortOrder(e.target.value as any); setLeadPage(1); }}>
               <option value="desc">Highest / Newest First</option>
               <option value="asc">Lowest / Oldest First</option>
            </select>
            <input className="search-input" placeholder="Search leads by name or branch..." value={search} onChange={e => { setSearch(e.target.value); setLeadPage(1); }} style={{ width: '100%' }} />
          </div>
          {paginatedLeads.map(lead => {
             const isExpanded = expandedLeads.has(lead.id);
             const daysSince = lead.last_activity_at 
               ? Math.floor((new Date().getTime() - new Date(lead.last_activity_at).getTime()) / (1000 * 3600 * 24))
               : Math.floor((new Date().getTime() - new Date(lead.createdAt).getTime()) / (1000 * 3600 * 24));
             const agingColor = daysSince > 7 ? 'var(--accent-red)' : daysSince > 3 ? 'var(--accent-orange)' : 'var(--accent-green)';
             const completedCount = lead.tasks.filter((t:any) => t.status === 'COMPLETED' || t.status === 'DONE').length;
             
             return (
               <div key={lead.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `6px solid ${agingColor}` }}>
                  <div 
                    style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isExpanded ? 'var(--bg-primary)' : 'transparent' }}
                    onClick={() => {
                       const next = new Set(expandedLeads);
                       if (next.has(lead.id)) next.delete(lead.id); else next.add(lead.id);
                       setExpandedLeads(next);
                    }}
                  >
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)' }}>
                           {lead.lead_name}
                           <span className="status-badge" style={{ fontSize: '11px', background: 'var(--accent-blue-light)', color: 'var(--accent-blue)' }}>{lead.status.replace(/_/g, ' ')}</span>
                           <span className="priority-badge priority-critical" style={{ fontSize: '10px' }}>{lead.lead_type.replace(/_/g, ' ')}</span>
                           {lead.lead_category && (
                              <span className="priority-badge priority-medium" style={{ fontSize: '10px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                                 {lead.lead_category}
                              </span>
                           )}
                        </div>
                        <div style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                           <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>💰 {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(lead.potential_amount || 0)}</span>
                           <span>👤 {lead.owner?.name || 'Unassigned'}</span>
                           <span>📍 {lead.branch || 'Unknown'}</span>
                           <span style={{ color: agingColor, fontWeight: 600 }}>⏱ Aging: {daysSince} days</span>
                        </div>
                     </div>
                     
                     <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                           <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '14px' }}>{completedCount}/{lead.tasks.length}</span>
                           <span>Tasks Completed</span>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={(e) => { 
                           e.stopPropagation(); 
                           setEditingLead(lead);
                           setLeadForm({ status: lead.status, priority: lead.priority, owner_user_id: lead.owner_user_id || '', support_needed: lead.support_needed || '' });
                           setShowLeadModal(true);
                        }}>Edit CRM Lead</button>
                        <div style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', fontSize: '18px', color: 'var(--text-tertiary)' }}>▼</div>
                     </div>
                  </div>
                  
                  {isExpanded && (
                     <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '20px 24px', background: 'var(--bg-main)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                           <div>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Activity & Sub-tasks</h4>
                           </div>
                           {isAdmin && (
                             <button className="btn btn-primary btn-sm" onClick={() => {
                                setEditingTask(null);
                                setTaskForm({ title: '', description: '', priority: 'MEDIUM', status: 'OPEN', assigneeId: lead.owner_user_id || '', leadId: lead.id });
                                setShowTaskModal(true);
                             }}>+ Add Follow Up Task</button>
                           )}
                        </div>
                        <div className="table-container" style={{ borderRadius: '8px' }}>
                           <table className="data-table" style={{ background: 'var(--bg-card)', margin: 0 }}>
                              <thead style={{ background: 'var(--bg-primary)' }}>
                                 <tr><th>Task Description</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Date</th></tr>
                              </thead>
                              <tbody>
                                 {lead.tasks.map((task: any) => (
                                    <tr key={task.id}>
                                       <td>
                                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{task.title}</div>
                                          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{task.description}</div>
                                       </td>
                                       <td>
                                          <select
                                             className={`status-select select-${task.status.toLowerCase()}`}
                                             value={task.status}
                                             onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                          >
                                             <option value="OPEN">Open</option>
                                             <option value="IN_PROGRESS">In Progress</option>
                                             <option value="DONE">Done</option>
                                             <option value="CANCELLED">Cancelled</option>
                                          </select>
                                       </td>
                                       <td><span className={`priority-badge priority-${task.priority.toLowerCase()}`}>{task.priority}</span></td>
                                       <td>
                                          {isAdmin ? (
                                            <select
                                              value={task.assigneeId || ''}
                                              onChange={(e) => handleAssign(task.id, e.target.value || null)}
                                              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-secondary)', fontSize: '12px', padding: '4px 6px', cursor: 'pointer', outline: 'none' }}
                                            >
                                              <option value="">Unassigned</option>
                                              {users.filter((u: any) => u.role !== 'ADMIN').map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                            </select>
                                          ) : (
                                            <span>{task.assignee?.name || 'Unassigned'}</span>
                                          )}
                                       </td>
                                       <td style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{new Date(task.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                 ))}
                                 {lead.tasks.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>No follow-up tasks recorded yet.</td></tr>}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  )}
               </div>
             );
          })}
          {leads.length === 0 && (
             <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
                You have no Leads assigned. Please upload an Excel mapping first.
             </div>
          )}
          
          {filteredLeads.length > 0 && (
            <Pagination
              currentPage={leadPage}
              totalPages={totalLeadPages}
              onPageChange={setLeadPage}
              totalItems={filteredLeads.length}
              itemsPerPage={leadPageSize}
              itemName="leads"
            />
          )}
        </div>
      ) : (
      <div className="table-container">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="table-title">Task Manager</div>
            {selectedTaskIds.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'var(--bg-primary)', borderRadius: '20px', border: '1px solid var(--border-default)', marginLeft: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedTaskIds.size} selected:</span>
                <select 
                  style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}
                  onChange={(e) => {
                    if(e.target.value) handleBulkStatusUpdate(e.target.value);
                    e.target.value = '';
                  }}
                >
                  <option value="">Update Status...</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="BLOCKER">Blocker</option>
                  <option value="DONE">Done</option>
                </select>
                {isAdmin && (
                  <select 
                    style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}
                    onChange={(e) => {
                      if(e.target.value) handleBulkAssign(e.target.value);
                      e.target.value = '';
                    }}
                  >
                    <option value="">Assign to...</option>
                    <option value="unassigned">Unassigned</option>
                    {users.filter(u => u.role !== 'ADMIN').map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                )}
                {isAdmin && (
                  <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: '11px', background: 'transparent', color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }} onClick={() => setBulkDeleteModal(true)}>Delete All</button>
                )}
              </div>
            )}
          </div>
          <div className="table-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isAdmin && (
              <button id="tour-tasks-add" className="btn btn-primary btn-sm" onClick={() => {
                setEditingTask(null);
                setTaskForm({ title: '', description: '', priority: 'MEDIUM', status: 'OPEN', assigneeId: '', leadId: '' });
                setShowTaskModal(true);
              }}>Add Task</button>
            )}
            <input className="search-input" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="filter-row" id="tour-tasks-filter">
          <select className="filter-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>
          <select className="filter-input" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">All Priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div className="data-table-wrapper" id="tour-tasks-table">
          <table className="data-table">
            <thead>
                <tr>
                  <th id="tour-tasks-bulk" style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={paginatedTasks.length > 0 && selectedTaskIds.size === paginatedTasks.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th onClick={() => handleSort('title')} style={{ cursor: 'pointer' }}>
                    Title {sortField === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                    Status {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('priority')} style={{ cursor: 'pointer' }}>
                    Priority {sortField === 'priority' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  {isAdmin && (
                    <th onClick={() => handleSort('assignee')} style={{ cursor: 'pointer' }}>
                      Assignee {sortField === 'assignee' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  )}
                  <th onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer' }}>
                    Created {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Actions</th>
                </tr>
            </thead>
            <tbody>
              {paginatedTasks.map(task => (
                <tr key={task.id} style={{ background: selectedTaskIds.has(task.id) ? 'var(--bg-primary)' : 'transparent' }}>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedTaskIds.has(task.id)}
                      onChange={() => handleSelect(task.id)}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{task.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{task.description}</div>
                  </td>
                  <td>
                    <select
                      className={`status-select select-${task.status.toLowerCase()}`}
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </td>
                  <td><span className={`priority-badge priority-${task.priority.toLowerCase()}`}>{task.priority}</span></td>
                  {isAdmin && (
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setAssignModal({ taskId: task.id, currentAssigneeId: task.assigneeId })}>
                        {task.assignee?.name || 'Unassigned'}
                      </button>
                    </td>
                  )}
                  <td>{new Date(task.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => {
                          setEditingTask(task);
                          setTaskForm({ title: task.title, description: task.description || '', priority: task.priority, status: task.status, assigneeId: task.assigneeId || '', leadId: '' });
                          setShowTaskModal(true);
                      }}>Edit</button>}
                      {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(task.id)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={filteredTasks.length}
          itemsPerPage={pageSize}
          itemName="tasks"
        />
      </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editingTask ? 'Edit Task' : 'Add New Task'}</h2>
            <form onSubmit={handleTaskSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input className="form-input" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-input" value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                    <label>Priority</label>
                    <select className="form-select" value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Status</label>
                    <select className="form-select" value={taskForm.status} onChange={e => setTaskForm({...taskForm, status: e.target.value})}>
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="BLOCKER">Blocker</option>
                        <option value="DONE">Done</option>
                    </select>
                </div>
              </div>
              <div className="form-group">
                <label>Assignee</label>
                <select className="form-select" value={taskForm.assigneeId} onChange={e => setTaskForm({...taskForm, assigneeId: e.target.value})}>
                  <option value="">Unassigned</option>
                  {users.filter(u => u.role !== 'ADMIN').map(u => <option key={u.id} value={u.id}>{u.name} (NIP: {u.nip})</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Update Modal */}
      {showLeadModal && editingLead && (
         <div className="modal-overlay" onClick={() => setShowLeadModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
               <h2 className="modal-title">Update Lead Status</h2>
               <form onSubmit={handleLeadUpdate}>
                  <div className="form-group">
                     <label>Lead Status</label>
                     <select className="form-select" value={leadForm.status} onChange={e => setLeadForm({...leadForm, status: e.target.value})}>
                        <option value="NEW">New</option>
                        <option value="READY_TO_FOLLOW_UP">Ready to Follow Up</option>
                        <option value="CONTACTED">Contacted</option>
                        <option value="IN_DISCUSSION">In Discussion</option>
                        <option value="WAITING_CUSTOMER">Waiting Customer</option>
                        <option value="NEED_SUPPORT">Need Support</option>
                        <option value="WON">Won (Deal)</option>
                        <option value="LOST">Lost / Failed</option>
                        <option value="DORMANT">Dormant</option>
                     </select>
                  </div>
                  <div className="form-group">
                     <label>Priority / Escaping Constraint</label>
                     <select className="form-select" value={leadForm.priority} onChange={e => setLeadForm({...leadForm, priority: e.target.value})}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                     </select>
                  </div>
                  {isAdmin && (
                     <div className="form-group">
                        <label>Reassign Owner PIC</label>
                        <select className="form-select" value={leadForm.owner_user_id} onChange={e => setLeadForm({...leadForm, owner_user_id: e.target.value})}>
                           <option value="unassigned">Unassigned</option>
                           {users.filter(u => u.role !== 'ADMIN').map(u => <option key={u.id} value={u.id}>{u.name} (NIP: {u.nip})</option>)}
                        </select>
                     </div>
                  )}
                  <div className="form-group">
                     <label>Support / Help Needed</label>
                     <textarea className="form-input" placeholder="Explain if you need specific help from the branch manager or HQ..." value={leadForm.support_needed} onChange={e => setLeadForm({...leadForm, support_needed: e.target.value})} />
                  </div>
                  <div className="modal-actions">
                     <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowLeadModal(false)}>Cancel</button>
                     <button type="submit" className="btn btn-primary btn-sm">Save Lead</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Assign Task</h2>
            <div className="form-group">
            <select
              className="filter-input"
              style={{ width: '100%', padding: '10px' }}
              value={assignModal.currentAssigneeId || ''}
              onChange={(e) => setAssignModal({ ...assignModal, currentAssigneeId: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {users.filter(u => u.role !== 'ADMIN').map(u => (
                <option key={u.id} value={u.id}>{u.name} (NIP: {u.nip})</option>
              ))}
            </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setAssignModal(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={() => handleAssign(assignModal.taskId, assignModal.currentAssigneeId)}>Assign</button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', color: 'var(--accent-red)', marginBottom: '16px' }}>⚠️</div>
            <h2 className="modal-title">Delete Task</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Are you sure you want to delete this task? This action cannot be undone.</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Delete Modal */}
      {bulkDeleteModal && (
        <div className="modal-overlay" onClick={() => setBulkDeleteModal(false)}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', color: 'var(--accent-red)', marginBottom: '16px' }}>⚠️</div>
            <h2 className="modal-title">Hapus Massal</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Are you sure you want to delete <strong>{selectedTaskIds.size} tasks</strong> simultaneously? This action cannot be undone.</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setBulkDeleteModal(false)} disabled={loading}>Cancel</button>
              <button className="btn btn-danger" onClick={handleBulkDelete} disabled={loading}>{loading ? 'Deleting...' : 'Delete All Permanently'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="loading-spinner" />}>
      <TasksPageContent />
    </Suspense>
  );
}
