import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
    { to: '/', label: 'Dashboard', icon: '📊', roles: ['admin', 'manager', 'member'] },
    { to: '/goals', label: 'Goals', icon: '🎯', roles: ['admin', 'manager', 'member'] },
    { to: '/approvals', label: 'Approvals', icon: '✅', roles: ['admin', 'manager'] },
    { to: '/reports', label: 'Reports', icon: '📈', roles: ['admin', 'manager', 'member'] },
    { to: '/users', label: 'Users & Teams', icon: '👥', roles: ['admin'] },
];

export default function Layout() {
    const { user, logout } = useAuth();
    const initials = `${(user?.first_name || '')[0] || ''}${(user?.last_name || '')[0] || ''}`.toUpperCase() || 'U';

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <h1>GMS</h1>
                    <span>Goal Management</span>
                </div>

                <nav className="sidebar-nav">
                    {navItems
                        .filter(item => item.roles.includes(user?.user_type))
                        .map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) => isActive ? 'active' : ''}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                {item.label}
                            </NavLink>
                        ))}
                </nav>

                <div className="sidebar-user">
                    <div className="avatar">{initials}</div>
                    <div className="user-info">
                        <p>{user?.first_name} {user?.last_name}</p>
                        <span>{user?.user_type}</span>
                    </div>
                    <button
                        className="btn btn-sm btn-secondary"
                        onClick={logout}
                        title="Logout"
                        style={{ marginLeft: 'auto', padding: '6px 10px' }}
                    >
                        ↪
                    </button>
                </div>
            </aside>

            <main className="main-content fade-in">
                <Outlet />
            </main>
        </div>
    );
}
