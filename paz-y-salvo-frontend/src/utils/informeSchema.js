// ============================================================================
// Informe final por entrega de cargo (formato de la División de Talento Humano).
// Describe las secciones I a VIII tal como las pide el formato, para dibujar el formulario y la
// vista de solo lectura. Debe coincidir con paz-y-salvo-backend/src/utils/informe.js (que valida).
//
// No se piden contraseñas: donde el formato pedía «clave de acceso» o «credenciales» se registra el
// estado de la credencial.
// ============================================================================

export const TIPOS_IDENTIFICACION = ['CC', 'CE', 'Visa', 'Otro'];
export const ESTADOS_RECURSO = ['Buen estado', 'Regular estado', 'Mal estado'];
export const ESTADOS_CREDENCIAL = [
  { value: 'ENTREGADA_AL_JEFE', label: 'Entregada al jefe' },
  { value: 'RESTABLECIDA_POR_TI', label: 'Restablecida por TI' },
  { value: 'NO_APLICA', label: 'No aplica' },
];

const texto = (key, label, extra = {}) => ({ key, label, tipo: 'text', ...extra });
const area = (key, label, extra = {}) => ({ key, label, tipo: 'textarea', ...extra });
const lista = (key, label, opciones, extra = {}) => ({ key, label, tipo: 'select', opciones, ...extra });

const tabla = (path, titulo, campos, extra = {}) => ({ tipo: 'tabla', path, titulo, campos, ...extra });
const campos = (titulo, lista_, extra = {}) => ({ tipo: 'campos', titulo, campos: lista_, ...extra });

const I = 'I_datos_generales';

export const SECCIONES = [
  {
    clave: 'I_datos_generales',
    titulo: 'I. Datos generales',
    bloques: [
      campos('Fecha de presentación', [
        { path: 'fecha_presentacion', label: 'Fecha de presentación', tipo: 'date' },
      ]),
      campos('1. Identificación del colaborador', [
        { path: `${I}.nombres_completos`, label: 'Nombres y apellidos completos', tipo: 'text', ancho: 'completo' },
        { path: `${I}.tipo_identificacion`, label: 'Tipo de identificación', tipo: 'select', opciones: TIPOS_IDENTIFICACION },
        { path: `${I}.otro_tipo`, label: 'Otro, ¿cuál?', tipo: 'text', visibleSi: (s) => s?.[I]?.tipo_identificacion === 'Otro' },
        { path: `${I}.numero_identificacion`, label: 'Número de identificación', tipo: 'text' },
        { path: `${I}.ciudad_pais_expedicion`, label: 'Ciudad/País de expedición', tipo: 'text' },
      ]),
      campos('2. Cargo que entrega', [
        { path: `${I}.cargo_nombre`, label: 'Nombre del cargo', tipo: 'text' },
        { path: `${I}.dependencia_nombre`, label: 'Nombre de la dependencia', tipo: 'text' },
        { path: `${I}.superior_nombre`, label: 'Nombre superior inmediato', tipo: 'text' },
        { path: `${I}.superior_cargo`, label: 'Cargo superior inmediato', tipo: 'text' },
      ]),
      campos('3. Periodo de cobertura del informe', [
        { path: `${I}.periodo_inicio`, label: 'Inicio', tipo: 'date' },
        { path: `${I}.periodo_fin`, label: 'Terminación', tipo: 'date' },
      ]),
    ],
  },
  {
    clave: 'II_informe_gestion',
    titulo: 'II. Informe de gestión',
    bloques: [
      tabla('II_informe_gestion.propositos', '1. Cumplimiento de propósitos del cargo', [
        texto('objetivo', 'Objetivo o meta'),
        texto('estado', 'Estado'),
        area('descripcion', 'Descripción'),
      ]),
      tabla('II_informe_gestion.proyectos', '2. Proyectos y actividades en curso', [
        texto('proyecto', 'Proyecto o actividad'),
        area('acciones_concluidas', 'Acciones concluidas'),
        area('acciones_pendientes', 'Acciones pendientes'),
      ]),
      tabla('II_informe_gestion.contactos', '3. Contactos externos relevantes', [
        texto('nombre', 'Nombre del contacto'),
        texto('institucion', 'Institución/organización'),
        texto('datos_contacto', 'Datos de contacto'),
        texto('razones', 'Razones para contactar'),
      ]),
    ],
  },
  {
    clave: 'III_procedimientos',
    titulo: 'III. Procesos, procedimientos, manuales e instructivos',
    ayuda: 'Relación de procesos, procedimientos, manuales, instructivos y formatos utilizados en el desarrollo de las funciones.',
    bloques: [
      tabla('III_procedimientos', 'Descripción / Detalle', [area('descripcion', 'Descripción / Detalle')]),
    ],
  },
  {
    clave: 'IV_formatos',
    titulo: 'IV. Formatos creados, implementados o documentados',
    ayuda: 'Formatos creados, implementados o documentados para la realización de procedimientos.',
    bloques: [
      tabla('IV_formatos', 'Descripción / Detalle', [area('descripcion', 'Descripción / Detalle')]),
    ],
  },
  {
    clave: 'V_informes',
    titulo: 'V. Informes que deben presentarse',
    ayuda: 'Relación de informes que deben presentarse, periodicidad, fechas y fuentes de información. Describa los informes, su periodicidad, las fechas exactas de presentación, las áreas involucradas y su papel en el proceso (elaboración, compilación, envío, coordinación, etc.).',
    bloques: [
      tabla('V_informes', 'Informes', [
        texto('nombre', 'Nombre del informe'),
        texto('presentado_a', 'A quién se presenta y áreas'),
        texto('periodicidad', 'Periodicidad'),
        texto('fecha', 'Fechas día/mes/año'),
        texto('papel', 'Papel del funcionario que lo presenta'),
      ]),
    ],
  },
  {
    clave: 'VI_recursos',
    titulo: 'VI. Estado de los recursos a cargo',
    ayuda: 'Diligencie solo los recursos efectivamente asignados a su puesto de trabajo. En «Estado a la entrega» indique Buen estado, Regular estado o Mal estado. Si lo requiere, solicite asistencia al área de Infraestructura para obtener el listado oficial de elementos a su cargo.',
    bloques: [
      tabla('VI_recursos.infraestructura', '1. Infraestructura', [
        texto('espacio', 'Espacio físico o infraestructura'),
        lista('estado', 'Estado a la entrega', ESTADOS_RECURSO),
      ]),
      tabla('VI_recursos.muebles', '2. Muebles, elementos físicos y dotación', [
        texto('elemento', 'Elemento / Dotación'),
        texto('numero', 'Número'),
        lista('estado', 'Estado a la entrega', ESTADOS_RECURSO),
      ]),
      tabla('VI_recursos.equipos', '3. Equipos de cómputo y otros equipos a su cargo', [
        texto('equipo', 'Equipo'),
        lista('estado', 'Estado a la entrega', ESTADOS_RECURSO),
      ]),
      tabla('VI_recursos.archivos_fisicos', '4. Archivos y documentos físicos o en memorias portables (CD, USB, discos extraíbles, etc.)', [
        texto('nombre', 'Nombre del archivo o documento'),
        texto('descripcion', 'Descripción del contenido'),
        texto('localizacion', 'Localización física'),
      ]),
      tabla('VI_recursos.archivos_equipos', '5. Archivos y documentos disponibles en los equipos de cómputo', [
        texto('nombre', 'Nombre del archivo o documento'),
        texto('ruta', 'Ruta de localización'),
      ]),
      tabla('VI_recursos.software', '6. Software y sistemas de información', [
        texto('identificacion', 'Identificación del software o sistema de información'),
        texto('usos', 'Usos institucionales'),
        texto('papel', 'Papel de quien entrega'),
        texto('acceso_localizacion', 'Acceso (localización)'),
        lista('estado_credencial', 'Estado de la credencial', ESTADOS_CREDENCIAL),
      ], { aviso: 'Por seguridad no se escriben contraseñas: indica si la credencial se entregó al jefe o la restableció TI.' }),
      tabla('VI_recursos.correos', '7. Correos electrónicos institucionales bajo administración', [
        texto('correo', 'Correo'),
        lista('estado_credencial', 'Estado de la credencial', ESTADOS_CREDENCIAL),
      ], { aviso: 'Por seguridad no se escribe la clave de acceso: indica si la credencial se entregó al jefe o la restableció TI.' }),
      tabla('VI_recursos.snies', '8. Información SNIES', [
        texto('recurso', 'Identificación del recurso'),
        texto('estado', 'Estado'),
      ]),
      tabla('VI_recursos.otros', '9. Otros recursos', [
        texto('recurso', 'Identificación del recurso'),
        texto('estado', 'Estado'),
      ]),
    ],
  },
  {
    clave: 'VII_anexos',
    titulo: 'VII. Anexos y observaciones',
    bloques: [
      tabla('VII_anexos.anexos', '1. Listado de anexos', [
        texto('identificacion', 'Identificación del anexo'),
        texto('medio', 'Medio de entrega'),
        area('descripcion', 'Descripción del anexo'),
      ]),
      campos('2. Observaciones', [
        { path: 'VII_anexos.observaciones', label: 'Observaciones', tipo: 'textarea', ancho: 'completo' },
      ]),
    ],
  },
  {
    clave: 'VIII_contacto',
    titulo: 'VIII. Datos de contacto',
    ayuda: 'La firma del trabajador se registra en el último paso del paz y salvo.',
    bloques: [
      campos('1. Datos de contacto', [
        { path: 'VIII_contacto.correo', label: 'Correo electrónico de contacto', tipo: 'email' },
        { path: 'VIII_contacto.telefono', label: 'Celular o teléfono', tipo: 'text' },
        { path: 'VIII_contacto.direccion', label: 'Dirección de residencia o postal', tipo: 'text', ancho: 'completo' },
      ]),
    ],
  },
];

// ---------------------------------------------------------------- acceso por ruta
// Rutas como «VI_recursos.software.filas[0].usos»
function partes(path) {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
}

export function getPath(obj, path) {
  return partes(path).reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function setPath(obj, path, valor) {
  const [clave, ...resto] = partes(path);
  const base = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  if (resto.length === 0) {
    base[clave] = valor;
  } else {
    const siguiente = obj?.[clave];
    const esIndice = /^\d+$/.test(resto[0]);
    base[clave] = setPath(siguiente ?? (esIndice ? [] : {}), resto.join('.'), valor);
  }
  return base;
}

// Sección del formulario a la que pertenece una ruta de error
export function seccionDePath(path) {
  return SECCIONES.find((s) => path === s.clave || path.startsWith(`${s.clave}.`)
    || (s.clave === 'I_datos_generales' && path === 'fecha_presentacion'))?.clave;
}

export const filaVacia = (campos_) => Object.fromEntries(campos_.map((c) => [c.key, '']));

// Informe inicial con los datos que la persona ya diligenció en su trámite
export function informeInicial(solicitud) {
  const d = solicitud?.datosGenerales || {};
  return {
    I_datos_generales: {
      nombres_completos: d.nombre_completo || '',
      tipo_identificacion: d.tipo_documento === 'CC' || !d.tipo_documento ? 'CC' : d.tipo_documento === 'CE' ? 'CE' : 'Otro',
      numero_identificacion: d.numero_documento || '',
      ciudad_pais_expedicion: d.lugar_expedicion_documento || '',
      cargo_nombre: d.cargo_desempenado || '',
      superior_nombre: d.jefe_nombre || '',
    },
    VIII_contacto: { correo: solicitud?.correo || '' },
  };
}
