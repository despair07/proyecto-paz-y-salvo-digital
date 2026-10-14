import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, home } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Cargando tu panel...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRoles = user.roles?.map((role) => (
    typeof role === 'string' ? role : role.nombre_rol
  )) ?? [];

  const hasAllowedRole = !allowedRoles || allowedRoles.some((role) => userRoles.includes(role));
  if (!hasAllowedRole) {
    return <Navigate to={home || '/login'} replace />;
  }

  return children;
};

export default ProtectedRoute;
