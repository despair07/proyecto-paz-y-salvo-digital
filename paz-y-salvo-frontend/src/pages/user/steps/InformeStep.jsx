import React, { useCallback, useEffect, useRef, useState } from 'react';
import InformeForm from '../../../components/informe/InformeForm';
import { getInforme, saveInforme } from '../../../services/tramite.service';
import { informeInicial, seccionDePath } from '../../../utils/informeSchema';
import { mensajeError } from '../../../utils/errors';

const AUTOGUARDADO_MS = 1500;

// Informe final por entrega de cargo: lo diligencian todos, sin importar el tipo de vinculación.
// Todos los campos son obligatorios para finalizarlo; el borrador se guarda solo.
const InformeStep = ({ data, ctx }) => {
  const [cargando, setCargando] = useState(true);
  const [secciones, setSecciones] = useState({});
  const [resumen, setResumen] = useState(data.informe.secciones || []);
  const [estado, setEstado] = useState(data.informe.estado);
  const [editable, setEditable] = useState(data.informe.editable);
  const [guardado, setGuardado] = useState('');
  const [errores, setErrores] = useState({});
  const [listaErrores, setListaErrores] = useState([]);
  const [saltarA, setSaltarA] = useState(null);
  const [finalizando, setFinalizando] = useState(false);

  const actual = useRef({});
  const timer = useRef(null);
  const sucio = useRef(false);

  useEffect(() => {
    let cancelado = false;
    getInforme(data.solicitudId)
      .then((informe) => {
        if (cancelado) return;
        const vacio = Object.keys(informe.secciones || {}).length === 0;
        const inicial = vacio ? informeInicial(data) : informe.secciones;
        actual.current = inicial;
        setSecciones(inicial);
        setResumen(informe.resumen);
        setEstado(informe.estado);
        setEditable(informe.editable);
      })
      .catch((err) => ctx.fail(err, 'No se pudo cargar el informe'))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.solicitudId]);

  const guardarBorrador = useCallback(async () => {
    if (!sucio.current) return;
    sucio.current = false;
    setGuardado('guardando');
    try {
      const res = await saveInforme(data.solicitudId, 'BORRADOR', actual.current);
      setResumen(res.resumen);
      setEstado('BORRADOR');
      setGuardado('ok');
      ctx.recargar({ silencioso: true });
    } catch (err) {
      sucio.current = true;
      setGuardado('error');
      ctx.fail(err, 'No se pudo guardar el borrador del informe');
    }
  }, [data.solicitudId, ctx]);

  const cambiar = (nuevo) => {
    actual.current = nuevo;
    setSecciones(nuevo);
    sucio.current = true;
    setGuardado('pendiente');
    clearTimeout(timer.current);
    timer.current = setTimeout(guardarBorrador, AUTOGUARDADO_MS);
  };

  const finalizar = async () => {
    clearTimeout(timer.current);
    setFinalizando(true);
    setErrores({});
    setListaErrores([]);
    try {
      const res = await saveInforme(data.solicitudId, 'COMPLETO', actual.current);
      sucio.current = false;
      setResumen(res.resumen);
      setEstado('COMPLETO');
      setGuardado('ok');
      ctx.notify('Informe por entrega de cargo completo.');
      await ctx.recargar({ silencioso: true });
    } catch (err) {
      const detalles = err.response?.data?.detalles;
      if (err.response?.status === 400 && Array.isArray(detalles) && detalles.length) {
        setErrores(Object.fromEntries(detalles.map((d) => [d.path, d.mensaje])));
        setListaErrores(detalles);
        setSaltarA({ clave: seccionDePath(detalles[0].path), n: Date.now() });
        ctx.fail(err, 'El informe está incompleto');
      } else {
        ctx.fail(err, mensajeError(err, 'No se pudo finalizar el informe'));
      }
    } finally {
      setFinalizando(false);
    }
  };

  if (cargando) {
    return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Cargando el informe…</p>;
  }

  const completas = resumen.filter((r) => r.completa).length;

  return (
    <section aria-labelledby="titulo-informe" className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="titulo-informe" className="text-lg font-bold text-[#0A2540]">Informe final por entrega de cargo</h2>
            <p className="mt-1 text-xs text-slate-600">
              Todos los campos son obligatorios: sin el informe completo no se otorga el paz y salvo. Si una tabla no
              aplica en tu cargo, márcala como «No aplica» y explica por qué.
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${
              estado === 'COMPLETO' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
            >
              {estado === 'COMPLETO' ? '✓ Informe completo' : 'En borrador'}
            </span>
            <p aria-live="polite" className="mt-1 text-[11px] font-semibold text-slate-500">
              {guardado === 'guardando' && 'Guardando…'}
              {guardado === 'pendiente' && 'Cambios sin guardar…'}
              {guardado === 'ok' && '✓ Guardado'}
              {guardado === 'error' && <span className="text-red-600">No se guardó</span>}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-600">{completas} de {resumen.length || 8} secciones completas.</p>
        {estado === 'COMPLETO' && editable && (
          <p className="mt-2 text-xs text-slate-500">Si lo modificas, deberás finalizarlo de nuevo.</p>
        )}
        {!editable && (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            El trámite ya está en aprobación final o cerrado: el informe es de solo lectura.
          </p>
        )}
      </div>

      {listaErrores.length > 0 && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">Faltan {listaErrores.length} campo(s) para completar el informe:</p>
          <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-red-800">
            {listaErrores.slice(0, 40).map((e) => (
              <li key={e.path}>
                <button
                  type="button"
                  className="text-left underline-offset-2 hover:underline"
                  onClick={() => setSaltarA({ clave: seccionDePath(e.path), n: Date.now() })}
                >
                  {e.mensaje}
                </button>
              </li>
            ))}
          </ul>
          {listaErrores.length > 40 && <p className="mt-2 text-xs text-red-700">…y {listaErrores.length - 40} más.</p>}
        </div>
      )}

      <InformeForm
        secciones={secciones}
        onChange={cambiar}
        resumen={resumen}
        errores={errores}
        readOnly={!editable}
        saltarA={saltarA}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <button type="button" onClick={() => ctx.irAPaso(data.tipoVinculacion === 'Docente' ? 'profesores' : 'areas')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          ← Anterior
        </button>
        <div className="flex flex-wrap gap-3">
          {editable && (
            <button
              type="button"
              onClick={finalizar}
              disabled={finalizando}
              className="rounded-xl bg-[#D97706] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#B45309] disabled:opacity-60"
            >
              {finalizando ? 'Validando…' : estado === 'COMPLETO' ? 'Finalizar de nuevo' : 'Finalizar informe'}
            </button>
          )}
          <button
            type="button"
            onClick={() => ctx.irAPaso('cierre')}
            className="rounded-xl bg-[#0A2540] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#133961]"
          >
            Continuar →
          </button>
        </div>
      </div>
    </section>
  );
};

export default InformeStep;
