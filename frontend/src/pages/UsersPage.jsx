import { useState, useEffect } from 'react';
import api from '../api/client';

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [userForm, setUserForm] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', user_type: 'member', team: '', evaluator: '' });
    const [teamForm, setTeamForm] = useState({ name: '', description: '', lead: '' });

    const fetch = () => {
        setLoading(true);
        Promise.all([api.get('/users/'), api.get('/teams/')]).then(([u, t]) => {
            setUsers(u.data.results || u.data);
            setTeams(t.data.results || t.data);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { fetch(); }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        const payload = { ...userForm, team: userForm.team || null, evaluator: userForm.evaluator || null };
        try { await api.post('/users/', payload); setShowUserModal(false); fetch(); }
        catch (err) { alert(JSON.stringify(err.response?.data || 'Error')); }
    };

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        const payload = { ...teamForm, lead: teamForm.lead || null };
        try { await api.post('/teams/', payload); setShowTeamModal(false); fetch(); }
        catch (err) { alert(JSON.stringify(err.response?.data || 'Error')); }
    };

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    return (
        <div className="fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div><h1>Users & Teams</h1><p>Manage organization members and teams</p></div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowTeamModal(true)}>+ Team</button>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowUserModal(true)}>+ User</button>
                </div>
            </div>

            <div className="grid-2">
                <div>
                    <h2 style={{ fontSize: 'var(--font-lg)', marginBottom: '1rem' }}>Teams ({teams.length})</h2>
                    {teams.map(t => (
                        <div key={t.id} className="card" style={{ marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div><strong>{t.name}</strong><div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Lead: {t.lead_name || '—'} · {t.member_count} members</div></div>
                            </div>
                        </div>
                    ))}
                </div>
                <div>
                    <h2 style={{ fontSize: 'var(--font-lg)', marginBottom: '1rem' }}>Users ({users.length})</h2>
                    <div className="table-container">
                        <table>
                            <thead><tr><th>Name</th><th>Type</th><th>Team</th></tr></thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td><strong>{u.first_name} {u.last_name}</strong><div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{u.username}</div></td>
                                        <td><span className={`status-pill ${u.user_type === 'admin' ? 'scored' : u.user_type === 'manager' ? 'active' : 'draft'}`}>{u.user_type}</span></td>
                                        <td>{u.team_name || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showUserModal && (
                <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Add User</h2><button className="btn btn-icon btn-secondary" onClick={() => setShowUserModal(false)}>✕</button></div>
                        <div className="modal-body">
                            <form onSubmit={handleCreateUser}>
                                <div className="grid-2">
                                    <div className="form-group"><label>First Name</label><input className="form-control" value={userForm.first_name} onChange={e => setUserForm({ ...userForm, first_name: e.target.value })} required /></div>
                                    <div className="form-group"><label>Last Name</label><input className="form-control" value={userForm.last_name} onChange={e => setUserForm({ ...userForm, last_name: e.target.value })} required /></div>
                                </div>
                                <div className="form-group"><label>Username</label><input className="form-control" value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} required /></div>
                                <div className="form-group"><label>Email</label><input className="form-control" type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} required /></div>
                                <div className="form-group"><label>Password</label><input className="form-control" type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required /></div>
                                <div className="grid-2">
                                    <div className="form-group"><label>Role</label><select className="form-control" value={userForm.user_type} onChange={e => setUserForm({ ...userForm, user_type: e.target.value })}><option value="member">Member</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div>
                                    <div className="form-group"><label>Team</label><select className="form-control" value={userForm.team} onChange={e => setUserForm({ ...userForm, team: e.target.value })}><option value="">None</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                                </div>
                                <div className="form-group"><label>Evaluator</label><select className="form-control" value={userForm.evaluator} onChange={e => setUserForm({ ...userForm, evaluator: e.target.value })}><option value="">None</option>{users.filter(u => u.user_type !== 'member').map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Create User</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showTeamModal && (
                <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Add Team</h2><button className="btn btn-icon btn-secondary" onClick={() => setShowTeamModal(false)}>✕</button></div>
                        <div className="modal-body">
                            <form onSubmit={handleCreateTeam}>
                                <div className="form-group"><label>Team Name</label><input className="form-control" value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} required /></div>
                                <div className="form-group"><label>Description</label><textarea className="form-control" value={teamForm.description} onChange={e => setTeamForm({ ...teamForm, description: e.target.value })} /></div>
                                <div className="form-group"><label>Team Lead</label><select className="form-control" value={teamForm.lead} onChange={e => setTeamForm({ ...teamForm, lead: e.target.value })}><option value="">None</option>{users.filter(u => u.user_type !== 'member').map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Create Team</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
