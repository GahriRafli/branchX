'use client';

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
  const { user, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sync filters with URL
  const initialStatus = searchParams.get('status') || '';
  const initialSearch = searchParams.get('search') || '';

  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Sorting states
  const [sortField, setSortField] = useState<'title' | 'status' | 'priority' | 'assignee' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', assigneeId: '' });
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
    const [tasksRes, usersRes] = await Promise.all([
      fetch('/api/tasks'),
      isAdmin ? fetch('/api/users') : Promise.resolve({ json: () => ({ users: [] }) })
    ]);
    const tasksData = await tasksRes.json();
    const usersData = await usersRes.json();
    if (tasksData.tasks) setTasks(tasksData.tasks);
    if (usersData.users) setUsers(usersData.users);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter and Sort logic
  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const matchStatus = !statusFilter || t.status === statusFilter;
        const matchPriority = !priorityFilter || t.priority === priorityFilter;
        const matchSearch = !search || 
          t.title.toLowerCase().includes(search.toLowerCase()) || 
          t.description.toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchPriority && matchSearch;
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

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getPaginationGroup = () => {
    let start = Math.max(page - 2, 1);
    let end = Math.min(start + 4, totalPages);
    if (end - start < 4) start = Math.max(end - 4, 1);
    
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status: newStatus }),
    });
    fetchData();
  };

  const handleAssign = async (taskId: string, assigneeId: string | null) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, assigneeId }),
    });
    setAssignModal(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;
    await fetch(`/api/tasks?id=${showDeleteModal}`, { method: 'DELETE' });
    setShowDeleteModal(null);
    fetchData();
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
    await Promise.all(Array.from(selectedTaskIds).map(id =>
      fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
    ));
    setSelectedTaskIds(new Set());
    setBulkDeleteModal(false);
    fetchData();
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (!newStatus) return;
    setLoading(true);
    await Promise.all(Array.from(selectedTaskIds).map(id =>
      fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
    ));
    setSelectedTaskIds(new Set());
    fetchData();
  };

  const handleBulkAssign = async (assigneeId: string) => {
    if (!assigneeId) return;
    const payloadAssigneeId = assigneeId === 'unassigned' ? null : assigneeId;
    setLoading(true);
    await Promise.all(Array.from(selectedTaskIds).map(id =>
      fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, assigneeId: payloadAssigneeId }),
      })
    ));
    setSelectedTaskIds(new Set());
    fetchData();
  };

  const handleExport = (format: 'excel' | 'csv') => {
    const dataToExport = filteredTasks.map(t => ({
      Title: t.title,
      Description: t.description,
      Status: t.status,
      Priority: t.priority,
      Assignee: t.assignee?.name || 'Unassigned',
      'Created At': new Date(t.createdAt).toLocaleString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

    if (format === 'excel') {
      XLSX.writeFile(workbook, `tasks_export_${new Date().getTime()}.xlsx`);
    } else {
      XLSX.writeFile(workbook, `tasks_export_${new Date().getTime()}.csv`, { bookType: 'csv' });
    }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingTask ? 'PATCH' : 'POST';
    const body: any = { ...taskForm };
    if (editingTask) body.id = editingTask.id;
    if (body.assigneeId === '') body.assigneeId = null;

    const res = await fetch('/api/tasks', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowTaskModal(false);
      fetchData();
    }
  };

  if (loading) return <div className="loading-spinner" />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAdmin ? 'All Tasks' : 'My Tasks'}</h1>
          <p className="page-subtitle">{filteredTasks.length} tasks found</p>
        </div>
      </div>

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
            <button className="btn btn-excel btn-sm" onClick={() => handleExport('excel')}>
              <span>📊</span> Export Excel
            </button>
            <button className="btn btn-csv btn-sm" onClick={() => handleExport('csv')}>
              <span>📄</span> Export CSV
            </button>
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => {
                setEditingTask(null);
                setTaskForm({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', assigneeId: '' });
                setShowTaskModal(true);
              }}>Add Task</button>
            )}
            <input className="search-input" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="filter-row">
          <select className="filter-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKER">Blocker</option>
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

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
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
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="BLOCKER">Blocker</option>
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
                          setTaskForm({ title: task.title, description: task.description || '', priority: task.priority, status: task.status, assigneeId: task.assigneeId || '' });
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
        
        {totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Showing <strong>{(page-1)*pageSize + 1}</strong> to <strong>{Math.min(page*pageSize, filteredTasks.length)}</strong> of <strong>{filteredTasks.length}</strong> tasks
              </div>
              <div className="pagination-numbers">
                <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(1)}>First</button>
                <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>&laquo; Prev</button>
                
                {page > 3 && totalPages > 5 && <span className="pagination-ellipsis">...</span>}
                
                {getPaginationGroup().map(item => (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`pagination-btn ${page === item ? 'active' : ''}`}
                  >
                    {item}
                  </button>
                ))}

                {page < totalPages - 2 && totalPages > 5 && <span className="pagination-ellipsis">...</span>}

                <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next &raquo;</button>
                <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Last</button>
              </div>
            </div>
        )}
      </div>

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
