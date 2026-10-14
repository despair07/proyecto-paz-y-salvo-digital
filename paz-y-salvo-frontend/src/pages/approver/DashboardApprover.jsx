import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const DashboardApprover = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Solicitud seleccionada para revisar ficha
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Modal Rechazo
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Certificado emitido post-aprobación
  const [issuedCert, setIssuedCert] = useState(null);

  const loadPendingRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/tramites/pendientes-aprobacion');
      const list = res.data.data || [];
      setRequests(list);
      if (list.length > 0 && !selectedRequest) {
        setSelectedRequest(list[0]);
      }
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al cargar trámites pendientes de aprobación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingRequests();
  }, [user?.id]);

  // Aprobación final
  const handleApprove = async (solicitudId) => {
    setProcessing(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post(`/tramites/${solicitudId}/aprobar`, {
        decision: 'APROBADO',
        observacion: 'Aprobado a entera satisfacción por la División de Comunidad Universitaria tras verificar cumplimiento del formato GTH-07 y entrega de cargo.',
      });

      setNotice('¡Paz y salvo laboral autorizado con éxito! Certificado digital con QR emitido.');
      setIssuedCert(res.data.certificado);
      await loadPendingRequests();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al procesar la aprobación');
    } finally {
      setProcessing(false);
    }
  };

  // Rechazo motivado
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('Para rechazar una solicitud se debe ingresar una observación motivada obligatoria.');
      return;
    }
    setProcessing(true);
    setError('');
    try {
      await api.post(`/tramites/${selectedRequest.id || selectedRequest.solicitudId}/aprobar`, {
        decision: 'RECHAZADO',
        observacion: rejectReason.trim(),
      });

      setNotice('Solicitud rechazada con observación motivada.');
      setShowRejectModal(false);
      setRejectReason('');
      await loadPendingRequests();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al procesar el rechazo');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Layout title="Panel de Aprobación Final — Comunidad Universitaria">
      <div className="space-y-6 font-sans">
        {/* Alertas */}
        {notice && (
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice('')} className="text-green-600 font-bold">✕</button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-600 font-bold">✕</button>
          </div>
        )}

        {/* Banner Certificado Recién Emitido (Pantalla 7) */}
        {issuedCert && (
          <div className="rounded-2xl border-2 border-green-300 bg-green-50/70 p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#16A34A] text-white flex items-center justify-center text-2xl font-bold shadow-sm">
                🎓
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">
                  Certificado Digital Emitido (RF-006)
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Certificado de Paz y Salvo y Entrega de Cargo
                </h3>
                <p className="text-xs text-slate-600">
                  Token: <span className="font-mono">{issuedCert.token_verificacion?.slice(0, 24)}...</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <a
                href={`/verificar/${issuedCert.token_verificacion || issuedCert.codigo_qr_token}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition text-center flex-1 sm:flex-none"
              >
                Validación QR Pública
              </a>
              <a
                href={issuedCert.archivo_url || issuedCert.url_pdf_storage}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-[#16A34A] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-green-700 transition text-center flex-1 sm:flex-none"
              >
                Descargar PDF con QR
              </a>
            </div>
          </div>
        )}

        {/* Cabecera y Contexto de Aprobación */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">
                Etapa 3 · Potestad Exclusiva (RN-002)
              </span>
              <h2 className="text-xl font-bold text-[#0A2540]">
                Bandeja de Trámites Listos para Cierre Institucional
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                RN-005 & RN-010: Solo se listan trabajadores con 0 bloqueos activos y con informe de entrega de cargo completo.
              </p>
            </div>
            <button
              type="button"
              onClick={loadPendingRequests}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              🔄 Actualizar Bandeja
            </button>
          </div>
        </div>

        {/* Layout de Aprobación (2 columnas: Lista y Ficha) */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Lista de Solicitudes (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Trabajadores Elegibles ({requests.length})
              </h3>
              <span className="text-[11px] text-[#16A34A] font-bold">100% Liberados</span>
            </div>

            {loading ? (
              <p className="py-8 text-center text-xs text-slate-400">Cargando solicitudes...</p>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No hay solicitudes pendientes con todos los paz y salvos e informe al día.
              </div>
            ) : (
              <div className="space-y-2.5">
                {requests.map((req) => {
                  const isSelected = (selectedRequest?.id || selectedRequest?.solicitudId) === (req.id || req.solicitudId);
                  return (
                    <div
                      key={req.id || req.solicitudId}
                      onClick={() => setSelectedRequest(req)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        isSelected
                          ? 'border-[#0A2540] bg-slate-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-[#0A2540]">{req.nombre || req.usuario}</span>
                        <span className="badge-approved px-2 py-0.5 rounded text-[10px] font-bold">
                          AL DÍA
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{req.cargo} · {req.vinculacion || req.tipoVinculacion}</p>
                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Doc: {req.documento}</span>
                        <span>{req.novedad || req.tipoNovedad}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ficha de Verificación y Dictamen (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-card flex flex-col justify-between">
            {selectedRequest ? (
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">
                      Ficha de Verificación Institucional
                    </span>
                    <h3 className="text-xl font-bold text-[#0A2540]">
                      {selectedRequest.nombre || selectedRequest.usuario}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedRequest.cargo} · {selectedRequest.correo} · Cédula: {selectedRequest.documento}
                    </p>
                  </div>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                    Apto para Cierre
                  </span>
                </div>

                {/* Checklist Verde de Verificación por Área (Pantalla 5) */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                    Checklist de Áreas del Formato GTH-07:
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {(selectedRequest.areasVerificadas || []).map((area, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50/50 p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#16A34A] text-white text-[10px] font-bold">
                            ✓
                          </span>
                          <div>
                            <p className="font-bold text-slate-900">{area.dependencia}</p>
                            <p className="text-[11px] text-slate-500">{area.motivo || 'Paz y salvo verificado'}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {area.responsable || 'Encargado'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <span className="font-semibold text-slate-700">Informe de Entrega de Cargo (RN-010):</span>
                    <span className="text-green-700 font-bold">Completo ✓</span>
                  </div>
                </div>

                {/* Botones de Decisión (Pantalla 5) */}
                <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={processing}
                    className="w-full sm:w-auto rounded-xl border border-red-300 bg-red-50 px-5 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition"
                  >
                    Rechazar Solicitud
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedRequest.id || selectedRequest.solicitudId)}
                    disabled={processing}
                    className="w-full sm:w-auto rounded-xl bg-[#16A34A] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-green-700 transition"
                  >
                    {processing ? 'Autorizando...' : 'Autorizar y Emitir Paz y Salvo Definitivo'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-sm">
                Seleccione un trabajador de la lista para auditar su ficha de paz y salvo.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Rechazo Motivado */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-modal">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-red-700">Rechazar Solicitud de Paz y Salvo</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div className="my-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo / Causa del Rechazo (Obligatorio):
              </label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Especifique las razones por las cuales no se otorga el visto bueno final..."
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 outline-none focus:border-red-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={processing}
                className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                {processing ? 'Rechazando...' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DashboardApprover;
