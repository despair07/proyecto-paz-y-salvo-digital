import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const Header = ({ title }) => {
  const { user, logout } = useAuth();
  const roles = user?.roles?.map((role) => (typeof role === 'string' ? role : role.nombre_rol)) ?? [];
  const userName = [user?.nombres, user?.apellidos].filter(Boolean).join(' ') || user?.nombre_completo || 'Usuario';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 shadow-sm">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D97706]">Corporación Universitaria Autónoma del Cauca</p>
          <h1 className="text-lg font-bold text-[#0A2540] tracking-tight sm:text-xl">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col text-right">
          <span className="text-xs font-semibold text-slate-800">{userName}</span>
          <span className="text-[11px] text-slate-500">{roles[0] || 'Institucional'}</span>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0A2540] text-sm font-bold text-white shadow-sm">
          {userName.charAt(0).toUpperCase()}
        </div>

        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600"
        >
          Salir
        </button>
      </div>
    </header>
  );
};

export default Header;
