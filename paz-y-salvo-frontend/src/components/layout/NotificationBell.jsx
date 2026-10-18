import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notifications.service';

const REFRESH_MS = 60000;

// A dónde lleva cada tipo de aviso al abrirlo
const DESTINOS = {
  NUEVO_USUARIO_SIN_VERIFICAR: '/dashboard/admin?tab=solicitantes&filtro=pendientes',
  CAMBIO_TIPO_VINCULACION: '/dashboard/admin?tab=solicitantes',
  SOLICITUD_REVISION: '/dashboard/encargado',
  SOLICITUD_APROBACION_FINAL: '/dashboard/aprobador',
  REVISION_APROBADA: '/dashboard/usuario',
  REVISION_BLOQUEADA: '/dashboard/usuario',
  TRAMITE_APROBADO: '/dashboard/usuario',
  TRAMITE_RECHAZADO: '/dashboard/usuario',
  VINCULACION_VERIFICADA: '/dashboard/usuario',
};

function timeAgo(value) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'ahora';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await getNotifications({ limit: 20 });
      setItems(data.data || []);
      setUnread(data.noLeidas || 0);
      setError('');
    } catch {
      setError('No se pudieron cargar las notificaciones');
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) load();
    setOpen((value) => !value);
  };

  const handleRead = async (item) => {
    const destino = DESTINOS[item.tipo];
    if (destino) {
      setOpen(false);
      navigate(destino);
    }
    if (item.leida) return;
    try {
      await markNotificationRead(item.id);
      setItems((list) => list.map((n) => (n.id === item.id ? { ...n, leida: true } : n)));
      setUnread((count) => Math.max(0, count - 1));
    } catch {
      setError('No se pudo marcar la notificación');
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((list) => list.map((n) => ({ ...n, leida: true })));
      setUnread(0);
    } catch {
      setError('No se pudieron marcar las notificaciones');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-base transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A2540]/40"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#D97706] px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-modal"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-[#0A2540]">Notificaciones</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleReadAll}
                className="text-[11px] font-semibold text-[#0A2540] underline-offset-2 hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {error && <p className="px-4 py-2 text-xs text-red-600">{error}</p>}

          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {items.length === 0 && !error && (
              <li className="px-4 py-6 text-center text-xs text-slate-500">No tienes notificaciones.</li>
            )}
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleRead(item)}
                  className={`block w-full px-4 py-3 text-left transition hover:bg-slate-50 ${item.leida ? '' : 'bg-amber-50/60'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs ${item.leida ? 'font-medium text-slate-700' : 'font-bold text-[#0A2540]'}`}>
                      {item.titulo}
                    </p>
                    <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(item.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{item.mensaje}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
