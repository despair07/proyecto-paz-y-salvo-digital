import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// Cuentas ficticias de prueba (contraseña común del seed): VITE_ENABLE_PASSWORD_LOGIN y VITE_ENABLE_TEST_ACCOUNTS en true.
// El acceso con contraseña es solo de desarrollo (el backend también lo exige con AUTH_PASSWORD_ENABLED)
const PASSWORD_LOGIN = import.meta.env.VITE_ENABLE_PASSWORD_LOGIN === 'true';
const SHOW_TEST_ACCOUNTS = PASSWORD_LOGIN && import.meta.env.VITE_ENABLE_TEST_ACCOUNTS === 'true';
const TEST_PASSWORD = 'Demo2026*';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const TEST_ACCOUNTS = [
  // Trabajadores (3)
  {
    group: 'Trabajadores',
    name: 'Laura Marcela Ortiz Peña',
    documento: 'CC 1.061.700.101',
    rol: 'Docente',
    novedad: 'Retiro',
    dependencia: 'Docente de Planta',
    correo: 'laura.ortiz@uniautonoma.edu.co',
    badgeClass: 'badge-blocked',
    estadoInicial: 'EN_PROCESO (5/8 áreas)',
  },
  {
    group: 'Trabajadores',
    name: 'Carlos Andrés Muñoz Ruiz',
    documento: 'CC 1.061.700.102',
    rol: 'Administrativo',
    novedad: 'Cambio de dependencia',
    dependencia: 'Auxiliar Administrativo',
    correo: 'carlos.munoz@uniautonoma.edu.co',
    badgeClass: 'badge-blocked',
    estadoInicial: 'EN_PROCESO (Almacén bloqueado)',
  },
  {
    group: 'Trabajadores',
    name: 'Sofía Valentina Cárdenas Lozano',
    documento: 'CC 1.061.700.103',
    rol: 'Contratista',
    novedad: 'Retiro',
    dependencia: 'Contratista de Apoyo',
    correo: 'sofia.cardenas@uniautonoma.edu.co',
    badgeClass: 'badge-approved',
    estadoInicial: 'AL_DÍA (0 bloqueos · Lista para aprobación)',
  },

  // Encargados de área (8)
  {
    group: 'Encargados de Área (8 dependencias GTH-07)',
    name: 'Martha Lucía Quintero',
    rol: 'Jefe Inmediato',
    dependencia: 'Jefe Inmediato (Etapa 1)',
    correo: 'jefe.inmediato@uniautonoma.edu.co',
  },
  {
    group: 'Encargados de Área (8 dependencias GTH-07)',
    name: 'Andrés Felipe Valencia',
    rol: 'Encargado de Área',
    dependencia: 'Tecnologías de la información y transformación digital',
    correo: 'encargado.dti@uniautonoma.edu.co',
  },
  {
    group: 'Encargados de Área (8 dependencias GTH-07)',
    name: 'Juliana Restrepo Gómez',
    rol: 'Encargado de Área',
    dependencia: 'Medios Educativos (Vicerrectoría Académica)',
    correo: 'encargado.medios@uniautonoma.edu.co',
  },
  {
    group: 'Encargados de Área (8 dependencias GTH-07)',
    name: 'Héctor Fabio Mosquera',
    rol: 'Encargado de Área',
    dependencia: 'Almacén',
    correo: 'encargado.almacen@uniautonoma.edu.co',
  },
  {
    group: 'Encargados de Área (8 dependencias GTH-07)',
    name: 'Diana Carolina Bolaños',
    rol: 'Encargado de Área',
    dependencia: 'Archivo y Correspondencia',
    correo: 'encargado.archivo@uniautonoma.edu.co',
  },
  {
    group: 'Encargados de Área (8 dependencias GTH-07)',
    name: 'Ricardo Alonso Paz',
    rol: 'Encargado de Área',
    dependencia: 'División Contable Y Financiera',
    correo: 'encargado.financiera@uniautonoma.edu.co',
  },
  {
    group: 'Encargados de Área (8 dependencias GTH-07)',
    name: 'Natalia Andrea Ramírez',
    rol: 'Encargado de Área',
    dependencia: 'Seguridad y Salud en el Trabajo',
    correo: 'encargado.sst@uniautonoma.edu.co',
  },
  {
    group: 'Encargados de Área (8 dependencias GTH-07)',
    name: 'Camilo Ernesto Vidal',
    rol: 'Encargado de Área',
    dependencia: 'Centro de Desarrollo Profesoral',
    correo: 'encargado.profesoral@uniautonoma.edu.co',
  },

  // Aprobador Comunidad Universitaria (1)
  {
    group: 'Comunidad Universitaria (Aprobador Final)',
    name: 'Patricia Elena Lasso',
    rol: 'Aprobador Comunidad Universitaria',
    dependencia: 'División De Comunidad Universitaria (Etapa 3)',
    correo: 'aprobador.comunidad@uniautonoma.edu.co',
  },

  // Administrador DTI (1)
  {
    group: 'Administrador DTI',
    name: 'Sebastián Iván Mera',
    rol: 'Administrador DTI',
    dependencia: 'Administración del Sistema (RN-011)',
    correo: 'admin.dti@uniautonoma.edu.co',
  },
];

const Login = () => {
  const { loginWithPassword, login } = useAuth();
  const googleButtonRef = useRef(null);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorToast, setErrorToast] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorToast('');

    const trimmedEmail = email.trim().toLowerCase();
    // Validación de dominio institucional obligatoria (RF-001 / HU-007)
    if (!trimmedEmail.endsWith('@uniautonoma.edu.co')) {
      setErrorToast('Acceso restringido a personal institucional');
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithPassword(trimmedEmail, password);
      navigate(res.home, { replace: true });
    } catch (err) {
      setErrorToast(err.response?.data?.mensaje || 'Credenciales institucionales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (response) => {
    setErrorToast('');
    setLoading(true);
    try {
      const res = await login(response.credential);
      navigate(res.home, { replace: true });
    } catch (err) {
      console.error('Inicio de sesión con Google falló', err);
      setErrorToast(
        err.response?.data?.mensaje
          || (err.response
            ? `Error al iniciar sesión con Google Workspace (código ${err.response.status})`
            : 'No se pudo comunicar con el servidor. Verifica que el backend esté en ejecución.')
      );
    } finally {
      setLoading(false);
    }
  };

  // Botón oficial de Google; solo aparece si VITE_GOOGLE_CLIENT_ID está configurado
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;

    const render = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        hd: 'uniautonoma.edu.co',
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 320,
      });
    };

    if (window.google?.accounts?.id) {
      render();
      return undefined;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  const handleCardQuickLogin = async (account) => {
    setErrorToast('');
    setEmail(account.correo);
    setPassword(TEST_PASSWORD);
    setLoading(true);
    try {
      const res = await loginWithPassword(account.correo, TEST_PASSWORD);
      navigate(res.home, { replace: true });
    } catch (err) {
      setErrorToast(err.response?.data?.mensaje || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      {/* Toast de error */}
      {errorToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-lg animate-bounce">
          <span>⚠️</span>
          <span>{errorToast}</span>
          <button
            onClick={() => setErrorToast('')}
            className="ml-2 text-red-500 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Institucional */}
      <header className="mx-auto w-full max-w-6xl flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0A2540] text-white font-bold text-xl shadow-md">
            U
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D97706]">
              Corporación Universitaria Autónoma del Cauca
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0A2540] tracking-tight">
              Sistema de Paz y Salvo Digital — GTH-07
            </h1>
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Periodo académico 2026-2
          </span>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main className="mx-auto w-full max-w-6xl my-8">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Card central de login (5 cols) */}
          <div className={`lg:col-span-5 ${SHOW_TEST_ACCOUNTS ? '' : 'lg:col-start-4'} bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card flex flex-col justify-between`}>
            <div>
              <div className="mb-6">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#D97706]">
                  Portal Institucional
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#0A2540]">Iniciar Sesión</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Ingresa con tu cuenta de Google de la universidad (@uniautonoma.edu.co).
                </p>
              </div>

              {/* Google Workspace SSO (acceso principal) */}
              {GOOGLE_CLIENT_ID ? (
                <div ref={googleButtonRef} className="flex justify-center min-h-[44px]" />
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  El acceso con Google Workspace no está configurado (falta VITE_GOOGLE_CLIENT_ID).
                </p>
              )}

              <p className="mt-4 text-[11px] text-slate-500 text-center">
                Si ingresas por primera vez, elegirás tu tipo de vinculación (docente, administrativo o
                contratista). El personal de las dependencias debe estar registrado por TI.
              </p>

              {/* Acceso con contraseña: solo desarrollo */}
              {PASSWORD_LOGIN && (
                <>
                  <div className="relative my-6 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <span className="relative bg-white px-3 text-xs uppercase font-medium text-slate-400">
                      acceso de desarrollo
                    </span>
                  </div>
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Correo Institucional
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="usuario@uniautonoma.edu.co"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0A2540] focus:bg-white focus:ring-2 focus:ring-[#0A2540]/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Contraseña
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Contraseña"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0A2540] focus:bg-white focus:ring-2 focus:ring-[#0A2540]/10"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-[#0A2540] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#133961] disabled:opacity-60"
                    >
                      {loading ? 'Validando...' : 'Iniciar Sesión'}
                    </button>
                  </form>
                </>
              )}
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-[11px] text-slate-500 text-center">
              🔒 Autenticación institucional protegida por JWT y Google SSO. Política Cero Papel.
            </div>
          </div>

          {/* Cuentas de prueba (opcional, 7 cols) */}
          {SHOW_TEST_ACCOUNTS && (
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card flex flex-col">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#D97706]">
                  Cuentas de prueba
                </span>
                <h3 className="text-xl font-bold text-[#0A2540]">
                  Acceso rápido por rol
                </h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                Datos ficticios
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Haz clic sobre cualquier perfil para iniciar sesión con datos ficticios, con su respectivo token y rol RBAC:
            </p>

            <div className="flex-1 overflow-y-auto space-y-5 max-h-[520px] pr-1">
              {/* Grupo 1: Trabajadores */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A2540] mb-2 flex items-center gap-2">
                  <span>👤</span>
                  <span>Trabajadores que gestionan paz y salvo (3)</span>
                </h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TEST_ACCOUNTS.filter((a) => a.group === 'Trabajadores').map((acc) => (
                    <button
                      key={acc.correo}
                      type="button"
                      onClick={() => handleCardQuickLogin(acc)}
                      className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-[#0A2540] hover:bg-white hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                            {acc.rol}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {acc.documento.split(' ')[1]}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-bold text-slate-900 group-hover:text-[#0A2540]">
                          {acc.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{acc.dependencia}</p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-200/60">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${acc.badgeClass}`}>
                          {acc.estadoInicial}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grupo 2: Encargados de Área */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A2540] mb-2 flex items-center gap-2">
                  <span>🏢</span>
                  <span>Encargados de Área y Jefaturas (8 dependencias)</span>
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TEST_ACCOUNTS.filter((a) => a.group.includes('Encargados')).map((acc) => (
                    <button
                      key={acc.correo}
                      type="button"
                      onClick={() => handleCardQuickLogin(acc)}
                      className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-left transition hover:border-[#0A2540] hover:bg-white hover:shadow-sm"
                    >
                      <div className="truncate pr-2">
                        <p className="text-xs font-bold text-slate-900 group-hover:text-[#0A2540] truncate">
                          {acc.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{acc.dependencia}</p>
                      </div>
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 shrink-0">
                        Entrar →
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grupo 3 & 4: Comunidad Universitaria y Administrador DTI */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A2540] mb-2 flex items-center gap-2">
                  <span>⚖️</span>
                  <span>Aprobación Final y Administración</span>
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TEST_ACCOUNTS.filter((a) => a.group.includes('Comunidad') || a.group.includes('Administrador')).map((acc) => (
                    <button
                      key={acc.correo}
                      type="button"
                      onClick={() => handleCardQuickLogin(acc)}
                      className="group flex flex-col justify-between rounded-xl border-2 border-amber-200 bg-amber-50/50 p-3 text-left transition hover:border-[#D97706] hover:bg-white hover:shadow-md"
                    >
                      <div>
                        <span className="rounded-md bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                          {acc.rol}
                        </span>
                        <p className="mt-2 text-xs font-bold text-slate-900 group-hover:text-[#0A2540]">
                          {acc.name}
                        </p>
                        <p className="text-[11px] text-slate-600">{acc.dependencia}</p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] font-semibold text-[#D97706]">
                        <span>Acceder como autoridad</span>
                        <span>→</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-6xl text-center text-xs text-slate-400 pt-4 border-t border-slate-200">
        © 2026 Corporación Universitaria Autónoma del Cauca · División de Bienestar Universitario, DTI y Comunidad Universitaria · GTH-07
      </footer>
    </div>
  );
};

export default Login;
