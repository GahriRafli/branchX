'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../layout';

const ACTIVITY_TYPES = ['GMM', 'KSM', 'KPR', 'CC'] as const;
type ActivityType = typeof ACTIVITY_TYPES[number];

interface LeaderboardEntry {
  name: string;
  codeReferral: string;
  count: number;
}

export default function LeaderboardPage() {
  const { loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActivityType>('GMM');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/leaderboard?type=${activeTab}`);
        const data = await res.json();
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [activeTab]);

  if (authLoading) return <div className="loading-spinner" />;

  return (
    <div className="leaderboard-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ 
          fontSize: '36px', 
          fontWeight: 900, 
          background: 'linear-gradient(135deg, #1e293b 0%, #3b82f6 100%)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>
          🏆 Activity Leaderboard
        </h1>
        <p style={{ color: '#64748b', fontSize: '16px' }}>
          Peringkat performa tim berdasarkan jumlah aktivitas yang berhasil
        </p>
      </header>

      {/* Activity Tabs */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '12px', 
        marginBottom: '48px',
        background: 'rgba(255, 255, 255, 0.5)',
        padding: '8px',
        borderRadius: '20px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        width: 'fit-content',
        margin: '0 auto 48px'
      }}>
        {ACTIVITY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            style={{
              padding: '12px 28px',
              borderRadius: '16px',
              border: 'none',
              background: activeTab === type ? '#0052cc' : 'transparent',
              color: activeTab === type ? 'white' : '#64748b',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: activeTab === type ? '0 8px 20px rgba(0, 82, 204, 0.2)' : 'none'
            }}
          >
            {type === 'GMM' ? '📊 GMM' : type === 'KSM' ? '🚗 KSM' : type === 'KPR' ? '🏠 KPR' : '💳 CC'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
          <div className="loading-spinner" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '100px', color: '#94a3b8', background: 'var(--bg-card)', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>Belum ada data user terdaftar</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>Poin hanya dihitung dari aktivitas dengan No. KTP.</p>
        </div>
      ) : (
        <div style={{ 
          background: 'white', 
          borderRadius: '24px', 
          border: '1px solid #e2e8f0', 
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.03)',
          animation: 'fadeInUp 0.5s ease-out'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ padding: '24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b', width: '100px' }}>PERINGKAT</th>
                <th style={{ padding: '24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>NAMA EMPLOYEE</th>
                <th style={{ padding: '24px', textAlign: 'left', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>NIP / REFERRAL</th>
                <th style={{ padding: '24px', textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#64748b' }}>TOTAL POIN (ACTIVITY)</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => {
                const rank = index + 1;
                const isTop3 = rank <= 3;
                
                return (
                  <tr key={index} style={{ 
                    borderBottom: '1px solid #f1f5f9', 
                    transition: 'all 0.2s',
                    background: rank === 1 ? 'rgba(251, 191, 36, 0.03)' : 
                               rank === 2 ? 'rgba(148, 163, 184, 0.03)' : 
                               rank === 3 ? 'rgba(217, 119, 6, 0.03)' : 'transparent'
                  }}>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ 
                        width: '44px', 
                        height: '44px', 
                        borderRadius: '12px', 
                        background: rank === 1 ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 
                                   rank === 2 ? 'linear-gradient(135deg, #94a3b8, #cbd5e1)' : 
                                   rank === 3 ? 'linear-gradient(135deg, #d97706, #f59e0b)' : '#f1f5f9',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: isTop3 ? '22px' : '15px', 
                        fontWeight: 900,
                        color: isTop3 ? 'white' : '#64748b',
                        boxShadow: isTop3 ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                      }}>
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '10px', 
                          background: `hsl(${(index * 45) % 360}, 70%, 90%)`,
                          color: `hsl(${(index * 45) % 360}, 70%, 30%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '14px'
                        }}>
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b' }}>
                            {entry.name}
                            {rank === 1 && <span style={{ marginLeft: '8px', fontSize: '12px', background: '#fbbf24', color: 'white', padding: '2px 8px', borderRadius: '20px' }}>Top Performing</span>}
                          </div>
                          {isTop3 && <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>Peringkat {rank}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '20px 24px', fontSize: '14px', color: '#64748b', fontWeight: 500 }}>{entry.codeReferral}</td>
                    <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ 
                          fontSize: isTop3 ? '24px' : '18px', 
                          fontWeight: 900, 
                          color: rank === 1 ? '#b45309' : rank === 2 ? '#475569' : rank === 3 ? '#92400e' : '#1e293b'
                        }}>
                          {entry.count}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Points</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
