import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/auth/Login';
import VerifyCertificate from '../pages/certificates/VerifyCertificate';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../hooks/useAuth';

// Cada panel se descarga solo cuando la persona entra a él (la carga inicial queda más liviana)
const DashboardUser = lazy(() => import('../pages/user/DashboardUser'));
const DashboardArea = lazy(() => import('../pages/area-manager/DashboardArea'));
const DashboardApprover = lazy(() => import('../pages/approver/DashboardApprover'));
const DashboardAdmin = lazy(() => import('../pages/admin/DashboardAdmin'));
const Perfil = lazy(() => import('../pages/profile/Perfil'));

const Cargando = () => (
  <p role="status" className="p-8 text-center text-sm text-slate-500">Cargando…</p>
);

const HomeRedirect = () => {
  const { user, home } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={home || '/login'} replace />;
};

const AppRoutes = () => {
  return (
    <Router>
      <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verificar/:token" element={<VerifyCertificate />} />

        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <Perfil />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/usuario"
          element={
            <ProtectedRoute allowedRoles={['Docente', 'Administrativo', 'Contratista']}>
              <DashboardUser />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/encargado"
          element={
            <ProtectedRoute allowedRoles={['Encargado de Área', 'Jefe Inmediato']}>
              <DashboardArea />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/aprobador"
          element={
            <ProtectedRoute allowedRoles={['Aprobador Comunidad Universitaria']}>
              <DashboardApprover />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute allowedRoles={['Administrador DTI']}>
              <DashboardAdmin />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </Router>
  );
};

export default AppRoutes;
