const ROLES = {
  DOCENTE: 'Docente',
  ADMINISTRATIVO: 'Administrativo',
  CONTRATISTA: 'Contratista',
  JEFE_INMEDIATO: 'Jefe Inmediato',
  ENCARGADO_AREA: 'Encargado de Área',
  APROBADOR: 'Aprobador Comunidad Universitaria',
  ADMIN_DTI: 'Administrador DTI',
};

const SOLICITANTES = [ROLES.DOCENTE, ROLES.ADMINISTRATIVO, ROLES.CONTRATISTA];

function hasRole(userRoles = [], allowed = []) {
  return userRoles.some((role) => allowed.includes(role));
}

function primaryHome(userRoles = []) {
  if (userRoles.includes(ROLES.ADMIN_DTI)) return '/admin';
  if (userRoles.includes(ROLES.APROBADOR)) return '/approver';
  if (userRoles.includes(ROLES.ENCARGADO_AREA) || userRoles.includes(ROLES.JEFE_INMEDIATO)) {
    return '/area';
  }
  return '/app';
}

module.exports = {
  ROLES,
  SOLICITANTES,
  hasRole,
  primaryHome,
};
