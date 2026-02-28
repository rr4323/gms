import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

const STATUS_OPTIONS = ['', 'draft', 'pending', 'active', 'completed', 'rejected', 'scored'];

export default function GoalsPage() {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const navigate = useNavigate();

    const fetchGoals = () => {
        setLoading(true);
        const params = {};
        if (statusFilter) params.status = statusFilter;
        api.get('/goals/', { params }).then(res => {
            setGoals(res.data.results || res.data);
        }).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => { fetchGoals(); }, [statusFilter]);

    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="fade-in">
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h1>Goals</h1>
                    <p>Manage and track all your goals</p>
                </div>
                <Link to="/goals/new" className="btn btn-primary">+ New Goal</Link>
            </div>

            <div className="filters-bar">
                <div className="filter-group">
                    <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Status:</label>
                    <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">All</option>
                        {STATUS_OPTIONS.filter(Boolean).map(s => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="loading-page"><div className="spinner" /></div>
            ) : goals.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🎯</div>
                    <h3>No goals yet</h3>
                    <p>Create your first goal to get started</p>
                    <Link to="/goals/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>+ New Goal</Link>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                    {goals.map(goal => (
                        <div key={goal.id} className="goal-card" onClick={() => navigate(`/goals/${goal.id}`)}>
                            <div className="goal-meta">
                                <span className={`status-pill ${goal.status}`}>
                                    <span className="status-dot" />
                                    {goal.status}
                                </span>
                                {goal.is_at_risk && <span className="at-risk-badge">⚠ At Risk</span>}
                            </div>
                            <div className="goal-title">{goal.name}</div>
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    <span>Progress</span>
                                    <span>{goal.target_completion}%</span>
                                </div>
                                <div className={`progress-bar ${goal.is_at_risk ? 'at-risk' : ''}`}>
                                    <div className="fill" style={{ width: `${goal.target_completion}%` }} />
                                </div>
                            </div>
                            <div className="goal-footer">
                                <span>{goal.entity_name}</span>
                                <span>Due {formatDate(goal.due_date)}</span>
                            </div>
                            {goal.labels && goal.labels.length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                    {goal.labels.map((l, i) => <span key={i} className="label-tag">{l}</span>)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
