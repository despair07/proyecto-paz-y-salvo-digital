import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const roles = user.roles?.map((role) => (
    typeof role === 'string' ? role : role.nombre_rol
  )) ?? [];
  const userName = [user.nombres, user.apellidos].filter(Boolean).join(' ') || user.nombre_completo || 'Usuario';
  const email = user.correo_institucional || user.email;

  const isDocente = roles.includes('Docente');
  const isWorker = ['Docente', 'Administrativo', 'Contratista'].some((r) => roles.includes(r));
  const isEncargado = ['Encargado de Área', 'Jefe Inmediato'].some((r) => roles.includes(r));
  const isAprobador = roles.includes('Aprobador Comunidad Universitaria');
  const isAdmin = roles.includes('Administrador DTI');

  const links = [
    ...(isWorker ? [{ to: '/dashboard/usuario', label: 'Mi Paz y Salvo', icon: '📄' }] : []),
    ...(isEncargado ? [{ to: '/dashboard/encargado', label: 'Bandeja de revisión', icon: '🔒' }] : []),
    ...(isAprobador ? [{ to: '/dashboard/aprobador', label: 'Aprobación Final', icon: '✅' }] : []),
    ...(isAdmin ? [{ to: '/dashboard/admin', label: 'Administración DTI', icon: '⚙️' }] : []),
    { to: '/perfil', label: 'Mi perfil', icon: '👤' },
  ];

  return (
    <>
      {/* Botón flotante móvil */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A2540] text-white shadow-lg"
        aria-label="Abrir menú"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Backdrop móvil */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-[#0A2540] text-white shadow-xl transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabecera institucional */}
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D97706] text-white font-bold text-lg shadow-sm">
              U
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D97706]">Paz & Salvo</p>
              <h2 className="text-base font-bold text-white tracking-tight">Uniautónoma</h2>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="inline-block rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
              {roles[0] || 'Institucional'}
            </span>
            <span className="text-[10px] text-slate-400">GTH-07</span>
          </div>
        </div>

        {/* Navegación por rol */}
        <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Navegación
          </p>
          {links.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm border-l-4 border-[#D97706]'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Pie de usuario autenticado */}
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 px-1">
            <p className="text-xs font-semibold text-white truncate">{userName}</p>
            <p className="text-[11px] text-slate-400 truncate">{email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
          >
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
