import React, { useEffect, useState } from 'react';
import DependenciaCard from './DependenciaCard';
import ReviewState from '../../../components/common/ReviewState';
import { listJefes, solicitarAprobacion, updateDatosGenerales } from '../../../services/tramite.service';
import { mensajeError } from '../../../utils/errors';

const Contenedor = ({ id, titulo, descripcion, children }) => (
  <section aria-labelledby={id} className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <h2 id={id} className="text-lg font-bold text-[#0A2540]">{titulo}</h2>
      {descripcion && <p className="mt-1 text-xs text-slate-600">{descripcion}</p>}
    </div>
    {children}
  </section>
);

// ------------------------------------------------------------------ 2. Paz y Salvo jefe inmediato
export const JefeStep = ({ data, ctx }) => {
  const dep = data.dependencias.find((d) => d.etapa === 1);
  const [jefes, setJefes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const editable = data.editable;
  const elegido = data.datosGenerales.jefe_inmediato_id || '';

  useEffect(() => {
    if (editable) listJefes().then(setJefes).catch(() => setJefes([]));
  }, [editable]);

  const elegir = async (id) => {
    setGuardando(true);
    setError('');
    try {
      await updateDatosGenerales(data.solicitudId, { jefe_inmediato_id: id || null });
      await ctx.recargar({ silencioso: true });
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar tu jefe inmediato'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Contenedor
      id="titulo-jefe"
      titulo="2. Paz y Salvo jefe inmediato"
      descripcion="Tu jefe inmediato confirma que recibió tus archivos físicos, digitales o en medios magnéticos, el informe y los productos elaborados."
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label htmlFor="jefe-select" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
          Nombre del jefe del área <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        {editable ? (
          <>
            <select
              id="jefe-select"
              value={elegido}
              disabled={guardando}
              onChange={(e) => elegir(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/10"
            >
              <option value="">Selecciona a tu jefe inmediato…</option>
              {jefes.map((j) => <option key={j.id} value={j.id}>{j.nombre}{j.cargo ? ` — ${j.cargo}` : ''}</option>)}
            </select>
            {jefes.length === 0 && (
              <p className="mt-2 text-xs text-amber-800">
                Aún no hay jefes inmediatos registrados. Pídele a TI que registre a tu jefe para poder continuar.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm font-semibold text-slate-800">{data.datosGenerales.jefe_nombre || '—'}</p>
        )}
        {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      </div>

      {dep && (
        <DependenciaCard
          dep={{
            ...dep,
            puedeSolicitar: dep.puedeSolicitar && Boolean(elegido),
            motivoNoPuede: dep.motivoNoPuede || (!elegido ? 'Selecciona a tu jefe inmediato' : null),
          }}
          solicitudId={data.solicitudId}
          ctx={ctx}
        />
      )}

      <div className="flex justify-between">
        <button type="button" onClick={() => ctx.irAPaso('datos')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Anterior</button>
        <button type="button" onClick={() => ctx.irAPaso('areas')} className="rounded-xl bg-[#0A2540] px-5 py-2 text-sm font-bold text-white hover:bg-[#133961]">Continuar →</button>
      </div>
    </Contenedor>
  );
};

// ------------------------------------------------------------------ 3. Paz y Salvo áreas de gestión
export const AreasStep = ({ data, ctx }) => {
  const areas = data.dependencias.filter((d) => d.etapa === 2 && !d.soloDocentes);
  const [enviando, setEnviando] = useState(false);
  const disponibles = areas.filter((a) => a.aplica && a.estado === 'SIN_SOLICITAR' && a.puedeSolicitar && !a.requiereEnlace);

  const solicitarTodas = async () => {
    setEnviando(true);
    let enviadas = 0;
    try {
      for (const area of disponibles) {
        // una por una: si una falla se detiene y se muestra el motivo
        // eslint-disable-next-line no-await-in-loop
        await solicitarAprobacion(data.solicitudId, area.id, {});
        enviadas += 1;
      }
      ctx.notify(`Solicitud enviada a ${enviadas} dependencia(s).`);
    } catch (err) {
      ctx.fail(err, 'No se pudieron enviar todas las solicitudes');
    } finally {
      setEnviando(false);
      await ctx.recargar({ silencioso: true });
    }
  };

  return (
    <Contenedor
      id="titulo-areas"
      titulo="3. Paz y Salvo áreas de gestión"
      descripcion="Solicita la aprobación de cada área. Pueden revisarte al mismo tiempo; mientras decidan, verás «En proceso». Si una te bloquea, corrige lo que indica y vuelve a solicitarla."
    >
      {disponibles.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-900">
            Hay {disponibles.length} áreas listas para solicitar (las que piden un enlace se solicitan una por una).
          </p>
          <button
            type="button"
            onClick={solicitarTodas}
            disabled={enviando}
            className="rounded-xl bg-[#D97706] px-4 py-2 text-sm font-bold text-white hover:bg-[#B45309] disabled:opacity-60"
          >
            {enviando ? 'Enviando…' : `Solicitar las ${disponibles.length} áreas`}
          </button>
        </div>
      )}

      {areas.map((dep) => <DependenciaCard key={dep.id} dep={dep} solicitudId={data.solicitudId} ctx={ctx} />)}

      <div className="flex justify-between">
        <button type="button" onClick={() => ctx.irAPaso('jefe')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Anterior</button>
        <button type="button" onClick={() => ctx.irAPaso(data.tipoVinculacion === 'Docente' ? 'profesores' : 'informe')} className="rounded-xl bg-[#0A2540] px-5 py-2 text-sm font-bold text-white hover:bg-[#133961]">Continuar →</button>
      </div>
    </Contenedor>
  );
};

// ------------------------------------------------------------------ 4. Paz y Salvo a profesores
const ITEMS_PROFESORES = [
  {
    clave: 'innovaciones_educativas',
    titulo: 'Innovaciones educativas',
    texto: 'Los profesores que han participado deberán entregar la sistematización del proceso en el formato correspondiente. La primera y segunda convocatoria deben estar finalizadas.',
  },
  {
    clave: 'planes_aula',
    titulo: 'Planes de aula',
    texto: 'Todos los planes deben estar diligenciados y completos. Además, deberán estar cargados en el Excel que se maneja para este fin e incluir todos los ítems, (bibliografías, propósitos y demás).',
  },
  {
    clave: 'informes_ejecucion',
    titulo: 'Informes de ejecución',
    texto: 'Los profesores con horas asignada para otras actividades como: tutorías, RA, Saber Pro, clubes y otras asociadas a la VRA, deben entregar un informe cuantitativo con datos y evidencias sobre el cumplimiento de las actividades.',
  },
];

export const ProfesoresStep = ({ data, ctx }) => {
  const dep = data.dependencias.find((d) => d.soloDocentes);
  const entregables = dep?.entregablesProfesorales || {};

  return (
    <Contenedor
      id="titulo-profesores"
      titulo="4. Paz y Salvo a profesores"
      descripcion="Una sola persona del Centro de Desarrollo Profesoral revisa los tres aspectos y firma. Solicita su aprobación cuando hayas entregado todo."
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {ITEMS_PROFESORES.map((item) => (
            <li key={item.clave} className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Centro de Desarrollo Profesoral</p>
                <p className="mt-1 text-sm text-slate-800"><strong>{item.titulo}:</strong> {item.texto}</p>
              </div>
              <ReviewState estado={entregables[item.clave] ? 'APROBADA' : (dep?.estado === 'SOLICITADA' ? 'SOLICITADA' : 'SIN_SOLICITAR')} />
            </li>
          ))}
        </ul>
      </div>

      {dep && <DependenciaCard dep={dep} solicitudId={data.solicitudId} ctx={ctx} />}

      <div className="flex justify-between">
        <button type="button" onClick={() => ctx.irAPaso('areas')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Anterior</button>
        <button type="button" onClick={() => ctx.irAPaso('informe')} className="rounded-xl bg-[#0A2540] px-5 py-2 text-sm font-bold text-white hover:bg-[#133961]">Continuar →</button>
      </div>
    </Contenedor>
  );
};
