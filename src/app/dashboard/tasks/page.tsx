'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const initialStatus = searchParams.get('status') || 'ALL';
  const initialSearch = searchParams.get('search') || '';

  const [globalFilter, setGlobalFilter] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setStatusFilter(s);
    const q = searchParams.get('search');
    if (q) setGlobalFilter(q);
  }, [searchParams]);
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', assigneeId: '' });
  const [assignModal, setAssignModal] = useState<{ taskId: string; currentAssigneeId: string | null } | null>(null);

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

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
        if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
        if (globalFilter) {
          const q = globalFilter.toLowerCase();
          return t.title.toLowerCase().includes(q) || (t.assignee?.name || '').toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        const key = sortConfig.key as keyof Task;
        const aVal = (a[key] || '') as string;
        const bVal = (b[key] || '') as string;
        return sortConfig.direction === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
      });
  }, [tasks, statusFilter, priorityFilter, globalFilter, sortConfig]);

  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredTasks.length / pageSize);

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

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' });
    fetchData();
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
          <div className="table-title">Task Manager</div>
          <div className="table-actions">
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => {
                setEditingTask(null);
                setTaskForm({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', assigneeId: '' });
                setShowTaskModal(true);
              }}>Add Task</button>
            )}
            <input className="search-input" placeholder="Search tasks..." value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} />
          </div>
        </div>

        <div className="filter-row">
          <select className="filter-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKER">Blocker</option>
            <option value="DONE">Done</option>
          </select>
          <select className="filter-input" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="ALL">All Priority</option>
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
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                {isAdmin && <th>Assignee</th>}
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTasks.map(task => (
                <tr key={task.id}>
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
                      {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(task.id)}>Delete</button>}
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
                  Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filteredTasks.length)}</strong> of <strong>{filteredTasks.length}</strong> tasks
                </div>
                <div className="pagination-numbers">
                  <button className="pagination-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    &laquo; Prev
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      className={`pagination-btn ${currentPage === i + 1 ? 'active' : ''}`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button className="pagination-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    Next &raquo;
                  </button>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} (NIP: {u.nip})</option>)}
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
