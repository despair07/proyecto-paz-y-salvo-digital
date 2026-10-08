import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { login as loginRequest, me } from '../services/auth.service.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [home, setHome] = useState('/app');
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    const token = localStorage.getItem('pys_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await me();
      setUser(data.user);
      setHome(data.home);
    } catch {
      localStorage.removeItem('pys_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const login = async (correo, password) => {
    const data = await loginRequest(correo, password);
    localStorage.setItem('pys_token', data.token);
    setUser(data.user);
    setHome(data.home);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('pys_token');
    setUser(null);
    setHome('/app');
  };

  const value = useMemo(
    () => ({ user, home, loading, login, logout, hasRole: (roles) => user?.roles?.some((r) => roles.includes(r)) }),
    [user, home, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
