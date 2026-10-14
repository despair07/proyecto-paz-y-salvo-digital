function toLock(row) {
  if (!row) return null;
  return {
    id: row.id,
    solicitudId: row.solicitud_id,
    dependenciaId: row.dependencia_id,
    dependenciaNombre: row.nombre_dependencia || null,
    registradoPorId: row.registrado_por_id,
    categoria: row.categoria,
    motivoDescripcion: row.motivo_descripcion,
    estado: row.estado,
    fechaRegistro: row.fecha_registro,
    resueltoPorId: row.resuelto_por_id,
    fechaResolucion: row.fecha_resolucion,
    observacionResolucion: row.observacion_resolucion,
  };
}

module.exports = { toLock };
