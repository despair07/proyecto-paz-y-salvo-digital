import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../hooks/useAuth';
import { getMiEstado, habilitarTramite, reiniciarTramite } from '../../services/tramite.service';
import { formatearFecha, mensajeError } from '../../utils/errors';
import DatosGenerales from './steps/DatosGenerales';
import { AreasStep, JefeStep, ProfesoresStep } from './steps/DependenciasSteps';
import InformeStep from './steps/InformeStep';
import CierreStep from './steps/CierreStep';

const ESTADO_TRAMITE = {
  BORRADOR: { texto: 'Borrador', clases: 'bg-slate-100 text-slate-700 border-slate-200' },
  EN_PROCESO: { texto: 'Con pendientes', clases: 'bg-amber-50 text-amber-800 border-amber-200' },
  AL_DIA: { texto: 'Al día', clases: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  PENDIENTE_APROBACION: { texto: 'En aprobación final', clases: 'bg-sky-50 text-sky-800 border-sky-200' },
  APROBADO_FINAL: { texto: 'Aprobado', clases: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  RECHAZADO: { texto: 'Rechazado', clases: 'bg-rose-50 text-rose-800 border-rose-200' },
};

// Pasos del formulario, con los mismos nombres del formato GTH-07
function construirPasos(data) {
  const jefe = data.dependencias.find((d) => d.etapa === 1);
  const areas = data.dependencias.filter((d) => d.etapa === 2 && !d.soloDocentes && d.aplica);
  const profesoral = data.dependencias.find((d) => d.soloDocentes && d.aplica);
  const estadoDe = (lista) => {
    if (!lista.length) return 'pendiente';
    if (lista.every((d) => d.estado === 'APROBADA')) return 'completo';
    if (lista.some((d) => d.estado === 'BLOQUEADA')) return 'atencion';
    return lista.some((d) => d.estado !== 'SIN_SOLICITAR') ? 'curso' : 'pendiente';
  };

  const pasos = [
    { id: 'datos', titulo: '1. Datos generales', estado: data.datosCompletos ? 'completo' : 'atencion' },
    { id: 'jefe', titulo: '2. Paz y Salvo jefe inmediato', estado: estadoDe(jefe ? [jefe] : []) },
    { id: 'areas', titulo: '3. Paz y Salvo áreas de gestión', estado: estadoDe(areas) },
  ];
  if (data.tipoVinculacion === 'Docente' && profesoral) {
    pasos.push({ id: 'profesores', titulo: '4. Paz y Salvo a profesores', estado: estadoDe([profesoral]) });
  }
  pasos.push(
    { id: 'informe', titulo: 'Informe por entrega de cargo', estado: data.informeEntregaCargo ? 'completo' : 'atencion' },
    {
      id: 'cierre',
      titulo: 'Cierre y firma',
      estado: ['PENDIENTE_APROBACION', 'APROBADO_FINAL'].includes(data.estadoGlobal)
        ? 'completo'
        : data.cierre.clausulaAceptada ? 'curso' : 'pendiente',
    }
  );
  return pasos;
}

const ICONO = { completo: '✓', atencion: '!', curso: '◔', pendiente: '○' };
const CLASES_PASO = {
  completo: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  atencion: 'border-amber-200 bg-amber-50 text-amber-900',
  curso: 'border-sky-200 bg-sky-50 text-sky-900',
  pendiente: 'border-slate-200 bg-white text-slate-600',
};

const DashboardUser = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [paso, setPaso] = useState('datos');
  const [novedad, setNovedad] = useState('RETIRO');
  const [iniciando, setIniciando] = useState(false);
  const pasoElegido = useRef(false);

  const recargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true);
    try {
      const estado = await getMiEstado();
      setData(estado);
      setError('');
      // Primer ingreso: abre el primer paso que necesita atención
      if (!pasoElegido.current && estado.habilitado) {
        pasoElegido.current = true;
        const pasos = construirPasos(estado);
        setPaso((pasos.find((p) => p.estado !== 'completo') || pasos[pasos.length - 1]).id);
      }
    } catch (err) {
      setError(mensajeError(err, 'No se pudo consultar tu paz y salvo'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar, user?.id]);

  const ctx = useMemo(() => ({
    recargar,
    notify: (mensaje) => { setAviso(mensaje); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    fail: (err, fallback) => { setError(mensajeError(err, fallback)); setAviso(''); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    irAPaso: (id) => { setPaso(id); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  }), [recargar]);

  const iniciar = async () => {
    setIniciando(true);
    try {
      await habilitarTramite({ tipo_novedad: novedad });
      pasoElegido.current = false;
      await recargar();
    } catch (err) {
      ctx.fail(err, 'No se pudo iniciar tu paz y salvo');
    } finally {
      setIniciando(false);
    }
  };

  const reiniciar = async () => {
    try {
      const res = await reiniciarTramite(data.solicitudId);
      pasoElegido.current = false;
      setAviso(res.mensaje);
      await recargar();
    } catch (err) {
      ctx.fail(err, 'No se pudo reiniciar el trámite');
    }
  };

  const pasos = data?.habilitado ? construirPasos(data) : [];

  return (
    <Layout title="Mi Paz y Salvo">
      <div className="mx-auto max-w-5xl space-y-5">
        {aviso && (
          <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-800">
            <span>✓ {aviso}</span>
            <button type="button" onClick={() => setAviso('')} aria-label="Cerrar aviso" className="text-emerald-700 hover:text-emerald-900">✕</button>
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-semibold text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="Cerrar error" className="text-red-600 hover:text-red-800">✕</button>
          </div>
        )}

        {cargando && !data && <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando tu paz y salvo…</p>}

        {data && !data.habilitado && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
            <h2 className="text-xl font-bold text-[#0A2540]">Inicia tu paz y salvo</h2>
            <p className="mt-2 text-sm text-slate-600">
              Es el trámite del formato GTH-07 de la Corporación Universitaria Autónoma del Cauca. Lo harás paso a paso: tus datos
              generales, la aprobación de tu jefe y de cada área, el informe por entrega de cargo y tu firma.
            </p>
            <fieldset className="mt-5">
              <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Tipo de novedad</legend>
              <div className="flex flex-wrap gap-3">
                {[['RETIRO', 'Retiro'], ['CAMBIO_DEPENDENCIA', 'Cambio de dependencia']].map(([valor, texto]) => (
                  <label
                    key={valor}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                      novedad === valor ? 'border-[#0A2540] bg-slate-50 text-[#0A2540]' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <input type="radio" name="novedad-inicial" value={valor} checked={novedad === valor} onChange={() => setNovedad(valor)} className="h-4 w-4" />
                    {texto}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              onClick={iniciar}
              disabled={iniciando}
              className="mt-6 rounded-xl bg-[#0A2540] px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-[#133961] disabled:opacity-60"
            >
              {iniciando ? 'Creando…' : 'Iniciar mi paz y salvo'}
            </button>
            <p className="mt-4 text-xs text-slate-500">
              ¿No eres de este tipo de vinculación? Cámbialo en <Link to="/perfil" className="font-semibold text-[#0A2540] underline">Mi perfil</Link>.
            </p>
          </section>
        )}

        {data?.habilitado && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-label="Resumen del trámite">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#D97706]">Periodo {data.periodo}</p>
                  <h2 className="text-xl font-bold text-[#0A2540]">{data.nombreTrabajador}</h2>
                  <p className="text-xs text-slate-600">
                    {data.tipoVinculacion} · {data.tipoNovedad === 'RETIRO' ? 'Retiro' : 'Cambio de dependencia'}
                    {data.tipoNovedad === 'RETIRO' && data.fechaRetiro ? ` · ${formatearFecha(data.fechaRetiro)}` : ''}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${(ESTADO_TRAMITE[data.estadoGlobal] || ESTADO_TRAMITE.BORRADOR).clases}`}>
                  {(ESTADO_TRAMITE[data.estadoGlobal] || ESTADO_TRAMITE.BORRADOR).texto}
                </span>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{data.resumenProgreso}</span>
                  <span>{data.porcentajeCompletado}%</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={data.porcentajeCompletado} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${data.porcentajeCompletado}%` }} />
                </div>
              </div>
            </section>

            {data.solicitudAnterior && data.estadoGlobal === 'BORRADOR' && (
              <div role="note" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <p className="font-bold">Tu solicitud anterior fue rechazada</p>
                <p className="mt-1 text-xs">Motivos: {data.solicitudAnterior.observaciones}</p>
                <p className="mt-1 text-xs text-rose-700">Revisa tus datos, corrige lo que indica y vuelve a solicitar las aprobaciones.</p>
              </div>
            )}

            {data.estadoGlobal === 'RECHAZADO' && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="text-sm text-rose-900">
                  <p className="font-bold">Tu paz y salvo fue rechazado</p>
                  <p className="mt-1 text-xs">Motivos: {data.observacionesAprobacion}</p>
                </div>
                <button type="button" onClick={reiniciar} className="rounded-xl bg-[#0A2540] px-4 py-2 text-sm font-bold text-white hover:bg-[#133961]">
                  Iniciar de nuevo con mis datos
                </button>
              </div>
            )}

            <nav aria-label="Pasos del paz y salvo">
              <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {pasos.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => ctx.irAPaso(p.id)}
                      aria-current={paso === p.id ? 'step' : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition ${CLASES_PASO[p.estado]} ${
                        paso === p.id ? 'ring-2 ring-[#0A2540]' : 'hover:brightness-95'
                      }`}
                    >
                      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs">{ICONO[p.estado]}</span>
                      <span>{p.titulo}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            {paso === 'datos' && <DatosGenerales data={data} ctx={ctx} key={`datos-${data.solicitudId}`} />}
            {paso === 'jefe' && <JefeStep data={data} ctx={ctx} />}
            {paso === 'areas' && <AreasStep data={data} ctx={ctx} />}
            {paso === 'profesores' && <ProfesoresStep data={data} ctx={ctx} />}
            {paso === 'informe' && <InformeStep data={data} ctx={ctx} key={`informe-${data.solicitudId}`} />}
            {paso === 'cierre' && <CierreStep data={data} ctx={ctx} />}
          </>
        )}
      </div>
    </Layout>
  );
};

export default DashboardUser;
