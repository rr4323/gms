import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function GoalDetailPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [goal, setGoal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [comment, setComment] = useState('');
    const [feedbackText, setFeedbackText] = useState('');
    const [rejectComment, setRejectComment] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackType, setFeedbackType] = useState('member');
    const [showEvalModal, setShowEvalModal] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dimensions, setDimensions] = useState([]);
    const [ratings, setRatings] = useState([]);
    const [evalData, setEvalData] = useState({});
    const [finalRating, setFinalRating] = useState('');
    // Sub-task CRUD state
    const [newTaskName, setNewTaskName] = useState('');
    const [addingTask, setAddingTask] = useState(false);

    const fetchGoal = () => {
        api.get(`/goals/${id}/`).then(res => {
            setGoal(res.data);
            setProgress(res.data.target_completion);
        }).catch(() => navigate('/goals')).finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchGoal();
        api.get('/dimensions/').then(res => setDimensions(res.data.results || res.data));
        api.get('/ratings/').then(res => setRatings(res.data.results || res.data));
    }, [id]);

    const handleAction = async (action, data = {}) => {
        try {
            await api.post(`/goals/${id}/${action}/`, data);
            fetchGoal();
        } catch (err) {
            alert(err.response?.data?.error || 'Action failed');
        }
    };

    const handleProgressUpdate = async () => {
        try {
            await api.patch(`/goals/${id}/progress/`, { target_completion: progress });
            // NB-9: Immediately reflect in UI before refetch
            setGoal(prev => prev ? { ...prev, target_completion: progress } : prev);
            fetchGoal();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update progress');
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!comment.trim()) return;
        await api.post(`/goals/${id}/comments/`, { comment: comment.trim() });
        setComment('');
        fetchGoal();
    };

    const handleFeedback = async (type) => {
        try {
            await api.post(`/goals/${id}/feedback/`, { feedback: feedbackText, feedback_type: type });
            setFeedbackText('');
            setShowFeedbackModal(false);
            fetchGoal();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to submit feedback');
        }
    };

    const handleEvaluation = async () => {
        const evaluations = Object.entries(evalData).map(([dimId, ratingId]) => ({
            dimension: parseInt(dimId),
            rating: parseInt(ratingId),
        }));
        if (evaluations.length !== dimensions.length) {
            alert('Please rate all dimensions');
            return;
        }
        if (!finalRating) {
            alert('Please select a final rating');
            return;
        }
        try {
            await api.post(`/goals/${id}/evaluate/`, { evaluations, final_rating: finalRating });
            setShowEvalModal(false);
            fetchGoal();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to submit evaluation');
        }
    };

    // Sub-task handlers
    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTaskName.trim()) return;
        setAddingTask(true);
        try {
            await api.post('/tasks/', { goal: parseInt(id), name: newTaskName.trim(), status: 'todo' });
            setNewTaskName('');
            fetchGoal();
        } catch (err) {
            alert('Failed to add sub-task');
        } finally {
            setAddingTask(false);
        }
    };

    const handleUpdateTaskStatus = async (taskId, newStatus) => {
        try {
            await api.patch(`/tasks/${taskId}/`, { status: newStatus });
            fetchGoal();
        } catch (err) {
            alert('Failed to update task');
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!confirm('Delete this sub-task?')) return;
        try {
            await api.delete(`/tasks/${taskId}/`);
            fetchGoal();
        } catch (err) {
            alert('Failed to delete task');
        }
    };

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;
    if (!goal) return null;

    const isOwner = goal.assigned_to === user?.id;
    const isAssignedEvaluator = goal.evaluator === user?.id;
    const isAdminUser = user?.user_type === 'admin';
    const isEvaluator = isAdminUser || isAssignedEvaluator;
    // PRD §4: Progress update allowed for owner, evaluator of their team, or admin
    const canUpdateProgress = goal.status === 'active' && (isOwner || isEvaluator);
    // PRD §2 Step 5: Both member and evaluator can mark complete
    const canComplete = goal.status === 'active' && (isOwner || isEvaluator);
    const memberFb = goal.feedbacks?.find(f => f.feedback_type === 'member');
    const evaluatorFb = goal.feedbacks?.find(f => f.feedback_type === 'evaluator');
    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="fade-in">
            <div style={{ marginBottom: '1rem' }}>
                <Link to="/goals" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>← Back to Goals</Link>
            </div>

            <div className="goal-detail-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem' }}>
                        <h1>{goal.name}</h1>
                        <span className={`status-pill ${goal.status}`}>
                            <span className="status-dot" />{goal.status}
                        </span>
                        {goal.is_at_risk && <span className="at-risk-badge">⚠ At Risk</span>}
                    </div>
                    {goal.labels && goal.labels.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {goal.labels.map((l, i) => <span key={i} className="label-tag">{l}</span>)}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(user?.user_type === 'admin' || (goal.is_editable && (isOwner || goal.created_by === user?.id))) && (
                        <Link to={`/goals/${id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                    )}
                    {goal.status === 'draft' && (isOwner || user?.user_type === 'admin' || goal.created_by === user?.id) && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleAction('submit')}>Submit for Approval</button>
                    )}
                    {goal.status === 'rejected' && (isOwner || user?.user_type === 'admin' || goal.created_by === user?.id) && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleAction('submit')}>Re-submit</button>
                    )}
                    {goal.status === 'pending' && isEvaluator && (
                        <>
                            <button className="btn btn-success btn-sm" onClick={() => handleAction('approve')}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setShowRejectModal(true)}>Reject</button>
                        </>
                    )}
                    {canComplete && (
                        <button className="btn btn-success btn-sm" onClick={() => handleAction('complete')}>Mark Complete</button>
                    )}
                    {goal.status === 'completed' && !memberFb && isOwner && (
                        <button className="btn btn-primary btn-sm" onClick={() => { setFeedbackType('member'); setShowFeedbackModal(true); }}>Submit Self-Reflection</button>
                    )}
                    {/* NB-13: Evaluator feedback only shows after member self-reflection */}
                    {goal.status === 'completed' && memberFb && !evaluatorFb && isEvaluator && (
                        <button className="btn btn-primary btn-sm" onClick={() => { setFeedbackType('evaluator'); setShowFeedbackModal(true); }}>Submit Evaluator Feedback</button>
                    )}
                    {goal.status === 'completed' && memberFb && evaluatorFb && !goal.is_finalized && isEvaluator && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowEvalModal(true)}>Evaluate & Score</button>
                    )}
                </div>
            </div>

            <div className="goal-detail-grid">
                {/* Main content */}
                <div>
                    {/* Description */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header"><h3>Description</h3></div>
                        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                            {goal.description || 'No description provided.'}
                        </p>
                    </div>

                    {/* Progress — PRD §4: Owner, Evaluator (team), Admin can update */}
                    {canUpdateProgress && (
                        <div className="card" style={{ marginBottom: '1.5rem' }}>
                            <div className="card-header"><h3>Update Progress</h3></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="range" min="0" max="100"
                                    value={progress}
                                    onChange={(e) => setProgress(parseInt(e.target.value))}
                                    style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                                />
                                <span style={{ fontWeight: 700, fontSize: 'var(--font-lg)' }}>{progress}%</span>
                                <button className="btn btn-primary btn-sm" onClick={handleProgressUpdate}>Save</button>
                            </div>
                        </div>
                    )}

                    {/* Sub-tasks — PRD §3: CRUD for sub-items */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header"><h3>Sub-tasks</h3></div>
                        {goal.tasks && goal.tasks.length > 0 ? (
                            goal.tasks.map(t => (
                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                    <select
                                        className="form-control"
                                        value={t.status}
                                        onChange={(e) => handleUpdateTaskStatus(t.id, e.target.value)}
                                        style={{ width: '120px', fontSize: 'var(--font-xs)', padding: '4px 8px' }}
                                    >
                                        <option value="todo">To Do</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="done">Done</option>
                                    </select>
                                    <span style={{ flex: 1, fontSize: 'var(--font-sm)', textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.6 : 1 }}>{t.name}</span>
                                    <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }} onClick={() => handleDeleteTask(t.id)}>✕</button>
                                </div>
                            ))
                        ) : (
                            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>No sub-tasks yet</p>
                        )}
                        {(goal.status === 'active' || goal.status === 'draft') && (
                            <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '8px', marginTop: '0.75rem' }}>
                                <input
                                    className="form-control"
                                    placeholder="Add a sub-task..."
                                    value={newTaskName}
                                    onChange={(e) => setNewTaskName(e.target.value)}
                                />
                                <button type="submit" className="btn btn-primary btn-sm" disabled={addingTask}>
                                    {addingTask ? '...' : 'Add'}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Feedback */}
                    {(memberFb || evaluatorFb) && (
                        <div className="card" style={{ marginBottom: '1.5rem' }}>
                            <div className="card-header"><h3>Feedback</h3></div>
                            {memberFb && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Member Self-Reflection</div>
                                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', background: 'var(--bg-glass)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                                        {memberFb.feedback}
                                    </p>
                                </div>
                            )}
                            {evaluatorFb && (
                                <div>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Evaluator Feedback</div>
                                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', background: 'var(--bg-glass)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                                        {evaluatorFb.feedback}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Evaluations */}
                    {goal.evaluations && goal.evaluations.length > 0 && (
                        <div className="card" style={{ marginBottom: '1.5rem' }}>
                            <div className="card-header">
                                <h3>Evaluation</h3>
                                {goal.is_finalized && (
                                    <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                        Final: {goal.final_rating} ({goal.final_score})
                                    </span>
                                )}
                            </div>
                            {goal.evaluations.map(ev => (
                                <div key={ev.id} className="dimension-rating">
                                    <span className="dim-name">{ev.dimension_name}</span>
                                    <span className={`status-pill ${ev.rating_score >= 4 ? 'completed' : ev.rating_score >= 3 ? 'active' : 'rejected'}`}>
                                        {ev.rating_name} ({ev.rating_score})
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Comments */}
                    <div className="card">
                        <div className="card-header"><h3>Comments</h3></div>
                        {goal.comments && goal.comments.length > 0 ? (
                            goal.comments.map(c => (
                                <div key={c.id} className="comment-item">
                                    <div className="comment-header">
                                        <span className="comment-author">{c.user_name}</span>
                                        <span className="comment-time">{formatDate(c.created_at)}</span>
                                    </div>
                                    <div className="comment-text">{c.comment}</div>
                                </div>
                            ))
                        ) : (
                            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>No comments yet</p>
                        )}
                        <form onSubmit={handleComment} style={{ marginTop: '1rem', display: 'flex', gap: '8px' }}>
                            <input
                                className="form-control"
                                placeholder="Add a comment..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                            <button type="submit" className="btn btn-primary btn-sm">Post</button>
                        </form>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="goal-detail-sidebar">
                    <div className="card">
                        <h3 style={{ fontSize: 'var(--font-md)', marginBottom: '1rem' }}>Details</h3>
                        <div className="info-row"><span className="info-label">Level</span><span>{goal.entity_name}</span></div>
                        <div className="info-row"><span className="info-label">Priority</span><span>{goal.priority_name || '—'}</span></div>
                        <div className="info-row"><span className="info-label">Period</span><span>{goal.goal_period_name || '—'}</span></div>
                        <div className="info-row"><span className="info-label">Team</span><span>{goal.team_name || '—'}</span></div>
                        <div className="info-row"><span className="info-label">Assigned To</span><span>{goal.assigned_to_name}</span></div>
                        <div className="info-row"><span className="info-label">Created By</span><span>{goal.created_by_name}</span></div>
                        <div className="info-row"><span className="info-label">Approver</span><span>{goal.evaluator_name || '—'}</span></div>
                        <div className="info-row"><span className="info-label">Due Date</span><span>{formatDate(goal.due_date)}</span></div>
                        <div className="info-row"><span className="info-label">Weightage</span><span>{goal.weightage != null ? `${goal.weightage}%` : '—'}</span></div>
                        <div className="info-row"><span className="info-label">Completion</span><span style={{ fontWeight: 700 }}>{goal.target_completion != null ? `${goal.target_completion}%` : '0%'}</span></div>
                        <div style={{ marginTop: '1rem' }}>
                            <div className={`progress-bar ${goal.is_at_risk ? 'at-risk' : ''}`}>
                                <div className="fill" style={{ width: `${goal.target_completion || 0}%` }} />
                            </div>
                        </div>
                        {goal.is_finalized && (
                            <>
                                <div className="info-row" style={{ marginTop: '1rem' }}>
                                    <span className="info-label">Final Rating</span>
                                    <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{goal.final_rating}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Final Score</span>
                                    <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{goal.final_score}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Reject Goal</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowRejectModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Reason for rejection (required)</label>
                                <textarea className="form-control" value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} placeholder="Explain why this goal is being rejected..." />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={() => { handleAction('reject', { comment: rejectComment }); setShowRejectModal(false); setRejectComment(''); }}>
                                Reject Goal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback Modal */}
            {showFeedbackModal && (
                <div className="modal-overlay" onClick={() => setShowFeedbackModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{feedbackType === 'member' ? 'Self-Reflection' : 'Evaluator Feedback'}</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowFeedbackModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                {feedbackType === 'member'
                                    ? 'What did you deliver? What would you do differently?'
                                    : 'Provide your assessment of the goal completion.'}
                            </p>
                            <div className="form-group">
                                <label>Feedback</label>
                                <textarea className="form-control" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={5} placeholder="Write your feedback..." />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowFeedbackModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => handleFeedback(feedbackType)}>
                                Submit Feedback
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Evaluation Modal */}
            {showEvalModal && (
                <div className="modal-overlay" onClick={() => setShowEvalModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
                        <div className="modal-header">
                            <h2>Evaluate & Score</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowEvalModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                                Rate the goal across all five dimensions and set the final rating.
                            </p>
                            {dimensions.map(dim => (
                                <div key={dim.id} className="dimension-rating">
                                    <span className="dim-name">{dim.name}</span>
                                    <select
                                        className="form-control"
                                        style={{ width: '200px' }}
                                        value={evalData[dim.id] || ''}
                                        onChange={(e) => setEvalData({ ...evalData, [dim.id]: e.target.value })}
                                    >
                                        <option value="">Select rating</option>
                                        {ratings.map(r => (
                                            <option key={r.id} value={r.id}>{r.name} ({r.score})</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label>Final Rating</label>
                                <select className="form-control" value={finalRating} onChange={(e) => setFinalRating(e.target.value)}>
                                    <option value="">Select final rating</option>
                                    <option value="Below Expectations">Below Expectations</option>
                                    <option value="Meets Expectations">Meets Expectations</option>
                                    <option value="Above Expectations">Above Expectations</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowEvalModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleEvaluation}>Finalize Score</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
