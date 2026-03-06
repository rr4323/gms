import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const emptyUserForm = { username: '', email: '', password: '', first_name: '', last_name: '', user_type: 'member', team: '', evaluator: '' };
const emptyTeamForm = { name: '', description: '', lead: '' };

export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [showTeamDetail, setShowTeamDetail] = useState(null); // team object for detail view
    const [editTeam, setEditTeam] = useState(null); // team object for editing
    const [userForm, setUserForm] = useState({ ...emptyUserForm });
    const [teamForm, setTeamForm] = useState({ ...emptyTeamForm });

    const fetchData = () => {
        setLoading(true);
        Promise.all([api.get('/users/'), api.get('/teams/')]).then(([u, t]) => {
            setUsers(u.data.results || u.data);
            setTeams(t.data.results || t.data);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    // NB-1: Reset form when opening Add Team modal
    const openAddTeam = () => {
        setTeamForm({ ...emptyTeamForm });
        setEditTeam(null);
        setShowTeamModal(true);
    };

    // NB-2: Open team for editing
    const openEditTeam = (team) => {
        setTeamForm({ name: team.name, description: team.description || '', lead: team.lead || '' });
        setEditTeam(team);
        setShowTeamModal(true);
    };

    // NB-4: Reset user form (clears password field) when opening Add User modal
    const openAddUser = () => {
        setUserForm({ ...emptyUserForm });
        setShowUserModal(true);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        const payload = { ...userForm, team: userForm.team || null, evaluator: userForm.evaluator || null };
        try { await api.post('/users/', payload); setShowUserModal(false); setUserForm({ ...emptyUserForm }); fetchData(); }
        catch (err) { alert(JSON.stringify(err.response?.data || 'Error')); }
    };

    const handleSaveTeam = async (e) => {
        e.preventDefault();
        const payload = { ...teamForm, lead: teamForm.lead || null };
        try {
            if (editTeam) {
                await api.put(`/teams/${editTeam.id}/`, payload);
            } else {
                await api.post('/teams/', payload);
            }
            setShowTeamModal(false);
            setTeamForm({ ...emptyTeamForm });
            setEditTeam(null);
            fetchData();
        } catch (err) { alert(JSON.stringify(err.response?.data || 'Error')); }
    };

    // NB-3: Get members of a specific team
    const getTeamMembers = (teamId) => users.filter(u => u.team === teamId);

    if (loading) return <div className="loading-page"><div className="spinner" /></div>;

    return (
        <div className="fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div><h1>Users & Teams</h1><p>Manage organization members and teams</p></div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary btn-sm" onClick={openAddTeam}>+ Team</button>
                    <button className="btn btn-primary btn-sm" onClick={openAddUser}>+ User</button>
                </div>
            </div>

            <div className="grid-2">
                <div>
                    <h2 style={{ fontSize: 'var(--font-lg)', marginBottom: '1rem' }}>Teams ({teams.length})</h2>
                    {teams.map(t => (
                        <div key={t.id} className="card" style={{ marginBottom: '0.75rem', cursor: 'pointer' }}
                            onClick={() => setShowTeamDetail(showTeamDetail?.id === t.id ? null : t)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <strong>{t.name}</strong>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                                        Lead: {t.lead_name || '—'} · {t.member_count} members
                                    </div>
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openEditTeam(t); }}>Edit</button>
                            </div>
                            {/* NB-2 & NB-3: Show team members when team is clicked */}
                            {showTeamDetail?.id === t.id && (
                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Team Members</div>
                                    {getTeamMembers(t.id).length > 0 ? (
                                        getTeamMembers(t.id).map(m => (
                                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--font-sm)' }}>
                                                <span>{m.first_name} {m.last_name} <span style={{ color: 'var(--text-muted)' }}>({m.username})</span></span>
                                                <span className={`status-pill ${m.user_type === 'manager' ? 'active' : 'draft'}`}>{m.user_type}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>No members in this team</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div>
                    <h2 style={{ fontSize: 'var(--font-lg)', marginBottom: '1rem' }}>Users ({users.length})</h2>
                    <div className="table-container">
                        <table>
                            <thead><tr><th>Name</th><th>Type</th><th>Team</th><th>Email</th></tr></thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td><strong>{u.first_name} {u.last_name}</strong><div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{u.username}</div></td>
                                        <td><span className={`status-pill ${u.user_type === 'admin' ? 'scored' : u.user_type === 'manager' ? 'active' : 'draft'}`}>{u.user_type}</span></td>
                                        <td>{u.team_name || '—'}</td>
                                        <td style={{ fontSize: 'var(--font-xs)' }}>{u.email || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add/Edit User Modal */}
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
                                {/* NB-5: Email validation with type=email and required */}
                                <div className="form-group"><label>Email</label><input className="form-control" type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} required /></div>
                                {/* NB-4: autoComplete="new-password" prevents browser autofill */}
                                <div className="form-group"><label>Password</label><input className="form-control" type="password" autoComplete="new-password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required minLength={6} /></div>
                                <div className="grid-2">
                                    <div className="form-group"><label>Role</label><select className="form-control" value={userForm.user_type} onChange={e => setUserForm({ ...userForm, user_type: e.target.value })}><option value="member">Member</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div>
                                    <div className="form-group"><label>Team</label><select className="form-control" value={userForm.team} onChange={e => setUserForm({ ...userForm, team: e.target.value })}><option value="">None</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                                </div>
                                {/* NB-6: Evaluator dropdown — show managers and admins with proper names */}
                                <div className="form-group"><label>Evaluator</label><select className="form-control" value={userForm.evaluator} onChange={e => setUserForm({ ...userForm, evaluator: e.target.value })}><option value="">None</option>{users.filter(u => u.user_type === 'manager' || u.user_type === 'admin').map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.user_type})</option>)}</select></div>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Create User</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Team Modal */}
            {showTeamModal && (
                <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>{editTeam ? 'Edit Team' : 'Add Team'}</h2><button className="btn btn-icon btn-secondary" onClick={() => setShowTeamModal(false)}>✕</button></div>
                        <div className="modal-body">
                            <form onSubmit={handleSaveTeam}>
                                <div className="form-group"><label>Team Name</label><input className="form-control" value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} required /></div>
                                <div className="form-group"><label>Description</label><textarea className="form-control" value={teamForm.description} onChange={e => setTeamForm({ ...teamForm, description: e.target.value })} /></div>
                                <div className="form-group"><label>Team Lead</label><select className="form-control" value={teamForm.lead} onChange={e => setTeamForm({ ...teamForm, lead: e.target.value })}><option value="">None</option>{users.filter(u => u.user_type !== 'member').map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.user_type})</option>)}</select></div>
                                {/* NB-3: Show team members when editing an existing team */}
                                {editTeam && (
                                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
                                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Current Members ({getTeamMembers(editTeam.id).length})</div>
                                        {getTeamMembers(editTeam.id).length > 0 ? (
                                            getTeamMembers(editTeam.id).map(m => (
                                                <div key={m.id} style={{ fontSize: 'var(--font-sm)', padding: '2px 0' }}>
                                                    {m.first_name} {m.last_name} <span style={{ color: 'var(--text-muted)' }}>({m.username})</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>No members yet</p>
                                        )}
                                    </div>
                                )}
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>{editTeam ? 'Update Team' : 'Create Team'}</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
