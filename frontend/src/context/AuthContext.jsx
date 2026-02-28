import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('gms_token');
        const stored = localStorage.getItem('gms_user');
        if (token && stored) {
            setUser(JSON.parse(stored));
            // Verify token is still valid
            api.get('/auth/me/').then(res => {
                setUser(res.data);
                localStorage.setItem('gms_user', JSON.stringify(res.data));
            }).catch(() => {
                logout();
            }).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (username, password) => {
        const res = await api.post('/auth/login/', { username, password });
        localStorage.setItem('gms_token', res.data.token);
        localStorage.setItem('gms_user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        return res.data.user;
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout/');
        } catch { /* ignore */ }
        localStorage.removeItem('gms_token');
        localStorage.removeItem('gms_user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
