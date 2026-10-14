import * as React from 'react';
import { api, ApiError, setAuthToken } from '@/lib/api';
import type { Role, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  isAdmin: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

export interface RegisterInput {
  username: string;
  email: string;
  fullName: string;
  className?: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [status, setStatus] = React.useState<AuthContextValue['status']>('loading');

  const loadMe = React.useCallback(async () => {
    try {
      const res = await api.get<User>('/auth/me');
      setUser(res.data);
      setStatus('authenticated');
    } catch (err) {
      // 401 simply means "no session yet" - that is not an error worth showing.
      if (!(err instanceof ApiError) || err.status !== 401) {
        // Any other failure still resolves to anonymous; the login screen
        // will surface the real problem on the next attempt.
        setUser(null);
      }
      setAuthToken(null);
      setStatus('anonymous');
    }
  }, []);

  React.useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = React.useCallback(async (identifier: string, password: string) => {
    const res = await api.post<{ user: User; token: string }>('/auth/login', {
      identifier,
      password,
    });
    // Keep the token as a fallback for tools that read it; the primary
    // mechanism is the httpOnly cookie set by the server.
    setAuthToken(res.data.token);
    setUser(res.data.user);
    setStatus('authenticated');
    return res.data.user;
  }, []);

  const register = React.useCallback(async (input: RegisterInput) => {
    const res = await api.post<{ user: User }>('/auth/register', input);
    return res.data.user;
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAuthToken(null);
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      refresh: loadMe,
      setUser,
    }),
    [user, status, login, register, logout, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}

/** Where each role lands after signing in. */
export function homePathFor(role: Role): string {
  return role === 'admin' ? '/admin' : '/perpustakaan';
}

export { AuthContext };
