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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  isAdmin: false,
  logout: async () => {} 
});

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

  const logout = async () => {
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

  if (!user) return null;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, logout }}>
      <InactivityTracker timeoutMinutes={1} />
      <div className="dashboard-layout">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
          {sidebarOpen ? '✕' : '☰'}
        </button>
        {sidebarOpen && <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />}
        <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-logo">TheLeads</div>
          <div className="sidebar-subtitle">{isAdmin ? 'Admin Panel' : 'User Panel'}</div>
          <nav className="sidebar-nav">
            <Link href="/dashboard/dashboard" className={`sidebar-link ${pathname === '/dashboard/dashboard' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <span className="icon">📊</span> Dashboard
            </Link>
            <Link href="/dashboard/tasks" className={`sidebar-link ${pathname === '/dashboard/tasks' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <span className="icon">📋</span> Tasks
            </Link>
            {isAdmin && (
              <>
                <Link href="/dashboard/upload" className={`sidebar-link ${pathname === '/dashboard/upload' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="icon">📁</span> Upload Files
                </Link>
                <Link href="/dashboard/users" className={`sidebar-link ${pathname === '/dashboard/users' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="icon">👥</span> Users
                </Link>
              </>
            )}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar">{user.name.charAt(0)}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name}</div>
                <div className="sidebar-user-role">{user.role} (NIP: {user.nip})</div>
              </div>
            </div>
            <button onClick={logout} className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '12px' }}>Sign Out</button>
          </div>
        </aside>
        <main className="main-content">{children}</main>
      </div>
    </AuthContext.Provider>
  );
}

function InactivityTracker({ timeoutMinutes }: { timeoutMinutes: number }) {
  const { logout } = useAuth();
  
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log('User inactive for', timeoutMinutes, 'minutes. Logging out...');
        logout();
      }, timeoutMinutes * 60 * 1000);
    };

    // Events to track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    resetTimer(); // Start the timer initially

    return () => {
      clearTimeout(timeout);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [logout, timeoutMinutes]);

  return null;
}
