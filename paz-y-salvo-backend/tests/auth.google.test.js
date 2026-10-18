// ============================================================================
// PRUEBAS — Inicio de sesión con Google, registro, tipo de vinculación (RN-012) y notificaciones
// El ID token de Google se simula; la base de datos es PostgreSQL real (PGlite).
// ============================================================================

process.env.JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-bytes-long';
process.env.GOOGLE_CLIENT_ID = 'cliente-de-prueba.apps.googleusercontent.com';
process.env.AUTH_PASSWORD_ENABLED = 'false';

let mockGoogle = null;
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: async () => {
      if (mockGoogle instanceof Error) throw mockGoogle;
      return { getPayload: () => mockGoogle };
    },
  })),
}));
jest.mock('../src/config/database', () => require('./helpers/pgliteDatabase'));

const request = require('supertest');
const db = require('../src/config/database');
const env = require('../src/config/env');
const app = require('../src/app');

const API = '/api/v1';

function google(overrides = {}) {
  mockGoogle = {
    email: 'ana.rios@uniautonoma.edu.co',
    email_verified: true,
    hd: 'uniautonoma.edu.co',
    sub: 'google-sub-ana',
    given_name: 'Ana María',
    family_name: 'Ríos Pérez',
    ...overrides,
  };
}

const loginGoogle = () => request(app).post(`${API}/auth/login`).send({ googleToken: 'token-de-google' });
const auth = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(() => db.init(), 60000);
afterAll(() => db.close());

describe('Dominio institucional', () => {
  it('rechaza cuentas sin el claim hd de Workspace aunque el correo termine en el dominio', async () => {
    google({ hd: undefined });
    const res = await loginGoogle();
    expect(res.status).toBe(401);
    expect(res.body.mensaje).toBe('Acceso restringido a cuentas @uniautonoma.edu.co');
  });

  it('rechaza otro dominio, correo sin verificar y tokens inválidos', async () => {
    google({ hd: 'gmail.com', email: 'ana@gmail.com' });
    expect((await loginGoogle()).status).toBe(401);
    google({ email_verified: false });
    expect((await loginGoogle()).status).toBe(401);
    mockGoogle = new Error('Token used too late');
    expect((await loginGoogle()).status).toBe(401);
    const users = await db.query("SELECT 1 FROM usuarios WHERE correo_institucional LIKE 'ana%'");
    expect(users.rows).toHaveLength(0);
  });

  it('el login con contraseña está deshabilitado fuera de desarrollo', async () => {
    const res = await request(app).post(`${API}/auth/login`)
      .send({ email: 'laura.ortiz@uniautonoma.edu.co', password: 'Demo2026*' });
    expect(res.status).toBe(403);
    expect(env.AUTH_PASSWORD_ENABLED).toBe(false);
  });
});

describe('Primer ingreso con Google (autoregistro)', () => {
  let token;

  it('registra a la persona sin verificar, sin rol y avisa a TI', async () => {
    google();
    const res = await loginGoogle();
    expect(res.status).toBe(200);
    token = res.body.token;
    expect(res.body.usuario).toMatchObject({
      correo_institucional: 'ana.rios@uniautonoma.edu.co',
      nombres: 'Ana María',
      apellidos: 'Ríos Pérez',
      roles: [],
      tipo_vinculacion: null,
      verificado: false,
      origen: 'AUTOREGISTRO',
      requiere_tipo_vinculacion: true,
    });

    const { rows } = await db.query(
      `SELECT n.titulo FROM notificaciones n JOIN usuarios u ON u.id = n.usuario_id
        WHERE u.correo_institucional = 'admin.dti@uniautonoma.edu.co' AND n.tipo = 'NUEVO_USUARIO_SIN_VERIFICAR'`
    );
    expect(rows).toHaveLength(1);
  });

  it('un segundo ingreso no duplica el usuario ni vuelve a avisar', async () => {
    google();
    expect((await loginGoogle()).status).toBe(200);
    const users = await db.query("SELECT 1 FROM usuarios WHERE correo_institucional = 'ana.rios@uniautonoma.edu.co'");
    expect(users.rows).toHaveLength(1);
    const notes = await db.query("SELECT 1 FROM notificaciones WHERE tipo = 'NUEVO_USUARIO_SIN_VERIFICAR'");
    expect(notes.rows).toHaveLength(1);
  });

  it('otra cuenta de Google con el mismo correo no entra', async () => {
    google({ sub: 'otra-cuenta' });
    expect((await loginGoogle()).status).toBe(401);
  });

  it('sin tipo de vinculación no puede habilitar un trámite', async () => {
    const res = await request(app).post(`${API}/tramites/habilitar`).set(auth(token)).send({ cargo_desempenado: 'X' });
    expect(res.status).toBe(403);
  });

  it('un usuario inactivo no entra', async () => {
    await db.query("UPDATE usuarios SET estado = 'INACTIVO' WHERE correo_institucional = 'ana.rios@uniautonoma.edu.co'");
    google();
    expect((await loginGoogle()).status).toBe(403);
    await db.query("UPDATE usuarios SET estado = 'ACTIVO' WHERE correo_institucional = 'ana.rios@uniautonoma.edu.co'");
  });
});

describe('Personal de áreas registrado por TI', () => {
  it('entra con Google con sus roles y queda ligado a su cuenta', async () => {
    google({ email: 'encargado.almacen@uniautonoma.edu.co', sub: 'sub-almacen', given_name: 'Héctor', family_name: 'Mosquera' });
    const res = await loginGoogle();
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({
      roles: ['Encargado de Área'],
      verificado: true,
      origen: 'REGISTRADO_TI',
      requiere_tipo_vinculacion: false,
      dependencia: 'Almacén',
    });
    const { rows } = await db.query("SELECT google_sub FROM usuarios WHERE correo_institucional = 'encargado.almacen@uniautonoma.edu.co'");
    expect(rows[0].google_sub).toBe('sub-almacen');
  });
});

describe('Tipo de vinculación (RN-012)', () => {
  let token;

  beforeAll(async () => {
    google({ email: 'luis.mora@uniautonoma.edu.co', sub: 'sub-luis', given_name: 'Luis', family_name: 'Mora' });
    token = (await loginGoogle()).body.token;
  });

  it('valida el tipo', async () => {
    const res = await request(app).put(`${API}/auth/tipo-vinculacion`).set(auth(token)).send({ tipo: 'Estudiante' });
    expect(res.status).toBe(400);
    expect((await request(app).put(`${API}/auth/tipo-vinculacion`).send({ tipo: 'Docente' })).status).toBe(401);
  });

  it('la primera elección no necesita confirmación y entrega un token con el rol', async () => {
    const res = await request(app).put(`${API}/auth/tipo-vinculacion`).set(auth(token)).send({ tipo: 'Docente' });
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ tipo_vinculacion: 'Docente', roles: ['Docente'], requiere_tipo_vinculacion: false });
    token = res.body.token;

    const status = await request(app).get(`${API}/paz-y-salvo/mi-estado`).set(auth(token));
    expect(status.body.data.habilitado).toBe(false);
    const { rows } = await db.query(
      `SELECT titulo FROM notificaciones n JOIN usuarios u ON u.id = n.usuario_id
        WHERE u.correo_institucional = 'luis.mora@uniautonoma.edu.co' AND n.tipo = 'TIPO_VINCULACION_DEFINIDO'`
    );
    expect(rows).toHaveLength(1);
  });

  it('cambiar el tipo exige confirmación explícita', async () => {
    const res = await request(app).put(`${API}/auth/tipo-vinculacion`).set(auth(token)).send({ tipo: 'Administrativo' });
    expect(res.status).toBe(400);
    expect(res.body.mensaje).toMatch(/confirmar/);
  });

  it('con un trámite en curso no se puede cambiar (RN-012)', async () => {
    google({ email: 'laura.ortiz@uniautonoma.edu.co', sub: 'sub-laura', given_name: 'Laura', family_name: 'Ortiz' });
    const laura = (await loginGoogle()).body.token;
    const res = await request(app).put(`${API}/auth/tipo-vinculacion`).set(auth(laura))
      .send({ tipo: 'Administrativo', confirmar: true });
    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/RN-012/);
    const me = await request(app).get(`${API}/auth/me`).set(auth(laura));
    expect(me.body.usuario.tipo_vinculacion).toBe('Docente');
  });

  it('con el trámite en borrador sí se puede: reemplaza el rol y notifica a la persona y a TI', async () => {
    const habilitar = await request(app).post(`${API}/tramites/habilitar`).set(auth(token))
      .send({ tipo_novedad: 'RETIRO' });
    expect(habilitar.status).toBe(201);
    expect(habilitar.body.solicitud.estado_global).toBe('BORRADOR');

    const res = await request(app).put(`${API}/auth/tipo-vinculacion`).set(auth(token))
      .send({ tipo: 'Administrativo', confirmar: true });
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ tipo_vinculacion: 'Administrativo', roles: ['Administrativo'] });

    const own = await request(app).get(`${API}/notificaciones`).set(auth(res.body.token));
    const cambio = own.body.data.find((n) => n.tipo === 'CAMBIO_TIPO_VINCULACION');
    expect(cambio.mensaje).toBe('Tu tipo de vinculación pasó de Docente a Administrativo.');

    const admins = await db.query(
      `SELECT n.mensaje FROM notificaciones n JOIN usuarios u ON u.id = n.usuario_id
        WHERE u.correo_institucional = 'admin.dti@uniautonoma.edu.co' AND n.tipo = 'CAMBIO_TIPO_VINCULACION'`
    );
    expect(admins.rows[0].mensaje).toMatch(/luis\.mora@uniautonoma\.edu\.co.*Docente a Administrativo/);
  });

  it('la base de datos también impide el cambio con un trámite abierto', async () => {
    await expect(db.query(
      "UPDATE usuarios SET tipo_vinculacion = 'Contratista' WHERE correo_institucional = 'laura.ortiz@uniautonoma.edu.co'"
    )).rejects.toThrow(/RN-012/);
  });

  it('la auditoría guarda el cambio sin el hash de contraseña', async () => {
    const { rows } = await db.query(
      `SELECT datos_anteriores, datos_nuevos, motivo FROM auditoria
        WHERE tabla = 'usuarios' AND motivo = 'Cambio de tipo de vinculación' ORDER BY id DESC LIMIT 1`
    );
    expect(rows[0].datos_anteriores.tipo_vinculacion).toBe('Docente');
    expect(rows[0].datos_nuevos.tipo_vinculacion).toBe('Administrativo');
    expect(rows[0].datos_nuevos.password_hash).toBeUndefined();
  });
});

describe('Notificaciones', () => {
  let token;
  let other;

  beforeAll(async () => {
    google({ email: 'ana.rios@uniautonoma.edu.co', sub: 'google-sub-ana' });
    token = (await loginGoogle()).body.token;
    await request(app).put(`${API}/auth/tipo-vinculacion`).set(auth(token)).send({ tipo: 'Contratista' });
    google({ email: 'luis.mora@uniautonoma.edu.co', sub: 'sub-luis' });
    other = (await loginGoogle()).body.token;
  });

  it('cada persona ve solo las suyas, con el conteo de no leídas', async () => {
    const res = await request(app).get(`${API}/notificaciones`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.noLeidas).toBe(1);
    expect(res.body.data.every((n) => n.leida === false)).toBe(true);
    expect(res.body.data[0].titulo).toBe('Perfil configurado');
  });

  it('marca una como leída y no deja leer las de otra persona', async () => {
    const [first] = (await request(app).get(`${API}/notificaciones`).set(auth(token))).body.data;
    expect((await request(app).put(`${API}/notificaciones/${first.id}/leida`).set(auth(other))).status).toBe(404);
    expect((await request(app).put(`${API}/notificaciones/${first.id}/leida`).set(auth(token))).status).toBe(200);
    const after = await request(app).get(`${API}/notificaciones?soloNoLeidas=true`).set(auth(token));
    expect(after.body.data).toHaveLength(0);
    expect(after.body.noLeidas).toBe(0);
  });

  it('marca todas como leídas', async () => {
    const res = await request(app).put(`${API}/notificaciones/leer-todas`).set(auth(other));
    expect(res.status).toBe(200);
    expect((await request(app).get(`${API}/notificaciones`).set(auth(other))).body.noLeidas).toBe(0);
  });

  it('exige sesión', async () => {
    expect((await request(app).get(`${API}/notificaciones`)).status).toBe(401);
  });
});
