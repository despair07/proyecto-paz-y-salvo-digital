import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api';

export default function VerifyCertificate() {
  const { token } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api.get(`/certificados/verificar/${token}`)
      .then(({ data }) => {
        if (active) {
          setCertificate(data.data || data);
          setError(false);
        }
      })
      .catch(() => {
        if (active) {
          setCertificate(null);
          setError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between items-center px-4 py-10 font-sans">
      <div className="w-full max-w-xl">
        {/* Cabecera institucional */}
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#0A2540] text-white font-bold text-xl shadow-md mb-2">
            U
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D97706]">
            Corporación Universitaria Autónoma del Cauca
          </p>
          <h1 className="text-xl font-bold text-[#0A2540] tracking-tight">
            Validación Pública de Certificado Digital (GTH-07)
          </h1>
        </div>

        {/* Card de verificación */}
        <section className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-card p-6 sm:p-8">
          {loading ? (
            <div className="py-12 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0A2540] border-t-transparent mx-auto" />
              <p className="mt-3 text-xs font-semibold text-slate-500">Verificando autenticidad en la base institucional...</p>
            </div>
          ) : certificate && !error ? (
            <div className="space-y-6">
              {/* Badge de autenticidad */}
              <div className="flex items-center gap-3.5 rounded-xl border border-green-200 bg-green-50 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-lg font-bold text-white shadow-sm">
                  ✓
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-green-800">
                    Documento Oficial Auténtico y Vigente
                  </p>
                  <p className="text-xs text-green-900 mt-0.5">
                    Certificado de Paz y Salvo Laboral y Entrega de Cargo con Aprobación Final registrada.
                  </p>
                </div>
              </div>

              {/* Datos certificados */}
              <dl className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex justify-between items-center">
                  <dt className="font-bold text-slate-500 uppercase tracking-wide">Titular:</dt>
                  <dd className="font-bold text-slate-900 text-sm text-right">{certificate.solicitante || certificate.nombre}</dd>
                </div>
                {certificate.documento && (
                  <div className="py-2.5 flex justify-between items-center">
                    <dt className="font-bold text-slate-500 uppercase tracking-wide">Identificación:</dt>
                    <dd className="font-mono text-slate-800 font-semibold">{certificate.documento}</dd>
                  </div>
                )}
                {certificate.cargo && (
                  <div className="py-2.5 flex justify-between items-center">
                    <dt className="font-bold text-slate-500 uppercase tracking-wide">Cargo Desempeñado:</dt>
                    <dd className="text-slate-800 font-semibold">{certificate.cargo}</dd>
                  </div>
                )}
                <div className="py-2.5 flex justify-between items-center">
                  <dt className="font-bold text-slate-500 uppercase tracking-wide">Tipo de Vinculación:</dt>
                  <dd className="text-slate-800">{certificate.tipoVinculacion}</dd>
                </div>
                {certificate.periodo && (
                  <div className="py-2.5 flex justify-between items-center">
                    <dt className="font-bold text-slate-500 uppercase tracking-wide">Periodo Académico:</dt>
                    <dd className="text-slate-800">{certificate.periodo}</dd>
                  </div>
                )}
                <div className="py-2.5 flex justify-between items-center">
                  <dt className="font-bold text-slate-500 uppercase tracking-wide">Fecha de Emisión:</dt>
                  <dd className="text-slate-800 font-mono">
                    {new Date(certificate.fechaEmision).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <dt className="font-bold text-slate-500 uppercase tracking-wide">Entidad Emisora:</dt>
                  <dd className="text-slate-800 text-right">División de Comunidad Universitaria</dd>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <dt className="font-bold text-slate-500 uppercase tracking-wide">Código de Verificación:</dt>
                  <dd className="font-mono text-[10px] text-slate-400 break-all">{token.slice(0, 32)}...</dd>
                </div>
              </dl>

              {/* Botón Descargar PDF */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <a
                  href={`/api/v1/certificados/${token}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-xl bg-[#0A2540] py-2.5 text-center text-xs font-bold text-white shadow-sm hover:bg-[#133961] transition"
                >
                  Descargar Documento PDF Oficial
                </a>
                <Link
                  to="/login"
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Ir al Sistema
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl mx-auto mb-3">
                ✕
              </div>
              <h2 className="text-base font-bold text-red-800 uppercase tracking-wide">
                Certificado No Válido o Inexistente
              </h2>
              <p className="mt-2 text-xs text-slate-600 max-w-sm mx-auto">
                No se encontró ningún certificado digital aprobado que corresponda al token proporcionado. Verifique que el código QR escaneado sea auténtico.
              </p>
              <div className="mt-6">
                <Link
                  to="/login"
                  className="inline-block rounded-xl bg-[#0A2540] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#133961]"
                >
                  Regresar al Inicio
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>

      <footer className="text-xs text-slate-400 text-center mt-6">
        © 2026 Corporación Universitaria Autónoma del Cauca · División de Comunidad Universitaria · GTH-07
      </footer>
    </main>
  );
}