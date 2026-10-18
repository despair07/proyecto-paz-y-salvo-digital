// ============================================================================
// SETUP DE BASE DE DATOS (Supabase / PostgreSQL)
//
//   npm run setup-db            → aplica seed_maestro.sql + seed_demo.sql (idempotente)
//   npm run setup-db -- --reset → ⚠ BORRA y recrea todo: ddl.sql + seeds
//   npm run setup-db -- --solo-maestro → solo catálogos (sin datos ficticios)
//
// Cada archivo corre en su propia transacción: si falla, no queda nada a medias.
// ============================================================================

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.resolve(__dirname, '../../database');
const args = new Set(process.argv.slice(2));
const RESET = args.has('--reset');
const SOLO_MAESTRO = args.has('--solo-maestro');

// --reset borra todas las tablas y el seed demo crea cuentas con contraseña conocida: nunca en producción
if (process.env.NODE_ENV === 'production' && (RESET || !SOLO_MAESTRO)) {
  console.error('❌ En producción solo se permite: npm run setup-db -- --solo-maestro (sin --reset ni datos ficticios).');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function runFile(label, file) {
  const sql = fs.readFileSync(path.join(DB_DIR, file), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✅  ${label} (${file})`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`${label} (${file}) falló: ${err.message}`);
  } finally {
    client.release();
  }
}

async function main() {
  console.log(`📡  ${process.env.DB_HOST} / ${process.env.DB_NAME || 'postgres'}`);

  try {
    const { rows } = await pool.query('SELECT current_user AS usuario');
    console.log(`🔌  Conectado como ${rows[0].usuario}`);
  } catch (err) {
    console.error(`❌  No se pudo conectar: ${err.message}`);
    console.error('    · ¿El proyecto Supabase está pausado? Restáuralo en supabase.com/dashboard');
    console.error('    · Revisa DB_HOST, DB_USER y DB_PASSWORD en .env');
    process.exit(1);
  }

  if (RESET) {
    console.log('\n⚠️   --reset: se eliminarán y recrearán TODAS las tablas del sistema.');
    await runFile('Estructura', 'ddl.sql');
  } else {
    const { rows } = await pool.query(`SELECT to_regclass('public.solicitudes_paz_y_salvo') AS t`);
    if (!rows[0].t) {
      console.error('\n❌  La base no tiene el esquema. Ejecuta: npm run setup-db -- --reset');
      process.exit(1);
    }
  }

  await runFile('Catálogos', 'seed_maestro.sql');
  if (!SOLO_MAESTRO) {
    await runFile('Datos ficticios', 'seed_demo.sql');
  }

  const { rows: [t] } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM roles)                   AS roles,
      (SELECT COUNT(*) FROM dependencias)            AS dependencias,
      (SELECT COUNT(*) FROM usuarios)                AS usuarios,
      (SELECT COUNT(*) FROM solicitudes_paz_y_salvo) AS solicitudes,
      (SELECT COUNT(*) FROM bloqueos_dependencia)    AS bloqueos,
      (SELECT COUNT(*) FROM certificados_digitales)  AS certificados
  `);
  console.log('\n📊  Resumen:');
  console.table(t);
  console.log('🚀  Listo. Arranca el backend con: npm run dev');
}

main()
  .catch((err) => {
    console.error(`\n💥  ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
