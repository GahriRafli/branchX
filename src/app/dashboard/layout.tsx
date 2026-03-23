'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
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

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: ToastType;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
  showToast: (title: string, message: string, type?: ToastType) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  logout: async () => { },
  showToast: () => { }
});

export const useAuth = () => useContext(AuthContext);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((title: string, message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);
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

  const visibleNotifications = notifications.filter(n => !hiddenNotifications.has(n.id) && !n.isRead);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, logout, showToast }}>
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
                    <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: 'var(--accent-red)', color: 'white', fontSize: '9px', fontWeight: 'bold', minWidth: '16px', height: '16px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                      {visibleNotifications.filter(n => !n.isRead).length}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="card" style={{ position: 'absolute', top: '40px', left: '0', width: '280px', zIndex: 100, maxHeight: '350px', overflowY: 'auto', padding: '12px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)' }}>
                      <span>Notifikasi Terbaru</span>
                      {visibleNotifications.length > 0 && (
                        <button 
                          onClick={async () => {
                            const unreadIds = visibleNotifications.map(n => n.id);
                            setHiddenNotifications(new Set([...hiddenNotifications, ...unreadIds]));
                            try {
                              await fetch('/api/notifications', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ markAllAsRead: true })
                              });
                            } catch (e) {
                              console.error('Failed to mark all as read', e);
                            }
                          }} 
                          style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    {visibleNotifications.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 10px' }}>Tidak ada notifikasi</div>
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
                          style={{ 
                            padding: '10px 10px 10px 24px', 
                            fontSize: '12px', 
                            cursor: 'pointer', 
                            borderBottom: '1px solid var(--border-subtle)', 
                            background: n.isRead ? 'transparent' : 'var(--accent-blue-light)', 
                            borderRadius: '6px', 
                            marginBottom: '6px',
                            color: n.isRead ? 'var(--text-secondary)' : 'var(--text-primary)',
                            fontWeight: n.isRead ? 400 : 500,
                            position: 'relative',
                            transition: 'var(--transition-fast)'
                          }}
                        >
                          {!n.isRead && (
                            <span style={{ position: 'absolute', left: '8px', top: '15px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-blue)' }} />
                          )}
                          <div style={{ lineHeight: '1.4' }}>{n.message}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px', fontWeight: 400 }}>{new Date(n.createdAt).toLocaleString()}</div>
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
            {/* <Link href="/dashboard/game" className={`sidebar-link ${pathname === '/dashboard/game' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <span className="icon">🎮</span> Mini Game
            </Link> */}
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
      
      <div className="toast-container">
        {toasts.map(toast => {
          const icons = {
            success: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
            error: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>,
            warning: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
            info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          };

          return (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              <div className="toast-icon">{icons[toast.type]}</div>
              <div className="toast-content">
                <div className="toast-title">{toast.title}</div>
                <div className="toast-message">{toast.message}</div>
              </div>
              <button className="toast-close" onClick={() => removeToast(toast.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          );
        })}
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
