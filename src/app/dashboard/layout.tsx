'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

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

  const visibleNotifications = notifications.filter(n => !hiddenNotifications.has(n.id));
  const unreadCount = visibleNotifications.filter(n => !n.isRead).length;

  const startTour = () => {
    let steps: any[] = [];

    if (pathname === '/dashboard/dashboard') {
      steps = isAdmin ? [
        { element: '#tour-dash-stats', popover: { title: 'Rangkuman Metrik', description: 'Lihat jumlah tugas, anggota tim, dan berbagai status pencapaian secara ringkas di sini.' } },
        { element: '#tour-dash-chart', popover: { title: 'Distribusi Tugas', description: 'Grafik ini memvisualisasikan proporsi setiap status pekerjaan tim Anda secara real-time.' } }
      ] : [
        { element: '#tour-dash-stats', popover: { title: 'Rangkuman Pribadi', description: 'Pantau jumlah dan status tugas Anda di sini.' } },
        { element: '#tour-dash-recent', popover: { title: 'Tugas Terbaru', description: 'Daftar tugas yang baru saja Anda terima. Anda bisa langsung mengubah statusnya di sini.' } }
      ];
    } else if (pathname === '/dashboard/tasks') {
      steps = isAdmin ? [
        { popover: { title: '📋 Halaman CRM Framework', description: 'Ini adalah pusat manajemen pipeline leads dan follow-up tasks Anda. Mari kita pahami setiap fiturnya!', side: 'bottom' as const } },
        { element: '#tour-view-toggle', popover: { title: '🔄 Mode Tampilan', description: '2 mode tersedia:\n\n• **Grouped by Leads** — Menampilkan pipeline per nasabah beserta task follow-up-nya.\n• **All Tasks List** — Menampilkan semua tugas dalam satu tabel datar.', side: 'bottom' as const } },
        { element: '#tour-export-toolbar', popover: { title: '📊 Export & Periode', description: 'Pilih rentang tanggal untuk memfilter data, lalu klik **Export Excel** untuk mengunduh data leads beserta potensi nominalnya.', side: 'bottom' as const } },
        { popover: { title: '🏢 Tab: Grouped by Leads', description: 'Dalam mode ini, setiap nasabah ditampilkan sebagai kartu lead yang bisa di-expand. Anda dapat melihat:\n\n• 💰 Potensi Nominal\n• 📍 Cabang\n• ⏱ Aging (usia lead)\n• Status pipeline (WON/LOST/READY)', side: 'bottom' as const } },
        { popover: { title: '👤 Assign Karyawan', description: 'Klik kartu lead untuk expand, lalu pada tabel **Activity & Sub-tasks**, klik dropdown di kolom **Assignee** untuk menugaskan task ke karyawan tertentu.', side: 'bottom' as const } },
        { popover: { title: '📝 Tab: All Tasks List', description: 'Mode ini menampilkan seluruh tugas dalam satu tabel. Berguna untuk:\n\n• Melihat semua tugas sekaligus\n• Filter berdasarkan status\n• Bulk actions (pilih banyak, ubah status serentak)', side: 'bottom' as const } },
        { element: '#tour-notifications', popover: { title: '🔔 Notifikasi', description: 'Klik lonceng untuk melihat notifikasi terbaru. Klik pada notifikasi akan langsung mengarahkan Anda ke halaman dan data terkait.', side: 'right' as const } }
      ] : [
        { popover: { title: '📋 Tugas Follow-Up Anda', description: 'Halaman ini berisi semua tugas follow-up yang telah didelegasikan Admin kepada Anda.' } },
        { element: '#tour-view-toggle', popover: { title: '🔄 Mode Tampilan', description: 'Pilih **Grouped by Leads** untuk melihat per nasabah, atau **All Tasks List** untuk melihat semua tugas.', side: 'bottom' as const } },
        { element: '.status-select', popover: { title: '✅ Ubah Status', description: 'Jangan lupa ubah status tugas menjadi **DONE** apabila sudah selesai dikerjakan! Admin akan mendapat notifikasi otomatis.', side: 'bottom' as const } }
      ];
    } else if (pathname === '/dashboard/monitoring') {
      steps = isAdmin ? [
        { element: '#tour-gmm-chart', popover: { title: 'Grafik Pencapaian', description: 'Pantau performa GMM seluruh anggota tim beserta targetnya di sini.' } },
        { element: '#tour-gmm-stats', popover: { title: 'Total Pencapaian', description: 'Kalkulasi total secara serentak dari seluruh data.' } },
        { element: '#tour-gmm-bulk', popover: { title: 'Verifikasi Massal', description: 'Gunakan tombol pintar ini untuk Verifikasi atau Reject banyak data GMM secara sekaligus dengan satu klik.' } }
      ] : [
        { element: '#tour-gmm-chart', popover: { title: 'Grafik GMM Pribadi', description: 'Lihat perbandingan antara pencapaian GMM Anda dan Target yang ditetapkan.' } },
        { element: '#tour-gmm-add', popover: { title: 'Lapor Data GMM', description: 'Klik tombol ini untuk men-submit data pencapaian baru agar bisa diverifikasi Admin.' } },
        { element: '#tour-gmm-table', popover: { title: 'Riwayat GMM', description: 'Pantau apakah data yang Anda masukkan sudah diverifikasi (Verified) atau ditolak (Rejected).' } }
      ];
    } else if (pathname === '/dashboard/upload') {
      steps = [
        { element: '#tour-upload-zone', popover: { title: 'Area Upload', description: 'Tarik dan lepas (drag & drop) file Excel/CSV Anda di area ini, atau klik untuk memilih file dari komputer.' } },
        { element: '#tour-upload-history', popover: { title: 'Riwayat Upload', description: 'Lihat daftar file yang pernah Anda upload sebelumnya. Anda juga bisa langsung menuju halaman Tasks dari sini.' } }
      ];
    } else if (pathname === '/dashboard/users') {
      steps = [
        { element: '#tour-users-add', popover: { title: 'Tambah Staff Baru', description: 'Berikan akses kepada anggota tim baru melalui tombol ini.' } },
        { element: '#tour-users-table', popover: { title: 'Manajemen Akun', description: 'Ubah peran (User / Admin) atau akses spesifik GMM Monitoring staf.' } }
      ];
    } else {
      steps = [
        { element: '#tour-dashboard', popover: { title: 'Selamat Datang', description: 'Pilih salah satu menu di bilah navigasi kiri ini untuk memulai (misalnya klik menu Tasks). Lalu klik "Panduan Halaman" lagi di halaman tersebut untuk mempelajari detailnya.' } }
      ];
    }

    const tourDriver = driver({ showProgress: true, steps });
    tourDriver.drive();
  };

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
            <div style={{ display: 'flex', gap: '10px' }}>
              {isAdmin && (
                <div style={{ position: 'relative' }} id="tour-notifications">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', position: 'relative', padding: '5px' }}
                  >
                    🔔
                    {unreadCount > 0 && (
                      <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: 'var(--accent-red)', color: 'white', fontSize: '9px', fontWeight: 'bold', minWidth: '16px', height: '16px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <div className="card notification-dropdown" style={{ position: 'absolute', top: '40px', left: '0', width: '300px', zIndex: 100, maxHeight: '400px', overflowY: 'auto', padding: '0', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)', borderRadius: '12px' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', padding: '14px 16px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)' }}>
                        <span>🔔 Notifikasi</span>
                        {visibleNotifications.length > 0 && (
                          <button
                            onClick={() => {
                              const allIds = visibleNotifications.map(n => n.id);
                              setHiddenNotifications(new Set([...hiddenNotifications, ...allIds]));
                            }}
                            style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--accent-red)', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      <div style={{ padding: '8px' }}>
                        {visibleNotifications.length === 0 ? (
                          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 10px' }}>
                            <div style={{ fontSize: '28px', marginBottom: '8px' }}>📭</div>
                            Tidak ada notifikasi baru
                          </div>
                        ) : (
                          visibleNotifications.map(n => {
                            const icon = n.type === 'TASK_DONE' ? '✅' : n.type === 'GMM_ENTRY' ? '📊' : '📋';
                            return (
                              <div
                                key={n.id}
                                onClick={async () => {
                                  if (!n.isRead) {
                                    await fetch('/api/notifications', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: n.id, isRead: true })
                                    });
                                    setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, isRead: true } : notif));
                                  }
                                  setShowNotifications(false);
                                  if (n.type === 'GMM_ENTRY') {
                                    router.push('/dashboard/monitoring');
                                  } else {
                                    // Extract customer name: new format "untuk CUSTOMER_NAME: task"
                                    const customerMatch = n.message.match(/untuk\s+([^:]+):/i);
                                    let searchName = customerMatch ? customerMatch[1].trim() : '';
                                    // If no customer name in message, try to look up via referenceId (task ID)
                                    if (!searchName && n.referenceId) {
                                      try {
                                        const res = await fetch(`/api/tasks/lead-name?taskId=${n.referenceId}`);
                                        const data = await res.json();
                                        if (data.customerName) searchName = data.customerName;
                                      } catch { /* fallback: navigate without search */ }
                                    }
                                    router.push(`/dashboard/tasks${searchName ? `?search=${encodeURIComponent(searchName)}` : ''}`);
                                  }
                                }}
                                style={{
                                  padding: '10px 12px',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  background: n.isRead ? 'transparent' : 'var(--accent-blue-light)',
                                  borderRadius: '8px',
                                  marginBottom: '4px',
                                  color: n.isRead ? 'var(--text-secondary)' : 'var(--text-primary)',
                                  fontWeight: n.isRead ? 400 : 500,
                                  display: 'flex',
                                  gap: '10px',
                                  alignItems: 'flex-start',
                                  transition: 'background 0.15s'
                                }}
                              >
                                <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ lineHeight: '1.4', wordBreak: 'break-word' }}>{n.message}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', fontWeight: 400 }}>{new Date(n.createdAt).toLocaleString('id-ID')}</div>
                                </div>
                                {!n.isRead && (
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-blue)', flexShrink: 0, marginTop: '6px' }} />
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                  )}
                </div>
              )}
            </div>
          </div>
          <div className="sidebar-subtitle">{isAdmin ? 'Admin Panel' : 'User Panel'}</div>
          <nav className="sidebar-nav">
            <Link href="/dashboard/dashboard" id="tour-dashboard" className={`sidebar-link ${pathname === '/dashboard/dashboard' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <span className="icon">📊</span> Dashboard
            </Link>
            <Link href="/dashboard/tasks" id="tour-tasks" className={`sidebar-link ${pathname === '/dashboard/tasks' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <span className="icon">📋</span> Tasks
            </Link>
            {isAdmin && (
              <Link href="/dashboard/upload" id="tour-upload" className={`sidebar-link ${pathname === '/dashboard/upload' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <span className="icon">📂</span> Upload Files
              </Link>
            )}

            {!isAdmin && (
              <Link href="/dashboard/monitoring" id="tour-monitoring" className={`sidebar-link ${pathname === '/dashboard/monitoring' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                <span className="icon">📈</span> GMM
              </Link>
            )}

            {isAdmin && (
              <div className="sidebar-dropdown-wrapper" id="tour-monitoring">
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
                <Link href="/dashboard/users" id="tour-users" className={`sidebar-link ${pathname === '/dashboard/users' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                  <span className="icon">👥</span> Users
                </Link>
              </>
            )}

            <div className="sidebar-group-label" style={{ padding: '16px 16px 4px', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pusat Bantuan</div>
            <button
              onClick={startTour}
              style={{ width: 'calc(100% - 24px)', margin: '4px 12px 12px', textAlign: 'left', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', color: '#60a5fa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', transition: 'all 0.2s ease' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Panduan Halaman
            </button>
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
