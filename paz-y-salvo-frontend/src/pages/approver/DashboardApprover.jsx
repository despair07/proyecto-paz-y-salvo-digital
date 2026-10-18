import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ReviewState from '../../components/common/ReviewState';
import InformeForm from '../../components/informe/InformeForm';
import { getRevisionFinal, listPendientes, resolverFinal } from '../../services/tramite.service';
import { formatearFecha, mensajeError } from '../../utils/errors';

const ENTREGABLES = [
  ['innovaciones_educativas', 'Innovaciones educativas'],
  ['planes_aula', 'Planes de aula'],
  ['informes_ejecucion', 'Informes de ejecución'],
];

const Firma = ({ src, alt }) => (
  src
    ? <img src={src} alt={alt} className="h-14 max-w-[180px] rounded border border-slate-200 bg-white object-contain p-1" />
    : <span className="text-[11px] italic text-slate-400">Sin firma registrada</span>
);

// ------------------------------------------------------------------ revisión final
const RevisionFinal = ({ id, onVolver, onResuelta }) => {
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [verInforme, setVerInforme] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivos, setMotivos] = useState('');
  const [observacion, setObservacion] = useState('');
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setD(await getRevisionFinal(id));
      setError('');
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar la solicitud'));
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const resolver = async (payload, mensajeFallo) => {
    setProcesando(true);
    setError('');
    try {
      const res = await resolverFinal(id, payload);
      onResuelta(res);
    } catch (err) {
      setError(mensajeError(err, mensajeFallo));
    } finally {
      setProcesando(false);
    }
  };

  if (cargando && !d) return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando solicitud…</p>;
  if (!d) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || 'No se encontró la solicitud.'}
        <button type="button" onClick={onVolver} className="ml-3 font-semibold underline">Volver</button>
      </div>
    );
  }

  const t = d.trabajador;
  const pendiente = d.estadoGlobal === 'PENDIENTE_APROBACION';
  const noAprobadas = d.checklist.filter((c) => c.estado !== 'APROBADA');

  return (
    <div className="space-y-4">
      <button type="button" onClick={onVolver} className="text-xs font-semibold text-[#0A2540] hover:underline lg:hidden">← Volver a la lista</button>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#D97706]">Ficha de verificación institucional</p>
        <h2 className="text-lg font-bold text-[#0A2540]">{t.nombre}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {[
            ['Documento', t.documento],
            ['Lugar de expedición', t.lugarExpedicion],
            ['Cargo', t.cargo],
            ['Vinculación', t.vinculacion],
            ['Correo', t.correo],
            ['Jefe inmediato', t.jefe],
            ['Novedad', t.novedad === 'RETIRO' ? `Retiro${t.fechaRetiro ? ` · ${formatearFecha(t.fechaRetiro)}` : ''}` : 'Cambio de dependencia'],
            ['Pidió la aprobación final', formatearFecha(d.cierre.fechaSolicitudFinal, { hora: true })],
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
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Paz y salvo de cada dependencia (formato GTH-07)</h3>
        <ul className="mt-3 space-y-2.5">
          {d.checklist.map((c) => (
            <li key={c.id} className="rounded-xl border border-slate-200 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[#0A2540]">{c.nombre}</p>
                  {c.aspecto && <p className="mt-0.5 text-[11px] text-slate-500">{c.aspecto}</p>}
                </div>
                <ReviewState estado={c.estado} />
              </div>
              {c.estado === 'APROBADA' && (
                <div className="mt-2.5 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-2.5">
                  <div className="min-w-0 flex-1 text-xs text-slate-700">
                    <p><strong>Recibí / Revisé:</strong> {c.recibi}</p>
                    {c.enlace && (
                      <p className="mt-1">
                        <strong>{c.etiqueta_enlace || 'Enlace'}:</strong>{' '}
                        <a href={c.enlace} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">{c.enlace}</a>
                      </p>
                    )}
                    <p className="mt-1 text-slate-500">{c.revisor} · {formatearFecha(c.fecha_revision, { hora: true })}</p>
                  </div>
                  <Firma src={c.firma} alt={`Firma de ${c.revisor}`} />
                </div>
              )}
            </li>
          ))}
        </ul>
        {noAprobadas.length > 0 && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            Hay {noAprobadas.length} dependencia(s) sin aprobar: {noAprobadas.map((c) => c.nombre).join(', ')}.
          </p>
        )}
        {d.entregables && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Entregables del docente</p>
            <ul className="mt-1.5 space-y-1 text-sm">
              {ENTREGABLES.map(([clave, texto]) => (
                <li key={clave}>{d.entregables[clave] ? '✓' : '✕'} {texto}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <button
          type="button"
          onClick={() => setVerInforme((v) => !v)}
          aria-expanded={verInforme}
          className="flex w-full items-center justify-between text-left text-sm font-bold text-[#0A2540]"
        >
          <span>Informe por entrega de cargo{d.informe?.estado === 'COMPLETO' ? ' · completo ✓' : ' · incompleto'}</span>
          <span aria-hidden="true">{verInforme ? '▲' : '▼'}</span>
        </button>
        {verInforme && d.informe && (
          <div className="mt-4">
            <InformeForm secciones={d.informe.secciones} readOnly compacto />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cláusula y firma del trabajador</h3>
        <p className="mt-2 text-sm text-slate-700">
          {d.cierre.clausulaAceptada ? `Cláusula aceptada el ${formatearFecha(d.cierre.fechaClausula, { hora: true })}` : 'Cláusula sin aceptar.'}
        </p>
        <div className="mt-2 text-sm text-slate-800">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Observaciones</p>
          <p className="whitespace-pre-wrap">{d.cierre.observaciones || '—'}</p>
        </div>
        <div className="mt-3">
          <Firma src={d.cierre.firmaTrabajador} alt={`Firma de ${t.nombre}`} />
        </div>
      </section>

      {pendiente ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          {!rechazando ? (
            <>
              <label htmlFor="obs" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">Observación (opcional)</label>
              <textarea
                id="obs"
                rows={2}
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                maxLength={1000}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/10"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Al aprobar se emite el certificado con QR y se firma con la firma de tu perfil.{' '}
                <Link to="/perfil" className="font-semibold underline">Revisar mi firma</Link>
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setRechazando(true)} className="rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50">
                  Rechazar…
                </button>
                <button
                  type="button"
                  disabled={procesando || noAprobadas.length > 0}
                  onClick={() => resolver({ decision: 'APROBADO', observacion }, 'No se pudo aprobar')}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {procesando ? 'Aprobando…' : 'Aprobar y emitir certificado'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold text-rose-800">Rechazar el paz y salvo</h3>
              <label htmlFor="motivos" className="mb-1 mt-3 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Motivos <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <textarea
                id="motivos"
                rows={4}
                value={motivos}
                onChange={(e) => setMotivos(e.target.value)}
                maxLength={1000}
                placeholder="Explica qué debe corregir el trabajador. Verá este texto y podrá reiniciar el proceso con sus datos anteriores."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-500"
              />
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setRechazando(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button
                  type="button"
                  disabled={procesando || motivos.trim().length < 10}
                  onClick={() => resolver({ decision: 'RECHAZADO', observacion: motivos.trim() }, 'No se pudo rechazar')}
                  className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {procesando ? 'Rechazando…' : 'Confirmar rechazo'}
                </button>
              </div>
              {motivos.trim().length < 10 && <p className="mt-2 text-right text-xs text-slate-500">Mínimo 10 caracteres.</p>}
            </>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          <p className="font-bold">Trámite resuelto: {d.estadoGlobal.replace(/_/g, ' ').toLowerCase()}</p>
          {d.resolucion && <p className="mt-1">{d.resolucion.aprobador} · {formatearFecha(d.resolucion.fecha, { hora: true })}</p>}
          {d.resolucion?.observaciones && <p className="mt-1">{d.resolucion.observaciones}</p>}
        </section>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ lista
const DashboardApprover = () => {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [certificado, setCertificado] = useState(null);
  const [seleccion, setSeleccion] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setLista(await listPendientes());
      setError('');
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cargar la lista de pendientes'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const resuelta = (res) => {
    setAviso(res.mensaje);
    setCertificado(res.certificado || null);
    setSeleccion(null);
    cargar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Layout title="Aprobación final">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#D97706]">División de Comunidad Universitaria</p>
            <h2 className="text-lg font-bold text-[#0A2540]">Solicitudes con todas las dependencias al día</h2>
            <p className="mt-1 text-xs text-slate-600">Revisa lo que aprobó cada área y el informe, y luego aprueba o rechaza con motivos.</p>
          </div>
          <button type="button" onClick={cargar} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Actualizar</button>
        </div>

        {aviso && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-800">✓ {aviso}</div>}
        {certificado?.token_verificacion && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-bold text-emerald-900">Certificado emitido</p>
            <div className="flex gap-2">
              <a href={`/verificar/${certificado.token_verificacion}`} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Verificación pública</a>
              <a href={`/api/v1/certificados/${certificado.token_verificacion}/pdf`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">Descargar PDF</a>
            </div>
          </div>
        )}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700">{error}</div>}

        <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_1fr]">
          <div className={seleccion ? 'hidden lg:block' : ''}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">Pendientes ({lista.length})</h3>
            <ul className="space-y-2">
              {cargando && <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Cargando…</li>}
              {!cargando && lista.length === 0 && (
                <li className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                  No hay solicitudes esperando tu aprobación.
                </li>
              )}
              {lista.map((s) => (
                <li key={s.solicitudId}>
                  <button
                    type="button"
                    onClick={() => setSeleccion(s.solicitudId)}
                    aria-current={seleccion === s.solicitudId}
                    className={`w-full rounded-xl border bg-white p-3.5 text-left transition hover:bg-slate-50 ${
                      seleccion === s.solicitudId ? 'border-[#0A2540] ring-1 ring-[#0A2540]' : 'border-slate-200'
                    }`}
                  >
                    <p className="text-sm font-bold text-[#0A2540]">{s.nombre}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{s.cargo} · {s.vinculacion}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {s.novedad === 'RETIRO' ? 'Retiro' : 'Cambio de dependencia'} · solicitada {formatearFecha(s.fechaSolicitudFinal)}
                      {s.verificado === false ? ' · sin verificar' : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={seleccion ? '' : 'hidden lg:block'}>
            {seleccion ? (
              <RevisionFinal key={seleccion} id={seleccion} onVolver={() => setSeleccion(null)} onResuelta={resuelta} />
            ) : (
              <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Selecciona una solicitud para ver el detalle y decidir.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardApprover;
