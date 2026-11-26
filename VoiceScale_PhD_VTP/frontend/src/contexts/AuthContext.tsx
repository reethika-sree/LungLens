import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchCurrentUser,
  loginUser,
  signupUser,
  logout as logoutAction,
  setUser as setUserAction,
  setShowSessionExpiredModal as setModalAction,
  setAuthLoading,
} from '../store/slices/authSlice';
import type { User } from '../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (full_name: string, email: string, password: string, confirm_password: string, role?: string) => Promise<User>;
  logout: () => void;
  setUser: (user: User | null) => void;
  showSessionExpiredModal: boolean;
  setShowSessionExpiredModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { user, isLoading, isAuthenticated, showSessionExpiredModal } = useAppSelector(state => state.auth);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      dispatch(fetchCurrentUser());
    } else {
      dispatch(setAuthLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    const handle = () => {
      dispatch(setModalAction(true));
      dispatch(logoutAction());
    };
    window.addEventListener('sessionExpired', handle);
    return () => window.removeEventListener('sessionExpired', handle);
  }, [dispatch]);

  // Proactive JWT expiry check every 30s
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp <= Date.now() / 1000 + 30) {
          dispatch(setModalAction(true));
          dispatch(logoutAction());
        }
      } catch {}
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [dispatch]);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await dispatch(loginUser({ email, password })).unwrap();
    return res.user;
  };

  const signup = async (
    full_name: string,
    email: string,
    password: string,
    confirm_password: string,
    role = 'patient'
  ): Promise<User> => {
    const res = await dispatch(
      signupUser({ full_name, email, password, confirm_password, role })
    ).unwrap();
    return res.user;
  };

  const logout = () => {
    dispatch(logoutAction());
  };

  const setUser = (u: User | null) => {
    dispatch(setUserAction(u));
  };

  const setShowSessionExpiredModal = (show: boolean) => {
    dispatch(setModalAction(show));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        signup,
        logout,
        setUser,
        showSessionExpiredModal,
        setShowSessionExpiredModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
