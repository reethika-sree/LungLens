import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi, type User } from '../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (full_name: string, email: string, password: string, confirm_password: string, role?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  showSessionExpiredModal: boolean;
  setShowSessionExpiredModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);

  const setUser = (u: User | null) => setUserState(u);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      authApi.getMe()
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('access_token'))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = () => { setShowSessionExpiredModal(true); logout(); };
    window.addEventListener('sessionExpired', handle);
    return () => window.removeEventListener('sessionExpired', handle);
  }, []);

  // Proactive JWT expiry check every 30s
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp <= Date.now() / 1000 + 30) {
          setShowSessionExpiredModal(true);
          logout();
        }
      } catch {}
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const login = async (email: string, password: string) => {
    logout();
    const res = await authApi.loginJson({ email, password });
    localStorage.setItem('access_token', res.data.access_token);
    setUser(res.data.user);
  };

  const signup = async (full_name: string, email: string, password: string, confirm_password: string, role = 'patient') => {
    const res = await authApi.signup({ full_name, email, password, confirm_password, role });
    localStorage.setItem('access_token', res.data.access_token);
    setUser(res.data.user);
  };

  const logout = () => { localStorage.removeItem('access_token'); setUserState(null); };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, signup, logout, setUser, showSessionExpiredModal, setShowSessionExpiredModal }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
