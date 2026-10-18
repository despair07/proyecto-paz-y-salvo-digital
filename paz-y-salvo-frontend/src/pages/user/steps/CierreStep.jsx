import React, { useCallback, useEffect, useRef, useState } from 'react';
import SignaturePad from '../../../components/common/SignaturePad';
import {
  getFirma, reiniciarTramite, saveFirma, solicitarAprobacionFinal, updateCierre,
} from '../../../services/tramite.service';
import { formatearFecha, mensajeError } from '../../../utils/errors';

// Cláusula del formato GTH-07 (texto original)
const CLAUSULA = [
  'Por medio de la suscripción del presente documento el Trabajador o Contratista se compromete a dar cumplimiento a las obligaciones sobre normas del derecho de autor estipuladas con la Entidad, así como a guardar estricta reserva de los asuntos e información de la Entidad una vez terminado el contrato, excepto cuando la información sea requerida por autoridad competente para efecto de procesos o investigaciones en curso.',
  'Por otra parte, el Trabajador o Contratista se compromete a no ejecutar cualquier acción que pretenda difamar, abusar, afectar la reputación o presentar una mala imagen de la Institución.',
];

// Cierre del paz y salvo: observaciones, cláusula, firma del trabajador y solicitud de aprobación final
const CierreStep = ({ data, ctx }) => {
  const cierre = data.cierre;
  const editable = cierre.editable && data.estadoGlobal !== 'PENDIENTE_APROBACION';
  const [observaciones, setObservaciones] = useState(cierre.observaciones || '');
  const [firma, setFirma] = useState(null);
  const [cargandoFirma, setCargandoFirma] = useState(true);
  const [dibujando, setDibujando] = useState(false);
  const [guardandoFirma, setGuardandoFirma] = useState(false);
  const [guardadoObs, setGuardadoObs] = useState('');
  const [aceptando, setAceptando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const timer = useRef(null);

  const cargarFirma = useCallback(async () => {
    try {
      const res = await getFirma();
      setFirma(res.imagen);
    } catch {
      setFirma(null);
    } finally {
      setCargandoFirma(false);
    }
  }, []);

  useEffect(() => {
    cargarFirma();
    return () => clearTimeout(timer.current);
  }, [cargarFirma]);

  const guardarObservaciones = async (valor) => {
    setGuardadoObs('guardando');
    try {
      await updateCierre(data.solicitudId, { observaciones: valor });
      setGuardadoObs('ok');
    } catch (err) {
      setGuardadoObs('error');
      ctx.fail(err, 'No se pudieron guardar las observaciones');
    }
  };

  const cambiarObservaciones = (valor) => {
    setObservaciones(valor);
    setGuardadoObs('pendiente');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => guardarObservaciones(valor), 1000);
  };

  const guardarFirmaNueva = async (imagen) => {
    setGuardandoFirma(true);
    try {
      await saveFirma(imagen);
      setFirma(imagen);
      setDibujando(false);
      ctx.notify('Firma guardada en tu perfil.');
      await ctx.recargar({ silencioso: true });
    } catch (err) {
      ctx.fail(err, 'No se pudo guardar la firma');
    } finally {
      setGuardandoFirma(false);
    }
  };

  const cambiarClausula = async (aceptar) => {
    setAceptando(true);
    try {
      await updateCierre(data.solicitudId, { aceptar_clausula: aceptar });
      await ctx.recargar({ silencioso: true });
    } catch (err) {
      ctx.fail(err, 'No se pudo registrar la aceptación');
    } finally {
      setAceptando(false);
    }
  };

  const enviarFinal = async () => {
    setEnviando(true);
    try {
      clearTimeout(timer.current);
      const res = await solicitarAprobacionFinal(data.solicitudId);
      setConfirmando(false);
      ctx.notify(res.mensaje);
      await ctx.recargar({ silencioso: true });
    } catch (err) {
      setConfirmando(false);
      ctx.fail(err, 'No se pudo enviar la solicitud final');
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = async () => {
    setEnviando(true);
    try {
      const res = await reiniciarTramite(data.solicitudId);
      ctx.notify(res.mensaje);
      ctx.irAPaso('datos');
      await ctx.recargar({ silencioso: true });
    } catch (err) {
      ctx.fail(err, 'No se pudo reiniciar el trámite');
    } finally {
      setEnviando(false);
    }
  };

  // ------------------------------------------------------------ estados posteriores
  if (data.estadoGlobal === 'PENDIENTE_APROBACION') {
    return (
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-6 shadow-card">
        <h2 className="text-lg font-bold text-sky-900">Solicitud en revisión de Comunidad Universitaria</h2>
        <p className="mt-2 text-sm text-sky-900">
          Enviaste tu solicitud de aprobación final el {formatearFecha(data.fechaSolicitudFinal, { hora: true })}. Revisarán el
          checklist de las dependencias y tu informe, y te avisaremos el resultado. Mientras tanto no puedes modificar tu trámite.
        </p>
      </section>
    );
  }

  if (data.estadoGlobal === 'APROBADO_FINAL') {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-card">
        <h2 className="text-lg font-bold text-emerald-900">¡Tu paz y salvo fue aprobado!</h2>
        <p className="mt-2 text-sm text-emerald-900">
          Aprobó {data.observacionesAprobacion ? `con la nota: «${data.observacionesAprobacion}»` : 'Comunidad Universitaria'}.
          Tu información quedó registrada y ya puedes descargar el certificado.
        </p>
        {data.certificado?.token_verificacion && (
          <a
            href={`/api/v1/certificados/${data.certificado.token_verificacion}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-xl bg-[#0A2540] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#133961]"
          >
            Descargar certificado PDF con QR
          </a>
        )}
      </section>
    );
  }

  if (data.estadoGlobal === 'RECHAZADO') {
    return (
      <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-card">
        <h2 className="text-lg font-bold text-rose-900">Tu paz y salvo fue rechazado</h2>
        <p className="mt-2 text-sm text-rose-900"><strong>Motivos:</strong> {data.observacionesAprobacion}</p>
        <p className="mt-2 text-xs text-rose-800">
          Puedes iniciar el proceso de nuevo: copiaremos tus datos y tu informe para que solo corrijas lo necesario, y tendrás que
          solicitar otra vez la aprobación de las dependencias.
        </p>
        <button
          type="button"
          onClick={reiniciar}
          disabled={enviando}
          className="mt-4 rounded-xl bg-[#0A2540] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#133961] disabled:opacity-60"
        >
          {enviando ? 'Reiniciando…' : 'Iniciar de nuevo con mis datos'}
        </button>
      </section>
    );
  }

  // ------------------------------------------------------------ edición normal
  const faltantes = data.faltantesAprobacionFinal || [];

  // El cierre y la firma se hacen al final: antes, las dependencias y el informe pueden avanzar en paralelo
  if (!cierre.habilitado) {
    const pendientes = faltantes.filter((f) => !/cláusula/i.test(f));
    return (
      <section aria-labelledby="titulo-cierre" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h2 id="titulo-cierre" className="text-lg font-bold text-[#0A2540]">Cierre y firma</h2>
        <p className="mt-2 text-sm text-slate-700">
          Este paso se habilita al final, cuando todas las dependencias hayan aprobado y tu informe esté completo. Mientras
          tanto puedes avanzar en los demás pasos en el orden que prefieras.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-700">
          {pendientes.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <div className="mt-4">
          <button type="button" onClick={() => ctx.irAPaso('informe')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Anterior</button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="titulo-cierre" className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h2 id="titulo-cierre" className="text-lg font-bold text-[#0A2540]">Cierre y firma</h2>
        <p className="mt-1 text-xs text-slate-600">
          Acepta la cláusula, agrega tus observaciones y firma. Cuando todas las dependencias hayan aprobado, podrás pedir la
          aprobación final.
        </p>

        <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
          {CLAUSULA.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}
        </div>

        <div className="mt-5">
          <label htmlFor="observaciones" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
            Observaciones
          </label>
          <textarea
            id="observaciones"
            rows={3}
            value={observaciones}
            disabled={!editable}
            maxLength={2000}
            onChange={(e) => cambiarObservaciones(e.target.value)}
            onBlur={() => { clearTimeout(timer.current); if (guardadoObs === 'pendiente') guardarObservaciones(observaciones); }}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/10 disabled:bg-slate-50"
          />
          <p aria-live="polite" className="mt-1 text-[11px] text-slate-500">
            {guardadoObs === 'guardando' && 'Guardando…'}
            {guardadoObs === 'ok' && '✓ Guardado'}
            {guardadoObs === 'pendiente' && 'Cambios sin guardar…'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h3 className="text-sm font-bold text-[#0A2540]">Firma Trabajador o Contratista</h3>

        {cargandoFirma ? (
          <p className="mt-3 text-sm text-slate-500">Cargando tu firma…</p>
        ) : dibujando ? (
          <div className="mt-3">
            <SignaturePad onSave={guardarFirmaNueva} onCancel={() => setDibujando(false)} guardando={guardandoFirma} />
          </div>
        ) : firma ? (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <img src={firma} alt="Tu firma guardada" className="h-20 max-w-[260px] rounded-lg border border-slate-200 bg-white object-contain p-1" />
            {editable && (
              <button type="button" onClick={() => setDibujando(true)} className="text-xs font-semibold text-[#0A2540] underline underline-offset-2">
                Dibujar de nuevo
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p>Aún no tienes una firma guardada. Dibújala una vez: se guarda en tu perfil y se usa en todos tus documentos.</p>
            <button
              type="button"
              onClick={() => setDibujando(true)}
              className="mt-2 rounded-xl bg-[#D97706] px-4 py-2 text-sm font-bold text-white hover:bg-[#B45309]"
            >
              Dibujar mi firma
            </button>
          </div>
        )}

        <label className={`mt-5 flex items-start gap-3 text-sm ${!firma || !editable ? 'opacity-60' : ''}`}>
          <input
            type="checkbox"
            checked={cierre.clausulaAceptada}
            disabled={!firma || !editable || aceptando}
            onChange={(e) => cambiarClausula(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span>
            He leído y acepto la cláusula anterior, y firmo este paz y salvo con mi firma digital.
            {cierre.clausulaAceptada && cierre.fechaClausula && (
              <span className="block text-[11px] text-slate-500">Aceptada el {formatearFecha(cierre.fechaClausula, { hora: true })}.</span>
            )}
          </span>
        </label>
        {!firma && !cargandoFirma && <p className="mt-2 text-xs text-slate-500">Guarda tu firma para poder aceptar la cláusula.</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <h3 className="text-sm font-bold text-[#0A2540]">Aprobación final de Comunidad Universitaria</h3>
        {faltantes.length > 0 ? (
          <>
            <p className="mt-2 text-xs text-slate-600">Para pedir la aprobación final todavía falta:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
              {faltantes.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-xs font-semibold text-emerald-800">
            ✓ Todo listo: las dependencias aprobaron, el informe está completo y firmaste.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => ctx.irAPaso('informe')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Anterior</button>
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={!data.puedeSolicitarAprobacionFinal}
            className="rounded-xl bg-[#D97706] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#B45309] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Solicitar aprobación final
          </button>
        </div>
      </div>

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="conf-final-titulo" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-modal">
            <h2 id="conf-final-titulo" className="text-lg font-bold text-[#0A2540]">¿Enviar tu solicitud final?</h2>
            <p className="mt-3 text-sm text-slate-700">
              Comunidad Universitaria revisará lo que aprobó cada dependencia y tu informe. Una vez enviada no podrás modificar tu
              trámite hasta que respondan.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmando(false)} disabled={enviando} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={enviarFinal} disabled={enviando} className="rounded-xl bg-[#D97706] px-4 py-2 text-sm font-bold text-white hover:bg-[#B45309] disabled:opacity-60">
                {enviando ? 'Enviando…' : 'Sí, enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CierreStep;
