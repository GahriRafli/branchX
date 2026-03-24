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
  todoCount: number;
  inProgressCount: number;
  blockerCount: number;
  doneCount: number;
  totalUsers: number;
}

const CHART_COLORS = {
  TODO: '#6366f1',
  IN_PROGRESS: '#3b82f6',
  BLOCKER: '#ef4444',
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
    { name: 'To Do', value: stats.todoCount, color: CHART_COLORS.TODO },
    { name: 'In Progress', value: stats.inProgressCount, color: CHART_COLORS.IN_PROGRESS },
    { name: 'Blocker', value: stats.blockerCount, color: CHART_COLORS.BLOCKER },
    { name: 'Done', value: stats.doneCount, color: CHART_COLORS.DONE },
  ] : [], [stats]);

  const barData = useMemo(() => stats ? [
    { name: 'To Do', count: stats.todoCount, fill: CHART_COLORS.TODO },
    { name: 'In Progress', count: stats.inProgressCount, fill: CHART_COLORS.IN_PROGRESS },
    { name: 'Blocker', count: stats.blockerCount, fill: CHART_COLORS.BLOCKER },
    { name: 'Done', count: stats.doneCount, fill: CHART_COLORS.DONE },
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

  if (loading || !stats) return <div className="loading-spinner" />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Monitor team productivity and manage task workflows</p>
        </div>
      </div>

      <div className="stats-grid" id="tour-dash-stats">
        <div className="stat-card indigo" onClick={() => router.push('/dashboard/tasks')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Total Tasks</div>
          <div className="stat-value">{stats.totalTasks}</div>
        </div>
        <div className="stat-card emerald" onClick={() => router.push('/dashboard/tasks?status=DONE')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Completed</div>
          <div className="stat-value">{stats.doneCount}</div>
        </div>
        <div className="stat-card amber" onClick={() => router.push('/dashboard/tasks?status=IN_PROGRESS')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">In Progress</div>
          <div className="stat-value">{stats.inProgressCount}</div>
        </div>
        <div className="stat-card rose" onClick={() => router.push('/dashboard/tasks?status=BLOCKER')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Blockers</div>
          <div className="stat-value">{stats.blockerCount}</div>
        </div>
        {isAdmin && (
          <div className="stat-card cyan" onClick={() => router.push('/dashboard/users')} style={{ cursor: 'pointer' }}>
            <div className="stat-label">Team Members</div>
            <div className="stat-value">{stats.totalUsers}</div>
          </div>
        )}
      </div>

      <div className="charts-grid" id="tour-dash-chart">
        <div className="chart-card">
          <div className="chart-title">Task Distribution</div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={5} dataKey="value">
                {pieData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#ffffff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', marginTop: '16px', fontSize: '13px' }}>
            {pieData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: d.color }} />
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.value}</span> {d.name}
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Status Breakdown</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fill: '#5e6c84', fontSize: 12 }} />
              <YAxis tick={{ fill: '#5e6c84', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #dfe1e6', borderRadius: '8px', boxShadow: '0 4px 8px -2px rgba(9,30,66,0.1)' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!isAdmin && (
        <div className="table-container" id="tour-dash-recent" style={{ marginTop: '32px' }}>
          <div className="table-header">
            <h2 className="table-title">My Recent Tasks</h2>
            <p className="page-subtitle" style={{ margin: 0 }}>Showing your currently assigned tasks</p>
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
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px' }}>No tasks assigned to you</td></tr>
                ) : (
                  tasks.slice(0, 5).map(task => (
                    <tr key={task.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{task.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{task.description}</div>
                      </td>
                      <td>
                        <select
                          className={`status-select ${getStatusClass(task.status)}`}
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
