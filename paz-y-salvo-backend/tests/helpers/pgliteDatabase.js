// ============================================================================
// Base de datos de pruebas: PostgreSQL real (PGlite, en memoria) con el mismo esquema
// (database/ddl.sql) y los mismos seeds que Supabase, para probar SQL y triggers sin red.
// Reemplaza a src/config/database mediante jest.mock.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

const SQL_DIR = path.resolve(__dirname, '../../../database');
const FILES = ['ddl.sql', 'seed_maestro.sql', 'seed_demo.sql'];

let pg = null;
let loading = null;

async function load() {
  pg = new PGlite({ parsers: { 1082: (value) => value } }); // DATE como texto, igual que en database.js
  for (const file of FILES) {
    await pg.exec(fs.readFileSync(path.join(SQL_DIR, file), 'utf8'));
  }
}

// Carga el esquema una sola vez; reset() lo recrea desde cero.
function init() {
  if (!loading) loading = load();
  return loading;
}

async function reset() {
  if (pg) await pg.close();
  loading = load();
  return loading;
}

const clientFor = () => ({ query: (text, params) => pg.query(text, params) });

module.exports = {
  isOnline: true,
  init,
  reset,

  async query(text, params) {
    await init();
    return pg.query(text, params);
  },

  async checkConnection() {
    await init();
    return true;
  },

  async withClient(operation) {
    await init();
    return operation(clientFor());
  },

  async withSystemContext(auditReason, operation) {
    await init();
    await pg.exec('BEGIN');
    try {
      await pg.query("SELECT set_config('app.audit_reason', $1, true)", [String(auditReason || 'Sistema')]);
      const result = await operation(clientFor());
      await pg.exec('COMMIT');
      return result;
    } catch (error) {
      await pg.exec('ROLLBACK');
      throw error;
    }
  },

  async withUserContext(user, auditReason, operation) {
    await init();
    await pg.exec('BEGIN');
    try {
      await pg.query(
        "SELECT set_config('app.user_id', $1, true), set_config('app.audit_reason', $2, true)",
        [user.id, String(auditReason || 'Operación')]
      );
      const result = await operation(clientFor());
      await pg.exec('COMMIT');
      return result;
    } catch (error) {
      await pg.exec('ROLLBACK');
      throw error;
    }
  },

  async close() {
    if (pg) await pg.close();
    pg = null;
    loading = null;
  },
};
