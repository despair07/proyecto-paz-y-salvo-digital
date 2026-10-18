import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../hooks/useAuth';

const TIPOS = [
  {
    value: 'Docente',
    descripcion: 'Profesores. Además del paz y salvo de áreas, incluye el Centro de Desarrollo Profesoral.',
  },
  {
    value: 'Administrativo',
    descripcion: 'Personal administrativo vinculado a la universidad.',
  },
  {
    value: 'Contratista',
    descripcion: 'Personal con contrato de prestación de servicios.',
  },
];

const Perfil = () => {
  const { user, updateTipoVinculacion } = useAuth();
  const navigate = useNavigate();

  const roles = user?.roles?.map((r) => (typeof r === 'string' ? r : r.nombre_rol)) ?? [];
  const tipoActual = user?.tipo_vinculacion || null;
  const isOnboarding = roles.length === 0;
  const nombre = [user?.nombres, user?.apellidos].filter(Boolean).join(' ') || user?.nombre_completo;

  const [selected, setSelected] = useState(tipoActual);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isChange = Boolean(tipoActual);
  const canSubmit = selected && selected !== tipoActual;

  const save = async (confirmar) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await updateTipoVinculacion(selected, confirmar);
      setConfirming(false);
      if (isOnboarding) {
        navigate(res.home, { replace: true });
      } else {
        setNotice(`Tu tipo de vinculación ahora es ${selected}. Se te notificó el cambio.`);
      }
    } catch (err) {
      setConfirming(false);
      setError(err.response?.data?.mensaje || 'No se pudo guardar el tipo de vinculación');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    if (isChange) {
      setConfirming(true);
    } else {
      save(false);
    }
  };

  return (
    <Layout title={isOnboarding ? 'Completa tu perfil' : 'Mi perfil'}>
      <div className="mx-auto max-w-3xl space-y-6">
        {isOnboarding && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">¡Bienvenido/a, {user?.nombres}!</p>
            <p className="mt-1">
              Es la primera vez que ingresas. Elige tu tipo de vinculación para continuar. Quedará asociado a tu
              cuenta y podrás cambiarlo después, siempre que no tengas un trámite en curso.
            </p>
          </div>
        )}

        {notice && (
          <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
            ✓ {notice}
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="text-base font-bold text-[#0A2540]">Datos de tu cuenta</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nombre</dt>
              <dd className="mt-0.5 text-slate-800">{nombre}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Correo institucional</dt>
              <dd className="mt-0.5 break-all text-slate-800">{user?.correo_institucional}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tipo de vinculación</dt>
              <dd className="mt-0.5 text-slate-800">{tipoActual || 'Sin definir'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Roles en el sistema</dt>
              <dd className="mt-0.5 text-slate-800">{roles.length ? roles.join(', ') : 'Ninguno todavía'}</dd>
            </div>
          </dl>
          {user?.verificado === false && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Tu vinculación con la universidad está pendiente de verificación por TI. Puedes continuar, pero las
              dependencias verán tu cuenta como «sin verificar».
            </p>
          )}
        </section>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <fieldset>
            <legend className="text-base font-bold text-[#0A2540]">
              {isChange ? 'Cambiar tipo de vinculación' : 'Tipo de vinculación'}
            </legend>
            {!isOnboarding && !isChange && (
              <p className="mt-1 text-xs text-slate-500">
                Si además vas a tramitar tu propio paz y salvo, elige tu tipo de vinculación.
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {TIPOS.map((tipo) => {
                const active = selected === tipo.value;
                return (
                  <label
                    key={tipo.value}
                    className={`cursor-pointer rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-[#0A2540]/30 ${
                      active ? 'border-[#0A2540] bg-slate-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipo"
                      value={tipo.value}
                      checked={active}
                      onChange={() => setSelected(tipo.value)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between text-sm font-bold text-[#0A2540]">
                      {tipo.value}
                      {tipo.value === tipoActual && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                          Actual
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-slate-600">{tipo.descripcion}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="rounded-xl bg-[#0A2540] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#133961] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Guardando...' : isChange ? 'Cambiar tipo' : 'Continuar'}
            </button>
          </div>
        </form>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmar-titulo"
            aria-describedby="confirmar-detalle"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-modal"
          >
            <h2 id="confirmar-titulo" className="text-lg font-bold text-[#0A2540]">
              ¿Cambiar tu tipo de vinculación?
            </h2>
            <div id="confirmar-detalle" className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                Vas a pasar de <strong>{tipoActual}</strong> a <strong>{selected}</strong>.
              </p>
              <p>
                Cambia las dependencias que debes tramitar (por ejemplo, Desarrollo Profesoral solo aplica a
                docentes). Solo es posible si no tienes un trámite de paz y salvo en curso.
              </p>
              <p>Se te enviará una notificación y se avisará a TI.</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => save(true)}
                disabled={saving}
                className="rounded-xl bg-[#D97706] px-4 py-2 text-sm font-bold text-white hover:bg-[#B45309] disabled:opacity-60"
              >
                {saving ? 'Cambiando...' : 'Sí, cambiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Perfil;
