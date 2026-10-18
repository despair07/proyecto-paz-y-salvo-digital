import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  loginWithPassword as loginWithPasswordRequest,
  login as loginRequest,
  me,
  updateTipoVinculacion as updateTipoRequest,
} from '../services/auth.service.js';

export const AuthContext = createContext(null);

function getRolesFromUser(user) {
  return user?.roles?.map((role) => (
    typeof role === 'string' ? role : role.nombre_rol
  )) ?? [];
}

function getHomeForUser(user) {
  const roles = getRolesFromUser(user);

  if (roles.includes('Administrador DTI')) {
    return '/dashboard/admin';
  }
  if (roles.some((role) => ['Encargado de Área', 'Jefe Inmediato'].includes(role))) {
    return '/dashboard/encargado';
  }
  if (roles.includes('Aprobador Comunidad Universitaria')) {
    return '/dashboard/aprobador';
  }
  if (roles.some((role) => ['Docente', 'Administrativo', 'Contratista'].includes(role))) {
    return '/dashboard/usuario';
  }
  // Sin rol: la persona todavía debe elegir su tipo de vinculación
  return '/perfil';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [home, setHome] = useState('/login');
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    const token = localStorage.getItem('pys_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await me();
      const nextUser = data.usuario;
      setUser(nextUser);
      setHome(getHomeForUser(nextUser));
    } catch {
      localStorage.removeItem('pys_token');
      setUser(null);
      setHome('/login');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const setSession = useCallback((nextUser, token) => {
    if (token) {
      localStorage.setItem('pys_token', token);
    }
    setUser(nextUser);
    const userHome = getHomeForUser(nextUser);
    setHome(userHome);
    return userHome;
  }, []);

  const login = useCallback(async (googleToken) => {
    const data = await loginRequest(googleToken);
    const userHome = setSession(data.usuario, data.token);
    return { ...data, home: userHome };
  }, [setSession]);

  const loginWithPassword = useCallback(async (email, password) => {
    const data = await loginWithPasswordRequest(email, password);
    const userHome = setSession(data.usuario, data.token);
    return { ...data, home: userHome };
  }, [setSession]);

  // Elegir o cambiar el tipo de vinculación; el backend devuelve un token con los roles nuevos
  const updateTipoVinculacion = useCallback(async (tipo, confirmar = false) => {
    const data = await updateTipoRequest(tipo, confirmar);
    const userHome = setSession(data.usuario, data.token);
    return { ...data, home: userHome };
  }, [setSession]);

  const logout = useCallback(() => {
    localStorage.removeItem('pys_token');
    setUser(null);
    setHome('/login');
  }, []);

  const value = useMemo(
    () => ({
      user,
      home,
      loading,
      login,
      loginWithPassword,
      updateTipoVinculacion,
      logout,
      hasRole: (roles) => getRolesFromUser(user).some((role) => roles.includes(role)),
    }),
    [user, home, loading, login, loginWithPassword, updateTipoVinculacion, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
