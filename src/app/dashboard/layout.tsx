'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  nip: string;
  role: string;
  name: string;
  can_access_monitoring: boolean;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  referenceId?: string;
  isRead: boolean;
  createdAt: string;
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
  logout: async () => { }
});

export const useAuth = () => useContext(AuthContext);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [monitoringOpen, setMonitoringOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hiddenNotifications, setHiddenNotifications] = useState<Set<string>>(new Set());
  const [showNotifications, setShowNotifications] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname.startsWith('/dashboard/monitoring')) {
      setMonitoringOpen(true);
    }
  }, [pathname]);

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

  const fetchNotifications = async () => {
    try {
      const r = await fetch('/api/notifications');
      const data = await r.json();
      if (data.notifications) setNotifications(data.notifications);
    } catch (e) {
      console.error('Failed to fetch notifications');
    }
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [user]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
    setShowNotifications(false);
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

  const visibleNotifications = notifications.filter(n => !hiddenNotifications.has(n.id));

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, logout }}>
      <InactivityTracker timeoutMinutes={1} />
      <div className="dashboard-layout">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
          {sidebarOpen ? '✕' : '☰'}
        </button>
        {sidebarOpen && <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />}
        <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '15px' }}>
            <div className="sidebar-logo">TheLeads</div>
            {isAdmin && (
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', position: 'relative', padding: '5px' }}
                >
                  🔔
                  {visibleNotifications.some(n => !n.isRead) && (
                    <span style={{ position: 'absolute', top: '0', right: '0', background: 'var(--accent-red)', borderRadius: '50%', width: '10px', height: '10px', display: 'block' }}></span>
                  )}
                </button>
                {showNotifications && (
                  <div className="card" style={{ position: 'absolute', top: '35px', left: '0', width: '250px', zIndex: 100, maxHeight: '300px', overflowY: 'auto', padding: '10px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px', paddingBottom: '5px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Notifications</span>
                      {visibleNotifications.length > 0 && (
                        <button 
                          onClick={() => {
                            setHiddenNotifications(new Set([...hiddenNotifications, ...visibleNotifications.map(n => n.id)]));
                          }} 
                          style={{ background: 'none', border: 'none', fontSize: '10px', color: 'var(--accent-blue)', cursor: 'pointer' }}
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    {visibleNotifications.length === 0 ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '10px' }}>No notifications</div>
                    ) : (
                      visibleNotifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={async () => {
                            await fetch('/api/notifications', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: n.id, isRead: true })
                            });
                            setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, isRead: true } : notif));
                            if (n.type === 'GMM_ENTRY') router.push('/dashboard/monitoring');
                            if (n.type === 'TASK_DONE') {
                              const titleSplit = n.message.split('DONE: ');
                              if (titleSplit.length > 1) {
                                router.push(`/dashboard/tasks?search=${encodeURIComponent(titleSplit[1].trim())}&status=DONE`);
                              } else {
                                router.push('/dashboard/tasks?status=DONE');
                              }
                            }
                            setShowNotifications(false);
                          }}
                          style={{ padding: '8px', fontSize: '11px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', background: n.isRead ? 'transparent' : 'rgba(25, 118, 210, 0.05)', borderRadius: '4px', marginBottom: '4px' }}
                        >
                          {n.message}
                          <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{new Date(n.createdAt).toLocaleTimeString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="sidebar-subtitle">{isAdmin ? 'Admin Panel' : 'User Panel'}</div>
          <nav className="sidebar-nav">
            <Link href="/dashboard/dashboard" className={`sidebar-link ${pathname === '/dashboard/dashboard' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <span className="icon">📊</span> Dashboard
            </Link>
            <Link href="/dashboard/tasks" className={`sidebar-link ${pathname === '/dashboard/tasks' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <span className="icon">📋</span> Tasks
            </Link>
            {isAdmin && (
              <Link href="/dashboard/upload" className={`sidebar-link ${pathname === '/dashboard/upload' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <span className="icon">📂</span> Upload Files
              </Link>
            )}
            
            {!isAdmin && (
              <Link href="/dashboard/monitoring" className={`sidebar-link ${pathname === '/dashboard/monitoring' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <span className="icon">📈</span> GMM
              </Link>
            )}

            {isAdmin && (
              <div className="sidebar-dropdown-wrapper">
                <button 
                  className={`sidebar-link ${pathname.startsWith('/dashboard/monitoring') ? 'active' : ''}`} 
                  onClick={() => setMonitoringOpen(!monitoringOpen)}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="icon">📊</span> Monitoring
                  </div>
                  <span style={{ fontSize: '10px', transform: monitoringOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>▼</span>
                </button>
                {monitoringOpen && (
                  <div className="sidebar-submenu" style={{ paddingLeft: '40px' }}>
                    <Link href="/dashboard/monitoring" className={`sidebar-link ${pathname === '/dashboard/monitoring' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                      GMM
                    </Link>
                  </div>
                )}
              </div>
            )}

            {isAdmin && (
              <>
                <div className="sidebar-group-label" style={{ padding: '12px 16px 4px', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Administration</div>
                <Link href="/dashboard/users" className={`sidebar-link ${pathname === '/dashboard/users' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="icon">👥</span> Users
                </Link>
              </>
            )}
            <Link href="/dashboard/game" className={`sidebar-link ${pathname === '/dashboard/game' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <span className="icon">🎮</span> Mini Game
            </Link>
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
  const pathname = usePathname();

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log('User inactive for', timeoutMinutes, 'minutes. Logging out...');
        logout();
      }, timeoutMinutes * 60 * 1000);
    };

    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.user) {
          console.log('Session invalidated by another login. Logging out...');
          logout();
        }
      } catch (err) {
        console.error('Session check failed:', err);
      }
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
