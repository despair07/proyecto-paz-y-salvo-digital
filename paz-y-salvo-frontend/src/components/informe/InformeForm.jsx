import React, { useEffect, useMemo, useState } from 'react';
import { ESTADOS_CREDENCIAL, SECCIONES, filaVacia, getPath, seccionDePath, setPath } from '../../utils/informeSchema';

const inputBase = 'w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/10 disabled:bg-slate-50';

const etiquetaCredencial = (valor) => ESTADOS_CREDENCIAL.find((e) => e.value === valor)?.label || valor;

// ---------------------------------------------------------------- un campo
const Campo = ({ id, label, tipo = 'text', opciones, valor, onChange, error, readOnly, descripcion }) => {
  const opcionesNorm = (opciones || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const mostrar = tipo === 'select'
    ? opcionesNorm.find((o) => o.value === valor)?.label
    : valor;

  if (readOnly) {
    return (
      <div>
        <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
        <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800">{mostrar || '—'}</dd>
      </div>
    );
  }

  const comunes = {
    id,
    'data-path': id,
    value: valor ?? '',
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : undefined,
    className: `${inputBase} ${error ? 'border-red-400' : 'border-slate-300'}`,
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
        {label} <span className="text-red-600" aria-hidden="true">*</span>
      </label>
      {tipo === 'textarea' && <textarea {...comunes} rows={3} onChange={(e) => onChange(e.target.value)} />}
      {tipo === 'select' && (
        <select {...comunes} onChange={(e) => onChange(e.target.value)}>
          <option value="">Seleccione…</option>
          {opcionesNorm.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {!['textarea', 'select'].includes(tipo) && (
        <input {...comunes} type={tipo} onChange={(e) => onChange(e.target.value)} />
      )}
      {descripcion && <p className="mt-1 text-[11px] text-slate-500">{descripcion}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
};

// ---------------------------------------------------------------- una tabla de filas
const Tabla = ({ def, secciones, onChange, errores, readOnly }) => {
  const valor = getPath(secciones, def.path) || {};
  const filas = Array.isArray(valor.filas) ? valor.filas : [];
  const noAplica = valor.no_aplica === true;
  const errorTabla = errores[def.path];

  const actualizar = (nuevo) => onChange(setPath(secciones, def.path, { no_aplica: false, justificacion: '', filas: [], ...valor, ...nuevo }));
  const agregar = () => actualizar({ filas: [...filas, filaVacia(def.campos)] });
  const quitar = (i) => actualizar({ filas: filas.filter((_, idx) => idx !== i) });
  const cambiarFila = (i, key, v) => actualizar({ filas: filas.map((f, idx) => (idx === i ? { ...f, [key]: v } : f)) });

  const mostrarCelda = (campo, v) => (campo.key === 'estado_credencial' ? etiquetaCredencial(v) : v);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" data-path={def.path}>
      <h4 className="text-sm font-bold text-[#0A2540]">{def.titulo}</h4>
      {def.aviso && !readOnly && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">{def.aviso}</p>
      )}

      {readOnly ? (
        noAplica ? (
          <p className="mt-3 text-sm text-slate-600">
            <strong>No aplica.</strong> {valor.justificacion}
          </p>
        ) : filas.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Sin información.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                  {def.campos.map((c) => <th key={c.key} className="px-2 py-1.5 font-bold">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, i) => (
                  <tr key={i} className="border-b border-slate-100 align-top">
                    {def.campos.map((c) => (
                      <td key={c.key} className="whitespace-pre-wrap break-words px-2 py-2 text-slate-800">{mostrarCelda(c, fila[c.key]) || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={noAplica}
              onChange={(e) => actualizar({ no_aplica: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            No aplica
          </label>

          {noAplica ? (
            <div className="mt-3">
              <Campo
                id={`${def.path}.justificacion`}
                label="¿Por qué no aplica?"
                tipo="textarea"
                valor={valor.justificacion}
                onChange={(v) => actualizar({ justificacion: v })}
                error={errores[`${def.path}.justificacion`]}
                descripcion="Explica brevemente por qué no tienes nada que reportar en esta tabla."
              />
            </div>
          ) : (
            <>
              {errorTabla && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{errorTabla}</p>}
              <div className="mt-3 space-y-3">
                {filas.map((fila, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fila {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => quitar(i)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                        aria-label={`Quitar la fila ${i + 1} de ${def.titulo}`}
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {def.campos.map((c) => {
                        const path = `${def.path}.filas[${i}].${c.key}`;
                        return (
                          <div key={c.key} className={c.tipo === 'textarea' ? 'sm:col-span-2' : ''}>
                            <Campo
                              id={path}
                              label={c.label}
                              tipo={c.tipo}
                              opciones={c.opciones}
                              valor={fila[c.key]}
                              onChange={(v) => cambiarFila(i, c.key, v)}
                              error={errores[path]}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={agregar}
                className="mt-3 rounded-xl border border-dashed border-[#0A2540]/40 px-4 py-2 text-sm font-semibold text-[#0A2540] hover:bg-slate-50"
              >
                + Agregar fila
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
};

// ---------------------------------------------------------------- el formulario completo
// `saltarA` permite al padre llevar al usuario a una sección (p. ej. desde la lista de faltantes)
const InformeForm = ({ secciones, onChange, resumen = [], errores = {}, readOnly = false, saltarA = null, compacto = false }) => {
  const [activa, setActiva] = useState(SECCIONES[0].clave);
  useEffect(() => {
    if (saltarA?.clave) setActiva(saltarA.clave);
  }, [saltarA]);
  const seccion = SECCIONES.find((s) => s.clave === activa) || SECCIONES[0];
  const estadoSeccion = useMemo(
    () => Object.fromEntries(resumen.map((r) => [r.clave, r])),
    [resumen]
  );

  const erroresPorSeccion = useMemo(() => {
    const cuenta = {};
    Object.keys(errores).forEach((path) => {
      const clave = seccionDePath(path);
      if (clave) cuenta[clave] = (cuenta[clave] || 0) + 1;
    });
    return cuenta;
  }, [errores]);

  return (
    <div className={compacto ? 'grid gap-5 xl:grid-cols-[230px_1fr]' : 'grid gap-5 lg:grid-cols-[230px_1fr]'}>
      <nav aria-label="Secciones del informe" className={compacto ? 'xl:sticky xl:top-20 xl:self-start' : 'lg:sticky lg:top-20 lg:self-start'}>
        <ol className={compacto ? 'flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible' : 'flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible'}>
          {SECCIONES.map((s) => {
            const r = estadoSeccion[s.clave];
            const conErrores = erroresPorSeccion[s.clave];
            const activaAhora = s.clave === activa;
            return (
              <li key={s.clave} className={compacto ? 'shrink-0 xl:shrink' : 'shrink-0 lg:shrink'}>
                <button
                  type="button"
                  onClick={() => setActiva(s.clave)}
                  aria-current={activaAhora ? 'step' : undefined}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                    activaAhora ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span aria-hidden="true" className="w-4 text-center">
                    {conErrores ? '!' : r?.completa ? '✓' : '•'}
                  </span>
                  <span className="flex-1">{s.titulo}</span>
                  {!readOnly && r && !r.completa && (
                    <span className={`rounded-full px-1.5 text-[10px] ${activaAhora ? 'bg-white/20' : 'bg-amber-100 text-amber-800'}`}>
                      {r.faltantes}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-[#0A2540]">{seccion.titulo}</h3>
          {seccion.ayuda && <p className="mt-1 text-xs text-slate-600">{seccion.ayuda}</p>}
        </div>

        {seccion.bloques.map((bloque) => {
          if (bloque.tipo === 'tabla') {
            return (
              <Tabla
                key={bloque.path}
                def={bloque}
                secciones={secciones}
                onChange={onChange}
                errores={errores}
                readOnly={readOnly}
              />
            );
          }
          return (
            <section key={bloque.titulo} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h4 className="text-sm font-bold text-[#0A2540]">{bloque.titulo}</h4>
              {readOnly ? (
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {bloque.campos.filter((c) => !c.visibleSi || c.visibleSi(secciones)).map((c) => (
                    <div key={c.path} className={c.ancho === 'completo' ? 'sm:col-span-2' : ''}>
                      <Campo id={c.path} label={c.label} tipo={c.tipo} opciones={c.opciones} valor={getPath(secciones, c.path)} readOnly />
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {bloque.campos.filter((c) => !c.visibleSi || c.visibleSi(secciones)).map((c) => (
                    <div key={c.path} className={c.ancho === 'completo' ? 'sm:col-span-2' : ''}>
                      <Campo
                        id={c.path}
                        label={c.label}
                        tipo={c.tipo}
                        opciones={c.opciones}
                        valor={getPath(secciones, c.path)}
                        onChange={(v) => onChange(setPath(secciones, c.path, v))}
                        error={errores[c.path]}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <div className="flex justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              const i = SECCIONES.findIndex((s) => s.clave === activa);
              if (i > 0) setActiva(SECCIONES[i - 1].clave);
            }}
            disabled={activa === SECCIONES[0].clave}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            ← Sección anterior
          </button>
          <button
            type="button"
            onClick={() => {
              const i = SECCIONES.findIndex((s) => s.clave === activa);
              if (i < SECCIONES.length - 1) setActiva(SECCIONES[i + 1].clave);
            }}
            disabled={activa === SECCIONES[SECCIONES.length - 1].clave}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Sección siguiente →
          </button>
        </div>
      </div>
    </div>
  );
};

export default InformeForm;
