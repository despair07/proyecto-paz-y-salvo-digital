import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ReviewState, { CATEGORIAS_BLOQUEO } from '../../components/common/ReviewState';
import InformeForm from '../../components/informe/InformeForm';
import { useAuth } from '../../hooks/useAuth';
import {
  aprobarRevision, bloquearRevision, getRevision, listRevisiones, saveEntregables,
} from '../../services/tramite.service';
import { formatearFecha, mensajeError } from '../../utils/errors';

const FILTROS = [
  { id: 'SOLICITADA', texto: 'En revisión' },
  { id: 'BLOQUEADA', texto: 'Bloqueadas' },
  { id: 'APROBADA', texto: 'Aprobadas' },
  { id: '', texto: 'Todas' },
];

const ENTREGABLES = [
  ['innovaciones_educativas', 'Innovaciones educativas'],
  ['planes_aula', 'Planes de aula'],
  ['informes_ejecucion', 'Informes de ejecución'],
];

const CATEGORIA_POR_DEFECTO = (r) => (r.soloDocentes ? 'ACADEMICO_PROFESORAL' : 'INVENTARIO_ELEMENTOS');

// ------------------------------------------------------------------ detalle y decisión
const Detalle = ({ id, onVolver, onDecidido, notificar }) => {
  const [r, setR] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recibi, setRecibi] = useState('');
  const [modo, setModo] = useState(null); // 'bloquear'
  const [categoria, setCategoria] = useState('INVENTARIO_ELEMENTOS');
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [verInforme, setVerInforme] = useState(false);
  const [guardandoEntregable, setGuardandoEntregable] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const detalle = await getRevision(id);
      setR(detalle);
      setCategoria(CATEGORIA_POR_DEFECTO(detalle));
      setError('');
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar la solicitud'));
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    setRecibi('');
    setMotivo('');
    setModo(null);
    setVerInforme(false);
    cargar();
  }, [cargar]);

  const cambiarEntregable = async (clave, valor) => {
    setGuardandoEntregable(true);
    try {
      await saveEntregables(r.solicitudId, { [clave]: valor });
      await cargar();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar el entregable'));
    } finally {
      setGuardandoEntregable(false);
    }
  };

  const aprobar = async () => {
    setProcesando(true);
    setError('');
    try {
      const res = await aprobarRevision(id, recibi);
      notificar(res.mensaje);
      onDecidido();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo aprobar'));
    } finally {
      setProcesando(false);
    }
  };

  const bloquear = async () => {
    setProcesando(true);
    setError('');
    try {
      const res = await bloquearRevision(id, { categoria, motivo });
      notificar(res.mensaje);
      onDecidido();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo bloquear'));
    } finally {
      setProcesando(false);
    }
  };

  if (cargando && !r) return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando solicitud…</p>;
  if (!r) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || 'No se encontró la solicitud.'}
        <button type="button" onClick={onVolver} className="ml-3 font-semibold underline">Volver</button>
      </div>
    );
  }

  const t = r.trabajador;
  const entregables = r.entregables || {};

  return (
    <div className="space-y-4">
      <button type="button" onClick={onVolver} className="text-xs font-semibold text-[#0A2540] hover:underline lg:hidden">← Volver a la bandeja</button>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#D97706]">{r.dependencia}</p>
            <h2 className="text-lg font-bold text-[#0A2540]">{t.nombre}</h2>
          </div>
          <ReviewState estado={r.estado} />
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {[
            ['Documento', t.documento],
            ['Lugar de expedición', r.trabajadorDetalle.lugarExpedicion],
            ['Cargo', t.cargo],
            ['Vinculación', t.vinculacion],
            ['Correo', t.correo],
            ['Tipo de novedad', t.novedad === 'RETIRO' ? `Retiro${t.fechaRetiro ? ` · ${formatearFecha(t.fechaRetiro)}` : ''}` : 'Cambio de dependencia'],
            ['Solicitada', `${formatearFecha(r.solicitadaEl, { hora: true })}${r.intentos > 1 ? ` · intento ${r.intentos}` : ''}`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{k}</dt>
              <dd className="mt-0.5 break-words text-slate-800">{v || '—'}</dd>
            </div>
          ))}
        </dl>
        {t.verificado === false && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            ⚠ Esta persona se autoregistró y TI aún no ha verificado su vinculación con la universidad.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Aspecto sobre el que se da paz y salvo</h3>
        <p className="mt-1.5 text-sm text-slate-800">{r.aspecto || 'Aprobación de la dependencia.'}</p>

        {r.requiereEnlace && (
          <p className="mt-3 text-sm text-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{r.etiquetaEnlace || 'Enlace'}: </span>
            {r.enlace ? (
              <a href={r.enlace} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-[#0A2540] underline underline-offset-2">
                {r.enlace}
              </a>
            ) : '—'}
          </p>
        )}

        {r.soloDocentes && (
          <fieldset className="mt-4" disabled={!r.puedeDecidir || guardandoEntregable}>
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-500">Entregables del docente (una sola persona los revisa)</legend>
            <ul className="mt-2 space-y-2">
              {ENTREGABLES.map(([clave, texto]) => (
                <li key={clave}>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(entregables[clave])}
                      onChange={(e) => cambiarEntregable(clave, e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="font-semibold text-slate-800">{texto}</span>
                    <span className="ml-auto text-xs text-slate-500">{entregables[clave] ? 'Aprobado' : 'Pendiente'}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Para aprobar la solicitud deben estar los tres aprobados; si falta alguno, bloquéala con el motivo.</p>
          </fieldset>
        )}
      </section>

      {r.estado === 'BLOQUEADA' && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          <p className="font-bold">Bloqueada · {CATEGORIAS_BLOQUEO[r.categoriaBloqueo] || r.categoriaBloqueo}</p>
          <p className="mt-1">{r.motivoBloqueo}</p>
          <p className="mt-2 text-xs text-rose-700">Esperando que el trabajador corrija y solicite de nuevo.</p>
        </section>
      )}

      {r.estado === 'APROBADA' && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="font-bold">Aprobada el {formatearFecha(r.fechaRevision, { hora: true })}</p>
          <p className="mt-1"><strong>Recibí / Revisé:</strong> {r.recibi}</p>
        </section>
      )}

      {r.puedeDecidir && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          {!r.tieneFirma && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Para aprobar necesitas tu firma guardada. <Link to="/perfil" className="font-bold underline">Dibújala en Mi perfil</Link> y vuelve.
            </p>
          )}

          {modo !== 'bloquear' ? (
            <>
              <label htmlFor="recibi" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Recibí / Revisé <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <textarea
                id="recibi"
                rows={3}
                value={recibi}
                onChange={(e) => setRecibi(e.target.value)}
                maxLength={1000}
                placeholder="Escribe lo que recibiste o verificaste (p. ej. «Recibí portátil #123 y accesos revocados»)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/10"
              />
              <p className="mt-1 text-[11px] text-slate-500">Se guardará con tu nombre, la fecha y tu firma, y la verá Comunidad Universitaria.</p>
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setModo('bloquear')} className="rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50">
                  Bloquear…
                </button>
                <button
                  type="button"
                  onClick={aprobar}
                  disabled={procesando || recibi.trim().length < 3 || !r.tieneFirma || (r.soloDocentes && !entregables.completo)}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {procesando ? 'Aprobando…' : 'Aprobar y firmar'}
                </button>
              </div>
              {r.soloDocentes && !entregables.completo && (
                <p className="mt-2 text-right text-xs text-slate-500">Marca los tres entregables como aprobados para poder aprobar.</p>
              )}
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold text-rose-800">Bloquear la solicitud</h3>
              <div className="mt-3 grid gap-3">
                <div>
                  <label htmlFor="categoria" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Categoría</label>
                  <select id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                    {Object.entries(CATEGORIAS_BLOQUEO).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="motivo" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Motivo <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="motivo"
                    rows={3}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    maxLength={1000}
                    placeholder="Explica qué debe corregir o entregar el trabajador"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/10"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setModo(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button
                  type="button"
                  onClick={bloquear}
                  disabled={procesando || motivo.trim().length < 5}
                  className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {procesando ? 'Bloqueando…' : 'Confirmar bloqueo'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {r.historial?.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Historial de bloqueos de tu dependencia</h3>
          <ul className="mt-2 space-y-2">
            {r.historial.map((b) => (
              <li key={b.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                <p className="font-semibold text-slate-800">{CATEGORIAS_BLOQUEO[b.categoria]} · {b.motivo}</p>
                <p className="mt-0.5 text-slate-500">
                  {formatearFecha(b.fecha_registro, { hora: true })}
                  {b.estado === 'RESUELTO' ? ` · resuelto: ${b.observacion || 'sí'}` : ' · activo'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.informe && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <button
            type="button"
            onClick={() => setVerInforme((v) => !v)}
            aria-expanded={verInforme}
            className="flex w-full items-center justify-between text-left text-sm font-bold text-[#0A2540]"
          >
            <span>Informe por entrega de cargo (solo lectura){r.informe.estado === 'COMPLETO' ? ' · completo' : ' · en borrador'}</span>
            <span aria-hidden="true">{verInforme ? '▲' : '▼'}</span>
          </button>
          {verInforme && (
            <div className="mt-4">
              <InformeForm secciones={r.informe.secciones} readOnly compacto />
            </div>
          )}
        </section>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ bandeja
const DashboardArea = () => {
  const { user } = useAuth();
  const [filtro, setFiltro] = useState('SOLICITADA');
  const [q, setQ] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [lista, setLista] = useState([]);
  const [conteos, setConteos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [seleccion, setSeleccion] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await listRevisiones({ estado: filtro || undefined, q: busqueda || undefined, limit: 50 });
      setLista(res.data);
      setConteos(res.conteos);
      setError('');
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar la bandeja'));
    } finally {
      setCargando(false);
    }
  }, [filtro, busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <Layout title="Bandeja de revisión">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#D97706]">{user?.dependencia || 'Dependencia'}</p>
          <h2 className="text-lg font-bold text-[#0A2540]">Solicitudes de paz y salvo que debes revisar</h2>
          <p className="mt-1 text-xs text-slate-600">
            Revisa los datos, aprueba con tu «Recibí» y tu firma, o bloquea indicando el motivo. Quien lo solicitó verá el estado «En proceso» hasta que decidas.
          </p>
        </div>

        {aviso && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-800">✓ {aviso}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700">{error}</div>}

        <div className="grid gap-5 lg:grid-cols-[minmax(320px,400px)_1fr]">
          <div className={seleccion ? 'hidden lg:block' : ''}>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtro por estado">
              {FILTROS.map((f) => (
                <button
                  key={f.id || 'todas'}
                  type="button"
                  role="tab"
                  aria-selected={filtro === f.id}
                  onClick={() => setFiltro(f.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                    filtro === f.id ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {f.texto}{f.id ? ` (${conteos[f.id] ?? 0})` : ''}
                </button>
              ))}
            </div>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => { e.preventDefault(); setBusqueda(q.trim()); }}
              role="search"
            >
              <label htmlFor="buscar" className="sr-only">Buscar por nombre, cédula o correo</label>
              <input
                id="buscar"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, cédula o correo"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/10"
              />
              <button type="submit" className="rounded-xl bg-[#0A2540] px-4 py-2 text-sm font-bold text-white hover:bg-[#133961]">Buscar</button>
            </form>

            <ul className="mt-3 space-y-2">
              {cargando && <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Cargando…</li>}
              {!cargando && lista.length === 0 && (
                <li className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                  No hay solicitudes en esta vista.
                </li>
              )}
              {lista.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSeleccion(item.id)}
                    aria-current={seleccion === item.id}
                    className={`w-full rounded-xl border bg-white p-3.5 text-left transition hover:bg-slate-50 ${
                      seleccion === item.id ? 'border-[#0A2540] ring-1 ring-[#0A2540]' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-[#0A2540]">{item.trabajador.nombre}</p>
                      <ReviewState estado={item.estado} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">{item.trabajador.cargo} · {item.trabajador.vinculacion}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {item.dependencia} · solicitada {formatearFecha(item.solicitadaEl)}
                      {item.intentos > 1 ? ` · intento ${item.intentos}` : ''}
                      {item.trabajador.verificado === false ? ' · sin verificar' : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={seleccion ? '' : 'hidden lg:block'}>
            {seleccion ? (
              <Detalle
                key={seleccion}
                id={seleccion}
                onVolver={() => setSeleccion(null)}
                notificar={(m) => { setAviso(m); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                onDecidido={() => { setSeleccion(null); cargar(); }}
              />
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Selecciona una solicitud de la bandeja para ver los datos del trabajador y decidir.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardArea;
