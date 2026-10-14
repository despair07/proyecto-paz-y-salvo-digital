function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    nombres: row.nombres,
    apellidos: row.apellidos,
    nombreCompleto: `${row.nombres} ${row.apellidos}`.trim(),
    tipoDocumento: row.tipo_documento,
    numeroDocumento: row.numero_documento,
    correoInstitucional: row.correo_institucional,
    tipoVinculacion: row.tipo_vinculacion,
    estado: row.estado,
    roles: row.roles || [],
    fechaCreacion: row.fecha_creacion,
  };
}

module.exports = { toPublicUser };
