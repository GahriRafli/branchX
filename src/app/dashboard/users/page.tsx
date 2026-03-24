'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../layout';
import { useRouter } from 'next/navigation';

interface UserListItem {
  id: string;
  name: string;
  nip: string;
  role: string;
  can_access_monitoring: boolean;
}

export default function UsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [userForm, setUserForm] = useState({ name: '', nip: '', password: '', role: 'USER', can_access_monitoring: false });
  const [error, setError] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    if (data.users) setUsers(data.users);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/dashboard/dashboard');
      return;
    }
    fetchUsers();
  }, [isAdmin, router, fetchUsers]);

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const method = editingUser ? 'PATCH' : 'POST';
    const body: any = { ...userForm };
    if (editingUser) {
      body.id = editingUser.id;
      if (!body.password) delete body.password;
    }

    const res = await fetch('/api/users', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to save user');
    } else {
      setShowUserModal(false);
      fetchUsers();
    }
  };

  const handleDeleteUser = async () => {
    if (!showDeleteModal) return;
    if (showDeleteModal === currentUser?.id) {
      alert('You cannot delete yourself');
      setShowDeleteModal(null);
      return;
    }
    await fetch(`/api/users?id=${showDeleteModal}`, { method: 'DELETE' });
    setShowDeleteModal(null);
    fetchUsers();
  };

  if (!isAdmin) return null;
  if (loading) return <div className="loading-spinner" />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Members</h1>
          <p className="page-subtitle">{users.length} registered users</p>
        </div>
        <button id="tour-users-add" className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={() => {
          setEditingUser(null);
          setUserForm({ name: '', nip: '', password: '', role: 'USER', can_access_monitoring: false });
          setShowUserModal(true);
        }}>Add User</button>
      </div>

      <div className="table-container" id="tour-users-table">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>NIP</th><th>Role</th><th>Monitoring</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td>{u.nip}</td>
                <td><span className={`status-badge ${u.role === 'ADMIN' ? 'status-in-progress' : 'status-todo'}`}>{u.role}</span></td>
                <td>
                  <span className={`status-badge ${u.can_access_monitoring || u.role === 'ADMIN' ? 'status-done' : 'status-blocker'}`}>
                    {u.can_access_monitoring || u.role === 'ADMIN' ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                        setEditingUser(u);
                        setUserForm({ name: u.name, nip: u.nip, role: u.role, password: '', can_access_monitoring: u.can_access_monitoring });
                        setShowUserModal(true);
                    }}>Edit</button>
                    {u.id !== currentUser?.id && <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(u.id)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editingUser ? 'Edit User' : 'Add New User'}</h2>
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={handleUserSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <input className="form-input" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>NIP</label>
                <input className="form-input" inputMode="numeric" pattern="[0-9]*" value={userForm.nip} onChange={e => setUserForm({...userForm, nip: e.target.value.replace(/\D/g, '')})} required />
              </div>
              <div className="form-group">
                <label>Password {editingUser && '(Leave blank to keep current)'}</label>
                <input className="form-input" type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} required={!editingUser} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select className="form-select" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  id="can_access_monitoring"
                  checked={userForm.can_access_monitoring} 
                  onChange={e => setUserForm({...userForm, can_access_monitoring: e.target.checked})} 
                />
                <label htmlFor="can_access_monitoring" style={{ marginBottom: 0 }}>Akses Menu Monitoring</label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowUserModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', color: 'var(--accent-red)', marginBottom: '16px' }}>⚠️</div>
            <h2 className="modal-title">Delete User</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Are you sure you want to delete this user? This action cannot be undone.</p>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteUser}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
