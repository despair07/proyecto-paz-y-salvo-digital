import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const CATEGORIES = [
  { value: 'FINANCIERO', label: 'Financiero (anticipos, préstamos, saldos)' },
  { value: 'INVENTARIO_ELEMENTOS', label: 'Inventario / Elementos (activos fijos, equipos)' },
  { value: 'DOCUMENTAL_ENTREGABLES', label: 'Documental / Entregables (archivos, informes)' },
  { value: 'ACADEMICO_PROFESORAL', label: 'Académico / Profesoral (planes de aula, notas)' },
];

const DashboardArea = () => {
  const { user } = useAuth();
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  // Modal Crear Bloqueo
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [selectedUserForLock, setSelectedUserForLock] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].value);
  const [lockMotivo, setLockMotivo] = useState('');
  const [submittingLock, setSubmittingLock] = useState(false);

  // Modal Resolver / Editar Bloqueo
  const [selectedLockToResolve, setSelectedLockToResolve] = useState(null);
  const [resolveObservation, setResolveObservation] = useState('');
  const [resolving, setResolving] = useState(false);

  // Módulo Desarrollo Profesoral (Pantalla 4)
  const isProfesoral = (user?.correo_institucional || '').includes('profesoral') ||
    user?.dependencia?.includes('Profesoral') ||
    user?.roles?.includes('Encargado de Área');

  const [teacherEval, setTeacherEval] = useState({
    solicitudId: '',
    docenteNombre: '',
    planes_aula: false,
    innovaciones_educativas: false,
    informes_ejecucion: false,
    observaciones: '',
  });
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [savingTeacher, setSavingTeacher] = useState(false);

  // Carga de bloqueos de su propia dependencia (RN-004)
  const fetchLocks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/bloqueos', {
        params: {
          q: searchTerm,
          estado: statusFilter === 'TODOS' ? undefined : statusFilter,
        },
      });
      setLocks(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al cargar bloqueos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocks();
  }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLocks();
  };

  // Cargar lista de usuarios para nuevo bloqueo
  const handleOpenCreateModal = async () => {
    setError('');
    try {
      const res = await api.get('/usuarios', { params: { conTramite: true, limit: 100 } });
      setUsersList(res.data.data || []);
      if (res.data.data?.length) {
        setSelectedUserForLock(res.data.data[0].id);
      }
      setShowCreateModal(true);
    } catch (err) {
      setError('Error al consultar catálogo de usuarios');
    }
  };

  const handleCreateLock = async (e) => {
    e.preventDefault();
    if (!lockMotivo.trim()) {
      setError('El motivo del bloqueo es obligatorio (RN-009)');
      return;
    }

    setSubmittingLock(true);
    setError('');
    try {
      // El trámite activo del trabajador seleccionado viene del catálogo (conTramite=true)
      const targetUser = usersList.find((u) => u.id === selectedUserForLock);
      if (!targetUser?.solicitud_id) {
        setError('El trabajador seleccionado no tiene un trámite de paz y salvo en curso');
        return;
      }

      await api.post('/bloqueos', {
        solicitudId: targetUser.solicitud_id,
        dependenciaId: user?.dependencia_id,
        categoria: selectedCategory,
        motivo: lockMotivo.trim(),
      });

      setNotice('Bloqueo registrado exitosamente. Se ha recalculado el estado del trabajador a CON PENDIENTES (RN-001).');
      setShowCreateModal(false);
      setLockMotivo('');
      await fetchLocks();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al registrar el bloqueo');
    } finally {
      setSubmittingLock(false);
    }
  };

  // RF-003: Levantar bloqueo (marcar RESUELTO)
  const handleResolveLock = async () => {
    if (!selectedLockToResolve) return;
    setResolving(true);
    setError('');
    try {
      await api.put(`/bloqueos/${selectedLockToResolve.id}`, {
        estado: 'RESUELTO',
        observacion: resolveObservation.trim() || 'Bloqueo resuelto y subsanado a satisfacción',
      });

      setNotice('Bloqueo marcado como RESUELTO. La fila se actualizó a Paz y Salvo.');
      setSelectedLockToResolve(null);
      setResolveObservation('');
      await fetchLocks();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al levantar el bloqueo');
    } finally {
      setResolving(false);
    }
  };

  // Pantalla 4: Cargar evaluación docente
  const handleOpenTeacherModal = async (solicitudId, docenteNombre) => {
    setError('');
    try {
      const res = await api.get(`/desarrollo-profesoral/docentes/${solicitudId}`);
      setTeacherEval({
        solicitudId,
        docenteNombre,
        planes_aula: res.data.data.planes_aula,
        innovaciones_educativas: res.data.data.innovaciones_educativas,
        informes_ejecucion: res.data.data.informes_ejecucion,
        observaciones: res.data.data.observaciones || '',
      });
      setShowTeacherModal(true);
    } catch (err) {
      setError('Error al consultar entregables profesorales');
    }
  };

  const handleSaveTeacherEval = async () => {
    setSavingTeacher(true);
    setError('');
    try {
      const res = await api.put(`/desarrollo-profesoral/docentes/${teacherEval.solicitudId}`, {
        planes_aula: teacherEval.planes_aula,
        innovaciones_educativas: teacherEval.innovaciones_educativas,
        informes_ejecucion: teacherEval.informes_ejecucion,
        observaciones: teacherEval.observaciones,
      });

      setNotice(res.data.mensaje || 'Evaluación docente actualizada');
      setShowTeacherModal(false);
      await fetchLocks();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al actualizar entregables docentes');
    } finally {
      setSavingTeacher(false);
    }
  };

  return (
    <Layout title="Portal del Encargado de Área / Jefatura">
      <div className="space-y-6">
        {/* Notificaciones */}
        {notice && (
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800 shadow-sm">
            <span>✓ {notice}</span>
            <button onClick={() => setNotice('')} className="text-green-600 font-bold">✕</button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-sm">
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')} className="text-red-600 font-bold">✕</button>
          </div>
        )}

        {/* Header y Filtros (Pantalla 3) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">
                Dependencia Asignada (RN-004)
              </span>
              <h2 className="text-xl font-bold text-[#0A2540]">
                {user?.dependencia || 'Gestión de Paz y Salvo'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Solo administra los bloqueos pertenecientes a su propia dependencia.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="rounded-xl bg-[#0A2540] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#133961] flex items-center gap-2"
              >
                <span>➕</span>
                <span>Registrar Nuevo Bloqueo (RF-002)</span>
              </button>
            </div>
          </div>

          {/* Barra de búsqueda y selector de estado */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <form onSubmit={handleSearch} className="w-full sm:w-80 flex items-center gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cédula o correo..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#0A2540] focus:bg-white"
              />
              <button
                type="submit"
                className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Buscar
              </button>
            </form>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs font-semibold text-slate-500">Filtrar estado:</span>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
                {['TODOS', 'BLOQUEADO', 'RESUELTO'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      statusFilter === st
                        ? 'bg-white text-[#0A2540] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'TODOS' ? 'Todos' : st === 'BLOQUEADO' ? 'Bloqueados' : 'Paz y Salvo'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Módulo Pantalla 4: Acceso a Centro de Desarrollo Profesoral */}
        {isProfesoral && (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-5 shadow-sm flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                Pantalla 4 · Desarrollo Profesoral
              </span>
              <h3 className="text-base font-bold text-[#0A2540] mt-1">
                Validación de Entregables Docentes (RN-007)
              </h3>
              <p className="text-xs text-slate-600">
                Evalúe los 3 criterios obligatorios (Planes de Aula, Innovaciones Educativas e Informes de Ejecución).
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenTeacherModal('aaaa1111-1111-4111-8111-111111111111', 'Laura Marcela Ortiz Peña')}
              className="rounded-xl bg-[#D97706] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
            >
              Evaluar Entregables de Laura Ortiz (Docente) →
            </button>
          </div>
        )}

        {/* Tabla de Bloqueos de la Dependencia (Pantalla 3) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0A2540] text-white uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Trabajador</th>
                  <th className="px-5 py-3.5">Cargo y Novedad</th>
                  <th className="px-5 py-3.5">Categoría (RN-003)</th>
                  <th className="px-5 py-3.5">Motivo del Bloqueo</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      Cargando registros de la dependencia...
                    </td>
                  </tr>
                ) : locks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No se registran bloqueos con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  locks.map((lock) => {
                    const isBlocked = lock.estado === 'BLOQUEADO';
                    return (
                      <tr key={lock.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900">{lock.trabajador_nombre}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{lock.numero_documento}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-800">{lock.cargo_desempenado || 'Funcionario'}</p>
                          <span className="inline-block mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-medium">
                            {lock.tipo_novedad || 'Retiro'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {lock.categoria}
                          </span>
                        </td>
                        <td className="px-5 py-4 max-w-xs">
                          <p className="text-slate-800 line-clamp-2">{lock.motivo || lock.motivo_descripcion}</p>
                          {lock.observacion && (
                            <p className="text-[10px] text-green-700 mt-1 font-medium">
                              ✓ {lock.observacion}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                              isBlocked ? 'badge-blocked' : 'badge-approved'
                            }`}
                          >
                            <span>{isBlocked ? '✕' : '✓'}</span>
                            <span>{isBlocked ? 'Bloqueado' : 'Paz y Salvo'}</span>
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {isBlocked ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLockToResolve(lock);
                                setResolveObservation('');
                              }}
                              className="rounded-lg bg-[#16A34A] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-green-700"
                            >
                              Levantar Bloqueo (RF-003)
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              Resuelto ({new Date(lock.fecha_resolucion || lock.fecha_registro).toLocaleDateString()})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Registrar Bloqueo (RF-002) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-modal">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-[#0A2540]">Registrar Nuevo Bloqueo (RF-002)</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleCreateLock} className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seleccionar Trabajador
                </label>
                <select
                  value={selectedUserForLock}
                  onChange={(e) => setSelectedUserForLock(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-800 outline-none focus:border-[#0A2540]"
                >
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombres} {u.apellidos} — {u.numero_documento} ({u.tipo_vinculacion})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Categoría Obligatoria (RN-003)
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-800 outline-none focus:border-[#0A2540]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Causa / Motivo del Bloqueo (RN-009 Obligatorio)
                </label>
                <textarea
                  rows={3}
                  required
                  value={lockMotivo}
                  onChange={(e) => setLockMotivo(e.target.value)}
                  placeholder="Detalle exactamente la causa del pendiente o elemento sin devolver..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-800 outline-none focus:border-[#0A2540]"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingLock}
                  className="rounded-xl bg-[#DC2626] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                >
                  {submittingLock ? 'Guardando...' : 'Guardar Bloqueo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Levantar Bloqueo (RF-003) */}
      {selectedLockToResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-modal">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-[#0A2540]">Levantar Bloqueo y Marcar Paz y Salvo</h3>
              <button onClick={() => setSelectedLockToResolve(null)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div className="my-4 space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <p className="font-bold text-slate-800">{selectedLockToResolve.trabajador_nombre}</p>
                <p className="text-slate-600 mt-1">{selectedLockToResolve.motivo}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observación de Resolución (Opcional):
                </label>
                <textarea
                  rows={2}
                  value={resolveObservation}
                  onChange={(e) => setResolveObservation(e.target.value)}
                  placeholder="Ej: Material bibliográfico devuelto a entera satisfacción en biblioteca central..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 outline-none focus:border-[#16A34A]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedLockToResolve(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResolveLock}
                disabled={resolving}
                className="rounded-xl bg-[#16A34A] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-green-700"
              >
                {resolving ? 'Procesando...' : 'Confirmar y Marcar Paz y Salvo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pantalla 4: Centro de Desarrollo Profesoral (Checklist 3 ítems RN-007) */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-modal">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">
                  Pantalla 4 · GTH-07 Página 2
                </span>
                <h3 className="text-base font-bold text-[#0A2540]">
                  Evaluación Docente: {teacherEval.docenteNombre}
                </h3>
              </div>
              <button onClick={() => setShowTeacherModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-600 my-3">
              RN-007: El área cambia a Paz y Salvo únicamente si los 3 criterios están aprobados y confirmados.
            </p>

            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teacherEval.planes_aula}
                  onChange={(e) => setTeacherEval({ ...teacherEval, planes_aula: e.target.checked })}
                  className="h-4 w-4 rounded text-[#16A34A] focus:ring-[#16A34A]"
                />
                <span className="text-xs font-semibold text-slate-800">
                  1. Planes de Aula finalizados y cargados en matriz
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teacherEval.innovaciones_educativas}
                  onChange={(e) => setTeacherEval({ ...teacherEval, innovaciones_educativas: e.target.checked })}
                  className="h-4 w-4 rounded text-[#16A34A] focus:ring-[#16A34A]"
                />
                <span className="text-xs font-semibold text-slate-800">
                  2. Innovaciones Educativas registradas (1.ª y 2.ª convocatoria)
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teacherEval.informes_ejecucion}
                  onChange={(e) => setTeacherEval({ ...teacherEval, informes_ejecucion: e.target.checked })}
                  className="h-4 w-4 rounded text-[#16A34A] focus:ring-[#16A34A]"
                />
                <span className="text-xs font-semibold text-slate-800">
                  3. Informes de Ejecución Académica entregados (tutorías, RA, clubes)
                </span>
              </label>

              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Observaciones del evaluador:
                </label>
                <textarea
                  rows={2}
                  value={teacherEval.observaciones}
                  onChange={(e) => setTeacherEval({ ...teacherEval, observaciones: e.target.value })}
                  placeholder="Observaciones de la validación docente..."
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold">
                Resultado:{' '}
                <span
                  className={
                    teacherEval.planes_aula && teacherEval.innovaciones_educativas && teacherEval.informes_ejecucion
                      ? 'text-[#16A34A] font-bold'
                      : 'text-[#DC2626] font-bold'
                  }
                >
                  {teacherEval.planes_aula && teacherEval.innovaciones_educativas && teacherEval.informes_ejecucion
                    ? 'Paz y Salvo (3/3 ✓)'
                    : 'Bloqueado (Incompleto)'}
                </span>
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowTeacherModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTeacherEval}
                  disabled={savingTeacher}
                  className="rounded-xl bg-[#0A2540] px-4 py-2 text-xs font-bold text-white hover:bg-[#133961]"
                >
                  {savingTeacher ? 'Guardando...' : 'Confirmar Evaluación (RN-007)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DashboardArea;
