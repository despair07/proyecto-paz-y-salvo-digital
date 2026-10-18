import React, { useEffect, useRef, useState } from 'react';
import { getCargos, updateDatosGenerales } from '../../../services/tramite.service';
import { aInputFecha, mensajeError } from '../../../utils/errors';

const inputBase = 'w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/10 disabled:bg-slate-50 disabled:text-slate-600';
const TIPOS_DOCUMENTO = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PA', label: 'Pasaporte' },
  { value: 'TI', label: 'Tarjeta de identidad' },
];

const Campo = ({ id, label, children, ayuda, error }) => (
  <div>
    <label htmlFor={id} className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
      {label} <span className="text-red-600" aria-hidden="true">*</span>
    </label>
    {children}
    {ayuda && <p className="mt-1 text-[11px] text-slate-500">{ayuda}</p>}
    {error && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
  </div>
);

// 1. Datos generales del trabajador o contratista. Obligatorios y editables mientras no se haya
// solicitado ninguna aprobación (después quedan como constancia del trámite).
const DatosGenerales = ({ data, ctx }) => {
  const origen = data.datosGenerales;
  const editable = data.editable;
  const [form, setForm] = useState({
    nombre_completo: origen.nombre_completo || '',
    tipo_documento: origen.tipo_documento || 'CC',
    numero_documento: origen.numero_documento || '',
    lugar_expedicion_documento: origen.lugar_expedicion_documento || '',
    cargo_desempenado: origen.cargo_desempenado || '',
    tipo_novedad: origen.tipo_novedad || 'RETIRO',
    fecha_retiro: aInputFecha(origen.fecha_retiro),
  });
  const [cargos, setCargos] = useState([]);
  const [guardado, setGuardado] = useState('');
  const [errorCampo, setErrorCampo] = useState('');
  const pendiente = useRef({});
  const timer = useRef(null);

  useEffect(() => {
    getCargos().then(setCargos).catch(() => setCargos([]));
    return () => clearTimeout(timer.current);
  }, []);

  const guardar = async () => {
    const cambios = pendiente.current;
    pendiente.current = {};
    if (!Object.keys(cambios).length) return;
    setGuardado('guardando');
    try {
      await updateDatosGenerales(data.solicitudId, cambios);
      setGuardado('ok');
      setErrorCampo('');
      ctx.recargar({ silencioso: true });
    } catch (err) {
      pendiente.current = { ...cambios, ...pendiente.current };
      setGuardado('error');
      setErrorCampo(mensajeError(err, 'No se pudieron guardar los datos'));
    }
  };

  const cambiar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    pendiente.current[campo] = valor;
    setGuardado('pendiente');
    clearTimeout(timer.current);
    timer.current = setTimeout(guardar, 900);
  };

  const comunes = (campo, id) => ({
    id,
    value: form[campo],
    disabled: !editable,
    onChange: (e) => cambiar(campo, e.target.value),
    onBlur: () => { clearTimeout(timer.current); guardar(); },
    className: `${inputBase} border-slate-300`,
  });

  const faltantes = data.datosFaltantes || [];

  return (
    <section aria-labelledby="titulo-datos" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-datos" className="text-lg font-bold text-[#0A2540]">1. Datos generales del trabajador o contratista</h2>
          <p className="mt-1 text-xs text-slate-600">
            Todos los campos son obligatorios. Revísalos y corrígelos si hay algún dato errado
            {editable ? '.' : ': ya no se pueden editar porque se solicitó la aprobación de alguna dependencia.'}
          </p>
        </div>
        <span aria-live="polite" className="text-xs font-semibold text-slate-500">
          {guardado === 'guardando' && 'Guardando…'}
          {guardado === 'pendiente' && 'Cambios sin guardar…'}
          {guardado === 'ok' && '✓ Guardado'}
          {guardado === 'error' && <span className="text-red-600">No se guardó</span>}
        </span>
      </div>

      {errorCampo && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700">{errorCampo}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo id="dg-nombre" label="Nombre">
            <input {...comunes('nombre_completo', 'dg-nombre')} type="text" autoComplete="name" maxLength={300} />
          </Campo>
        </div>
        <Campo id="dg-tipo-doc" label="Tipo de documento">
          <select {...comunes('tipo_documento', 'dg-tipo-doc')}>
            {TIPOS_DOCUMENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo id="dg-doc" label="Número de documento">
          <input {...comunes('numero_documento', 'dg-doc')} type="text" inputMode="numeric" maxLength={40} />
        </Campo>
        <Campo id="dg-lugar" label="Lugar de expedición" ayuda="Ciudad y departamento donde se expidió el documento.">
          <input {...comunes('lugar_expedicion_documento', 'dg-lugar')} type="text" maxLength={180} placeholder="Popayán, Cauca" />
        </Campo>
        <Campo id="dg-cargo" label="Cargo actual">
          <input {...comunes('cargo_desempenado', 'dg-cargo')} type="text" list="cargos-sugeridos" maxLength={180} />
          <datalist id="cargos-sugeridos">
            {cargos.map((c) => <option key={c.id} value={c.nombre} />)}
          </datalist>
        </Campo>

        <fieldset className="sm:col-span-2" disabled={!editable}>
          <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-700">
            Tipo de novedad <span className="text-red-600" aria-hidden="true">*</span>
          </legend>
          <div className="flex flex-wrap gap-3">
            {[['RETIRO', 'Retiro'], ['CAMBIO_DEPENDENCIA', 'Cambio de dependencia']].map(([valor, texto]) => (
              <label
                key={valor}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  form.tipo_novedad === valor ? 'border-[#0A2540] bg-slate-50 text-[#0A2540]' : 'border-slate-200 text-slate-700'
                } ${!editable ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <input
                  type="radio"
                  name="tipo_novedad"
                  value={valor}
                  checked={form.tipo_novedad === valor}
                  onChange={() => cambiar('tipo_novedad', valor)}
                  className="h-4 w-4"
                />
                {texto}
              </label>
            ))}
          </div>
          {form.tipo_novedad === 'CAMBIO_DEPENDENCIA' && (
            <p className="mt-2 text-xs text-slate-600">
              En un cambio de dependencia no firman las áreas que solo aplican al retiro (por ejemplo, Seguridad y Salud en el Trabajo).
            </p>
          )}
        </fieldset>

        {form.tipo_novedad === 'RETIRO' && (
          <div className="sm:col-span-2">
            <Campo id="dg-fecha" label="Si es retiro, indique la fecha de retiro (día / mes / año)">
              <input {...comunes('fecha_retiro', 'dg-fecha')} type="date" />
            </Campo>
          </div>
        )}
      </div>

      {faltantes.length > 0 ? (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Falta completar:</strong> {faltantes.join(', ')}.
        </p>
      ) : (
        <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          ✓ Datos generales completos. Ya puedes elegir a tu jefe inmediato y solicitar las aprobaciones.
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => ctx.irAPaso('jefe')}
          disabled={faltantes.length > 0}
          className="rounded-xl bg-[#0A2540] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#133961] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar →
        </button>
      </div>
    </section>
  );
};

export default DatosGenerales;
