import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

// ✅ helper to normalize API responses
const getList = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.results)) return data.results;
    return [];
};

export default function GoalFormPage() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const { user } = useAuth();
    const navigate = useNavigate();

    const [entities, setEntities] = useState([]);
    const [priorities, setPriorities] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [teams, setTeams] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [initialLoading, setInitialLoading] = useState(true);

    const [form, setForm] = useState({
        name: '',
        description: '',
        entity: '',
        priority: '',
        goal_period: '',
        team: '',
        assigned_to: '',
        evaluator: '',
        due_date: '',
        weightage: 100,
        labels: '',
    });

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const [e, p, gp, t, u] = await Promise.all([
                    api.get('/entities/'),
                    api.get('/priorities/'),
                    api.get('/goal-periods/'),
                    api.get('/teams/'),
                    api.get('/users/'),
                ]);

                if (!isMounted) return;

                setEntities(getList(e.data));
                setPriorities(getList(p.data));
                setPeriods(getList(gp.data));
                setTeams(getList(t.data));
                setUsers(getList(u.data));

                // ✅ edit mode
                if (isEdit) {
                    const res = await api.get(`/goals/${id}/`);
                    if (!isMounted) return;

                    const g = res.data;

                    setForm({
                        name: g.name,
                        description: g.description || '',
                        entity: g.entity,
                        priority: g.priority || '',
                        goal_period: g.goal_period || '',
                        team: g.team || '',
                        assigned_to: g.assigned_to,
                        evaluator: g.evaluator || '',
                        due_date: g.due_date,
                        weightage: g.weightage,
                        labels: Array.isArray(g.labels) ? g.labels.join(', ') : '',
                    });
                } else {
                    setForm((f) => ({
                        ...f,
                        assigned_to: user?.id || '',
                    }));
                }
            } catch (err) {
                console.error('Failed to load form data', err);
                if (isMounted) {
                    setError('Failed to load form data.');
                }
            } finally {
                if (isMounted) {
                    setInitialLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [id, isEdit, user?.id]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const payload = {
            ...form,
            entity: parseInt(form.entity),
            priority: form.priority ? parseInt(form.priority) : null,
            goal_period: form.goal_period ? parseInt(form.goal_period) : null,
            team: form.team ? parseInt(form.team) : null,
            assigned_to: parseInt(form.assigned_to),
            evaluator: form.evaluator ? parseInt(form.evaluator) : null,
            weightage: parseInt(form.weightage),
            labels: form.labels
                ? form.labels.split(',').map((l) => l.trim()).filter(Boolean)
                : [],
        };

        try {
            if (isEdit) {
                await api.put(`/goals/${id}/`, payload);
                navigate(`/goals/${id}`);
            } else {
                const res = await api.post('/goals/', payload);
                navigate(`/goals/${res.data.id}`);
            }
        } catch (err) {
            const data = err.response?.data;
            if (typeof data === 'object') {
                const msgs = Object.entries(data).map(
                    ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`
                );
                setError(msgs.join(' | '));
            } else {
                setError('Failed to save goal.');
            }
        } finally {
            setLoading(false);
        }
    };

    // ✅ optional loading state
    if (initialLoading) {
        return <div className="fade-in">Loading...</div>;
    }

    return (
        <div className="fade-in">
            <div style={{ marginBottom: '1rem' }}>
                <Link
                    to="/goals"
                    style={{
                        fontSize: 'var(--font-sm)',
                        color: 'var(--text-muted)',
                    }}
                >
                    ← Back to Goals
                </Link>
            </div>

            <div className="page-header">
                <h1>{isEdit ? 'Edit Goal' : 'Create New Goal'}</h1>
                <p>
                    {isEdit
                        ? 'Update the goal details below.'
                        : 'Set up a new goal for tracking.'}
                </p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="card" style={{ maxWidth: '720px' }}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Goal Title *</label>
                        <input
                            className="form-control"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            required
                            placeholder="e.g. Increase user retention by 15%"
                        />
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            className="form-control"
                            name="description"
                            value={form.description}
                            onChange={handleChange}
                            rows={4}
                        />
                    </div>

                    <div className="grid-2">
                        <div className="form-group">
                            <label>Level *</label>
                            <select
                                className="form-control"
                                name="entity"
                                value={form.entity}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select level</option>
                                {Array.isArray(entities) &&
                                    entities.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Priority</label>
                            <select
                                className="form-control"
                                name="priority"
                                value={form.priority}
                                onChange={handleChange}
                            >
                                <option value="">Select priority</option>
                                {Array.isArray(priorities) &&
                                    priorities.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid-2">
                        <div className="form-group">
                            <label>Goal Period</label>
                            <select
                                className="form-control"
                                name="goal_period"
                                value={form.goal_period}
                                onChange={handleChange}
                            >
                                <option value="">Select period</option>
                                {Array.isArray(periods) &&
                                    periods.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Team</label>
                            <select
                                className="form-control"
                                name="team"
                                value={form.team}
                                onChange={handleChange}
                            >
                                <option value="">Select team</option>
                                {Array.isArray(teams) &&
                                    teams.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid-2">
                        <div className="form-group">
                            <label>Assigned To *</label>
                            <select
                                className="form-control"
                                name="assigned_to"
                                value={form.assigned_to}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select user</option>
                                {Array.isArray(users) &&
                                    users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.first_name} {u.last_name} ({u.username})
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Due Date *</label>
                            <input
                                className="form-control"
                                type="date"
                                name="due_date"
                                value={form.due_date}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid-2">
                        <div className="form-group">
                            <label>Weightage (%)</label>
                            <input
                                className="form-control"
                                type="number"
                                name="weightage"
                                min="1"
                                max="100"
                                value={form.weightage}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Approver / Evaluator *</label>
                        <select
                            className="form-control"
                            name="evaluator"
                            value={form.evaluator}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select Approver</option>
                            {users.filter(u => u.user_type === 'manager' || u.user_type === 'admin').map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.first_name} {u.last_name} ({u.user_type})
                                </option>
                            ))}
                        </select>
                        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                            The person who will approve and score this goal.
                        </p>
                    </div>

                    <div className="form-group">
                        <label>Labels (comma separated)</label>
                        <input
                            className="form-control"
                            name="labels"
                            value={form.labels}
                            onChange={handleChange}
                            placeholder="Growth, Delivery, Process"
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading
                                ? 'Saving...'
                                : isEdit
                                    ? 'Update Goal'
                                    : 'Create Goal'}
                        </button>
                        <Link to="/goals" className="btn btn-secondary">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}