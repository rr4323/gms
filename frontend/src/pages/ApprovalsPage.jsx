import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function ApprovalsPage() {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchPending = () => {
        setLoading(true);
        api.get('/goals/', { params: { status: 'pending' } }).then(res => {
            setGoals(res.data.results || res.data);
        }).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => { fetchPending(); }, []);

    const handleApprove = async (id) => {
        try {
            await api.post(`/goals/${id}/approve/`);
            fetchPending();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to approve');
        }
    };

    const handleReject = async (id) => {
        const comment = prompt('Reason for rejection (required):');
        if (!comment) return;
        try {
            await api.post(`/goals/${id}/reject/`, { comment });
            fetchPending();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to reject');
        }
    };

    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1>Approval Queue</h1>
                <p>Review and approve or reject pending goals</p>
            </div>

            {loading ? (
                <div className="loading-page"><div className="spinner" /></div>
            ) : goals.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    <h3>All caught up!</h3>
                    <p>No goals pending your approval</p>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Goal</th>
                                <th>Submitted By</th>
                                <th>Level</th>
                                <th>Due Date</th>
                                <th>Weightage</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {goals.map(goal => (
                                <tr key={goal.id}>
                                    <td>
                                        <div
                                            style={{ cursor: 'pointer', fontWeight: 600 }}
                                            onClick={() => navigate(`/goals/${goal.id}`)}
                                        >
                                            {goal.name}
                                        </div>
                                        {goal.labels && goal.labels.length > 0 && (
                                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                                {goal.labels.map((l, i) => <span key={i} className="label-tag">{l}</span>)}
                                            </div>
                                        )}
                                    </td>
                                    <td>{goal.assigned_to_name}</td>
                                    <td>{goal.entity_name}</td>
                                    <td>{formatDate(goal.due_date)}</td>
                                    <td>{goal.weightage}%</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                            <button className="btn btn-success btn-sm" onClick={() => handleApprove(goal.id)}>Approve</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleReject(goal.id)}>Reject</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
