import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import DonutChart from '../components/DonutChart';

export default function DashboardPage() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/dashboard/'),
            api.get('/goals/?ordering=-updated_at'),
        ]).then(([dashRes, goalsRes]) => {
            setData(dashRes.data);
            setGoals(goalsRes.data?.results || goalsRes.data || []);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;
    if (!data) return <div className="empty-state"><h3>Failed to load dashboard</h3></div>;

    const { status_counts: sc, entity_counts: ec } = data;
    const completedPct = data.total_goals > 0
        ? Math.round(((sc.completed + sc.scored) / data.total_goals) * 100)
        : 0;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1>Dashboard</h1>
                <p>Welcome back, {user?.first_name}. Here's your performance overview.</p>
            </div>

            {/* Stats cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Goals</div>
                    <div className="stat-value">{data.total_goals}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Active</div>
                    <div className="stat-value">{sc.active}</div>
                    <div className="stat-sub">{data.total_goals > 0 ? Math.round((sc.active / data.total_goals) * 100) : 0}% of total</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Completed</div>
                    <div className="stat-value">{sc.completed + sc.scored}</div>
                    <div className="stat-sub">{completedPct}% completion rate</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Pending Approval</div>
                    <div className="stat-value">{sc.pending}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">At Risk</div>
                    <div className="stat-value" style={{ background: data.at_risk_count > 0 ? 'linear-gradient(135deg, #EF4444, #FF6B6B)' : undefined, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        {data.at_risk_count}
                    </div>
                    {data.at_risk_count > 0 && <div className="at-risk-badge">⚠ Needs attention</div>}
                </div>
                {data.average_score !== null && (
                    <div className="stat-card">
                        <div className="stat-label">Avg Score</div>
                        <div className="stat-value">{Number(data.average_score).toFixed(1)}</div>
                        <div className="stat-sub">across scored goals</div>
                    </div>
                )}
            </div>

            {/* Charts row */}
            <div className="grid-2" style={{ marginBottom: '2rem' }}>
                <div className="card">
                    <div className="card-header"><h3>Goal Completion</h3></div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
                        <DonutChart
                            segments={[
                                { value: sc.completed + sc.scored, color: '#10B981', label: 'Completed' },
                                { value: sc.active, color: '#3B82F6', label: 'Active' },
                                { value: sc.pending, color: '#F59E0B', label: 'Pending' },
                                { value: sc.draft, color: '#64748b', label: 'Draft' },
                                { value: sc.rejected, color: '#EF4444', label: 'Rejected' },
                            ]}
                            size={180}
                            centerText={`${completedPct}%`}
                            centerLabel="Complete"
                        />
                        <div>
                            {[
                                { label: 'Completed', color: '#10B981', count: sc.completed + sc.scored },
                                { label: 'Active', color: '#3B82F6', count: sc.active },
                                { label: 'Pending', color: '#F59E0B', count: sc.pending },
                                { label: 'Draft', color: '#64748b', count: sc.draft },
                                { label: 'Rejected', color: '#EF4444', count: sc.rejected },
                            ].map(item => (
                                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: 'var(--font-sm)' }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                                    <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header"><h3>Goals by Level</h3></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
                        {[
                            { label: 'Company', count: ec.company, icon: '🏢' },
                            { label: 'Team', count: ec.team, icon: '👥' },
                            { label: 'Individual', count: ec.individual, icon: '👤' },
                        ].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: 'var(--font-sm)', fontWeight: 500 }}>{item.label}</span>
                                        <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>{item.count}</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div className="fill" style={{ width: `${data.total_goals > 0 ? (item.count / data.total_goals) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Goal Status Board — PRD §3 */}
            {goals.length > 0 && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div className="card-header">
                        <h3>Goal Status Board</h3>
                        <Link to="/goals" className="btn btn-secondary btn-sm">View All →</Link>
                    </div>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Goal</th>
                                    <th>Status</th>
                                    <th>Assigned To</th>
                                    <th>Approver</th>
                                    <th>Due Date</th>
                                    <th>Completion</th>
                                    <th>Last Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {goals.slice(0, 10).map(g => (
                                    <tr key={g.id}>
                                        <td>
                                            <Link to={`/goals/${g.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{g.name}</Link>
                                            {g.is_at_risk && <span className="at-risk-badge" style={{ marginLeft: '8px' }}>⚠</span>}
                                        </td>
                                        <td><span className={`status-pill ${g.status}`}><span className="status-dot" />{g.status}</span></td>
                                        <td style={{ fontSize: 'var(--font-sm)' }}>{g.assigned_to_name}</td>
                                        <td style={{ fontSize: 'var(--font-sm)' }}>{g.evaluator_name || '—'}</td>
                                        <td style={{ fontSize: 'var(--font-sm)' }}>{fmtDate(g.due_date)}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div className={`progress-bar ${g.is_at_risk ? 'at-risk' : ''}`} style={{ width: '60px' }}>
                                                    <div className="fill" style={{ width: `${g.target_completion}%` }} />
                                                </div>
                                                <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>{g.target_completion}%</span>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{fmtDateTime(g.updated_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Team stats */}
            {data.team_stats && data.team_stats.length > 0 && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div className="card-header"><h3>Team Performance</h3></div>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table>
                            <thead><tr><th>Team</th><th>Total Goals</th><th>Completed</th><th>Completion Rate</th><th>Avg Score</th></tr></thead>
                            <tbody>
                                {data.team_stats.map((t, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{t.team__name}</td>
                                        <td>{t.total}</td>
                                        <td>{t.completed}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="progress-bar" style={{ width: '80px' }}>
                                                    <div className="fill" style={{ width: `${t.total > 0 ? (t.completed / t.total) * 100 : 0}%` }} />
                                                </div>
                                                <span style={{ fontSize: 'var(--font-xs)' }}>{t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0}%</span>
                                            </div>
                                        </td>
                                        <td>{t.avg_score ? Number(t.avg_score).toFixed(1) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Member stats */}
            {data.member_stats && data.member_stats.length > 0 && (
                <div className="card">
                    <div className="card-header"><h3>Member Performance</h3></div>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table>
                            <thead><tr><th>Member</th><th>Goals</th><th>Completed</th><th>Avg Score</th></tr></thead>
                            <tbody>
                                {data.member_stats.map((m, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{m.assigned_to__first_name} {m.assigned_to__last_name || m.assigned_to__username}</td>
                                        <td>{m.total}</td>
                                        <td>{m.completed}</td>
                                        <td>{m.avg_score ? Number(m.avg_score).toFixed(1) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
