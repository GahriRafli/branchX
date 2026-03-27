'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../layout';
import dynamic from 'next/dynamic';

// Lazy import recharts
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: { name: string } | null;
  createdAt: string;
}

interface DashboardStats {
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  totalLeads: number;
  wonLeads: number;
  totalUsers: number;
  pipelineAmount: number;
  wonAmount: number;
  aging: { fresh: number; warning: number; critical: number };
  leaderboard: { id: string; name: string; wonCount: number; pipelineAmount: number }[];
  activityStats: {
    GMM: { count: number, amount: number };
    KSM: { count: number, amount: number };
    KPR: { count: number, amount: number };
    CC: { count: number, amount: number };
    totalCount: number;
    totalAmount: number;
  };
}

const TAB_COLORS = {
  GMM: 'var(--accent-blue)',
  KSM: 'var(--accent-green)',
  KPR: 'var(--accent-orange, #f59e0b)',
  CC: '#0891b2',
};

const CHART_COLORS = {
  FRESH: '#10b981',
  WARNING: '#f59e0b',
  CRITICAL: '#ef4444',
  OPEN: '#6366f1',
  IN_PROGRESS: '#3b82f6',
  DONE: '#10b981'
};

export default function DashboardMainPage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, tasksRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/tasks')
      ]);
      const statsData = await statsRes.json();
      const tasksData = await tasksRes.json();
      
      if (statsData.stats) setStats(statsData.stats);
      if (tasksData.tasks) setTasks(tasksData.tasks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pieData = useMemo(() => stats ? [
    { name: 'Fresh (<3d)', value: stats.aging.fresh, color: CHART_COLORS.FRESH },
    { name: 'Warning (3-7d)', value: stats.aging.warning, color: CHART_COLORS.WARNING },
    { name: 'Critical (>7d)', value: stats.aging.critical, color: CHART_COLORS.CRITICAL },
  ] : [], [stats]);

  const barData = useMemo(() => stats ? [
    { name: 'Open Tasks', count: stats.openTasks, fill: CHART_COLORS.OPEN },
    { name: 'In Progress', count: stats.inProgressTasks, fill: CHART_COLORS.IN_PROGRESS },
    { name: 'Done', count: stats.doneTasks, fill: CHART_COLORS.DONE },
  ] : [], [stats]);

  const activityChartData = useMemo(() => stats ? [
    { name: 'GMM', amount: stats.activityStats.GMM.amount, fill: TAB_COLORS.GMM },
    { name: 'KSM', amount: stats.activityStats.KSM.amount, fill: TAB_COLORS.KSM },
    { name: 'KPR', amount: stats.activityStats.KPR.amount, fill: TAB_COLORS.KPR },
    { name: 'CC', amount: stats.activityStats.CC?.amount || 0, fill: TAB_COLORS.CC },
  ] : [], [stats]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status: newStatus }),
    });
    fetchData();
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'TODO': return 'select-todo';
      case 'IN_PROGRESS': return 'select-in-progress';
      case 'BLOCKER': return 'select-blocker';
      case 'DONE': return 'select-done';
      default: return '';
    }
  };

  // Compact number formatter (removes Rp prefix as requested)
  const formatAmount = (amount: number) => {
    if (amount >= 1_000_000_000_000) return `${(amount / 1_000_000_000_000).toFixed(1).replace('.', ',')} T`;
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(amount);
  };

  const currentMonthName = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date()).toUpperCase();
  }, []);

  if (loading || !stats) return <div className="loading-spinner" />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">CRM Dashboard</h1>
          <p className="page-subtitle">Monitor pipeline performance and follow-up activities</p>
        </div>
      </div>

      <div className="stats-grid" id="tour-dash-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="stat-card indigo" onClick={() => router.push('/dashboard/tasks')} style={{ cursor: 'pointer', padding: '20px', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8 }}>Total Pipeline (Leads)</div>
          <div className="stat-value" style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px' }}>{stats.totalLeads}</div>
        </div>
        <div className="stat-card emerald" style={{ padding: '20px', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8 }}>Won Value (Amount)</div>
          <div className="stat-value" style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px' }} title={new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(stats.wonAmount)}>{formatAmount(stats.wonAmount)}</div>
        </div>
        <div className="stat-card amber" style={{ padding: '20px', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8 }}>Potential Pipeline (Amount)</div>
          <div className="stat-value" style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px' }} title={new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(stats.pipelineAmount)}>{formatAmount(stats.pipelineAmount)}</div>
        </div>
        <div className="stat-card rose" onClick={() => router.push('/dashboard/tasks')} style={{ cursor: 'pointer', padding: '20px', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '13px', fontWeight: 600, opacity: 0.8 }}>Open Follow-up Tasks</div>
          <div className="stat-value" style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px' }}>{stats.openTasks}</div>
        </div>
        <div className="stat-card cyan" onClick={() => router.push('/dashboard/monitoring')} style={{ cursor: 'pointer', padding: '20px', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-tertiary)', opacity: 0.8 }}>TOTAL ACTIVITIES (AMOUNT)</div>
          <div className="stat-value" style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px', color: 'var(--accent-blue)' }}>{formatAmount(stats.activityStats.totalAmount)}</div>
        </div>
      </div>

      <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
        <div className="card" onClick={() => router.push('/dashboard/monitoring?tab=GMM')} style={{ cursor: 'pointer', padding: '16px', borderLeft: `4px solid ${TAB_COLORS.GMM}`, background: 'var(--bg-card)' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>GMM SUMMARY ({currentMonthName})</div>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{stats.activityStats.GMM.count} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-tertiary)' }}>Entries</span></div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Amount: {formatAmount(stats.activityStats.GMM.amount)}</div>
           </div>
        </div>
        <div className="card" onClick={() => router.push('/dashboard/monitoring?tab=KSM')} style={{ cursor: 'pointer', padding: '16px', borderLeft: `4px solid ${TAB_COLORS.KSM}`, background: 'var(--bg-card)' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>KSM SUMMARY ({currentMonthName})</div>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{stats.activityStats.KSM.count} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-tertiary)' }}>Entries</span></div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Amount: {formatAmount(stats.activityStats.KSM.amount)}</div>
           </div>
        </div>
        <div className="card" onClick={() => router.push('/dashboard/monitoring?tab=KPR')} style={{ cursor: 'pointer', padding: '16px', borderLeft: `4px solid ${TAB_COLORS.KPR}`, background: 'var(--bg-card)' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>KPR SUMMARY ({currentMonthName})</div>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{stats.activityStats.KPR.count} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-tertiary)' }}>Entries</span></div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Amount: {formatAmount(stats.activityStats.KPR.amount)}</div>
           </div>
        </div>
        <div className="card" onClick={() => router.push('/dashboard/monitoring?tab=CC')} style={{ cursor: 'pointer', padding: '16px', borderLeft: `4px solid ${TAB_COLORS.CC}`, background: 'var(--bg-card)' }}>
           <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>CC SUMMARY ({currentMonthName})</div>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{stats.activityStats.CC?.count || 0} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-tertiary)' }}>Entries</span></div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Amount: {formatAmount(stats.activityStats.CC?.amount || 0)}</div>
           </div>
        </div>
      </div>


      <div className="charts-grid" id="tour-dash-chart" style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr 1fr' : '1fr 1fr', gap: '24px', marginTop: '24px' }}>
        <div className="chart-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <div className="chart-title" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px' }}>Lead Ageing Distribution</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={5} dataKey="value">
                {pieData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-popover)', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px', color: 'var(--text-primary)' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', marginTop: '16px', fontSize: '13px' }}>
            {pieData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: d.color }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.value}</span> {d.name}
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <div className="chart-title" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px' }}>Activity Breakdown (Total Amount)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={activityChartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatAmount(value)} />
              <Tooltip 
                formatter={(value: any) => [formatAmount(value), 'Total Amount']}
                contentStyle={{ background: 'var(--bg-popover)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} 
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={60}>
                {activityChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>


        {isAdmin ? (
           <div className="chart-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div className="chart-title" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px' }}>Top Performers</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 {stats.leaderboard.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 0' }}>No closed deals yet.</div>
                 ) : (
                    stats.leaderboard.map((user, i) => (
                       <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: i === 0 ? 'var(--accent-orange-light)' : 'var(--bg-main)', color: i === 0 ? 'var(--accent-orange)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                             #{i + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                             <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{user.name}</div>
                             <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{user.wonCount} Won • {new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(user.pipelineAmount)} Pipeline</div>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
        ) : (
          <div className="chart-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <div className="chart-title" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px' }}>Task Status</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-popover)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {!isAdmin && (
        <div className="table-container" id="tour-dash-recent" style={{ marginTop: '32px' }}>
          <div className="table-header">
             <div>
                <h2 className="table-title">My Recent Tasks</h2>
                <p className="page-subtitle">Menampilkan {Math.min(tasks.length, 5)} dari {tasks.length} tugas yang ditugaskan</p>
             </div>
             <button className="btn btn-secondary btn-sm" onClick={() => router.push('/dashboard/tasks')}>View All CRM Tasks</button>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>No tasks assigned to you</td></tr>
                ) : (
                  tasks.slice(0, 5).map(task => (
                    <tr key={task.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{task.title}</div>
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
                      <td>{new Date(task.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
