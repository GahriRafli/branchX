'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../layout';
import { useRouter } from 'next/navigation';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const ACTIVITY_TYPES = ['GMM', 'KSM', 'KPR', 'CC'] as const;

const TAB_COLORS: Record<string, string> = {
  GMM: '#3b82f6', // Bright Blue
  KSM: '#8b5cf6', // Violet
  KPR: '#f59e0b', // Amber
  CC: '#10b981'  // Emerald
};

const TAB_ICONS: Record<string, string> = {
  GMM: '📊',
  KSM: '🚗',
  KPR: '🏠',
  CC: '💳'
};

const DEFAULT_COLOR = '#6366f1';

interface MonitoringData {
  id: string;
  activityType: string;
  name: string;
  amount: number;
  target: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
}

export default function MonitoringAnalyticsPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('GMM');
  const [allData, setAllData] = useState<MonitoringData[]>([]);
  const [loading, setLoading] = useState(true);


  const fetchData = async () => {
    try {
      const res = await fetch('/api/monitoring');
      const d = await res.json();
      if (d.data) setAllData(d.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/api/auth/login');
        return;
      }
      fetchData();
    }
  }, [user, authLoading, router]);

  const stats = useMemo(() => {
    const filtered = allData.filter(item => item.activityType === activeTab);
    
    // Define success/failure statuses
    const successStatuses = ['VERIFIED', 'Pengajuan Cair', 'Maintain Nasabah', 'NEW CIF', 'NTB'];
    const failureStatuses = [
      'REJECTED', 
      'TAKEOUT', 
      'Pengajuan Ditolak', 
      'Dalam Proses Pengajuan (Ditolak)', 
      'Pengajuan Tidak Tertarik'
    ];

    const exclusionStatuses = ['TAKEOUT', 'Dalam Proses Pengajuan (Ditolak)', 'Pengajuan Ditolak', 'REJECTED'];
    const verifiedFiltered = filtered.filter(item => !failureStatuses.includes(item.status)); 
    const targetFiltered = filtered.filter(item => !exclusionStatuses.includes(item.status));
    
    const totalAmount = verifiedFiltered.reduce((sum: number, item: any) => sum + item.amount, 0);
    const totalTarget = targetFiltered.reduce((sum: number, item: any) => sum + item.target, 0);
    const achievement = totalTarget > 0 ? (totalAmount / totalTarget) * 100 : 0;
    
    const pendingCount = filtered.filter(item => 
      !successStatuses.includes(item.status) && !failureStatuses.includes(item.status)
    ).length;
    
    const verifiedCount = filtered.filter(item => successStatuses.includes(item.status)).length;

    return { totalAmount, totalTarget, achievement: Math.round(achievement) + '%', pendingCount, verifiedCount };
  }, [allData, activeTab]);

  const aggregatedChartData = useMemo(() => {
    const filtered = allData.filter(item => item.activityType === activeTab);
    const grouped = filtered.reduce((acc: any, item: any) => {
      if (!acc[item.name]) {
        acc[item.name] = { name: item.name, amount: 0, target: 0 };
      }
      
      const failureStatuses = [
        'REJECTED', 
        'TAKEOUT', 
        'Pengajuan Ditolak', 
        'Dalam Proses Pengajuan (Ditolak)', 
        'Pengajuan Tidak Tertarik'
      ];
      
      const exclusionStatuses = ['TAKEOUT', 'Dalam Proses Pengajuan (Ditolak)', 'Pengajuan Ditolak', 'REJECTED'];
      if (!failureStatuses.includes(item.status)) {
        acc[item.name].amount += item.amount;
      }
      if (!exclusionStatuses.includes(item.status)) {
        acc[item.name].target += item.target;
      }
      return acc;
    }, {});
    return Object.values(grouped);
  }, [allData, activeTab]);

  if (loading || authLoading) return <div className="loading-spinner" />;

  return (
    <div className="monitoring-page" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Activity Dashboard</h1>
          <p className="page-subtitle" style={{ fontSize: '15px', color: 'var(--text-tertiary)' }}>Performance metrics and achievement overview for current period</p>
        </div>
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.5)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '8px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        overflowX: 'auto',
        gap: '6px',
        marginBottom: '32px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        width: 'fit-content'
      }}>
        {ACTIVITY_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            style={{
              padding: '12px 28px',
              border: 'none',
              borderRadius: '14px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: activeTab === type ? (TAB_COLORS[type] || DEFAULT_COLOR) : 'transparent',
              color: activeTab === type ? '#fff' : 'var(--text-secondary)',
              boxShadow: activeTab === type ? `0 8px 16px ${(TAB_COLORS[type] || DEFAULT_COLOR)}40` : 'none',
              transform: activeTab === type ? 'translateY(-2px)' : 'none',
            }}
          >
            <span style={{ fontSize: '18px' }}>{TAB_ICONS[type]}</span>
            <span style={{ whiteSpace: 'nowrap' }}>{type}</span>
            <span style={{
              fontSize: '11px',
              background: activeTab === type ? 'rgba(255,255,255,0.25)' : 'var(--bg-primary)',
              padding: '2px 10px',
              borderRadius: '12px',
              fontWeight: 800,
              color: activeTab === type ? '#fff' : 'var(--text-tertiary)'
            }}>
              {allData.filter(d => d.activityType === type).length}
            </span>
          </button>
        ))}
      </div>

      <div className="dashboard-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginBottom: '32px',
        }}>
        {[
          { label: 'Total Amount', value: stats.totalAmount.toLocaleString(), icon: '💰', color: TAB_COLORS[activeTab] || DEFAULT_COLOR },
          { label: 'Total Target', value: stats.totalTarget.toLocaleString(), icon: '🎯', color: '#64748b' },
          { label: 'Achievement', value: stats.achievement, icon: '🏆', color: '#10b981' },
          { 
            label: activeTab === 'GMM' ? 'Pending Review' : 'Total Entries', 
            value: activeTab === 'GMM' ? stats.pendingCount : stats.verifiedCount, 
            icon: '📋', 
            color: '#3b82f6' 
          }
        ].map((item, idx) => (
          <div key={idx} className="card" style={{ 
            padding: '24px', 
            borderRadius: '24px', 
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            transition: 'transform 0.3s ease',
            cursor: 'default'
          }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '16px', 
              background: `${item.color}15`, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              {item.icon}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {item.value}
              </div>
            </div>
            <div style={{ 
              position: 'absolute', 
              right: '-10px', 
              bottom: '-10px', 
              fontSize: '100px', 
              opacity: 0.03, 
              pointerEvents: 'none',
              transform: 'rotate(-15deg)'
            }}>
              {item.icon}
            </div>
            {item.label === 'Achievement' && (
              <div style={{ 
                height: '4px', 
                background: '#e2e8f0', 
                borderRadius: '2px', 
                marginTop: '8px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  height: '100%', 
                  background: '#10b981', 
                  width: stats.achievement,
                  borderRadius: '2px',
                  transition: 'width 1s ease-out'
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>📈</span> Status Breakdown
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px'
        }}>
          {(activeTab === 'GMM' ? [
            { s: 'PENDING', i: '⏳' },
            { s: 'NEW CIF', i: '🆕' },
            { s: 'NTB', i: '🏛️' }
          ] : [
            { s: 'Belum ada Pengajuan', i: '📝' },
            { s: 'Pengajuan Sudah (Tertarik)', i: '🎯' },
            { s: 'Pengajuan Sudah (Custom / Tidak Respond)', i: '📵' },
            { s: 'Pengajuan Tidak Tertarik', i: '🚫' },
            { s: 'Dalam Proses Pengajuan (Lancar)', i: '⚙️' },
            { s: 'Dalam Proses Pengajuan (Perlu Ralat / Sendback)', i: '⚠️' },
            { s: 'Pengajuan Diterima', i: '📥' },
            { s: 'Pengajuan Cair', i: '💎' },
            { s: 'Maintain Nasabah', i: '🤝' }
          ]).map(statusObj => {
            const count = allData.filter(d => d.activityType === activeTab && d.status === statusObj.s).length;
            const successStatuses = ['VERIFIED', 'Pengajuan Cair', 'Maintain Nasabah', 'NEW CIF', 'NTB'];
            const failureStatuses = ['REJECTED', 'TAKEOUT', 'Pengajuan Ditolak', 'Dalam Proses Pengajuan (Ditolak)', 'Pengajuan Tidak Tertarik'];
            
            const color = successStatuses.includes(statusObj.s) ? '#10b981' : 
                         failureStatuses.includes(statusObj.s) ? '#ef4444' : '#3b82f6';

            return (
              <div key={statusObj.s} className="card" style={{ 
                padding: '20px', 
                borderRadius: '20px', 
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                transition: 'transform 0.2s ease'
              }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '12px', 
                  background: `${color}10`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '20px'
                }}>
                  {statusObj.i}
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    {statusObj.s}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {aggregatedChartData.length > 0 && (
        <div className="card" style={{ 
          marginBottom: '40px', 
          padding: '32px', 
          borderRadius: '32px', 
          border: '1px solid var(--border-subtle)', 
          background: 'var(--bg-card)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Achievement Analysis — {activeTab}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-tertiary)' }}>Comparison between achieved amounts and set targets per user</p>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: TAB_COLORS[activeTab] }} />
                <span>Amount</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#e2e8f0' }} />
                <span>Target</span>
              </div>
            </div>
          </div>
          
          <div style={{ width: '100%', height: 450 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggregatedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  fontSize={12} 
                  fontWeight={600}
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: 'var(--text-tertiary)' }}
                  dy={10}
                />
                <YAxis 
                  fontSize={12} 
                  fontWeight={600}
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: 'var(--text-tertiary)' }}
                  tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    backdropFilter: 'blur(8px)',
                    borderColor: 'var(--border-subtle)', 
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    padding: '12px 16px'
                  }}
                  itemStyle={{ fontSize: 13, fontWeight: 700 }}
                  labelStyle={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}
                />
                <Bar 
                  dataKey="amount" 
                  fill={TAB_COLORS[activeTab] || DEFAULT_COLOR} 
                  name="Amount" 
                  radius={[10, 10, 0, 0]} 
                  barSize={32} 
                  animationDuration={1500}
                />
                <Bar 
                  dataKey="target" 
                  fill="#e2e8f0" 
                  name="Target" 
                  radius={[10, 10, 0, 0]} 
                  barSize={32} 
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
