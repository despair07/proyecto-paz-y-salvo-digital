import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import {
  actualizarUsuario, asignarDependencia, cambiarEstadoUsuario, getResumenAdmin, listPersonal,
  listSolicitantes, quitarPersonal, registrarPersonal, verificarUsuario,
} from '../../services/admin.service';
import { formatearFecha, mensajeError } from '../../utils/errors';

const LIMITE = 15;
const FILTROS = [
  { id: 'pendientes', texto: 'Por verificar' },
  { id: 'verificados', texto: 'Verificados' },
  { id: 'inactivos', texto: 'Inactivos' },
  { id: 'todos', texto: 'Todos' },
];

const inputClase = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/10';
const botonPrimario = 'rounded-xl bg-[#0A2540] px-4 py-2 text-sm font-bold text-white hover:bg-[#133961] disabled:cursor-not-allowed disabled:opacity-50';
const botonSecundario = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

// ------------------------------------------------------------------ piezas
const Modal = ({ titulo, onCerrar, children }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label={titulo} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-modal">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-[#0A2540]">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};

const Insignia = ({ clases, children }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${clases}`}>{children}</span>
);

const Paginacion = ({ pagination, onPagina }) => {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
      <span>{pagination.totalRecords} resultados · página {pagination.page} de {pagination.totalPages}</span>
      <div className="flex gap-2">
        <button type="button" className={botonSecundario} disabled={pagination.page <= 1} onClick={() => onPagina(pagination.page - 1)}>← Anterior</button>
        <button type="button" className={botonSecundario} disabled={pagination.page >= pagination.totalPages} onClick={() => onPagina(pagination.page + 1)}>Siguiente →</button>
      </div>
    </div>
  );
};

// Formulario de nombre, correo y cargo (editar) + dependencia (registrar personal)
const FormularioPersona = ({ inicial, dependencias, conDependencia, textoGuardar, onGuardar, onCancelar }) => {
  const [form, setForm] = useState({
    nombres: inicial?.nombres || '',
    apellidos: inicial?.apellidos || '',
    correo_institucional: inicial?.correo_institucional || '',
    cargo: inicial?.cargo || '',
    dependencia_id: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const cambia = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const cambioCorreo = inicial && form.correo_institucional.trim().toLowerCase() !== inicial.correo_institucional;

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await onGuardar(form);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar'));
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-3">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Nombres
          <input className={`${inputClase} mt-1 font-normal normal-case tracking-normal`} value={form.nombres} onChange={cambia('nombres')} maxLength={120} required />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Apellidos
          <input className={`${inputClase} mt-1 font-normal normal-case tracking-normal`} value={form.apellidos} onChange={cambia('apellidos')} maxLength={160} required />
        </label>
      </div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
        Correo institucional
        <input type="email" className={`${inputClase} mt-1 font-normal normal-case tracking-normal`} value={form.correo_institucional} onChange={cambia('correo_institucional')} placeholder="nombre.apellido@uniautonoma.edu.co" required />
      </label>
      {cambioCorreo && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          Al cambiar el correo, la persona deberá ingresar con la cuenta de Google del nuevo correo.
        </p>
      )}
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
        Cargo
        <input className={`${inputClase} mt-1 font-normal normal-case tracking-normal`} value={form.cargo} onChange={cambia('cargo')} maxLength={150} />
      </label>
      {conDependencia && (
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Dependencia
          <select className={`${inputClase} mt-1 font-normal normal-case tracking-normal`} value={form.dependencia_id} onChange={cambia('dependencia_id')} required>
            <option value="">Elige la dependencia…</option>
            {dependencias.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </label>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className={botonSecundario} onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button type="submit" className={botonPrimario} disabled={guardando}>{guardando ? 'Guardando…' : textoGuardar}</button>
      </div>
    </form>
  );
};

const Confirmar = ({ titulo, texto, textoBoton, peligro, onConfirmar, onCancelar }) => {
  const [procesando, setProcesando] = useState(false);
  return (
    <Modal titulo={titulo} onCerrar={onCancelar}>
      <p className="text-sm text-slate-700">{texto}</p>
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className={botonSecundario} onClick={onCancelar} disabled={procesando}>Cancelar</button>
        <button
          type="button"
          disabled={procesando}
          onClick={async () => { setProcesando(true); await onConfirmar(); }}
          className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${peligro ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {procesando ? 'Procesando…' : textoBoton}
        </button>
      </div>
    </Modal>
  );
};

// ------------------------------------------------------------------ panel 1: solicitantes
const PanelSolicitantes = ({ filtroInicial, aviso, alError, alCambiar }) => {
  const [filtro, setFiltro] = useState(filtroInicial);
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null);
  const [accion, setAccion] = useState(null); // { tipo, usuario }

  useEffect(() => { setFiltro(filtroInicial); setPage(1); }, [filtroInicial]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setRes(await listSolicitantes({ filtro, q: busqueda || undefined, page, limit: LIMITE }));
    } catch (err) {
      alError(mensajeError(err, 'No se pudo cargar a los solicitantes'));
    } finally {
      setCargando(false);
    }
  }, [filtro, busqueda, page, alError]);

  useEffect(() => { cargar(); }, [cargar]);

  const ejecutar = async () => {
    const { tipo, usuario } = accion;
    try {
      let r;
      if (tipo === 'confirmar') r = await verificarUsuario(usuario.id, 'CONFIRMAR');
      else if (tipo === 'rechazar') r = await verificarUsuario(usuario.id, 'RECHAZAR');
      else r = await cambiarEstadoUsuario(usuario.id, tipo === 'desactivar' ? 'INACTIVO' : 'ACTIVO');
      aviso(`${usuario.nombre_completo}: ${r.mensaje}`);
      setAccion(null);
      await cargar();
      alCambiar();
    } catch (err) {
      setAccion(null);
      alError(mensajeError(err, 'No se pudo completar la acción'));
    }
  };

  const textosAccion = {
    confirmar: { titulo: 'Confirmar vinculación', boton: 'Sí, confirmar', peligro: false, texto: 'Confirmas que esta persona pertenece a la universidad. Se le avisará y quedará como verificada para las dependencias.' },
    rechazar: { titulo: 'Rechazar autoregistro', boton: 'Sí, rechazar', peligro: true, texto: 'No podrá ingresar al sistema. Puedes reactivar la cuenta después desde «Inactivos».' },
    desactivar: { titulo: 'Desactivar cuenta', boton: 'Desactivar', peligro: true, texto: 'La persona no podrá ingresar mientras la cuenta esté inactiva.' },
    reactivar: { titulo: 'Reactivar cuenta', boton: 'Reactivar', peligro: false, texto: 'La persona podrá volver a ingresar al sistema.' },
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filtro de solicitantes">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filtro === f.id}
            onClick={() => { setFiltro(f.id); setPage(1); }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${filtro === f.id ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            {f.texto} ({res?.conteos?.[f.id] ?? 0})
          </button>
        ))}
        <form className="ml-auto flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); setBusqueda(q.trim()); setPage(1); }}>
          <label htmlFor="buscar-solicitantes" className="sr-only">Buscar por nombre o correo</label>
          <input id="buscar-solicitantes" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o correo" className={`${inputClase} w-56`} />
          <button type="submit" className={botonPrimario}>Buscar</button>
        </form>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0A2540] text-[10px] uppercase tracking-wider text-white">
            <tr>
              <th className="px-4 py-3">Persona</th>
              <th className="px-4 py-3">Vinculación</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Registro</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Cargando…</td></tr>}
            {!cargando && res?.data.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No hay personas en esta vista.</td></tr>}
            {res?.data.map((u) => (
              <tr key={u.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-bold text-slate-900">{u.nombre_completo}</p>
                  <p className="break-all text-slate-600">{u.correo_institucional}</p>
                </td>
                <td className="px-4 py-3 text-slate-800">{u.tipo_vinculacion || <span className="italic text-slate-400">Aún no elige</span>}</td>
                <td className="px-4 py-3">
                  {u.estado === 'INACTIVO'
                    ? <Insignia clases="border-slate-200 bg-slate-100 text-slate-700">✕ Inactivo</Insignia>
                    : u.verificado
                      ? <Insignia clases="border-emerald-200 bg-emerald-50 text-emerald-800">✓ Verificado</Insignia>
                      : <Insignia clases="border-amber-200 bg-amber-50 text-amber-800">◔ Por verificar</Insignia>}
                  {u.tramite_en_curso && <p className="mt-1 text-[11px] text-slate-500">Tiene un trámite en curso</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>{u.origen === 'AUTOREGISTRO' ? 'Ingresó con Google' : 'Registrado por TI'}</p>
                  <p className="text-[11px] text-slate-500">{formatearFecha(u.created_at, { hora: true })}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {!u.verificado && u.estado === 'ACTIVO' && (
                      <>
                        <button type="button" onClick={() => setAccion({ tipo: 'confirmar', usuario: u })} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 font-bold text-white hover:bg-emerald-700">Confirmar</button>
                        <button type="button" onClick={() => setAccion({ tipo: 'rechazar', usuario: u })} className="rounded-lg border border-rose-300 px-2.5 py-1.5 font-bold text-rose-700 hover:bg-rose-50">Rechazar</button>
                      </>
                    )}
                    <button type="button" onClick={() => setEditando(u)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">Editar</button>
                    {u.estado === 'ACTIVO' && u.verificado && (
                      <button type="button" onClick={() => setAccion({ tipo: 'desactivar', usuario: u })} className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">Desactivar</button>
                    )}
                    {u.estado === 'INACTIVO' && (
                      <button type="button" onClick={() => setAccion({ tipo: 'reactivar', usuario: u })} className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">Reactivar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion pagination={res?.pagination} onPagina={setPage} />

      {editando && (
        <Modal titulo={`Editar a ${editando.nombre_completo}`} onCerrar={() => setEditando(null)}>
          <FormularioPersona
            inicial={editando}
            textoGuardar="Guardar cambios"
            onCancelar={() => setEditando(null)}
            onGuardar={async (form) => {
              const r = await actualizarUsuario(editando.id, form);
              aviso(r.mensaje);
              setEditando(null);
              await cargar();
            }}
          />
        </Modal>
      )}
      {accion && (
        <Confirmar
          titulo={textosAccion[accion.tipo].titulo}
          texto={`${accion.usuario.nombre_completo} (${accion.usuario.correo_institucional}). ${textosAccion[accion.tipo].texto}`}
          textoBoton={textosAccion[accion.tipo].boton}
          peligro={textosAccion[accion.tipo].peligro}
          onConfirmar={ejecutar}
          onCancelar={() => setAccion(null)}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------ panel 2: personal de dependencias
const FilaPersonal = ({ persona, dependencias, onEditar, onGuardarDependencia, onQuitar }) => {
  const actual = persona.dependencias[0]?.id || '';
  const [nueva, setNueva] = useState(actual);
  useEffect(() => { setNueva(actual); }, [actual]);
  const cambio = nueva && nueva !== actual;

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <p className="font-bold text-slate-900">{persona.nombre_completo}</p>
        <p className="break-all text-slate-600">{persona.correo_institucional}</p>
        {persona.estado === 'INACTIVO' && <Insignia clases="mt-1 border-slate-200 bg-slate-100 text-slate-700">Inactivo</Insignia>}
      </td>
      <td className="px-4 py-3 text-slate-800">{persona.roles.join(', ')}</td>
      <td className="px-4 py-3">
        <label className="sr-only" htmlFor={`dep-${persona.id}`}>Dependencia de {persona.nombre_completo}</label>
        <select id={`dep-${persona.id}`} value={nueva} onChange={(e) => setNueva(e.target.value)} className={`${inputClase} min-w-[14rem] text-xs`}>
          {!actual && <option value="">Sin dependencia</option>}
          {dependencias.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        {cambio && (
          <button type="button" onClick={() => onGuardarDependencia(persona, nueva)} className="mt-2 rounded-lg bg-[#D97706] px-3 py-1.5 font-bold text-white hover:bg-[#B45309]">
            Guardar dependencia
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-slate-700">
        <p>{persona.cargo || '—'}</p>
        <p className="text-[11px] text-slate-500">{persona.ha_ingresado ? `Último ingreso: ${formatearFecha(persona.ultimo_acceso)}` : 'Aún no ha ingresado'}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-1.5">
          <button type="button" onClick={() => onEditar(persona)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">Editar</button>
          <button type="button" onClick={() => onQuitar(persona)} className="rounded-lg border border-rose-300 px-2.5 py-1.5 font-semibold text-rose-700 hover:bg-rose-50">Quitar</button>
        </div>
      </td>
    </tr>
  );
};

const PanelPersonal = ({ aviso, alError, alCambiar }) => {
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [dependenciaId, setDependenciaId] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null);
  const [registrando, setRegistrando] = useState(false);
  const [quitando, setQuitando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setRes(await listPersonal({ q: busqueda || undefined, dependenciaId: dependenciaId || undefined, page, limit: LIMITE }));
    } catch (err) {
      alError(mensajeError(err, 'No se pudo cargar al personal'));
    } finally {
      setCargando(false);
    }
  }, [busqueda, dependenciaId, page, alError]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarDependencia = async (persona, nueva) => {
    try {
      const r = await asignarDependencia(persona.id, nueva);
      aviso(`${persona.nombre_completo}: ${r.mensaje}`);
      await cargar();
      alCambiar();
    } catch (err) {
      alError(mensajeError(err, 'No se pudo cambiar la dependencia'));
      await cargar();
    }
  };

  const dependencias = res?.dependencias || [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="filtro-dependencia" className="sr-only">Filtrar por dependencia</label>
        <select id="filtro-dependencia" value={dependenciaId} onChange={(e) => { setDependenciaId(e.target.value); setPage(1); }} className={`${inputClase} w-auto min-w-[16rem]`}>
          <option value="">Todas las dependencias</option>
          {dependencias.map((d) => <option key={d.id} value={d.id}>{d.nombre} ({d.personas})</option>)}
        </select>
        <form className="flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); setBusqueda(q.trim()); setPage(1); }}>
          <label htmlFor="buscar-personal" className="sr-only">Buscar por nombre o correo</label>
          <input id="buscar-personal" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o correo" className={`${inputClase} w-56`} />
          <button type="submit" className={botonPrimario}>Buscar</button>
        </form>
        <button type="button" onClick={() => setRegistrando(true)} className="ml-auto rounded-xl bg-[#D97706] px-4 py-2 text-sm font-bold text-white hover:bg-[#B45309]">+ Registrar personal</button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0A2540] text-[10px] uppercase tracking-wider text-white">
            <tr>
              <th className="px-4 py-3">Persona</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Dependencia</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Cargando…</td></tr>}
            {!cargando && res?.data.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No hay personal en esta vista.</td></tr>}
            {res?.data.map((p) => (
              <FilaPersonal key={p.id} persona={p} dependencias={dependencias} onEditar={setEditando} onGuardarDependencia={guardarDependencia} onQuitar={setQuitando} />
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion pagination={res?.pagination} onPagina={setPage} />

      {registrando && (
        <Modal titulo="Registrar personal de una dependencia" onCerrar={() => setRegistrando(false)}>
          <p className="mb-3 text-xs text-slate-600">
            Si la persona ya ingresó con Google, se conserva su cuenta y queda verificada. Si no, podrá entrar con Google la primera vez con este correo.
          </p>
          <FormularioPersona
            conDependencia
            dependencias={dependencias}
            textoGuardar="Registrar"
            onCancelar={() => setRegistrando(false)}
            onGuardar={async (form) => {
              const r = await registrarPersonal(form);
              aviso(r.mensaje);
              setRegistrando(false);
              await cargar();
              alCambiar();
            }}
          />
        </Modal>
      )}
      {editando && (
        <Modal titulo={`Editar a ${editando.nombre_completo}`} onCerrar={() => setEditando(null)}>
          <FormularioPersona
            inicial={editando}
            textoGuardar="Guardar cambios"
            onCancelar={() => setEditando(null)}
            onGuardar={async (form) => {
              const r = await actualizarUsuario(editando.id, form);
              aviso(r.mensaje);
              setEditando(null);
              await cargar();
            }}
          />
        </Modal>
      )}
      {quitando && (
        <Confirmar
          titulo="Quitar de la dependencia"
          texto={`${quitando.nombre_completo} dejará de atender solicitudes. La cuenta no se borra.`}
          textoBoton="Sí, quitar"
          peligro
          onCancelar={() => setQuitando(null)}
          onConfirmar={async () => {
            try {
              const r = await quitarPersonal(quitando.id);
              aviso(`${quitando.nombre_completo}: ${r.mensaje}`);
              setQuitando(null);
              await cargar();
              alCambiar();
            } catch (err) {
              setQuitando(null);
              alError(mensajeError(err, 'No se pudo quitar a la persona'));
            }
          }}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------ página
const DashboardAdmin = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'personal' ? 'personal' : 'solicitantes';
  const filtroUrl = FILTROS.some((f) => f.id === params.get('filtro')) ? params.get('filtro') : null;
  const [resumen, setResumen] = useState(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  const cargarResumen = useCallback(async () => {
    try {
      setResumen(await getResumenAdmin());
    } catch {
      setResumen(null);
    }
  }, []);

  useEffect(() => { cargarResumen(); }, [cargarResumen]);

  // Sin filtro en la URL, entra a «Por verificar» si hay pendientes (se decide una sola vez)
  const [filtroInicial, setFiltroInicial] = useState(filtroUrl);
  useEffect(() => {
    if (filtroUrl) setFiltroInicial(filtroUrl);
    else if (resumen && !filtroInicial) setFiltroInicial(resumen.solicitantes.pendientes > 0 ? 'pendientes' : 'todos');
  }, [filtroUrl, resumen]); // eslint-disable-line react-hooks/exhaustive-deps

  const mostrarAviso = useCallback((m) => { setError(''); setAviso(m); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);
  const mostrarError = useCallback((m) => { setAviso(''); setError(m); }, []);
  const irA = (nuevo) => setParams({ tab: nuevo }, { replace: true });

  const pendientes = resumen?.solicitantes.pendientes ?? 0;

  return (
    <Layout title="Administración DTI">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#D97706]">Administración técnica del sistema</p>
          <h2 className="text-lg font-bold text-[#0A2540]">Personas y personal de las dependencias</h2>
          <p className="mt-1 text-xs text-slate-600">
            Verifica a quienes ingresan por primera vez, corrige nombres y correos, y asigna a cada persona del personal a su dependencia.
            Por seguridad (RN-011) este panel no muestra datos de los trámites.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ['Por verificar', resumen?.solicitantes.pendientes, pendientes > 0],
              ['Solicitantes', resumen?.solicitantes.todos],
              ['Personal de dependencias', resumen?.personal.total],
              ['Personal sin dependencia', resumen?.personal.sinDependencia, resumen?.personal.sinDependencia > 0],
            ].map(([k, v, alerta]) => (
              <div key={k} className={`rounded-xl border p-3 ${alerta ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{k}</dt>
                <dd className="mt-0.5 text-2xl font-bold text-[#0A2540]">{v ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </div>

        {aviso && <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-800"><span>✓ {aviso}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setAviso('')}>✕</button></div>}
        {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700"><span>{error}</span><button type="button" aria-label="Cerrar error" onClick={() => setError('')}>✕</button></div>}

        <div className="flex gap-6 border-b border-slate-200 text-xs font-bold uppercase tracking-wider" role="tablist">
          {[
            ['solicitantes', `Solicitantes${pendientes > 0 ? ` · ${pendientes} por verificar` : ''}`],
            ['personal', 'Personal de dependencias'],
          ].map(([id, texto]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => irA(id)}
              className={`border-b-2 pb-3 transition ${tab === id ? 'border-[#0A2540] text-[#0A2540]' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              {texto}
            </button>
          ))}
        </div>

        {tab === 'solicitantes'
          ? filtroInicial && <PanelSolicitantes filtroInicial={filtroInicial} aviso={mostrarAviso} alError={mostrarError} alCambiar={cargarResumen} />
          : <PanelPersonal aviso={mostrarAviso} alError={mostrarError} alCambiar={cargarResumen} />}
      </div>
    </Layout>
  );
};

export default DashboardAdmin;
