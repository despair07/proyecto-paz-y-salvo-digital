// ============================================================================
// INFORME FINAL POR ENTREGA DE CARGO (formato de la División de Talento Humano)
// Estructura de las secciones I a VIII y su validación. Para quedar COMPLETO todos los campos son
// obligatorios; las tablas piden al menos una fila o marcar «No aplica» con una justificación.
//
// Por decisión de seguridad el formato no guarda contraseñas: donde pedía «clave de acceso» o
// «credenciales» se registra el estado de la credencial (estado_credencial).
// ============================================================================

const TIPOS_IDENTIFICACION = ['CC', 'CE', 'Visa', 'Otro'];
const ESTADOS_RECURSO = ['Buen estado', 'Regular estado', 'Mal estado'];
const ESTADOS_CREDENCIAL = ['ENTREGADA_AL_JEFE', 'RESTABLECIDA_POR_TI', 'NO_APLICA'];
const MIN_JUSTIFICACION = 10;

// Definición de las tablas: campos de cada fila (clave, etiqueta y valores permitidos)
const TABLAS = {
  'II_informe_gestion.propositos': {
    etiqueta: 'II.1 Cumplimiento de propósitos del cargo',
    campos: [['objetivo', 'Objetivo o meta'], ['estado', 'Estado'], ['descripcion', 'Descripción']],
  },
  'II_informe_gestion.proyectos': {
    etiqueta: 'II.2 Proyectos y actividades en curso',
    campos: [['proyecto', 'Proyecto o actividad'], ['acciones_concluidas', 'Acciones concluidas'], ['acciones_pendientes', 'Acciones pendientes']],
  },
  'II_informe_gestion.contactos': {
    etiqueta: 'II.3 Contactos externos relevantes',
    campos: [['nombre', 'Nombre del contacto'], ['institucion', 'Institución/organización'], ['datos_contacto', 'Datos de contacto'], ['razones', 'Razones para contactar']],
  },
  III_procedimientos: {
    etiqueta: 'III. Relación de procesos, procedimientos, manuales, instructivos y formatos',
    campos: [['descripcion', 'Descripción / Detalle']],
  },
  IV_formatos: {
    etiqueta: 'IV. Formatos creados, implementados o documentados',
    campos: [['descripcion', 'Descripción / Detalle']],
  },
  V_informes: {
    etiqueta: 'V. Relación de informes que deben presentarse',
    campos: [['nombre', 'Nombre del informe'], ['presentado_a', 'A quién se presenta y áreas'], ['periodicidad', 'Periodicidad'], ['fecha', 'Fechas día/mes/año'], ['papel', 'Papel del funcionario que lo presenta']],
  },
  'VI_recursos.infraestructura': {
    etiqueta: 'VI.1 Infraestructura',
    campos: [['espacio', 'Espacio físico o infraestructura'], ['estado', 'Estado a la entrega', ESTADOS_RECURSO]],
  },
  'VI_recursos.muebles': {
    etiqueta: 'VI.2 Muebles, elementos físicos y dotación',
    campos: [['elemento', 'Elemento / Dotación'], ['numero', 'Número'], ['estado', 'Estado a la entrega', ESTADOS_RECURSO]],
  },
  'VI_recursos.equipos': {
    etiqueta: 'VI.3 Equipos de cómputo y otros equipos a su cargo',
    campos: [['equipo', 'Equipo'], ['estado', 'Estado a la entrega', ESTADOS_RECURSO]],
  },
  'VI_recursos.archivos_fisicos': {
    etiqueta: 'VI.4 Archivos y documentos físicos o en memorias portables',
    campos: [['nombre', 'Nombre del archivo o documento'], ['descripcion', 'Descripción del contenido'], ['localizacion', 'Localización física']],
  },
  'VI_recursos.archivos_equipos': {
    etiqueta: 'VI.5 Archivos y documentos disponibles en los equipos de cómputo',
    campos: [['nombre', 'Nombre del archivo o documento'], ['ruta', 'Ruta de localización']],
  },
  'VI_recursos.software': {
    etiqueta: 'VI.6 Software y sistemas de información',
    campos: [['identificacion', 'Identificación del software o sistema'], ['usos', 'Usos institucionales'], ['papel', 'Papel de quien entrega'], ['acceso_localizacion', 'Acceso (localización)'], ['estado_credencial', 'Estado de la credencial', ESTADOS_CREDENCIAL]],
  },
  'VI_recursos.correos': {
    etiqueta: 'VI.7 Correos electrónicos institucionales bajo administración',
    campos: [['correo', 'Correo'], ['estado_credencial', 'Estado de la credencial', ESTADOS_CREDENCIAL]],
  },
  'VI_recursos.snies': {
    etiqueta: 'VI.8 Información SNIES',
    campos: [['recurso', 'Identificación del recurso'], ['estado', 'Estado']],
  },
  'VI_recursos.otros': {
    etiqueta: 'VI.9 Otros recursos',
    campos: [['recurso', 'Identificación del recurso'], ['estado', 'Estado']],
  },
  'VII_anexos.anexos': {
    etiqueta: 'VII.1 Listado de anexos',
    campos: [['identificacion', 'Identificación del anexo'], ['medio', 'Medio de entrega'], ['descripcion', 'Descripción del anexo']],
  },
};

const SECCIONES = [
  { clave: 'I_datos_generales', titulo: 'I. Datos generales' },
  { clave: 'II_informe_gestion', titulo: 'II. Informe de gestión' },
  { clave: 'III_procedimientos', titulo: 'III. Procesos, procedimientos, manuales e instructivos' },
  { clave: 'IV_formatos', titulo: 'IV. Formatos creados, implementados o documentados' },
  { clave: 'V_informes', titulo: 'V. Informes que deben presentarse' },
  { clave: 'VI_recursos', titulo: 'VI. Estado de los recursos a cargo' },
  { clave: 'VII_anexos', titulo: 'VII. Anexos y observaciones' },
  { clave: 'VIII_contacto', titulo: 'VIII. Datos de contacto y firma' },
];

const get = (obj, path) => path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
const texto = (value) => (typeof value === 'string' ? value.trim() : '');
const esFecha = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

function validarTabla(secciones, path, errores) {
  const def = TABLAS[path];
  const tabla = get(secciones, path);
  if (!tabla || typeof tabla !== 'object') {
    errores.push({ path, mensaje: `${def.etiqueta}: agregue al menos una fila o marque «No aplica»` });
    return;
  }
  if (tabla.no_aplica === true) {
    if (texto(tabla.justificacion).length < MIN_JUSTIFICACION) {
      errores.push({ path: `${path}.justificacion`, mensaje: `${def.etiqueta}: explique por qué no aplica (mínimo ${MIN_JUSTIFICACION} caracteres)` });
    }
    return;
  }
  const filas = Array.isArray(tabla.filas) ? tabla.filas : [];
  if (filas.length === 0) {
    errores.push({ path, mensaje: `${def.etiqueta}: agregue al menos una fila o marque «No aplica»` });
    return;
  }
  filas.forEach((fila, i) => {
    for (const [clave, etiqueta, permitidos] of def.campos) {
      const valor = texto(fila?.[clave]);
      if (!valor) {
        errores.push({ path: `${path}.filas[${i}].${clave}`, mensaje: `${def.etiqueta}, fila ${i + 1}: falta «${etiqueta}»` });
      } else if (permitidos && !permitidos.includes(valor)) {
        errores.push({ path: `${path}.filas[${i}].${clave}`, mensaje: `${def.etiqueta}, fila ${i + 1}: «${etiqueta}» no es válido` });
      }
    }
  });
}

function requerido(secciones, path, etiqueta, errores) {
  if (!texto(get(secciones, path))) errores.push({ path, mensaje: `Falta «${etiqueta}»` });
}

// Devuelve la lista de problemas que impiden marcar el informe como COMPLETO (vacía = válido)
function validarInformeCompleto(secciones) {
  const errores = [];
  const s = secciones && typeof secciones === 'object' ? secciones : {};

  if (!esFecha(texto(s.fecha_presentacion))) {
    errores.push({ path: 'fecha_presentacion', mensaje: 'Falta la fecha de presentación (AAAA-MM-DD)' });
  }

  // I. Datos generales
  const I = 'I_datos_generales';
  requerido(s, `${I}.nombres_completos`, 'Nombres y apellidos completos', errores);
  const tipo = texto(get(s, `${I}.tipo_identificacion`));
  if (!TIPOS_IDENTIFICACION.includes(tipo)) {
    errores.push({ path: `${I}.tipo_identificacion`, mensaje: 'Seleccione el tipo de identificación' });
  } else if (tipo === 'Otro') {
    requerido(s, `${I}.otro_tipo`, 'Tipo de identificación (¿cuál?)', errores);
  }
  requerido(s, `${I}.numero_identificacion`, 'Número de identificación', errores);
  requerido(s, `${I}.ciudad_pais_expedicion`, 'Ciudad/País de expedición', errores);
  requerido(s, `${I}.cargo_nombre`, 'Nombre del cargo', errores);
  requerido(s, `${I}.dependencia_nombre`, 'Nombre de la dependencia', errores);
  requerido(s, `${I}.superior_nombre`, 'Nombre del superior inmediato', errores);
  requerido(s, `${I}.superior_cargo`, 'Cargo del superior inmediato', errores);
  const inicio = texto(get(s, `${I}.periodo_inicio`));
  const fin = texto(get(s, `${I}.periodo_fin`));
  if (!esFecha(inicio)) errores.push({ path: `${I}.periodo_inicio`, mensaje: 'Falta el inicio del periodo de cobertura' });
  if (!esFecha(fin)) errores.push({ path: `${I}.periodo_fin`, mensaje: 'Falta la terminación del periodo de cobertura' });
  if (esFecha(inicio) && esFecha(fin) && inicio > fin) {
    errores.push({ path: `${I}.periodo_fin`, mensaje: 'La terminación del periodo no puede ser anterior al inicio' });
  }

  // Tablas
  Object.keys(TABLAS).forEach((path) => validarTabla(s, path, errores));

  // VII. Observaciones y VIII. Contacto
  requerido(s, 'VII_anexos.observaciones', 'Observaciones (escriba «Sin observaciones» si no hay)', errores);
  const correo = texto(get(s, 'VIII_contacto.correo'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    errores.push({ path: 'VIII_contacto.correo', mensaje: 'Escriba un correo electrónico de contacto válido' });
  }
  if (texto(get(s, 'VIII_contacto.telefono')).replace(/\D/g, '').length < 7) {
    errores.push({ path: 'VIII_contacto.telefono', mensaje: 'Escriba un celular o teléfono de contacto válido' });
  }
  requerido(s, 'VIII_contacto.direccion', 'Dirección de residencia o postal', errores);

  return errores;
}

// Avance por sección (para mostrar «completa / faltan N» sin esperar a finalizar)
function resumenPorSeccion(secciones) {
  const errores = validarInformeCompleto(secciones);
  return SECCIONES.map(({ clave, titulo }) => {
    const prefijos = [clave, ...Object.keys(TABLAS).filter((t) => t.startsWith(clave))];
    const propios = errores.filter((e) => prefijos.some((p) => e.path === p || e.path.startsWith(`${p}.`) || e.path.startsWith(`${p}[`))
      || (clave === 'I_datos_generales' && e.path === 'fecha_presentacion'));
    return { clave, titulo, completa: propios.length === 0, faltantes: propios.length };
  });
}

module.exports = {
  TIPOS_IDENTIFICACION,
  ESTADOS_RECURSO,
  ESTADOS_CREDENCIAL,
  TABLAS,
  SECCIONES,
  validarInformeCompleto,
  resumenPorSeccion,
};
