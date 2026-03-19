'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../layout';
import { useRouter } from 'next/navigation';

interface UserListItem {
  id: string;
  name: string;
  nip: string;
  role: string;
}

export default function UsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [userForm, setUserForm] = useState({ name: '', nip: '', password: '', role: 'USER' });
  const [error, setError] = useState('');

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

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) return alert('You cannot delete yourself');
    if (!confirm('Are you sure?')) return;
    await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
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
        <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={() => {
          setEditingUser(null);
          setUserForm({ name: '', nip: '', password: '', role: 'USER' });
          setShowUserModal(true);
        }}>Add User</button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>NIP</th><th>Role</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td>{u.nip}</td>
                <td><span className={`status-badge ${u.role === 'ADMIN' ? 'status-in-progress' : 'status-todo'}`}>{u.role}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                        setEditingUser(u);
                        setUserForm({ name: u.name, nip: u.nip, role: u.role, password: '' });
                        setShowUserModal(true);
                    }}>Edit</button>
                    {u.id !== currentUser?.id && <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id)}>Delete</button>}
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
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowUserModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
