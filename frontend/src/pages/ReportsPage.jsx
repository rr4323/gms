import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function ReportsPage() {
    const { user } = useAuth();
    const [reportType, setReportType] = useState('individual');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState('');
    const [users, setUsers] = useState([]);

    useEffect(() => {
        if (user?.user_type !== 'member') {
            api.get('/users/').then(res => setUsers(res.data.results || res.data));
        }
    }, []);

    const fetchReport = () => {
        setLoading(true);
        let url = reportType === 'individual'
            ? `/reports/individual/${userId || user?.id}/`
            : reportType === 'team' ? '/reports/team/' : '/reports/company/';
        api.get(url).then(res => setData(res.data)).catch(() => setData(null)).finally(() => setLoading(false));
    };

    useEffect(() => { fetchReport(); }, [reportType, userId]);

    const handleExport = async (format) => {
        const params = new URLSearchParams({ type: reportType, format });
        if (reportType === 'individual') params.set('user_id', userId || user?.id);
        try {
            const res = await api.get(`/reports/export/?${params.toString()}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `gms_${reportType}_report.${format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Export failed. Please try again.');
        }
    };

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    return (
        <div className="fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div><h1>Reports</h1><p>Performance reports and analytics</p></div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}>📄 PDF</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')}>📊 CSV</button>
                </div>
            </div>
            <div className="filters-bar">
                <select className="form-control" value={reportType} onChange={e => setReportType(e.target.value)} style={{ width: 'auto' }}>
                    <option value="individual">Individual</option>
                    {user?.user_type !== 'member' && <option value="team">Team</option>}
                    {user?.user_type === 'admin' && <option value="company">Company</option>}
                </select>
                {reportType === 'individual' && user?.user_type !== 'member' && (
                    <select className="form-control" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: 'auto' }}>
                        <option value="">Myself</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                    </select>
                )}
            </div>
            {loading ? <div className="loading-page"><div className="spinner" /></div> : !data ? <div className="empty-state"><h3>No data</h3></div> : (
                <>
                    {reportType === 'individual' && data.summary && (
                        <div>
                            <div className="stats-grid">
                                {[['Total', data.summary.total], ['Completed', data.summary.completed], ['Active', data.summary.active], ['Avg Score', data.summary.average_score ? Number(data.summary.average_score).toFixed(1) : '—']].map(([l, v]) => (
                                    <div className="stat-card" key={l}><div className="stat-label">{l}</div><div className="stat-value">{v}</div></div>
                                ))}
                            </div>
                            {data.goals?.length > 0 && (
                                <div className="table-container">
                                    <table><thead><tr><th>Goal</th><th>Status</th><th>Completion</th><th>Due</th><th>Rating</th></tr></thead>
                                        <tbody>{data.goals.map(g => (
                                            <tr key={g.id}><td style={{ fontWeight: 600 }}>{g.name}</td><td><span className={`status-pill ${g.status}`}>{g.status}</span></td>
                                                <td>{g.target_completion}%</td><td>{fmtDate(g.due_date)}</td><td>{g.final_rating || '—'}</td></tr>
                                        ))}</tbody></table>
                                </div>
                            )}
                        </div>
                    )}
                    {reportType === 'team' && Array.isArray(data) && data.map((t, i) => (
                        <div key={i} className="report-section">
                            <h2>{t.team?.name}</h2>
                            <div className="stats-grid">
                                {[['Goals', t.total_goals], ['Done', t.completed], ['Avg', t.average_score ? Number(t.average_score).toFixed(1) : '—']].map(([l, v]) => (
                                    <div className="stat-card" key={l}><div className="stat-label">{l}</div><div className="stat-value">{v}</div></div>
                                ))}
                            </div>
                            {t.members?.length > 0 && (
                                <div className="table-container" style={{ marginBottom: '2rem' }}>
                                    <table><thead><tr><th>Member</th><th>Goals</th><th>Done</th><th>Score</th></tr></thead>
                                        <tbody>{t.members.map((m, j) => (
                                            <tr key={j}><td style={{ fontWeight: 600 }}>{m.user?.first_name} {m.user?.last_name}</td><td>{m.total_goals}</td><td>{m.completed}</td><td>{m.average_score ? Number(m.average_score).toFixed(1) : '—'}</td></tr>
                                        ))}</tbody></table>
                                </div>
                            )}
                        </div>
                    ))}
                    {reportType === 'company' && !Array.isArray(data) && (
                        <div>
                            <div className="stats-grid">
                                {[['Total', data.total_goals], ['Done', data.completed], ['Active', data.active], ['Avg', data.average_score ? Number(data.average_score).toFixed(1) : '—']].map(([l, v]) => (
                                    <div className="stat-card" key={l}><div className="stat-label">{l}</div><div className="stat-value">{v}</div></div>
                                ))}
                            </div>
                            {data.team_summary?.length > 0 && (
                                <div className="table-container">
                                    <table><thead><tr><th>Team</th><th>Total</th><th>Done</th><th>Rate</th><th>Avg</th></tr></thead>
                                        <tbody>{data.team_summary.map((t, i) => (
                                            <tr key={i}><td style={{ fontWeight: 600 }}>{t.team__name}</td><td>{t.total}</td><td>{t.completed}</td><td>{t.total > 0 ? Math.round(t.completed / t.total * 100) : 0}%</td><td>{t.avg_score ? Number(t.avg_score).toFixed(1) : '—'}</td></tr>
                                        ))}</tbody></table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
