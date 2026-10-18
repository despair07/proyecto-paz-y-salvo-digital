import React from 'react';

// Estado de la revisión de una dependencia, con texto + icono (nunca solo color)
const ESTADOS = {
  SIN_SOLICITAR: { texto: 'Sin solicitar', icono: '○', clases: 'bg-slate-100 text-slate-700 border-slate-200' },
  SOLICITADA: { texto: 'En proceso', icono: '◔', clases: 'bg-amber-50 text-amber-800 border-amber-200' },
  APROBADA: { texto: 'Paz y salvo', icono: '✓', clases: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  BLOQUEADA: { texto: 'Bloqueada', icono: '✕', clases: 'bg-rose-50 text-rose-800 border-rose-200' },
  NO_APLICA: { texto: 'No aplica', icono: '–', clases: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export const CATEGORIAS_BLOQUEO = {
  FINANCIERO: 'Financiero',
  INVENTARIO_ELEMENTOS: 'Inventario de elementos',
  DOCUMENTAL_ENTREGABLES: 'Documental / entregables',
  ACADEMICO_PROFESORAL: 'Académico / profesoral',
};

const ReviewState = ({ estado }) => {
  const e = ESTADOS[estado] || ESTADOS.SIN_SOLICITAR;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${e.clases}`}>
      <span aria-hidden="true">{e.icono}</span>
      {e.texto}
    </span>
  );
};

export default ReviewState;
