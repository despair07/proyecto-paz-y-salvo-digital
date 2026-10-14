import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const REPORT_SECTIONS = [
  { key: 'I_datos_generales', title: 'I. Datos Generales', desc: 'Identificación del colaborador, tipo y número de ID, cargo que entrega, dependencia, superior inmediato y periodo cubierto.' },
  { key: 'II_informe_gestion', title: 'II. Informe de Gestión', desc: 'Cumplimiento de propósitos del cargo, proyectos y actividades en curso (concluidas y pendientes).' },
  { key: 'III_procedimientos', title: 'III. Procedimientos', desc: 'Relación de procesos, manuales e instructivos utilizados o creados.' },
  { key: 'IV_formatos', title: 'IV. Formatos', desc: 'Formatos, planillas y modelos institucionales vigentes a su cargo.' },
  { key: 'V_informes_presentados', title: 'V. Relación de Informes', desc: 'Informes entregados a dependencias o entes de control con fechas de radicación.' },
  { key: 'VI_estado_recursos', title: 'VI. Estado de los Recursos', desc: 'Bienes, inventario físico, equipos de cómputo, archivos digitales (rutas), software y accesos.' },
  { key: 'VII_anexos', title: 'VII. Anexos', desc: 'Listado de actas, soportes documentales y constancias adicionales.' },
  { key: 'VIII_contacto_verificacion', title: 'VIII. Verificación y Contacto', desc: 'Datos personales de contacto post-retiro y constancia de entrega.' },
];

const DashboardUser = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  // Modales
  const [selectedArea, setSelectedArea] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState({});
  const [reportState, setReportState] = useState('BORRADOR');
  const [savingReport, setSavingReport] = useState(false);

  // Carga de estado desde API
  const fetchMyStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/paz-y-salvo/mi-estado');
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al consultar estado de paz y salvo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyStatus();
  }, [user?.id]);

  // RF-009: Habilitar paz y salvo
  const handleHabilitarTramite = async () => {
    try {
      setLoading(true);
      await api.post('/tramites/habilitar', {
        tipo_novedad: 'RETIRO',
      });
      setActionNotice('Trámite de paz y salvo habilitado exitosamente en Etapa 1');
      await fetchMyStatus();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al habilitar el trámite');
    } finally {
      setLoading(false);
    }
  };

  // RF-010: Cargar informe de entrega de cargo
  const handleOpenReport = async () => {
    if (!data?.solicitudId) return;
    try {
      const res = await api.get(`/tramites/${data.solicitudId}/informe-entrega-cargo`);
      setReportData(res.data.data.secciones || {});
      setReportState(res.data.data.estado || 'BORRADOR');
      setShowReportModal(true);
    } catch (err) {
      setError('No se pudo cargar el informe de entrega de cargo');
    }
  };

  // RF-010: Guardar informe
  const handleSaveReport = async (estadoFinal) => {
    if (!data?.solicitudId) return;
    setSavingReport(true);
    try {
      await api.put(`/tramites/${data.solicitudId}/informe-entrega-cargo`, {
        estado: estadoFinal,
        secciones: reportData,
      });
      setActionNotice(estadoFinal === 'COMPLETO' ? 'Informe de entrega de cargo finalizado y marcado como Completo' : 'Borrador de informe guardado');
      setShowReportModal(false);
      await fetchMyStatus();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al guardar el informe');
    } finally {
      setSavingReport(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!data?.puedeDescargarCertificado) return;
    const token = data?.certificado?.token_verificacion || data?.certificado?.codigo_qr_token;
    if (token) {
      window.open(`/api/v1/certificados/${token}/pdf`, '_blank');
    } else {
      window.open(`/api/v1/certificados/mine`, '_blank');
    }
  };

  if (loading && !data) {
    return (
      <Layout title="Mi Estado de Paz y Salvo">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0A2540] border-t-transparent mx-auto" />
            <p className="mt-3 text-xs font-semibold text-slate-500">Cargando estado institucional...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const isAlDia = data?.estadoGlobal === 'AL_DIA' || data?.estadoGlobal === 'APROBADO_FINAL';

  return (
    <Layout title="Panel del Trabajador — Formato GTH-07">
      {/* Alertas */}
      {actionNotice && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice('')} className="text-green-600 hover:text-green-800 font-bold">✕</button>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-600 hover:text-red-800 font-bold">✕</button>
        </div>
      )}

      {/* Pantalla sin trámite iniciado */}
      {!data?.habilitado ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto shadow-card">
          <div className="h-16 w-16 bg-amber-100 text-[#D97706] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            📋
          </div>
          <h2 className="text-xl font-bold text-[#0A2540]">Trámite de Paz y Salvo No Iniciado</h2>
          <p className="text-sm text-slate-600 mt-2 mb-6">
            Bajo la política Cero Papel, puedes iniciar tu trámite de entrega de cargo digital. Al habilitarlo, se notificará a tu Jefe Inmediato (Etapa 1).
          </p>
          <button
            type="button"
            onClick={handleHabilitarTramite}
            className="rounded-xl bg-[#0A2540] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#133961]"
          >
            Habilitar Paz y Salvo (RF-009)
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Ficha Resumen & Card de Estado Global (Sección 8.2 Pantalla 2) */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Card Estado Global (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#D97706]">
                    Estado Global del Trámite (RN-001)
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Periodo 2026-2
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <div
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-base tracking-wide shadow-sm ${
                      isAlDia
                        ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'
                        : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]'
                    }`}
                  >
                    <span>{isAlDia ? '✓' : '✕'}</span>
                    <span>{isAlDia ? 'PAZ Y SALVO (AL DÍA)' : 'CON PENDIENTES'}</span>
                  </div>

                  {data.aprobacionFinal === 'APROBADO' && (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-bold text-[#0A2540]">
                      <span>🎓</span> Aprobación Final Emitida
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  {isAlDia
                    ? 'Todas las dependencias evaluadoras requeridas registran 0 bloqueos activos. Cumple con RN-001.'
                    : 'Tiene pendientes o entregables no resueltos en una o más dependencias. No se permite aprobación final (RN-005).'}
                </p>
              </div>

              {/* Barra de progreso */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="text-slate-700">Progreso de dependencias liberadas:</span>
                  <span className="text-[#0A2540] font-bold">
                    {data.resumenProgreso} ({data.porcentajeCompletado}%)
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      isAlDia ? 'bg-[#16A34A]' : 'bg-[#D97706]'
                    }`}
                    style={{ width: `${data.porcentajeCompletado}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Acciones y Descarga de Certificado (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-card flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Requisitos Institucionales
                </span>
                <h3 className="text-base font-bold text-[#0A2540] mt-1">Gestión del Trabajador</h3>

                <div className="mt-4 space-y-3">
                  {/* Estado Informe de Entrega */}
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">📋</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Informe de Entrega de Cargo</p>
                        <p className="text-[11px] text-slate-500">Formato GTH-07 Secciones I a VIII</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        data.informeEntregaCargo ? 'badge-approved' : 'badge-blocked'
                      }`}
                    >
                      {data.informeEntregaCargo ? 'COMPLETO' : 'INCOMPLETO'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenReport}
                    className="w-full rounded-xl border border-[#0A2540] bg-white py-2 text-xs font-bold text-[#0A2540] transition hover:bg-slate-50"
                  >
                    {data.informeEntregaCargo ? 'Ver / Editar Informe (RF-010)' : 'Diligenciar Informe de Entrega (RF-010)'}
                  </button>
                </div>
              </div>

              {/* Botón Descargar Certificado PDF (RN-006) */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="relative group">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={!data.puedeDescargarCertificado}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold transition shadow-sm ${
                      data.puedeDescargarCertificado
                        ? 'bg-[#16A34A] text-white hover:bg-green-700 cursor-pointer'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    <span>📜</span>
                    <span>Descargar Certificado PDF con QR</span>
                  </button>

                  {!data.puedeDescargarCertificado && (
                    <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-64 rounded-lg bg-slate-800 p-2 text-center text-[10px] font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      RN-006: Disponible únicamente tras la aprobación final de Comunidad Universitaria.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Grid de Cards de las 8 Áreas del GTH-07 */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#0A2540]">
                  Dependencias Evaluadoras del Formato GTH-07
                </h3>
                <p className="text-xs text-slate-500">
                  Haz clic sobre cualquier tarjeta para ver el detalle de pendientes, responsable y fecha de revisión.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {data.dependencias.filter((d) => d.aplica).length} áreas asignadas
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.dependencias
                .filter((dep) => dep.aplica)
                .map((dep) => {
                  const isBlocked = dep.estado === 'BLOQUEADO';
                  return (
                    <div
                      key={dep.id}
                      onClick={() => setSelectedArea(dep)}
                      className={`group cursor-pointer rounded-2xl border bg-white p-5 shadow-card transition-all hover:shadow-cardHover hover:-translate-y-0.5 ${
                        isBlocked ? 'border-red-200' : 'border-slate-200 hover:border-green-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-400 font-mono">
                          {dep.nombre.split(' ')[0]}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                            isBlocked ? 'badge-blocked' : 'badge-approved'
                          }`}
                        >
                          <span>{isBlocked ? '✕' : '✓'}</span>
                          <span>{isBlocked ? 'Bloqueado' : 'Paz y Salvo'}</span>
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-[#0A2540] group-hover:text-blue-900 leading-tight min-h-[36px]">
                        {dep.nombre}
                      </h4>
                      <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                        {dep.descripcion}
                      </p>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1 text-[11px]">
                        {isBlocked ? (
                          <div className="text-red-600 font-medium truncate">
                            <span className="font-bold">Motivo:</span> {dep.motivo || 'Pendiente activo'}
                          </div>
                        ) : (
                          <div className="text-green-600 font-medium">
                            ✓ Sin novedades pendientes
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400">
                          Contacto: {dep.contacto?.nombre}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Área / Historial de Bloqueos */}
      {selectedArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-modal">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">Detalle de Dependencia</span>
                <h3 className="text-lg font-bold text-[#0A2540]">{selectedArea.nombre}</h3>
              </div>
              <button onClick={() => setSelectedArea(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <div className="my-4 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600">Estado actual en esta dependencia:</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${selectedArea.estado === 'BLOQUEADO' ? 'badge-blocked' : 'badge-approved'}`}>
                  {selectedArea.estado === 'BLOQUEADO' ? 'BLOQUEADO' : 'PAZ Y SALVO'}
                </span>
              </div>

              {selectedArea.motivo && (
                <div className="p-3.5 rounded-xl border border-red-200 bg-red-50">
                  <p className="text-xs font-bold text-red-800">Causa registrada del bloqueo:</p>
                  <p className="text-sm text-red-900 mt-1">{selectedArea.motivo}</p>
                  {selectedArea.fechaRegistro && (
                    <p className="text-[10px] text-red-700 mt-2 font-mono">
                      Registrado: {new Date(selectedArea.fechaRegistro).toLocaleString('es-CO')}
                    </p>
                  )}
                </div>
              )}

              {/* Si es Desarrollo Profesoral y es Docente, mostrar 3 criterios */}
              {selectedArea.entregablesProfesorales && (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                  <p className="text-xs font-bold text-amber-900 mb-2">Evaluación Docente (RN-007):</p>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div className="flex items-center justify-between">
                      <span>1. Planes de Aula:</span>
                      <span className={selectedArea.entregablesProfesorales.planes_aula ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                        {selectedArea.entregablesProfesorales.planes_aula ? 'Aprobado ✓' : 'Pendiente ✕'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>2. Innovaciones Educativas:</span>
                      <span className={selectedArea.entregablesProfesorales.innovaciones_educativas ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                        {selectedArea.entregablesProfesorales.innovaciones_educativas ? 'Aprobado ✓' : 'Pendiente ✕'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>3. Informes de Ejecución:</span>
                      <span className={selectedArea.entregablesProfesorales.informes_ejecucion ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                        {selectedArea.entregablesProfesorales.informes_ejecucion ? 'Aprobado ✓' : 'Pendiente ✕'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Historial de bloqueos resueltos */}
              {selectedArea.bloqueosResueltos?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Historial de Bloqueos Resueltos:</p>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {selectedArea.bloqueosResueltos.map((r, i) => (
                      <div key={i} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                        <p className="font-semibold text-slate-800">{r.motivo || r.motivo_descripcion}</p>
                        <p className="text-green-700 mt-1">✓ Resolución: {r.observacion || r.observacion_resolucion || 'Paz y salvo verificado'}</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">
                          Fecha: {new Date(r.fecha_resolucion || r.fecha_registro).toLocaleString('es-CO')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Información de contacto */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <p className="font-bold text-slate-800">Encargado de Dependencia:</p>
                <p className="text-slate-600 mt-0.5">{selectedArea.contacto?.nombre}</p>
                <p className="text-slate-500 font-mono text-[11px]">{selectedArea.contacto?.correo}</p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setSelectedArea(null)}
                className="rounded-xl bg-[#0A2540] px-4 py-2 text-xs font-bold text-white hover:bg-[#133961]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Diligenciamiento Informe de Entrega de Cargo (RF-010 - Secciones I a VIII) */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 sm:p-8 shadow-modal max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">
                  Requisito Obligatorio Formato GTH-07
                </span>
                <h3 className="text-xl font-bold text-[#0A2540]">
                  Informe por Entrega de Cargo (Secciones I a VIII)
                </h3>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2 mb-4">
              Diligencie los campos requeridos para cada sección antes de radicar ante su superior inmediato. Es requisito para la aprobación final (RN-010).
            </p>

            <div className="flex-1 overflow-y-auto space-y-5 pr-2">
              {REPORT_SECTIONS.map(({ key, title, desc }) => (
                <div key={key} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <h4 className="text-sm font-bold text-[#0A2540]">{title}</h4>
                  <p className="text-[11px] text-slate-500 mb-2">{desc}</p>
                  <textarea
                    rows={2}
                    value={reportData[key]?.contenido || reportData[key]?.observaciones || reportData[key]?.detalle || ''}
                    onChange={(e) => {
                      setReportData({
                        ...reportData,
                        [key]: { ...reportData[key], contenido: e.target.value },
                      });
                    }}
                    placeholder={`Ingrese la información para ${title}...`}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-800 outline-none focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540]"
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Estado actual: <span className="font-bold text-amber-700">{reportState}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveReport('BORRADOR')}
                  disabled={savingReport}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Guardar Borrador
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveReport('COMPLETO')}
                  disabled={savingReport}
                  className="rounded-xl bg-[#16A34A] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-green-700"
                >
                  {savingReport ? 'Guardando...' : 'Finalizar y Marcar Completo (RN-010)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DashboardUser;
