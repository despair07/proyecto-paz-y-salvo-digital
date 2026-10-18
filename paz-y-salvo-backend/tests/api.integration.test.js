// ============================================================================
// PRUEBAS DE INTEGRACIÓN — API + SQL reales (PGlite con ddl.sql y los seeds)
// Recorren el flujo completo del paz y salvo: datos generales → solicitud a cada dependencia
// (aprobar / bloquear) → informe → cláusula y firma → aprobación final → rechazo y reinicio,
// y las reglas de negocio RN-001 … RN-016.
// ============================================================================

process.env.JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-bytes-long';
process.env.FRONTEND_PUBLIC_URL = 'http://localhost:5173';
process.env.AUTH_PASSWORD_ENABLED = 'true';

jest.mock('../src/config/database', () => require('./helpers/pgliteDatabase'));

const request = require('supertest');
const db = require('../src/config/database');
const app = require('../src/app');
const { validarInformeCompleto } = require('../src/utils/informe');

const PASSWORD = 'Demo2026*';
const API = '/api/v1';

const SOLICITUD = {
  laura: 'aaaa1111-1111-4111-8111-111111111111',
  carlos: 'bbbb2222-2222-4222-8222-222222222222',
  sofia: 'cccc3333-3333-4333-8333-333333333333',
  mateo: 'dddd4444-4444-4444-8444-444444444444',
  valentina: 'eeee5555-5555-4555-8555-555555555555',
};
const DEP = {
  jefe: '6513e4af-9d27-4d7e-9eb4-111111111111',
  ti: '6513e4af-9d27-4d7e-9eb4-222222222222',
  medios: '6513e4af-9d27-4d7e-9eb4-333333333333',
  almacen: '6513e4af-9d27-4d7e-9eb4-444444444444',
  archivo: '6513e4af-9d27-4d7e-9eb4-555555555555',
  financiera: '6513e4af-9d27-4d7e-9eb4-666666666666',
  sst: '6513e4af-9d27-4d7e-9eb4-777777777777',
  profesoral: '6513e4af-9d27-4d7e-9eb4-888888888888',
};
const EMAIL = {
  laura: 'laura.ortiz@uniautonoma.edu.co',
  carlos: 'carlos.munoz@uniautonoma.edu.co',
  sofia: 'sofia.cardenas@uniautonoma.edu.co',
  mateo: 'mateo.gomez@uniautonoma.edu.co',
  valentina: 'valentina.narvaez@uniautonoma.edu.co',
  jefe: 'jefe.inmediato@uniautonoma.edu.co',
  ti: 'encargado.dti@uniautonoma.edu.co',
  medios: 'encargado.medios@uniautonoma.edu.co',
  almacen: 'encargado.almacen@uniautonoma.edu.co',
  archivo: 'encargado.archivo@uniautonoma.edu.co',
  financiera: 'encargado.financiera@uniautonoma.edu.co',
  sst: 'encargado.sst@uniautonoma.edu.co',
  profesoral: 'encargado.profesoral@uniautonoma.edu.co',
  aprobador: 'aprobador.comunidad@uniautonoma.edu.co',
  admin: 'admin.dti@uniautonoma.edu.co',
};

const tokens = {};
async function login(email) {
  if (!tokens[email]) {
    const res = await request(app).post(`${API}/auth/login`).send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    tokens[email] = res.body.token;
  }
  return tokens[email];
}
const as = async (who) => ({ Authorization: `Bearer ${await login(EMAIL[who] || who)}` });
const get = async (who, url) => request(app).get(`${API}${url}`).set(await as(who));
const post = async (who, url, body = {}) => request(app).post(`${API}${url}`).set(await as(who)).send(body);
const put = async (who, url, body = {}) => request(app).put(`${API}${url}`).set(await as(who)).send(body);
const status = async (who) => (await get(who, '/paz-y-salvo/mi-estado')).body.data;

// Informe por entrega de cargo completo (todas las secciones)
const tabla = (fila) => ({ no_aplica: false, justificacion: '', filas: [fila] });
function informeCompleto(nombre = 'Valentina Isabel Narváez Mosquera') {
  return {
    fecha_presentacion: '2026-10-14',
    I_datos_generales: {
      nombres_completos: nombre, tipo_identificacion: 'CC', otro_tipo: '', numero_identificacion: '1.061.700.115',
      ciudad_pais_expedicion: 'Popayán, Colombia', cargo_nombre: 'Docente de Cátedra', dependencia_nombre: 'Programa de Derecho',
      superior_nombre: 'Martha Lucía Quintero', superior_cargo: 'Coordinador Administrativo',
      periodo_inicio: '2024-02-01', periodo_fin: '2026-12-15',
    },
    II_informe_gestion: {
      propositos: tabla({ objetivo: 'Dictar las asignaturas asignadas', estado: 'Cumplido', descripcion: 'Cuatro asignaturas dictadas.' }),
      proyectos: tabla({ proyecto: 'Semillero de investigación', acciones_concluidas: 'Dos ponencias', acciones_pendientes: 'Informe final' }),
      contactos: { no_aplica: true, justificacion: 'No manejo contactos externos en mi cargo.', filas: [] },
    },
    III_procedimientos: tabla({ descripcion: 'Guías de aula en la carpeta compartida.' }),
    IV_formatos: tabla({ descripcion: 'Formato de seguimiento de tutorías.' }),
    V_informes: tabla({ nombre: 'Informe semestral', presentado_a: 'Decanatura', periodicidad: 'Semestral', fecha: '30/11', papel: 'Elaboración' }),
    VI_recursos: {
      infraestructura: tabla({ espacio: 'Cubículo docente', estado: 'Buen estado' }),
      muebles: tabla({ elemento: 'Escritorio', numero: '1', estado: 'Buen estado' }),
      equipos: tabla({ equipo: 'Portátil institucional', estado: 'Regular estado' }),
      archivos_fisicos: tabla({ nombre: 'Actas de calificación', descripcion: 'Semestre 2026-1', localizacion: 'Archivador 3' }),
      archivos_equipos: tabla({ nombre: 'Planes de aula', ruta: 'D:/Docencia/Planes' }),
      software: tabla({ identificacion: 'Plataforma virtual', usos: 'Aulas virtuales', papel: 'Docente', acceso_localizacion: 'Cuenta institucional', estado_credencial: 'RESTABLECIDA_POR_TI' }),
      correos: tabla({ correo: 'valentina.narvaez@uniautonoma.edu.co', estado_credencial: 'ENTREGADA_AL_JEFE' }),
      snies: { no_aplica: true, justificacion: 'El cargo no administra información SNIES.', filas: [] },
      otros: { no_aplica: true, justificacion: 'No tengo otros recursos a cargo.', filas: [] },
    },
    VII_anexos: { anexos: tabla({ identificacion: 'Acta de entrega', medio: 'Físico', descripcion: 'Acta firmada' }), observaciones: 'Sin observaciones.' },
    VIII_contacto: { correo: 'valentina.n@gmail.com', telefono: '3101112233', direccion: 'Popayán, Cauca' },
  };
}

beforeAll(() => db.init(), 60000);
afterAll(() => db.close());

describe('Informe por entrega de cargo: validador', () => {
  it('el informe de la prueba es válido y uno vacío se rechaza campo por campo', () => {
    expect(validarInformeCompleto(informeCompleto())).toEqual([]);
    const errores = validarInformeCompleto({});
    expect(errores.length).toBeGreaterThan(20);
    expect(errores[0]).toMatchObject({ path: expect.any(String), mensaje: expect.any(String) });
  });

  it('una tabla acepta una fila o «No aplica» con justificación, pero no una tabla vacía', () => {
    const base = informeCompleto();
    base.III_procedimientos = { no_aplica: false, justificacion: '', filas: [] };
    expect(validarInformeCompleto(base).map((e) => e.path)).toContain('III_procedimientos');
    base.III_procedimientos = { no_aplica: true, justificacion: 'corto', filas: [] };
    expect(validarInformeCompleto(base).map((e) => e.path)).toContain('III_procedimientos.justificacion');
    base.III_procedimientos = { no_aplica: true, justificacion: 'No se utilizan procedimientos formales.', filas: [] };
    expect(validarInformeCompleto(base)).toEqual([]);
  });

  it('exige un estado de recurso válido y no pide contraseñas', () => {
    const base = informeCompleto();
    base.VI_recursos.equipos.filas[0].estado = 'Excelente';
    expect(validarInformeCompleto(base)[0].path).toBe('VI_recursos.equipos.filas[0].estado');
    expect(JSON.stringify(informeCompleto())).not.toMatch(/clave|contraseña|password/i);
  });
});

describe('Autenticación y permisos de acceso', () => {
  it('inicia sesión y devuelve el perfil con roles', async () => {
    const res = await request(app).post(`${API}/auth/login`).send({ email: EMAIL.laura, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ roles: ['Docente'], cargo: 'Docente de Planta' });
    expect(res.body.usuario.password_hash).toBeUndefined();
  });

  it('el Administrador DTI no accede a los datos de los trámites (RN-011)', async () => {
    for (const url of [
      '/tramites/pendientes-aprobacion', '/revisiones', '/bloqueos',
      `/tramites/${SOLICITUD.laura}/informe-entrega-cargo`, `/tramites/${SOLICITUD.sofia}/revision-final`,
    ]) {
      expect((await get('admin', url)).status).toBe(403);
    }
  });
});

describe('Estado del trabajador (RF-004, RN-001)', () => {
  it('Laura: 5 de 8 dependencias aprobadas y 3 bloqueos', async () => {
    const d = await status('laura');
    expect(d).toMatchObject({
      estadoGlobal: 'EN_PROCESO', areasLiberadas: 5, totalAreasRequeridas: 8, informeEntregaCargo: true, editable: false,
    });
    const bloqueadas = d.dependencias.filter((x) => x.estado === 'BLOQUEADA').map((x) => x.nombre);
    expect(bloqueadas).toEqual(expect.arrayContaining([
      'Medios Educativos (Vicerrectoría Académica)', 'División Contable Y Financiera', 'Centro de Desarrollo Profesoral',
    ]));
    const medios = d.dependencias.find((x) => x.id === DEP.medios);
    expect(medios).toMatchObject({ categoria: 'INVENTARIO_ELEMENTOS', puedeSolicitar: true });
    const sst = d.dependencias.find((x) => x.id === DEP.sst);
    expect(sst).toMatchObject({ estado: 'APROBADA', enlace: expect.stringMatching(/^https:\/\//), revisor: 'Natalia Andrea Ramírez' });
    expect(sst.recibi).toMatch(/certificado de horas/);
    expect(d.dependencias.find((x) => x.id === DEP.profesoral).entregablesProfesorales).toMatchObject({ planes_aula: true, informes_ejecucion: false });
  });

  it('Carlos (cambio de dependencia): SST y Profesoral no aplican; hay una dependencia sin solicitar', async () => {
    const d = await status('carlos');
    expect(d.totalAreasRequeridas).toBe(6);
    expect(d.dependencias.find((x) => x.id === DEP.sst).estado).toBe('NO_APLICA');
    expect(d.dependencias.find((x) => x.id === DEP.profesoral).estado).toBe('NO_APLICA');
    expect(d.dependencias.find((x) => x.id === DEP.financiera).estado).toBe('SIN_SOLICITAR');
    expect(d.dependencias.find((x) => x.id === DEP.archivo).estado).toBe('SOLICITADA');
    const ti = d.dependencias.find((x) => x.id === DEP.ti);
    expect(ti.intentos).toBe(2);
    expect(ti.bloqueosResueltos).toHaveLength(1);
  });

  it('Sofía espera la aprobación final; Mateo tiene el certificado', async () => {
    expect(await status('sofia')).toMatchObject({ estadoGlobal: 'PENDIENTE_APROBACION', porcentajeCompletado: 100 });
    const m = await status('mateo');
    expect(m).toMatchObject({ estadoGlobal: 'APROBADO_FINAL', puedeDescargarCertificado: true });
    expect(m.certificado.token_verificacion).toHaveLength(64);
  });

  it('Valentina está en borrador y sabe qué datos le faltan', async () => {
    const d = await status('valentina');
    expect(d).toMatchObject({ estadoGlobal: 'BORRADOR', editable: true, datosCompletos: false });
    expect(d.datosFaltantes).toEqual(expect.arrayContaining(['Cédula de ciudadanía', 'Lugar de expedición', 'Fecha de retiro']));
    expect(d.dependencias.every((x) => x.estado === 'SIN_SOLICITAR' || x.estado === 'NO_APLICA')).toBe(true);
    expect(d.dependencias.find((x) => x.id === DEP.ti).motivoNoPuede).toBe('Complete los datos generales primero');
  });
});

describe('Datos generales (sección 1)', () => {
  const url = `/tramites/${SOLICITUD.valentina}/datos-generales`;

  it('valida los campos', async () => {
    expect((await put('valentina', url, { tipo_novedad: 'VACACIONES' })).status).toBe(400);
    expect((await put('valentina', url, { fecha_retiro: '15/12/2026' })).status).toBe(400);
    expect((await put('valentina', url, { tipo_documento: 'XX' })).status).toBe(400);
    expect((await put('valentina', url, { jefe_inmediato_id: '11111111-1111-4111-8111-555555555555' })).status).toBe(400);
  });

  it('solo el dueño edita y solo mientras es borrador', async () => {
    expect((await put('laura', url, { cargo_desempenado: 'X' })).status).toBe(403);
    const laura = await put('laura', `/tramites/${SOLICITUD.laura}/datos-generales`, { cargo_desempenado: 'X' });
    expect(laura.status).toBe(409);
    await expect(db.query("UPDATE solicitudes_paz_y_salvo SET cargo_desempenado = 'X' WHERE id = $1", [SOLICITUD.laura]))
      .rejects.toThrow(/datos generales ya no se pueden modificar/);
  });

  it('el trabajador elige a su jefe de la lista que registra TI', async () => {
    const jefes = await get('valentina', '/tramites/jefes-inmediatos');
    expect(jefes.body.data).toEqual([expect.objectContaining({ nombre: 'Martha Lucía Quintero', cargo: 'Coordinador Administrativo' })]);
    expect((await get('ti', '/tramites/jefes-inmediatos')).status).toBe(403);
  });

  it('antes de completar los datos no se puede solicitar ninguna dependencia', async () => {
    const res = await post('valentina', `/tramites/${SOLICITUD.valentina}/dependencias/${DEP.ti}/solicitar`);
    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/datos generales/);
  });

  it('se completan y quedan editables (autoguardado parcial)', async () => {
    const parcial = await put('valentina', url, { numero_documento: ' 1.061.700.115 ', lugar_expedicion_documento: 'Popayán, Cauca' });
    expect(parcial.status).toBe(200);
    expect(parcial.body.datosCompletos).toBe(false);
    expect(parcial.body.datosFaltantes).toEqual(['Fecha de retiro']);

    const completo = await put('valentina', url, {
      fecha_retiro: '2026-12-15', jefe_inmediato_id: '11111111-1111-4111-8111-444444444444', cargo_desempenado: 'Docente de Cátedra',
    });
    expect(completo.body).toMatchObject({ datosCompletos: true, datosFaltantes: [] });
    expect(completo.body.datosGenerales).toMatchObject({ numero_documento: '1.061.700.115', jefe_nombre: 'Martha Lucía Quintero' });
  });

  it('en un cambio de dependencia no se exige fecha de retiro y cambian las dependencias que aplican', async () => {
    await put('valentina', url, { tipo_novedad: 'CAMBIO_DEPENDENCIA', fecha_retiro: '' });
    let d = await status('valentina');
    expect(d.datosCompletos).toBe(true);
    expect(d.totalAreasRequeridas).toBe(7); // sin SST
    await put('valentina', url, { tipo_novedad: 'RETIRO', fecha_retiro: '2026-12-15' });
    d = await status('valentina');
    expect(d.totalAreasRequeridas).toBe(8);
  });
});

describe('Solicitar la aprobación de cada dependencia', () => {
  const base = `/tramites/${SOLICITUD.valentina}/dependencias`;

  it('Seguridad y Salud en el Trabajo exige un enlace https (RN-015)', async () => {
    expect((await post('valentina', `${base}/${DEP.sst}/solicitar`)).status).toBe(400);
    expect((await post('valentina', `${base}/${DEP.sst}/solicitar`, { enlace: 'http://inseguro.example/cert' })).status).toBe(400);
    expect((await post('valentina', `${base}/${DEP.sst}/solicitar`, { enlace: 'https://con espacios.example' })).status).toBe(400);
    expect((await post('valentina', `${base}/${DEP.sst}/solicitar`, { enlace: 'javascript:alert(1)' })).status).toBe(400);
  });

  it('el paz y salvo del jefe no depende del informe: se pide en paralelo', async () => {
    expect((await post('valentina', `${base}/${DEP.jefe}/solicitar`)).status).toBe(201);
  });

  it('el cierre y la firma no se habilitan hasta que las dependencias aprueben y el informe esté completo', async () => {
    const res = await put('valentina', `/tramites/${SOLICITUD.valentina}/cierre`, { observaciones: 'muy pronto' });
    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/cierre/i);
    expect((await status('valentina')).cierre.habilitado).toBe(false);
  });

  it('solicita varias dependencias en paralelo y el trámite pasa a EN_PROCESO', async () => {
    for (const dep of [DEP.ti, DEP.medios, DEP.almacen, DEP.archivo, DEP.financiera, DEP.profesoral]) {
      expect((await post('valentina', `${base}/${dep}/solicitar`)).status).toBe(201);
    }
    const sst = await post('valentina', `${base}/${DEP.sst}/solicitar`, { enlace: 'https://formacion.uniautonoma.edu.co/cert/valentina' });
    expect(sst.status).toBe(201);
    const d = await status('valentina');
    expect(d.estadoGlobal).toBe('EN_PROCESO');
    expect(d.dependencias.find((x) => x.id === DEP.ti)).toMatchObject({ estado: 'SOLICITADA', intentos: 1, puedeSolicitar: false });
    expect(d.dependencias.find((x) => x.id === DEP.sst).enlace).toBe('https://formacion.uniautonoma.edu.co/cert/valentina');
    // los datos ya no se editan
    expect((await put('valentina', `/tramites/${SOLICITUD.valentina}/datos-generales`, { cargo_desempenado: 'Otro' })).status).toBe(409);
  });

  it('no se solicita dos veces la misma dependencia y a quien no aplica', async () => {
    expect((await post('valentina', `${base}/${DEP.ti}/solicitar`)).status).toBe(409);
    expect((await post('valentina', `${base}/6513e4af-9d27-4d7e-9eb4-999999999999/solicitar`)).status).toBe(404);
    expect((await post('laura', `${base}/${DEP.ti}/solicitar`)).status).toBe(403); // trámite de otra persona
  });

  it('los encargados reciben una notificación de la nueva solicitud', async () => {
    const ti = await get('ti', '/notificaciones');
    expect(ti.body.data.find((n) => n.tipo === 'SOLICITUD_REVISION').mensaje).toMatch(/Valentina.*Tecnologías de la información/);
  });
});

describe('Informe por entrega de cargo (RF-010)', () => {
  const url = `/tramites/${SOLICITUD.valentina}/informe-entrega-cargo`;

  it('guarda borradores parciales sin validar', async () => {
    const res = await put('valentina', url, { estado: 'BORRADOR', secciones: { I_datos_generales: { nombres_completos: 'Valentina' } } });
    expect(res.status).toBe(200);
    expect(res.body.resumen.find((s) => s.clave === 'I_datos_generales')).toMatchObject({ completa: false });
    const leido = await get('valentina', url);
    expect(leido.body.data).toMatchObject({ estado: 'BORRADOR', editable: true });
  });

  it('al finalizar lista exactamente lo que falta', async () => {
    const res = await put('valentina', url, { estado: 'COMPLETO', secciones: { I_datos_generales: { nombres_completos: 'Valentina' } } });
    expect(res.status).toBe(400);
    expect(res.body.detalles.length).toBeGreaterThan(20);
    expect(res.body.detalles[0]).toHaveProperty('path');
    expect((await put('valentina', url, { estado: 'TERMINADO', secciones: {} })).status).toBe(400);
  });

  it('solo el dueño lo diligencia; las dependencias y el jefe no lo ven', async () => {
    expect((await put('laura', url, { estado: 'BORRADOR', secciones: {} })).status).toBe(403);
    expect((await get('laura', url)).status).toBe(403);
    expect((await get('almacen', url)).status).toBe(403);
    expect((await get('jefe', url)).status).toBe(403);
    expect((await get('aprobador', url)).status).toBe(403); // aún no está en aprobación final
  });

  it('completo, se marca el informe', async () => {
    const res = await put('valentina', url, { estado: 'COMPLETO', secciones: informeCompleto() });
    expect(res.status).toBe(200);
    expect(res.body.resumen.every((s) => s.completa)).toBe(true);
    expect((await status('valentina')).informeEntregaCargo).toBe(true);
  });
});

describe('Bandeja de las dependencias (RN-004, RN-011, RN-013)', () => {
  it('cada encargado ve las solicitudes de sus dependencias', async () => {
    const ti = await get('ti', '/revisiones?estado=SOLICITADA');
    expect(ti.status).toBe(200);
    expect(ti.body.data.map((r) => r.trabajador.nombre)).toContain('Valentina Isabel Narváez Mosquera');
    expect(ti.body.data.every((r) => r.dependenciaId === DEP.ti)).toBe(true);
    expect(ti.body.conteos).toMatchObject({ SOLICITADA: expect.any(Number), APROBADA: expect.any(Number) });

    const almacen = await get('almacen', '/revisiones');
    expect(almacen.body.data.every((r) => r.dependenciaId === DEP.almacen)).toBe(true);
    expect(almacen.body.data.some((r) => r.trabajador.nombre.startsWith('Carlos') && r.estado === 'BLOQUEADA')).toBe(true);
  });

  it('el trabajador y el Administrador DTI no acceden a la bandeja', async () => {
    expect((await get('valentina', '/revisiones')).status).toBe(403);
    expect((await get('admin', '/revisiones')).status).toBe(403);
  });

  it('el detalle muestra los datos del trabajador y el historial, pero no el informe', async () => {
    const lista = await get('ti', '/revisiones?q=Valentina');
    const id = lista.body.data[0].id;
    const res = await get('ti', `/revisiones/${id}`);
    expect(res.body.data).toMatchObject({
      dependencia: 'Tecnologías de la información y transformación digital',
      aspecto: 'Recibí:',
      puedeDecidir: true,
      tieneFirma: true,
      trabajador: { nombre: 'Valentina Isabel Narváez Mosquera', documento: 'CC 1.061.700.115', vinculacion: 'Docente' },
    });
    expect(res.body.data.informe).toBeUndefined(); // el informe solo lo ve la aprobación final
    // otra dependencia no ve esta solicitud
    expect((await get('almacen', `/revisiones/${id}`)).status).toBe(403);
  });

  it('el jefe inmediato solo ve los trámites donde fue elegido (RN-004)', async () => {
    await db.query(
      `INSERT INTO usuarios (nombres, apellidos, correo_institucional, tipo_vinculacion, password_hash)
       SELECT 'Otro', 'Jefe', 'otro.jefe@uniautonoma.edu.co', NULL, password_hash FROM usuarios WHERE correo_institucional = $1`, [EMAIL.laura]
    );
    await db.query(
      `INSERT INTO usuario_roles (usuario_id, rol_id)
       SELECT u.id, r.id FROM usuarios u, roles r WHERE u.correo_institucional = 'otro.jefe@uniautonoma.edu.co' AND r.nombre_rol = 'Jefe Inmediato'`
    );
    await db.query(
      `INSERT INTO encargados_dependencia (usuario_id, dependencia_id, es_jefe_inmediato)
       SELECT u.id, $1, TRUE FROM usuarios u WHERE u.correo_institucional = 'otro.jefe@uniautonoma.edu.co'`, [DEP.jefe]
    );
    const otro = await get('otro.jefe@uniautonoma.edu.co', '/revisiones');
    expect(otro.body.data).toHaveLength(0);
    const { rows: [rev] } = await db.query(
      `SELECT r.id FROM revisiones_area r WHERE r.solicitud_id = $1 AND r.dependencia_id = $2`, [SOLICITUD.valentina, DEP.jefe]
    );
    expect((await get('otro.jefe@uniautonoma.edu.co', `/revisiones/${rev.id}`)).status).toBe(403);
    expect((await post('otro.jefe@uniautonoma.edu.co', `/revisiones/${rev.id}/aprobar`, { recibi: 'Intento' })).status).toBe(403);
    // aparece como opción para el trabajador, que puede elegirlo
    const jefes = await get('valentina', '/tramites/jefes-inmediatos');
    expect(jefes.body.data.map((j) => j.nombre)).toEqual(expect.arrayContaining(['Martha Lucía Quintero', 'Otro Jefe']));
  });
});

describe('Aprobar y bloquear (RN-003, RN-009, RN-014)', () => {
  const idDe = async (who, dep) => {
    const res = await get(who, '/revisiones?q=Valentina');
    return res.body.data.find((r) => r.dependenciaId === dep).id;
  };

  it('aprobar exige el «Recibí:» y la firma del revisor', async () => {
    const id = await idDe('ti', DEP.ti);
    expect((await post('ti', `/revisiones/${id}/aprobar`, { recibi: '  ' })).status).toBe(400);

    await db.query("DELETE FROM firmas_usuario WHERE usuario_id = '11111111-1111-4111-8111-555555555555'");
    const sinFirma = await post('ti', `/revisiones/${id}/aprobar`, { recibi: 'Recibí equipo y accesos.' });
    expect(sinFirma.status).toBe(409);
    expect(sinFirma.body.mensaje).toMatch(/firma/);
    const png = (await db.query('SELECT imagen FROM firmas_usuario LIMIT 1')).rows[0].imagen;
    expect((await put('ti', '/firma', { imagen: png })).status).toBe(200);

    const ok = await post('ti', `/revisiones/${id}/aprobar`, { recibi: 'Recibí equipo de cómputo y accesos; cuenta restablecida.' });
    expect(ok.status).toBe(200);
    expect((await post('ti', `/revisiones/${id}/aprobar`, { recibi: 'otra vez' })).status).toBe(409);
    const d = await status('valentina');
    const ti = d.dependencias.find((x) => x.id === DEP.ti);
    expect(ti).toMatchObject({ estado: 'APROBADA', revisor: 'Andrés Felipe Valencia' });
    expect(ti.recibi).toMatch(/cuenta restablecida/);
    const notas = await get('valentina', '/notificaciones');
    expect(notas.body.data.some((n) => n.tipo === 'REVISION_APROBADA' && /Tecnologías/.test(n.titulo))).toBe(true);
  });

  it('bloquear exige categoría y motivo; el trabajador corrige y solicita de nuevo', async () => {
    const id = await idDe('almacen', DEP.almacen);
    expect((await post('almacen', `/revisiones/${id}/bloquear`, { categoria: 'FINANCIERO', motivo: '' })).status).toBe(400);
    expect((await post('almacen', `/revisiones/${id}/bloquear`, { categoria: 'OTRA', motivo: 'No devolvió las llaves' })).status).toBe(400);

    const bloqueo = await post('almacen', `/revisiones/${id}/bloquear`, { categoria: 'INVENTARIO_ELEMENTOS', motivo: 'No ha devuelto las llaves de la oficina' });
    expect(bloqueo.status).toBe(200);
    let d = await status('valentina');
    const almacen = d.dependencias.find((x) => x.id === DEP.almacen);
    expect(almacen).toMatchObject({ estado: 'BLOQUEADA', motivo: 'No ha devuelto las llaves de la oficina', puedeSolicitar: true });
    expect(d.estadoGlobal).toBe('EN_PROCESO');

    // ya bloqueada: el área no puede aprobarla hasta que el trabajador la envíe de nuevo
    expect((await post('almacen', `/revisiones/${id}/aprobar`, { recibi: 'Recibí' })).status).toBe(409);

    const reenvio = await post('valentina', `/tramites/${SOLICITUD.valentina}/dependencias/${DEP.almacen}/solicitar`);
    expect(reenvio.status).toBe(201);
    d = await status('valentina');
    expect(d.dependencias.find((x) => x.id === DEP.almacen)).toMatchObject({ estado: 'SOLICITADA', intentos: 2 });

    const ok = await post('almacen', `/revisiones/${id}/aprobar`, { recibi: 'Recibí las llaves y los elementos del inventario.' });
    expect(ok.status).toBe(200);
    d = await status('valentina');
    const final = d.dependencias.find((x) => x.id === DEP.almacen);
    expect(final.estado).toBe('APROBADA');
    expect(final.bloqueosResueltos).toHaveLength(1); // el bloqueo se resolvió solo al aprobar
    expect(final.bloqueosResueltos[0].observacion).toMatch(/Recibí las llaves/);
  });

  it('Desarrollo Profesoral exige los 3 entregables (RN-007) y solo con la solicitud en revisión', async () => {
    const id = await idDe('profesoral', DEP.profesoral);
    const sinMarcar = await post('profesoral', `/revisiones/${id}/aprobar`, { recibi: 'Todo entregado' });
    expect(sinMarcar.status).toBe(409);
    expect(sinMarcar.body.mensaje).toMatch(/RN-007/);

    const parcial = await put('profesoral', `/desarrollo-profesoral/docentes/${SOLICITUD.valentina}`, { planes_aula: true, innovaciones_educativas: true });
    expect(parcial.body.data).toMatchObject({ aprobado_total: false });
    expect((await post('profesoral', `/revisiones/${id}/aprobar`, { recibi: 'Casi' })).status).toBe(409);

    // otra persona no evalúa; tampoco un trámite sin solicitud en revisión
    expect((await put('almacen', `/desarrollo-profesoral/docentes/${SOLICITUD.valentina}`, { informes_ejecucion: true })).status).toBe(403);
    expect((await put('profesoral', `/desarrollo-profesoral/docentes/${SOLICITUD.laura}`, { informes_ejecucion: true })).status).toBe(409);

    const completo = await put('profesoral', `/desarrollo-profesoral/docentes/${SOLICITUD.valentina}`, { informes_ejecucion: true });
    expect(completo.body.data.aprobado_total).toBe(true);
    expect((await post('profesoral', `/revisiones/${id}/aprobar`, { recibi: 'Los tres entregables fueron recibidos a satisfacción.' })).status).toBe(200);
    // el docente consulta sus entregables y no los de otro
    expect((await get('valentina', `/desarrollo-profesoral/docentes/${SOLICITUD.valentina}`)).status).toBe(200);
    expect((await get('valentina', `/desarrollo-profesoral/docentes/${SOLICITUD.laura}`)).status).toBe(403);
  });

  it('las demás dependencias aprueban hasta dejar el trámite AL_DIA (RN-001)', async () => {
    const aprobaciones = [
      ['jefe', DEP.jefe, 'Recibí el informe, los archivos y los productos de la docente.'],
      ['medios', DEP.medios, 'Sin material bibliográfico pendiente.'],
      ['archivo', DEP.archivo, 'Revisé la entrega de expedientes; inventario documental conforme.'],
      ['financiera', DEP.financiera, 'Revisé contablemente: sin saldos por descontar.'],
      ['sst', DEP.sst, 'Examen de retiro realizado; certificado de horas validado en el enlace.'],
    ];
    for (const [who, dep, recibi] of aprobaciones) {
      const res = await get(who, '/revisiones?q=Valentina');
      const id = res.body.data.find((r) => r.dependenciaId === dep).id;
      expect((await post(who, `/revisiones/${id}/aprobar`, { recibi })).status).toBe(200);
    }
    const d = await status('valentina');
    expect(d).toMatchObject({ estadoGlobal: 'AL_DIA', areasLiberadas: 8, totalAreasRequeridas: 8, porcentajeCompletado: 100 });
    expect(d.puedeSolicitarAprobacionFinal).toBe(false);
    expect(d.faltantesAprobacionFinal).toEqual(['Aceptar la cláusula y firmar']);
  });
});

describe('Cláusula, firma del trabajador y aprobación final (RN-002, RN-005, RN-016)', () => {
  const tramite = `/tramites/${SOLICITUD.valentina}`;

  it('no puede pedir la aprobación final sin aceptar la cláusula y firmar', async () => {
    const res = await post('valentina', `${tramite}/solicitar-aprobacion-final`);
    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/RN-016/);
  });

  it('aceptar la cláusula exige tener la firma dibujada en el perfil', async () => {
    const png = (await db.query('SELECT imagen FROM firmas_usuario LIMIT 1')).rows[0].imagen;
    await db.query("DELETE FROM firmas_usuario WHERE usuario_id = '11111111-1111-4111-8111-ffffffffffff'");
    const sinFirma = await put('valentina', `${tramite}/cierre`, { aceptar_clausula: true });
    expect(sinFirma.status).toBe(409);
    expect(sinFirma.body.mensaje).toMatch(/firma/);

    // la firma se valida: debe ser un PNG real
    expect((await put('valentina', '/firma', { imagen: 'data:image/png;base64,AAAA' })).status).toBe(400);
    expect((await put('valentina', '/firma', { imagen: 'data:text/html;base64,PGI+' })).status).toBe(400);
    expect((await put('valentina', '/firma', { imagen: png })).status).toBe(200);
    expect((await get('valentina', '/firma')).body).toMatchObject({ tiene: true });

    const ok = await put('valentina', `${tramite}/cierre`, { aceptar_clausula: true, observaciones: 'Sin observaciones adicionales.' });
    expect(ok.status).toBe(200);
    const d = await status('valentina');
    expect(d.cierre).toMatchObject({ clausulaAceptada: true, firmado: true, observaciones: 'Sin observaciones adicionales.' });
    expect(d.puedeSolicitarAprobacionFinal).toBe(true);
  });

  it('se puede retirar la aceptación mientras no se haya pedido la aprobación final', async () => {
    await put('valentina', `${tramite}/cierre`, { aceptar_clausula: false });
    expect((await status('valentina')).cierre).toMatchObject({ clausulaAceptada: false, firmado: false });
    await put('valentina', `${tramite}/cierre`, { aceptar_clausula: true });
  });

  it('pide la aprobación final y se avisa a Comunidad Universitaria', async () => {
    const res = await post('valentina', `${tramite}/solicitar-aprobacion-final`);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('PENDIENTE_APROBACION');
    expect((await post('valentina', `${tramite}/solicitar-aprobacion-final`)).status).toBe(409);
    expect((await put('valentina', `${tramite}/cierre`, { observaciones: 'tarde' })).status).toBe(409);
    expect((await put('valentina', `${tramite}/informe-entrega-cargo`, { estado: 'BORRADOR', secciones: {} })).status).toBe(409);

    const notas = await get('aprobador', '/notificaciones');
    expect(notas.body.data.some((n) => n.tipo === 'SOLICITUD_APROBACION_FINAL')).toBe(true);
  });

  it('solo Comunidad Universitaria ve y resuelve las solicitudes finales (RN-002)', async () => {
    const lista = await get('aprobador', '/tramites/pendientes-aprobacion');
    expect(lista.body.data.map((s) => s.nombre)).toEqual(expect.arrayContaining(['Sofía Valentina Cárdenas Lozano', 'Valentina Isabel Narváez Mosquera']));
    for (const who of ['jefe', 'ti', 'valentina']) {
      expect((await get(who, '/tramites/pendientes-aprobacion')).status).toBe(403);
      expect((await post(who, `/tramites/${SOLICITUD.valentina}/aprobar`, { decision: 'APROBADO' })).status).toBe(403);
    }
  });

  it('la revisión final muestra la lista de verificación y el informe completo, sin editar', async () => {
    const res = await get('aprobador', `${tramite}/revision-final`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.trabajador).toMatchObject({ nombre: 'Valentina Isabel Narváez Mosquera', jefe: 'Martha Lucía Quintero' });
    expect(d.checklist).toHaveLength(8);
    expect(d.checklist.every((c) => c.estado === 'APROBADA' && c.recibi && c.firma?.startsWith('data:image/png;base64,'))).toBe(true);
    expect(d.checklist.find((c) => c.id === DEP.sst).enlace).toMatch(/^https:/);
    expect(d.informe.secciones.VIII_contacto.telefono).toBe('3101112233');
    expect(d.entregables.completo).toBe(true);
    expect(d.cierre).toMatchObject({ clausulaAceptada: true, observaciones: 'Sin observaciones adicionales.' });
    expect(d.cierre.firmaTrabajador).toMatch(/^data:image\/png/);
    expect((await get('aprobador', `/tramites/${SOLICITUD.laura}/revision-final`)).status).toBe(409); // aún no pidió la final
  });

  it('el rechazo exige motivos; el trabajador los ve y reinicia con sus datos copiados', async () => {
    expect((await post('aprobador', `/tramites/${SOLICITUD.sofia}/aprobar`, { decision: 'RECHAZADO' })).status).toBe(400);
    const rechazo = await post('aprobador', `/tramites/${SOLICITUD.sofia}/aprobar`, {
      decision: 'RECHAZADO', observacion: 'El informe no detalla los equipos entregados en la sección VI.',
    });
    expect(rechazo.status).toBe(200);

    let d = await status('sofia');
    expect(d).toMatchObject({ estadoGlobal: 'RECHAZADO', aprobacionFinal: 'RECHAZADO', puedeReiniciar: true });
    expect(d.observacionesAprobacion).toMatch(/sección VI/);
    const aviso = await get('sofia', '/notificaciones');
    expect(aviso.body.data.some((n) => n.tipo === 'TRAMITE_RECHAZADO' && /sección VI/.test(n.mensaje))).toBe(true);

    expect((await post('sofia', `/tramites/${SOLICITUD.sofia}/reiniciar`)).status).toBe(201);
    d = await status('sofia');
    expect(d).toMatchObject({ estadoGlobal: 'BORRADOR', editable: true, areasLiberadas: 0, datosCompletos: true });
    expect(d.datosGenerales).toMatchObject({ numero_documento: '1.061.700.103', cargo_desempenado: 'Contratista de Apoyo a la Gestión', jefe_inmediato_id: expect.any(String) });
    expect(d.informe.estado).toBe('BORRADOR');
    expect(d.solicitudAnterior).toMatchObject({ estado: 'RECHAZADO', observaciones: expect.stringMatching(/sección VI/) });
    expect(d.dependencias.find((x) => x.id === DEP.ti)).toMatchObject({ estado: 'SIN_SOLICITAR', puedeSolicitar: true });
    expect((await post('sofia', `/tramites/${SOLICITUD.sofia}/reiniciar`)).status).toBe(409);
  });

  it('la aprobación final emite el certificado con QR (RN-006) y firma del aprobador', async () => {
    await db.query("DELETE FROM firmas_usuario WHERE usuario_id = '11111111-1111-4111-8111-cccccccccccc'");
    const sinFirma = await post('aprobador', `${tramite}/aprobar`, { decision: 'APROBADO' });
    expect(sinFirma.status).toBe(409);
    const png = (await db.query('SELECT imagen FROM firmas_usuario LIMIT 1')).rows[0].imagen;
    await put('aprobador', '/firma', { imagen: png });

    const res = await post('aprobador', `${tramite}/aprobar`, { decision: 'APROBADO', observacion: 'Todo en orden.' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'APROBADO_FINAL' });
    const token = res.body.certificado.token_verificacion;
    expect(token).toHaveLength(64);

    const d = await status('valentina');
    expect(d).toMatchObject({ estadoGlobal: 'APROBADO_FINAL', puedeDescargarCertificado: true });
    expect((await post('aprobador', `${tramite}/aprobar`, { decision: 'APROBADO' })).status).toBe(409);

    const verificar = await request(app).get(`${API}/certificados/verificar/${token}`);
    expect(verificar.body.data).toMatchObject({ autentico: true, solicitante: 'Valentina Isabel Narváez Mosquera', periodo: '2026-2' });
    const pdf = await request(app).get(`${API}/certificados/${token}/pdf`).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect((await request(app).get(`${API}/certificados/verificar/corto`)).status).toBe(404);
  });
});

describe('Reglas protegidas por la base de datos', () => {
  it('RN-004: una revisión no la decide quien no es encargado de esa dependencia', async () => {
    await expect(db.query(
      `UPDATE revisiones_area SET estado = 'BLOQUEADA', revisor_id = '11111111-1111-4111-8111-666666666666', fecha_revision = NOW()
        WHERE solicitud_id = $1 AND dependencia_id = $2`, [SOLICITUD.carlos, DEP.archivo]
    )).rejects.toThrow(/RN-009|RN-004/);
  });

  it('RN-013: nadie revisa su propio trámite', async () => {
    await db.query(
      `INSERT INTO usuarios (nombres, apellidos, correo_institucional, tipo_vinculacion) VALUES ('Doble', 'Rol', 'doble.rol@uniautonoma.edu.co', 'Administrativo')`
    );
    await db.query(`INSERT INTO encargados_dependencia (usuario_id, dependencia_id) SELECT id, $1 FROM usuarios WHERE correo_institucional = 'doble.rol@uniautonoma.edu.co'`, [DEP.medios]);
    await db.query(
      `INSERT INTO solicitudes_paz_y_salvo (usuario_id, periodo_academico_id, nombre_completo, numero_documento, lugar_expedicion_documento, cargo_desempenado, tipo_novedad, fecha_retiro, jefe_inmediato_id)
       SELECT u.id, '77777777-7777-4777-8777-777777777777', 'Doble Rol', '99', 'Popayán', 'Auxiliar', 'RETIRO', '2026-12-01', '11111111-1111-4111-8111-444444444444'
         FROM usuarios u WHERE correo_institucional = 'doble.rol@uniautonoma.edu.co'`
    );
    await db.query(
      `INSERT INTO revisiones_area (solicitud_id, dependencia_id)
       SELECT s.id, $1 FROM solicitudes_paz_y_salvo s JOIN usuarios u ON u.id = s.usuario_id WHERE u.correo_institucional = 'doble.rol@uniautonoma.edu.co'`, [DEP.medios]
    );
    await expect(db.query(
      `UPDATE revisiones_area r SET estado = 'APROBADA', revisor_id = u.id, fecha_revision = NOW(), recibi = 'x', firma_snapshot = (SELECT imagen FROM firmas_usuario LIMIT 1)
         FROM usuarios u WHERE u.correo_institucional = 'doble.rol@uniautonoma.edu.co' AND r.dependencia_id = $1
          AND r.solicitud_id IN (SELECT id FROM solicitudes_paz_y_salvo WHERE usuario_id = u.id)`, [DEP.medios]
    )).rejects.toThrow(/RN-013/);
  });

  it('el estado del trámite no se salta pasos', async () => {
    await expect(db.query("UPDATE solicitudes_paz_y_salvo SET estado_global = 'PENDIENTE_APROBACION' WHERE id = $1", [SOLICITUD.laura]))
      .rejects.toThrow(/RN-001/);
    await expect(db.query("UPDATE solicitudes_paz_y_salvo SET estado_global = 'EN_PROCESO' WHERE id = $1", [SOLICITUD.mateo]))
      .rejects.toThrow(/cerrado/);
    await expect(db.query(
      `INSERT INTO solicitudes_paz_y_salvo (usuario_id, periodo_academico_id, estado_global)
       VALUES ('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777', 'AL_DIA')`
    )).rejects.toThrow(/BORRADOR/);
  });

  it('un trámite vigente por persona y periodo, con historial de rechazos', async () => {
    await expect(db.query(
      `INSERT INTO solicitudes_paz_y_salvo (usuario_id, periodo_academico_id) VALUES ('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777')`
    )).rejects.toThrow(/uq_solicitud_vigente|duplicate/);
  });

  it('la auditoría registra quién y por qué, sin firmas ni contraseñas', async () => {
    const { rows } = await db.query(
      `SELECT usuario_id, motivo, datos_nuevos FROM auditoria
        WHERE tabla = 'revisiones_area' AND motivo = 'Aprobar paz y salvo de dependencia' ORDER BY id DESC LIMIT 1`
    );
    expect(rows[0].usuario_id).toBeTruthy();
    expect(rows[0].datos_nuevos.estado).toBe('APROBADA');
    expect(rows[0].datos_nuevos.firma_snapshot).toBeUndefined();
    const firmas = await db.query("SELECT datos_nuevos FROM auditoria WHERE tabla = 'firmas_usuario' AND accion = 'INSERT' LIMIT 1");
    expect(firmas.rows[0].datos_nuevos.imagen).toBeUndefined();
  });
});

describe('Habilitación del trámite (RF-009)', () => {
  const email = 'ana.torres@uniautonoma.edu.co';

  beforeAll(async () => {
    await db.query(
      `INSERT INTO usuarios (nombres, apellidos, numero_documento, correo_institucional, tipo_vinculacion, cargo, password_hash)
       SELECT 'Ana', 'Torres', '1.061.700.200', $1, 'Administrativo', 'Secretaria Ejecutiva', password_hash
         FROM usuarios WHERE correo_institucional = 'laura.ortiz@uniautonoma.edu.co'`, [email]
    );
    await db.query(
      `INSERT INTO usuario_roles (usuario_id, rol_id)
       SELECT u.id, r.id FROM usuarios u, roles r WHERE u.correo_institucional = $1 AND r.nombre_rol = 'Administrativo'`, [email]
    );
  });

  it('sin trámite, mi-estado indica que no está habilitado', async () => {
    expect((await status(email))).toMatchObject({ habilitado: false, estadoGlobal: 'NO_INICIADO' });
  });

  it('crea el borrador con los datos del perfil y es idempotente', async () => {
    const first = await post(email, '/tramites/habilitar', { tipo_novedad: 'CAMBIO_DEPENDENCIA' });
    expect(first.status).toBe(201);
    expect(first.body.solicitud).toMatchObject({ estado_global: 'BORRADOR', tipo_novedad: 'CAMBIO_DEPENDENCIA', cargo_desempenado: 'Secretaria Ejecutiva' });
    const d = await status(email);
    expect(d.datosGenerales).toMatchObject({ nombre_completo: 'Ana Torres', numero_documento: '1.061.700.200' });
    expect(d.datosFaltantes).toEqual(['Lugar de expedición']);
    expect((await post(email, '/tramites/habilitar', {})).body.mensaje).toMatch(/ya se encuentra activo/);
    expect((await post('ti', '/tramites/habilitar', {})).status).toBe(403);
  });
});

describe('Catálogos y administración (RN-011)', () => {
  it('lista las 9 dependencias con los nombres originales y el enlace de SST', async () => {
    const res = await get('laura', '/dependencias');
    expect(res.body.data.map((d) => d.nombre)).toEqual([
      'Jefe Inmediato',
      'Tecnologías de la información y transformación digital',
      'Medios Educativos (Vicerrectoría Académica)',
      'Almacén',
      'Archivo y Correspondencia',
      'División Contable Y Financiera',
      'Seguridad y Salud en el Trabajo',
      'Centro de Desarrollo Profesoral',
      'División De Comunidad Universitaria',
    ]);
    const sst = res.body.data.find((d) => d.nombre === 'Seguridad y Salud en el Trabajo');
    expect(sst).toMatchObject({ requiere_enlace: true, aplica_cambio_dependencia: false, aspecto: expect.stringMatching(/exámenes médicos por retiro/) });
    expect(res.body.data.find((d) => d.nombre === 'Almacén').aspecto).toBe('Recibí los elementos asignados por inventario');
  });

  it('el catálogo de usuarios y su búsqueda', async () => {
    const found = await get('ti', '/usuarios?q=1.061.700.103');
    expect(found.body.data).toHaveLength(1);
    expect(found.body.data[0].correo_institucional).toBe(EMAIL.sofia);
    expect((await get('laura', '/usuarios')).status).toBe(403);
  });

  it('el Administrador DTI solo modifica el nombre del cargo', async () => {
    const id = '11111111-1111-4111-8111-222222222222';
    const res = await put('admin', `/usuarios/${id}`, { cargo_desempenado: 'Auxiliar Administrativo Senior', nombres: 'Otro' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ cargo_desempenado: 'Auxiliar Administrativo Senior', nombres: 'Carlos Andrés' });
    expect((await put('admin', `/usuarios/${id}`, {})).status).toBe(400);
    expect((await put('ti', `/usuarios/${id}`, { cargo: 'X' })).status).toBe(403);
  });

  it('el catálogo de cargos se lista para todos y solo el Admin DTI lo renombra', async () => {
    const list = await get('laura', '/cargos');
    expect(list.body.data).toHaveLength(17);
    const { id } = list.body.data.find((c) => c.nombre === 'Auxiliar Contable');
    expect((await put('ti', `/cargos/${id}`, { nombre: 'X' })).status).toBe(403);
    const renamed = await put('admin', `/cargos/${id}`, { nombre: 'Auxiliar Contable I' });
    expect(renamed.body.data.nombre).toBe('Auxiliar Contable I');
  });
});

describe('Administración DTI: solicitantes y personal de las dependencias (RN-011, RN-012)', () => {
  let autoregistrado;
  const ADMIN_ID = '11111111-1111-4111-8111-dddddddddddd';
  const del = async (who, url) => request(app).delete(`${API}${url}`).set(await as(who));
  const idDe = async (correo) => (await db.query('SELECT id FROM usuarios WHERE correo_institucional = $1', [correo])).rows[0].id;

  beforeAll(async () => {
    const { rows } = await db.query(
      `INSERT INTO usuarios (nombres, apellidos, correo_institucional, origen, verificado, google_sub)
       VALUES ('Duvan', 'Jaramillo', 'duvan.test@uniautonoma.edu.co', 'AUTOREGISTRO', FALSE, 'google-sub-duvan') RETURNING id`
    );
    autoregistrado = rows[0].id;
  });

  it('solo el Administrador DTI entra al panel', async () => {
    for (const who of ['laura', 'ti', 'jefe', 'aprobador']) {
      expect((await get(who, '/admin/solicitantes')).status).toBe(403);
      expect((await get(who, '/admin/personal')).status).toBe(403);
    }
  });

  it('lista a los solicitantes por separado del personal y cuenta los pendientes', async () => {
    const res = await get('admin', '/admin/solicitantes?filtro=pendientes');
    expect(res.status).toBe(200);
    expect(res.body.data.map((u) => u.correo_institucional)).toEqual(['duvan.test@uniautonoma.edu.co']);
    expect(res.body.conteos.pendientes).toBe(1);

    const todos = (await get('admin', '/admin/solicitantes?filtro=todos&limit=100')).body.data.map((u) => u.correo_institucional);
    expect(todos).toEqual(expect.arrayContaining([EMAIL.laura, EMAIL.carlos, EMAIL.sofia]));
    expect(todos).not.toContain(EMAIL.ti);
    expect(todos).not.toContain(EMAIL.admin);
  });

  it('lista al personal con su dependencia', async () => {
    const res = await get('admin', '/admin/personal?limit=100');
    expect(res.status).toBe(200);
    const ti = res.body.data.find((u) => u.correo_institucional === EMAIL.ti);
    expect(ti.dependencias.map((d) => d.nombre)).toEqual(['Tecnologías de la información y transformación digital']);
    expect(ti.roles).toEqual(['Encargado de Área']);
    expect(res.body.data.some((u) => u.correo_institucional === EMAIL.laura)).toBe(false);
    expect(res.body.dependencias).toHaveLength(9);
  });

  it('confirma la vinculación y la persona recibe un aviso', async () => {
    expect((await put('admin', `/admin/usuarios/${autoregistrado}/verificacion`, { decision: 'TAL VEZ' })).status).toBe(400);
    const ok = await put('admin', `/admin/usuarios/${autoregistrado}/verificacion`, { decision: 'CONFIRMAR' });
    expect(ok.status).toBe(200);
    const fila = (await db.query('SELECT verificado, verificado_por FROM usuarios WHERE id = $1', [autoregistrado])).rows[0];
    expect(fila.verificado).toBe(true);
    expect(fila.verificado_por).toBe(ADMIN_ID);
    expect((await db.query("SELECT 1 FROM notificaciones WHERE usuario_id = $1 AND tipo = 'VINCULACION_VERIFICADA'", [autoregistrado])).rows).toHaveLength(1);
    expect((await put('admin', `/admin/usuarios/${autoregistrado}/verificacion`, { decision: 'CONFIRMAR' })).status).toBe(409);
  });

  it('rechaza un autoregistro dejándolo inactivo y se puede reactivar', async () => {
    const { rows } = await db.query(
      `INSERT INTO usuarios (nombres, apellidos, correo_institucional, origen, verificado)
       VALUES ('Intruso', 'Prueba', 'intruso@uniautonoma.edu.co', 'AUTOREGISTRO', FALSE) RETURNING id`
    );
    const id = rows[0].id;
    expect((await put('admin', `/admin/usuarios/${id}/verificacion`, { decision: 'RECHAZAR' })).status).toBe(200);
    expect((await db.query('SELECT estado FROM usuarios WHERE id = $1', [id])).rows[0].estado).toBe('INACTIVO');
    expect((await get('admin', '/admin/solicitantes?filtro=inactivos')).body.data.map((u) => u.id)).toContain(id);
    expect((await put('admin', `/admin/usuarios/${id}/estado`, { estado: 'ACTIVO' })).status).toBe(200);
  });

  it('corrige nombre y correo; el correo debe ser institucional y no repetirse', async () => {
    const base = { nombres: 'Duvan Felipe', apellidos: 'David Jaramillo', cargo: 'Estudiante' };
    expect((await put('admin', `/admin/usuarios/${autoregistrado}`, { ...base, correo_institucional: 'x@gmail.com' })).status).toBe(400);
    expect((await put('admin', `/admin/usuarios/${autoregistrado}`, { ...base, correo_institucional: EMAIL.laura })).status).toBe(409);
    expect((await put('admin', `/admin/usuarios/${autoregistrado}`, { ...base, nombres: '', correo_institucional: 'duvan.test@uniautonoma.edu.co' })).status).toBe(400);

    const ok = await put('admin', `/admin/usuarios/${autoregistrado}`, { ...base, correo_institucional: 'Duvan.David.J@uniautonoma.edu.co' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ nombres: 'Duvan Felipe', correo_institucional: 'duvan.david.j@uniautonoma.edu.co' });
    // al cambiar el correo se suelta la cuenta de Google enlazada al correo anterior
    expect((await db.query('SELECT google_sub FROM usuarios WHERE id = $1', [autoregistrado])).rows[0].google_sub).toBeNull();
  });

  it('no modifica cuentas de administración ni desactiva la propia (RN-011)', async () => {
    const datos = { nombres: 'Otro', apellidos: 'Nombre', correo_institucional: EMAIL.admin };
    expect((await put('admin', `/admin/usuarios/${ADMIN_ID}`, datos)).status).toBe(403);
    expect((await put('admin', `/admin/usuarios/${ADMIN_ID}/estado`, { estado: 'INACTIVO' })).status).toBe(409);
  });

  it('registra personal nuevo con su dependencia y promueve a quien ya ingresó por Google', async () => {
    const datos = { nombres: 'Rosa Elena', apellidos: 'Cerón Ruiz', correo_institucional: 'rosa.ceron@uniautonoma.edu.co', cargo: 'Auxiliar de Almacén', dependencia_id: DEP.almacen };
    expect((await post('admin', '/admin/personal', { ...datos, dependencia_id: undefined })).status).toBe(400);
    const res = await post('admin', '/admin/personal', datos);
    expect(res.status).toBe(201);
    const fila = (await db.query(
      `SELECT u.verificado, u.origen, r.nombre_rol, ed.dependencia_id
         FROM usuarios u JOIN usuario_roles ur ON ur.usuario_id = u.id JOIN roles r ON r.id = ur.rol_id
         JOIN encargados_dependencia ed ON ed.usuario_id = u.id WHERE u.id = $1`, [res.body.id]
    )).rows[0];
    expect(fila).toMatchObject({ verificado: true, origen: 'REGISTRADO_TI', nombre_rol: 'Encargado de Área', dependencia_id: DEP.almacen });
    expect((await post('admin', '/admin/personal', datos)).status).toBe(409); // ya es personal

    const promovido = await post('admin', '/admin/personal', {
      nombres: 'Duvan Felipe', apellidos: 'David Jaramillo', correo_institucional: 'duvan.david.j@uniautonoma.edu.co', dependencia_id: DEP.jefe,
    });
    expect(promovido.status).toBe(201);
    expect(promovido.body.id).toBe(autoregistrado);
    expect((await db.query(
      'SELECT r.nombre_rol FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id WHERE ur.usuario_id = $1', [autoregistrado]
    )).rows.map((r) => r.nombre_rol)).toEqual(['Jefe Inmediato']);
  });

  it('cambia la dependencia del personal y ajusta su rol', async () => {
    const rosa = await idDe('rosa.ceron@uniautonoma.edu.co');
    expect((await put('admin', `/admin/personal/${rosa}/dependencia`, { dependencia_id: DEP.archivo })).status).toBe(200);
    const lista = (await get('admin', '/admin/personal?q=rosa')).body.data[0];
    expect(lista.dependencias.map((d) => d.id)).toEqual([DEP.archivo]);
    expect(lista.roles).toEqual(['Encargado de Área']);
    expect((await put('admin', `/admin/personal/${rosa}/dependencia`, { dependencia_id: '6513e4af-9d27-4d7e-9eb4-aaaaaaaaaaaa' })).status).toBe(404);
    expect((await put('admin', `/admin/personal/${await idDe(EMAIL.laura)}/dependencia`, { dependencia_id: DEP.archivo })).status).toBe(409); // Laura es solicitante

    await put('admin', `/admin/personal/${rosa}/dependencia`, { dependencia_id: DEP.jefe });
    expect((await get('admin', '/admin/personal?q=rosa')).body.data[0].roles).toEqual(['Jefe Inmediato']);
  });

  it('no deja a un jefe elegido en un trámite abierto fuera de su dependencia', async () => {
    const rosa = await idDe('rosa.ceron@uniautonoma.edu.co');
    const jefeOriginal = (await db.query('SELECT jefe_inmediato_id FROM solicitudes_paz_y_salvo WHERE id = $1', [SOLICITUD.carlos])).rows[0].jefe_inmediato_id;
    // los datos del trámite están protegidos por trigger: se asigna el jefe saltándolo solo para preparar la prueba
    await db.query('ALTER TABLE solicitudes_paz_y_salvo DISABLE TRIGGER USER');
    await db.query('UPDATE solicitudes_paz_y_salvo SET jefe_inmediato_id = $1 WHERE id = $2', [rosa, SOLICITUD.carlos]);
    await db.query('ALTER TABLE solicitudes_paz_y_salvo ENABLE TRIGGER USER');
    const abierto = (await db.query('SELECT estado_global FROM solicitudes_paz_y_salvo WHERE id = $1', [SOLICITUD.carlos])).rows[0].estado_global;
    expect(['EN_PROCESO', 'AL_DIA', 'PENDIENTE_APROBACION']).toContain(abierto);

    const res = await put('admin', `/admin/personal/${rosa}/dependencia`, { dependencia_id: DEP.medios });
    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/jefe inmediato/);
    expect((await del('admin', `/admin/personal/${rosa}`)).status).toBe(409);

    await db.query('ALTER TABLE solicitudes_paz_y_salvo DISABLE TRIGGER USER');
    await db.query('UPDATE solicitudes_paz_y_salvo SET jefe_inmediato_id = $1 WHERE id = $2', [jefeOriginal, SOLICITUD.carlos]);
    await db.query('ALTER TABLE solicitudes_paz_y_salvo ENABLE TRIGGER USER');
  });

  it('retira a una persona del personal y vuelve a ser una cuenta sin rol', async () => {
    const rosa = await idDe('rosa.ceron@uniautonoma.edu.co');
    expect((await del('admin', `/admin/personal/${rosa}`)).status).toBe(200);
    expect(Number((await db.query('SELECT COUNT(*) AS n FROM usuario_roles WHERE usuario_id = $1', [rosa])).rows[0].n)).toBe(0);
    expect(Number((await db.query('SELECT COUNT(*) AS n FROM encargados_dependencia WHERE usuario_id = $1', [rosa])).rows[0].n)).toBe(0);
    expect((await del('admin', `/admin/personal/${rosa}`)).status).toBe(409);
  });
});
