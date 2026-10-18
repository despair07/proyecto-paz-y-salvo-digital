// ============================================================================
// REGISTRO DE PERSONAL DE ÁREAS (lo que hará el panel de TI cuando exista)
// Quien no es trabajador (jefe inmediato, encargado de área, aprobador, administrador DTI) no se
// autoregistra: se da de alta aquí con su correo institucional y entra con Google.
//
//   npm run registrar-usuario -- <correo> "<Nombres> <Apellidos>" <rol> [dependencia]
//
//   rol: jefe | encargado | aprobador | admin
//   dependencia (solo para jefe y encargado): parte del nombre, p. ej. almacen, "medios", sst
//
// Ejemplos:
//   npm run registrar-usuario -- ana.perez@uniautonoma.edu.co "Ana Pérez" admin
//   npm run registrar-usuario -- luis.diaz@uniautonoma.edu.co "Luis Díaz" encargado almacen
// ============================================================================

require('dotenv').config();
const { Pool } = require('pg');

const ROLES = {
  jefe: { rol: 'Jefe Inmediato', dependencia: 'Jefe Inmediato', requiereDependencia: false },
  encargado: { rol: 'Encargado de Área', requiereDependencia: true },
  aprobador: { rol: 'Aprobador Comunidad Universitaria', dependencia: 'División De Comunidad Universitaria' },
  admin: { rol: 'Administrador DTI' },
};

const normalize = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function main() {
  const [correo, nombreCompleto, clave, buscar] = process.argv.slice(2);
  const config = ROLES[clave];
  if (!correo || !nombreCompleto || !config) {
    console.error('Uso: npm run registrar-usuario -- <correo> "<Nombres> <Apellidos>" <jefe|encargado|aprobador|admin> [dependencia]');
    process.exit(1);
  }
  const email = correo.trim().toLowerCase();
  if (!email.endsWith('@uniautonoma.edu.co')) {
    console.error('El correo debe ser @uniautonoma.edu.co');
    process.exit(1);
  }
  const partes = nombreCompleto.trim().split(/\s+/);
  const mitad = Math.max(1, Math.ceil(partes.length / 2));
  const nombres = partes.slice(0, mitad).join(' ');
  const apellidos = partes.slice(mitad).join(' ') || '(sin apellido)';

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.audit_reason', 'Registro de personal por script', true)");

    let dependenciaId = null;
    const nombreDependencia = config.dependencia || buscar;
    if (config.requiereDependencia || config.dependencia || (clave === 'jefe' && buscar)) {
      const { rows } = await client.query('SELECT id, nombre FROM dependencias ORDER BY orden');
      const candidatas = rows.filter((d) => normalize(d.nombre).includes(normalize(nombreDependencia || '')));
      if (candidatas.length !== 1) {
        console.error(`La dependencia "${nombreDependencia}" ${candidatas.length ? 'es ambigua' : 'no existe'}. Opciones:`);
        rows.forEach((d) => console.error(`  - ${d.nombre}`));
        throw new Error('Dependencia no válida');
      }
      dependenciaId = candidatas[0].id;
    }

    const existente = await client.query('SELECT id FROM usuarios WHERE correo_institucional = $1', [email]);
    let usuarioId = existente.rows[0]?.id;
    if (!usuarioId) {
      const creado = await client.query(
        `INSERT INTO usuarios (nombres, apellidos, correo_institucional, origen, verificado)
         VALUES ($1, $2, $3, 'REGISTRADO_TI', TRUE) RETURNING id`,
        [nombres, apellidos, email]
      );
      usuarioId = creado.rows[0].id;
    } else {
      // Si ya se había autoregistrado, TI lo verifica
      await client.query(
        `UPDATE usuarios SET verificado = TRUE, estado = 'ACTIVO' WHERE id = $1`,
        [usuarioId]
      );
    }

    await client.query(
      'INSERT INTO usuario_roles (usuario_id, rol_id) SELECT $1, id FROM roles WHERE nombre_rol = $2 ON CONFLICT DO NOTHING',
      [usuarioId, config.rol]
    );
    if (dependenciaId) {
      await client.query(
        `INSERT INTO encargados_dependencia (usuario_id, dependencia_id, es_jefe_inmediato)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [usuarioId, dependenciaId, clave === 'jefe']
      );
    }
    await client.query('COMMIT');
    console.log(`✅ ${email} registrado como ${config.rol}${dependenciaId ? ' (con dependencia asignada)' : ''}. Ya puede entrar con Google.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
