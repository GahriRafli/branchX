'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  nip: string;
  role: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false });

export const useAuth = () => useContext(AuthContext);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.push('/');
        } else {
          setUser(data.user);
          setLoading(false);
        }
      })
      .catch(() => router.push('/'));
  }, [router]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>Loading TheLeads...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin }}>
      <div className="dashboard-layout">
        {/* Mobile menu button */}
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? '✕' : '☰'}
        </button>

        {/* Sidebar Overlay */}
        <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-logo">TheLeads</div>
          <div className="sidebar-subtitle">{isAdmin ? 'Admin Panel' : 'User Panel'}</div>

          <nav className="sidebar-nav">
            <Link
              href="/dashboard/dashboard"
              className={`sidebar-link ${pathname === '/dashboard/dashboard' ? 'active' : ''}`}
            >
              <span className="icon">📊</span> Dashboard
            </Link>
            <Link
              href="/dashboard/tasks"
              className={`sidebar-link ${pathname === '/dashboard/tasks' ? 'active' : ''}`}
            >
              <span className="icon">📋</span> Tasks
            </Link>
            {isAdmin && (
              <>
                <Link
                  href="/dashboard/upload"
                  className={`sidebar-link ${pathname === '/dashboard/upload' ? 'active' : ''}`}
                >
                  <span className="icon">📁</span> Upload Files
                </Link>
                <Link
                  href="/dashboard/users"
                  className={`sidebar-link ${pathname === '/dashboard/users' ? 'active' : ''}`}
                >
                  <span className="icon">👥</span> Users
                </Link>
              </>
            )}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar">{user?.name?.[0]?.toUpperCase()}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user?.name}</div>
                <div className="sidebar-user-role">{user?.role} (NIP: {user?.nip})</div>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout} style={{ width: '100%', marginTop: '12px' }}>
              Sign Out
            </button>
          </div>
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </AuthContext.Provider>
  );
}
