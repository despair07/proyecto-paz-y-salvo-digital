import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const DashboardAdmin = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('usuarios'); // 'usuarios', 'dependencias', 'periodos'

  // Estados de datos
  const [users, setUsers] = useState([]);
  const [dependencias, setDependencias] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Edición de cargo (RN-011: Administrador DTI solo puede modificar el nombre del cargo)
  const [editingUserId, setEditingUserId] = useState(null);
  const [newCargoName, setNewCargoName] = useState('');
  const [savingCargo, setSavingCargo] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [uRes, dRes, pRes] = await Promise.all([
        api.get('/usuarios', { params: { limit: 100 } }),
        api.get('/dependencias'),
        api.get('/periodos'),
      ]);
      setUsers(uRes.data.data || []);
      setDependencias(dRes.data.data || []);
      setPeriodos(pRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al cargar datos administrativos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  // RN-011: Actualizar nombre del cargo
  const handleSaveCargo = async (userId) => {
    if (!newCargoName.trim()) {
      setError('El nombre del cargo no puede estar vacío');
      return;
    }
    setSavingCargo(true);
    setError('');
    try {
      await api.put(`/usuarios/${userId}`, {
        cargo_desempenado: newCargoName.trim(),
      });
      setNotice('Nombre del cargo actualizado con éxito (RN-011: demás campos del trámite son de solo lectura).');
      setEditingUserId(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al actualizar el cargo');
    } finally {
      setSavingCargo(false);
    }
  };

  return (
    <Layout title="Panel Administrativo — DTI">
      <div className="space-y-6 font-sans">
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

        {/* Encabezado y Regla RN-011 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">
                RF-007 · Administración Técnica del Sistema
              </span>
              <h2 className="text-xl font-bold text-[#0A2540]">
                Configuración y Catálogos Institucionales
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Restricción RN-011: El Administrador DTI solo puede modificar el nombre del cargo en el catálogo; el resto del trámite es de solo lectura.
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 font-medium">
              // TODO: confirmar con el cliente alcance futuro de edición
            </div>
          </div>

          {/* Navegación por Tabs (Pantalla 6) */}
          <div className="mt-6 flex border-b border-slate-200 gap-6 text-xs font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setActiveTab('usuarios')}
              className={`pb-3 transition border-b-2 ${
                activeTab === 'usuarios'
                  ? 'border-[#0A2540] text-[#0A2540]'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              1. Usuarios y Roles
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dependencias')}
              className={`pb-3 transition border-b-2 ${
                activeTab === 'dependencias'
                  ? 'border-[#0A2540] text-[#0A2540]'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              2. Catálogo de Dependencias
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('periodos')}
              className={`pb-3 transition border-b-2 ${
                activeTab === 'periodos'
                  ? 'border-[#0A2540] text-[#0A2540]'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              3. Periodos y Cohortes
            </button>
          </div>
        </div>

        {/* Tab 1: Usuarios y Roles con Matriz de Encargados */}
        {activeTab === 'usuarios' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0A2540]">
                  Cuentas Institucionales y Matriz de Encargados
                </h3>
                <p className="text-xs text-slate-500">
                  Muestra la asignación de cada funcionario a su dependencia y permite editar el cargo (RN-011).
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">{users.length} usuarios registrados</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0A2540] text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Nombre Completo</th>
                    <th className="px-4 py-3">Identificación</th>
                    <th className="px-4 py-3">Correo @uniautonoma</th>
                    <th className="px-4 py-3">Rol RBAC</th>
                    <th className="px-4 py-3">Dependencia Asignada</th>
                    <th className="px-4 py-3">Cargo (RN-011)</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isEditing = editingUserId === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3.5 font-bold text-slate-900">{u.nombre_completo || `${u.nombres} ${u.apellidos}`}</td>
                        <td className="px-4 py-3.5 font-mono text-slate-600">{u.numero_documento}</td>
                        <td className="px-4 py-3.5 text-slate-600">{u.correo_institucional}</td>
                        <td className="px-4 py-3.5">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                            {u.roles?.[0] || u.tipo_vinculacion}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 font-medium">
                          {u.dependencia || '— (Solicitante)'}
                        </td>
                        <td className="px-4 py-3.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={newCargoName}
                              onChange={(e) => setNewCargoName(e.target.value)}
                              className="w-full rounded border border-slate-300 p-1 text-xs"
                            />
                          ) : (
                            <span className="text-slate-800 font-semibold">{u.cargo_desempenado || 'Funcionario'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleSaveCargo(u.id)}
                                disabled={savingCargo}
                                className="rounded bg-[#16A34A] px-2 py-1 text-[11px] font-bold text-white hover:bg-green-700"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingUserId(null)}
                                className="rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-300"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUserId(u.id);
                                setNewCargoName(u.cargo_desempenado || '');
                              }}
                              className="text-[11px] font-bold text-[#0A2540] hover:underline"
                            >
                              Editar Cargo
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Dependencias */}
        {activeTab === 'dependencias' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
            <div className="mb-4">
              <h3 className="text-base font-bold text-[#0A2540]">
                Catálogo de Dependencias Institucionales (Formato GTH-07)
              </h3>
              <p className="text-xs text-slate-500">
                8 Dependencias evaluadoras de gestión + 1 Dependencia de aprobación final (Comunidad Universitaria).
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dependencias.map((dep, index) => (
                <div key={dep.id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 font-mono">#{index + 1}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        dep.es_aprobadora_final ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-[#0A2540]'
                      }`}
                    >
                      {dep.es_aprobadora_final ? 'Aprobador Final' : 'Área Evaluadora'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[#0A2540]">{dep.nombre || dep.nombre_dependencia}</h4>
                  <p className="text-xs text-slate-600 mt-1">{dep.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Periodos y Cohortes */}
        {activeTab === 'periodos' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
            <div className="mb-4">
              <h3 className="text-base font-bold text-[#0A2540]">
                Periodos Académicos y Cohortes
              </h3>
              <p className="text-xs text-slate-500">
                Control de semestres académicos para trámites de entrega de cargo.
              </p>
            </div>

            <div className="space-y-3">
              {periodos.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50/50 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">Periodo {p.nombre_periodo}</span>
                      <span className="rounded bg-[#16A34A] px-2 py-0.5 text-[10px] font-bold text-white">ACTIVO</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Vigencia: {p.fecha_inicio} al {p.fecha_fin}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 font-mono">ID: {p.id.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DashboardAdmin;
