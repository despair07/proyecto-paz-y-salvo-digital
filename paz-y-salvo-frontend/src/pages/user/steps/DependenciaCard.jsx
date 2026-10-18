import React, { useState } from 'react';
import ReviewState, { CATEGORIAS_BLOQUEO } from '../../../components/common/ReviewState';
import { solicitarAprobacion } from '../../../services/tramite.service';
import { formatearFecha, mensajeError } from '../../../utils/errors';

const EnlaceSeguro = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-[#0A2540] underline underline-offset-2">
    {children}
  </a>
);

// Una fila del formato GTH-07: dependencia, aspecto, estado y la acción del trabajador
// (solicitar la aprobación, o volver a solicitarla tras un bloqueo).
const DependenciaCard = ({ dep, solicitudId, ctx, nota }) => {
  const [enlace, setEnlace] = useState(dep.enlace || '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [verHistorial, setVerHistorial] = useState(false);

  if (!dep.aplica) {
    return (
      <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 opacity-80">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-700">{dep.nombre}</h3>
          <ReviewState estado="NO_APLICA" />
        </div>
        <p className="mt-1 text-xs text-slate-500">No aplica para tu tipo de vinculación o de novedad.</p>
      </article>
    );
  }

  const solicitar = async () => {
    setEnviando(true);
    setError('');
    try {
      const res = await solicitarAprobacion(solicitudId, dep.id, dep.requiereEnlace ? { enlace } : {});
      ctx.notify(res.mensaje);
      await ctx.recargar({ silencioso: true });
    } catch (err) {
      setError(mensajeError(err, 'No se pudo enviar la solicitud'));
    } finally {
      setEnviando(false);
    }
  };

  const puedeEditarEnlace = ['SIN_SOLICITAR', 'BLOQUEADA'].includes(dep.estado) && dep.requiereEnlace;
  const faltaEnlace = dep.requiereEnlace && !enlace.trim();
  const bloqueada = dep.estado === 'BLOQUEADA';
  const accionDisponible = ['SIN_SOLICITAR', 'BLOQUEADA'].includes(dep.estado);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-[#0A2540] sm:text-base">{dep.nombre}</h3>
        <ReviewState estado={dep.estado} />
      </div>

      {dep.aspecto && (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          <span className="font-bold uppercase tracking-wider text-slate-500">Aspecto sobre el que se da paz y salvo: </span>
          {dep.aspecto}
        </p>
      )}
      {nota && <p className="mt-2 text-xs text-slate-600">{nota}</p>}

      {dep.estado === 'SOLICITADA' && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Solicitud enviada el {formatearFecha(dep.fechaSolicitud, { hora: true })}
          {dep.intentos > 1 ? ` (intento ${dep.intentos})` : ''}. Está en revisión
          {dep.contacto?.nombre ? ` por ${dep.contacto.nombre}` : ''}; te avisaremos cuando decidan.
        </p>
      )}

      {dep.estado === 'APROBADA' && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p><strong>Aprobada</strong> por {dep.revisor} el {formatearFecha(dep.fechaRevision, { hora: true })} · Firmado digitalmente.</p>
          {dep.recibi && <p className="mt-1"><strong>Recibí / Revisé:</strong> {dep.recibi}</p>}
        </div>
      )}

      {bloqueada && (
        <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <p className="font-bold">
            Bloqueada{dep.categoria ? ` · ${CATEGORIAS_BLOQUEO[dep.categoria] || dep.categoria}` : ''}
          </p>
          <p className="mt-1">{dep.motivo}</p>
          <p className="mt-1 text-rose-700">Corrige lo indicado y vuelve a solicitar la aprobación.</p>
        </div>
      )}

      {dep.requiereEnlace && (
        <div className="mt-3">
          {puedeEditarEnlace ? (
            <>
              <label htmlFor={`enlace-${dep.id}`} className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
                {dep.etiquetaEnlace || 'Enlace'} <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <input
                id={`enlace-${dep.id}`}
                type="url"
                value={enlace}
                onChange={(e) => setEnlace(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/10"
              />
              <p className="mt-1 text-[11px] text-slate-500">Pega el enlace (https) para que el área lo valide.</p>
            </>
          ) : (
            dep.enlace && (
              <p className="text-xs text-slate-700">
                <span className="font-bold uppercase tracking-wider text-slate-500">{dep.etiquetaEnlace || 'Enlace'}: </span>
                <EnlaceSeguro href={dep.enlace}>{dep.enlace}</EnlaceSeguro>
              </p>
            )
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-xs font-semibold text-red-600">{error}</p>}

      {accionDisponible && (
        <div className="mt-4">
          <button
            type="button"
            onClick={solicitar}
            disabled={enviando || !dep.puedeSolicitar || faltaEnlace}
            className="rounded-xl bg-[#D97706] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#B45309] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : bloqueada ? 'Ya lo corregí: solicitar de nuevo' : 'Solicitar aprobación'}
          </button>
          {!dep.puedeSolicitar && dep.motivoNoPuede && (
            <p className="mt-2 text-xs text-slate-600">{dep.motivoNoPuede}.</p>
          )}
          {dep.puedeSolicitar && faltaEnlace && (
            <p className="mt-2 text-xs text-slate-600">Agrega el enlace para poder solicitar.</p>
          )}
        </div>
      )}

      {dep.contacto?.nombre && (
        <p className="mt-3 text-[11px] text-slate-500">Contacto: {dep.contacto.nombre} · {dep.contacto.correo}</p>
      )}

      {dep.bloqueosResueltos?.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => setVerHistorial((v) => !v)}
            aria-expanded={verHistorial}
            className="text-xs font-semibold text-slate-600 hover:underline"
          >
            {verHistorial ? 'Ocultar' : 'Ver'} historial de bloqueos resueltos ({dep.bloqueosResueltos.length})
          </button>
          {verHistorial && (
            <ul className="mt-2 space-y-2">
              {dep.bloqueosResueltos.map((b) => (
                <li key={b.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                  <p className="font-semibold text-slate-800">{b.motivo}</p>
                  <p className="mt-0.5 text-emerald-700">✓ {b.observacion || 'Resuelto'}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">{formatearFecha(b.fecha_resolucion, { hora: true })}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
};

export default DependenciaCard;
