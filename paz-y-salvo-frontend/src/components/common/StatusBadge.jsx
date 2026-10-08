const styles = {
  EN_PROCESO: 'bg-amber-100 text-amber-800',
  APROBADA: 'bg-emerald-100 text-emerald-800',
  RECHAZADA: 'bg-rose-100 text-rose-800',
  BLOQUEADO: 'bg-rose-100 text-rose-800',
  RESUELTO: 'bg-emerald-100 text-emerald-800',
  ACTIVO: 'bg-emerald-100 text-emerald-800',
};

export default function StatusBadge({ value }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[value] || 'bg-slate-100 text-slate-700'}`}>
      {value}
    </span>
  );
}
