import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/auth/Login';
import DashboardUser from '../pages/user/DashboardUser';
import DashboardArea from '../pages/area-manager/DashboardArea';
import DashboardApprover from '../pages/approver/DashboardApprover';
import DashboardAdmin from '../pages/admin/DashboardAdmin';
import VerifyCertificate from '../pages/certificates/VerifyCertificate';
import Perfil from '../pages/profile/Perfil';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../hooks/useAuth';

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
    </Router>
  );
};

export default AppRoutes;
