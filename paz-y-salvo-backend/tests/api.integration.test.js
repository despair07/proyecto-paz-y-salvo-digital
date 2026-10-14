// ============================================================================
// PRUEBAS DE INTEGRACIÓN — API + SQL reales (PGlite con ddl.sql y los seeds)
// Cubren los flujos del sistema y las reglas de negocio RN-001 … RN-011.
// ============================================================================

process.env.JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-bytes-long';
process.env.FRONTEND_PUBLIC_URL = 'http://localhost:5173';

jest.mock('../src/config/database', () => require('./helpers/pgliteDatabase'));

const request = require('supertest');
const db = require('../src/config/database');
const app = require('../src/app');

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
  dti: '6513e4af-9d27-4d7e-9eb4-222222222222',
  medios: '6513e4af-9d27-4d7e-9eb4-333333333333',
  almacen: '6513e4af-9d27-4d7e-9eb4-444444444444',
  archivo: '6513e4af-9d27-4d7e-9eb4-555555555555',
  financiera: '6513e4af-9d27-4d7e-9eb4-666666666666',
  sst: '6513e4af-9d27-4d7e-9eb4-777777777777',
  profesoral: '6513e4af-9d27-4d7e-9eb4-888888888888',
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
const as = async (email) => ({ Authorization: `Bearer ${await login(email)}` });

const EMAIL = {
  laura: 'laura.ortiz@uniautonoma.edu.co',
  carlos: 'carlos.munoz@uniautonoma.edu.co',
  sofia: 'sofia.cardenas@uniautonoma.edu.co',
  mateo: 'mateo.gomez@uniautonoma.edu.co',
  valentina: 'valentina.narvaez@uniautonoma.edu.co',
  jefe: 'jefe.inmediato@uniautonoma.edu.co',
  dti: 'encargado.dti@uniautonoma.edu.co',
  almacen: 'encargado.almacen@uniautonoma.edu.co',
  profesoral: 'encargado.profesoral@uniautonoma.edu.co',
  aprobador: 'aprobador.comunidad@uniautonoma.edu.co',
  admin: 'admin.dti@uniautonoma.edu.co',
};

const status = async (who) => (await request(app).get(`${API}/paz-y-salvo/mi-estado`).set(await as(EMAIL[who]))).body.data;

beforeAll(() => db.init(), 60000);
afterAll(() => db.close());

describe('Autenticación (RF-001)', () => {
  it('inicia sesión con correo y contraseña y devuelve el perfil con roles', async () => {
    const res = await request(app).post(`${API}/auth/login`).send({ email: EMAIL.laura, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario).toMatchObject({
      correo_institucional: EMAIL.laura,
      roles: ['Docente'],
      cargo: 'Docente de Planta',
    });
    expect(res.body.usuario.password_hash).toBeUndefined();
  });

  it('rechaza una contraseña incorrecta y un correo inexistente con el mismo mensaje', async () => {
    const wrong = await request(app).post(`${API}/auth/login`).send({ email: EMAIL.laura, password: 'mala' });
    const unknown = await request(app).post(`${API}/auth/login`).send({ email: 'nadie@uniautonoma.edu.co', password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body.mensaje).toBe(wrong.body.mensaje);
  });

  it('restringe el acceso a correos institucionales', async () => {
    const res = await request(app).post(`${API}/auth/login`).send({ email: 'x@gmail.com', password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('ya no expone la ruta de login de demostración', async () => {
    const res = await request(app).post(`${API}/auth/demo-login`).send({ email: EMAIL.laura, password: PASSWORD });
    expect(res.status).toBe(404);
  });

  it('devuelve el perfil con /auth/me y exige token', async () => {
    const me = await request(app).get(`${API}/auth/me`).set(await as(EMAIL.dti));
    expect(me.status).toBe(200);
    expect(me.body.usuario).toMatchObject({ roles: ['Encargado de Área'], dependencia_id: DEP.dti });
    expect((await request(app).get(`${API}/auth/me`)).status).toBe(401);
  });
});

describe('Estado del trabajador (RF-004, RN-001, RN-007)', () => {
  it('Laura está EN_PROCESO con 3 bloqueos y 5/8 áreas liberadas', async () => {
    const data = await status('laura');
    expect(data).toMatchObject({
      habilitado: true,
      estadoGlobal: 'EN_PROCESO',
      etapaActual: 'AREAS_GESTION',
      areasLiberadas: 5,
      totalAreasRequeridas: 8,
      puedeDescargarCertificado: false,
    });
    const bloqueadas = data.dependencias.filter((d) => d.estado === 'BLOQUEADO').map((d) => d.nombre);
    expect(bloqueadas).toEqual(expect.arrayContaining(['Medios Educativos', 'División Contable y Financiera', 'Centro de Desarrollo Profesoral']));
    const profesoral = data.dependencias.find((d) => d.nombre === 'Centro de Desarrollo Profesoral');
    expect(profesoral.entregablesProfesorales).toMatchObject({ planes_aula: true, informes_ejecucion: false });
  });

  it('Sofía (contratista) está AL_DIA y Desarrollo Profesoral no le aplica (RN-007)', async () => {
    const data = await status('sofia');
    expect(data.estadoGlobal).toBe('AL_DIA');
    expect(data.totalAreasRequeridas).toBe(7);
    expect(data.porcentajeCompletado).toBe(100);
    expect(data.dependencias.find((d) => d.nombre === 'Centro de Desarrollo Profesoral').estado).toBe('NO_APLICA');
  });

  it('Mateo tiene el trámite aprobado y su certificado disponible', async () => {
    const data = await status('mateo');
    expect(data).toMatchObject({ estadoGlobal: 'APROBADO_FINAL', puedeDescargarCertificado: true });
    expect(data.certificado.token_verificacion).toHaveLength(64);
  });
});

describe('Bloqueos (RN-003, RN-004, RN-009, RN-011)', () => {
  let lockId;

  it('un encargado solo ve los bloqueos de su dependencia (RN-004)', async () => {
    const res = await request(app).get(`${API}/bloqueos`).set(await as(EMAIL.almacen));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((b) => b.dependencia_id === DEP.almacen)).toBe(true);
  });

  it('un trabajador solo ve sus propios bloqueos', async () => {
    const res = await request(app).get(`${API}/bloqueos`).set(await as(EMAIL.laura));
    expect(res.body.data.length).toBe(3);
    expect(res.body.data.every((b) => b.correo_institucional === EMAIL.laura)).toBe(true);
  });

  it('exige motivo (RN-009) y categoría válida (RN-003)', async () => {
    const headers = await as(EMAIL.almacen);
    const sinMotivo = await request(app).post(`${API}/bloqueos`).set(headers)
      .send({ solicitudId: SOLICITUD.sofia, dependenciaId: DEP.almacen, categoria: 'FINANCIERO', motivo: '  ' });
    expect(sinMotivo.status).toBe(400);
    const categoria = await request(app).post(`${API}/bloqueos`).set(headers)
      .send({ solicitudId: SOLICITUD.sofia, dependenciaId: DEP.almacen, categoria: 'OTRA', motivo: 'x' });
    expect(categoria.status).toBe(400);
  });

  it('un encargado no puede bloquear en otra dependencia (RN-004)', async () => {
    const res = await request(app).post(`${API}/bloqueos`).set(await as(EMAIL.dti))
      .send({ solicitudId: SOLICITUD.sofia, dependenciaId: DEP.almacen, categoria: 'INVENTARIO_ELEMENTOS', motivo: 'Intento ajeno' });
    expect(res.status).toBe(403);
  });

  it('el Administrador DTI no registra bloqueos (RN-011)', async () => {
    const res = await request(app).post(`${API}/bloqueos`).set(await as(EMAIL.admin))
      .send({ solicitudId: SOLICITUD.sofia, dependenciaId: DEP.almacen, categoria: 'INVENTARIO_ELEMENTOS', motivo: 'No permitido' });
    expect(res.status).toBe(403);
  });

  it('registrar un bloqueo deja al trabajador EN_PROCESO y levantarlo lo regresa a AL_DIA (RN-001)', async () => {
    const headers = await as(EMAIL.almacen);
    const created = await request(app).post(`${API}/bloqueos`).set(headers).send({
      solicitudId: SOLICITUD.sofia, dependenciaId: DEP.almacen,
      categoria: 'INVENTARIO_ELEMENTOS', motivo: 'Llaves de oficina sin devolver',
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ estado: 'BLOQUEADO', motivo: 'Llaves de oficina sin devolver' });
    lockId = created.body.data.id;
    expect((await status('sofia')).estadoGlobal).toBe('EN_PROCESO');

    const duplicate = await request(app).post(`${API}/bloqueos`).set(headers).send({
      solicitudId: SOLICITUD.sofia, dependenciaId: DEP.almacen,
      categoria: 'INVENTARIO_ELEMENTOS', motivo: 'Otro',
    });
    expect(duplicate.status).toBe(409);

    const resolved = await request(app).put(`${API}/bloqueos/${lockId}`).set(headers)
      .send({ estado: 'RESUELTO', observacion: 'Llaves entregadas' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data).toMatchObject({ estado: 'RESUELTO', observacion: 'Llaves entregadas' });
    expect((await status('sofia')).estadoGlobal).toBe('AL_DIA');

    const again = await request(app).put(`${API}/bloqueos/${lockId}`).set(headers).send({ estado: 'RESUELTO' });
    expect(again.status).toBe(409);
  });

  it('solo se anulan bloqueos activos', async () => {
    const res = await request(app).delete(`${API}/bloqueos/${lockId}`).set(await as(EMAIL.almacen));
    expect(res.status).toBe(409);
  });

  it('un trámite cerrado no admite bloqueos nuevos', async () => {
    const res = await request(app).post(`${API}/bloqueos`).set(await as(EMAIL.almacen)).send({
      solicitudId: SOLICITUD.mateo, dependenciaId: DEP.almacen, categoria: 'INVENTARIO_ELEMENTOS', motivo: 'Tarde',
    });
    expect(res.status).toBe(409);
  });

  it('la auditoría registra quién y por qué', async () => {
    const { rows } = await db.query(
      `SELECT usuario_id, motivo FROM auditoria
        WHERE tabla = 'bloqueos_dependencia' AND motivo = 'Registrar bloqueo' LIMIT 1`
    );
    expect(rows[0].usuario_id).toBe('11111111-1111-4111-8111-777777777777');
  });
});

describe('Desarrollo profesoral (RN-007, RF-008)', () => {
  it('solo el encargado del Centro de Desarrollo Profesoral evalúa', async () => {
    const res = await request(app).put(`${API}/desarrollo-profesoral/docentes/${SOLICITUD.laura}`)
      .set(await as(EMAIL.almacen)).send({ informes_ejecucion: true });
    expect(res.status).toBe(403);
  });

  it('no aplica a personal que no es docente', async () => {
    const res = await request(app).put(`${API}/desarrollo-profesoral/docentes/${SOLICITUD.carlos}`)
      .set(await as(EMAIL.profesoral)).send({ planes_aula: true });
    expect(res.status).toBe(409);
  });

  it('con los 3 entregables aprobados se levanta el bloqueo de Desarrollo Profesoral', async () => {
    const headers = await as(EMAIL.profesoral);
    const res = await request(app).put(`${API}/desarrollo-profesoral/docentes/${SOLICITUD.laura}`).set(headers)
      .send({ planes_aula: true, innovaciones_educativas: true, informes_ejecucion: true, observaciones: 'Todo entregado' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ aprobado_total: true });

    const data = await status('laura');
    expect(data.dependencias.find((d) => d.nombre === 'Centro de Desarrollo Profesoral').estado).toBe('AL_DIA');
    expect(data.areasLiberadas).toBe(6);
    expect(data.estadoGlobal).toBe('EN_PROCESO'); // aún tiene Medios y Financiera
  });

  it('si se retira una aprobación se vuelve a bloquear el área', async () => {
    const headers = await as(EMAIL.profesoral);
    await request(app).put(`${API}/desarrollo-profesoral/docentes/${SOLICITUD.laura}`).set(headers)
      .send({ informes_ejecucion: false });
    const data = await status('laura');
    expect(data.dependencias.find((d) => d.nombre === 'Centro de Desarrollo Profesoral').estado).toBe('BLOQUEADO');
  });

  it('el docente consulta sus entregables y no los de otro', async () => {
    const own = await request(app).get(`${API}/desarrollo-profesoral/docentes/${SOLICITUD.laura}`).set(await as(EMAIL.laura));
    expect(own.status).toBe(200);
    const other = await request(app).get(`${API}/desarrollo-profesoral/docentes/${SOLICITUD.valentina}`).set(await as(EMAIL.laura));
    expect(other.status).toBe(403);
  });
});

describe('Informe de entrega de cargo y etapas (RF-010, RN-008)', () => {
  it('Valentina está en la etapa del Jefe Inmediato con el informe en borrador', async () => {
    const data = await status('valentina');
    expect(data).toMatchObject({ etapaActual: 'JEFE_INMEDIATO', informeEntregaCargo: false });
    const informe = await request(app).get(`${API}/tramites/${SOLICITUD.valentina}/informe-entrega-cargo`).set(await as(EMAIL.valentina));
    expect(informe.body.data.estado).toBe('BORRADOR');
    expect(informe.body.data.secciones.I_datos_generales.completado).toBe(true);
  });

  it('solo el dueño diligencia el informe', async () => {
    const res = await request(app).put(`${API}/tramites/${SOLICITUD.valentina}/informe-entrega-cargo`)
      .set(await as(EMAIL.laura)).send({ estado: 'COMPLETO', secciones: {} });
    expect(res.status).toBe(403);
  });

  it('al completar el informe el trámite pasa a la etapa de áreas', async () => {
    const res = await request(app).put(`${API}/tramites/${SOLICITUD.valentina}/informe-entrega-cargo`)
      .set(await as(EMAIL.valentina))
      .send({ estado: 'COMPLETO', secciones: { I_datos_generales: { completado: true } } });
    expect(res.status).toBe(200);
    const data = await status('valentina');
    expect(data).toMatchObject({ informeEntregaCargo: true, etapaActual: 'AREAS_GESTION' });
  });

  it('rechaza estados inválidos', async () => {
    const res = await request(app).put(`${API}/tramites/${SOLICITUD.valentina}/informe-entrega-cargo`)
      .set(await as(EMAIL.valentina)).send({ estado: 'TERMINADO' });
    expect(res.status).toBe(400);
  });
});

describe('Aprobación final y certificado (RN-002, RN-005, RN-006, RN-010)', () => {
  let token;

  it('lista los trámites listos para aprobar (sin bloqueos e informe completo)', async () => {
    const res = await request(app).get(`${API}/tramites/pendientes-aprobacion`).set(await as(EMAIL.aprobador));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((s) => s.solicitudId);
    expect(ids).toContain(SOLICITUD.sofia);
    expect(ids).not.toContain(SOLICITUD.laura);
    const sofia = res.body.data.find((s) => s.solicitudId === SOLICITUD.sofia);
    expect(sofia.areasVerificadas).toHaveLength(7);
  });

  it('solo Comunidad Universitaria aprueba (RN-002)', async () => {
    for (const who of ['admin', 'jefe', 'sofia']) {
      const res = await request(app).post(`${API}/tramites/${SOLICITUD.sofia}/aprobar`)
        .set(await as(EMAIL[who])).send({ decision: 'APROBADO' });
      expect(res.status).toBe(403);
    }
  });

  it('no aprueba con bloqueos activos (RN-005)', async () => {
    const res = await request(app).post(`${API}/tramites/${SOLICITUD.laura}/aprobar`)
      .set(await as(EMAIL.aprobador)).send({ decision: 'APROBADO' });
    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/RN-005/);
  });

  it('un rechazo exige observación y cierra el trámite', async () => {
    const headers = await as(EMAIL.aprobador);
    const sinObs = await request(app).post(`${API}/tramites/${SOLICITUD.valentina}/aprobar`).set(headers).send({ decision: 'RECHAZADO' });
    expect(sinObs.status).toBe(400);
    const res = await request(app).post(`${API}/tramites/${SOLICITUD.valentina}/aprobar`).set(headers)
      .send({ decision: 'RECHAZADO', observacion: 'Informe incompleto' });
    expect(res.status).toBe(200);
    const data = await status('valentina');
    expect(data).toMatchObject({ estadoGlobal: 'RECHAZADO', aprobacionFinal: 'RECHAZADO', etapaActual: 'FINALIZADO' });
  });

  it('aprueba a Sofía y emite el certificado con QR (RN-006)', async () => {
    const res = await request(app).post(`${API}/tramites/${SOLICITUD.sofia}/aprobar`)
      .set(await as(EMAIL.aprobador)).send({ decision: 'APROBADO', observacion: 'Todo en orden' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'APROBADO_FINAL' });
    token = res.body.certificado.token_verificacion;
    expect(token).toHaveLength(64);

    const data = await status('sofia');
    expect(data).toMatchObject({ estadoGlobal: 'APROBADO_FINAL', puedeDescargarCertificado: true });

    const again = await request(app).post(`${API}/tramites/${SOLICITUD.sofia}/aprobar`)
      .set(await as(EMAIL.aprobador)).send({ decision: 'APROBADO' });
    expect(again.status).toBe(409);
  });

  it('la verificación pública por QR no requiere sesión', async () => {
    const res = await request(app).get(`${API}/certificados/verificar/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      autentico: true,
      solicitante: 'Sofía Valentina Cárdenas Lozano',
      periodo: '2026-2',
    });
    expect((await request(app).get(`${API}/certificados/verificar/${'a'.repeat(64)}`)).status).toBe(404);
    expect((await request(app).get(`${API}/certificados/verificar/corto`)).status).toBe(404);
  });

  it('descarga el certificado en PDF', async () => {
    const res = await request(app).get(`${API}/certificados/${token}/pdf`).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('Habilitación del trámite (RF-009)', () => {
  const email = 'ana.torres@uniautonoma.edu.co';

  beforeAll(async () => {
    await db.query(
      `INSERT INTO usuarios (nombres, apellidos, numero_documento, correo_institucional, tipo_vinculacion, cargo, password_hash)
       SELECT 'Ana', 'Torres', '1.061.700.200', $1, 'Administrativo', 'Secretaria Ejecutiva', password_hash
         FROM usuarios WHERE correo_institucional = 'laura.ortiz@uniautonoma.edu.co'`,
      [email]
    );
    await db.query(
      `INSERT INTO usuario_roles (usuario_id, rol_id)
       SELECT u.id, r.id FROM usuarios u, roles r WHERE u.correo_institucional = $1 AND r.nombre_rol = 'Administrativo'`,
      [email]
    );
  });

  it('sin trámite, mi-estado indica que no está habilitado', async () => {
    const res = await request(app).get(`${API}/paz-y-salvo/mi-estado`).set(await as(email));
    expect(res.body.data).toMatchObject({ habilitado: false, estadoGlobal: 'NO_INICIADO' });
  });

  it('habilita el trámite y es idempotente', async () => {
    const headers = await as(email);
    const first = await request(app).post(`${API}/tramites/habilitar`).set(headers).send({ tipo_novedad: 'RETIRO' });
    expect(first.status).toBe(201);
    expect(first.body.solicitud).toMatchObject({ estado_global: 'AL_DIA', etapa_actual: 'JEFE_INMEDIATO', cargo_desempenado: 'Secretaria Ejecutiva' });
    const second = await request(app).post(`${API}/tramites/habilitar`).set(headers).send({});
    expect(second.body.mensaje).toMatch(/ya se encuentra activo/);
  });

  it('solo los solicitantes habilitan su paz y salvo', async () => {
    const res = await request(app).post(`${API}/tramites/habilitar`).set(await as(EMAIL.dti)).send({});
    expect(res.status).toBe(403);
  });
});

describe('Catálogos y administración (RN-011)', () => {
  it('lista las 9 dependencias en orden', async () => {
    const res = await request(app).get(`${API}/dependencias`).set(await as(EMAIL.laura));
    expect(res.body.data).toHaveLength(9);
    expect(res.body.data[0].nombre).toBe('Jefe Inmediato');
  });

  it('el encargado busca trabajadores con trámite en curso', async () => {
    const res = await request(app).get(`${API}/usuarios?conTramite=true`).set(await as(EMAIL.almacen));
    expect(res.status).toBe(200);
    const emails = res.body.data.map((u) => u.correo_institucional);
    expect(emails).toEqual(expect.arrayContaining([EMAIL.laura, EMAIL.carlos]));
    expect(emails).not.toContain(EMAIL.mateo); // trámite cerrado
    expect(res.body.data.every((u) => u.solicitud_id)).toBe(true);
  });

  it('busca por cédula y los trabajadores no acceden al catálogo', async () => {
    const found = await request(app).get(`${API}/usuarios?q=1.061.700.103`).set(await as(EMAIL.dti));
    expect(found.body.data).toHaveLength(1);
    expect(found.body.data[0].correo_institucional).toBe(EMAIL.sofia);
    expect((await request(app).get(`${API}/usuarios`).set(await as(EMAIL.laura))).status).toBe(403);
  });

  it('el Administrador DTI solo modifica el nombre del cargo', async () => {
    const admin = await as(EMAIL.admin);
    const id = '11111111-1111-4111-8111-222222222222';
    const res = await request(app).put(`${API}/usuarios/${id}`).set(admin)
      .send({ cargo_desempenado: 'Auxiliar Administrativo Senior', nombres: 'Otro' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ cargo_desempenado: 'Auxiliar Administrativo Senior', nombres: 'Carlos Andrés' });
    expect((await request(app).put(`${API}/usuarios/${id}`).set(admin).send({})).status).toBe(400);
    expect((await request(app).put(`${API}/usuarios/${id}`).set(await as(EMAIL.dti)).send({ cargo: 'X' })).status).toBe(403);

    const { rows } = await db.query(`SELECT datos_nuevos FROM auditoria WHERE tabla = 'usuarios' ORDER BY id DESC LIMIT 1`);
    expect(rows[0].datos_nuevos.cargo).toBe('Auxiliar Administrativo Senior');
    expect(rows[0].datos_nuevos.password_hash).toBeUndefined();
  });

  it('el catálogo de cargos se lista para todos y solo el Admin DTI lo renombra', async () => {
    const list = await request(app).get(`${API}/cargos`).set(await as(EMAIL.laura));
    expect(list.body.data).toHaveLength(17);
    const { id } = list.body.data.find((c) => c.nombre === 'Auxiliar Contable');
    expect((await request(app).put(`${API}/cargos/${id}`).set(await as(EMAIL.dti)).send({ nombre: 'X' })).status).toBe(403);
    const renamed = await request(app).put(`${API}/cargos/${id}`).set(await as(EMAIL.admin)).send({ nombre: 'Auxiliar Contable I' });
    expect(renamed.body.data.nombre).toBe('Auxiliar Contable I');
  });
});
