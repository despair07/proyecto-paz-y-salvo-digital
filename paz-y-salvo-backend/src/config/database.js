const { Pool, types } = require('pg');
const env = require('./env');
const HttpError = require('../utils/httpError');

// Las columnas DATE se devuelven como texto «YYYY-MM-DD» (sin convertirlas a Date con zona horaria,
// que desplazaría el día en el navegador).
types.setTypeParser(1082, (value) => value);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class Database {
  constructor() {
    this.isOnline = false;
    this.pool = new Pool({
      host: env.DB.HOST,
      port: env.DB.PORT,
      database: env.DB.NAME,
      user: env.DB.USER,
      password: env.DB.PASSWORD,
      max: env.DB.POOL_MAX || 10,
      connectionTimeoutMillis: env.DB.CONNECTION_TIMEOUT_MS || 5000,
      idleTimeoutMillis: env.DB.IDLE_TIMEOUT_MS || 10000,
      ssl: env.DB.SSL ? { rejectUnauthorized: false } : false,
    });

    this.pool.on('error', (error) => {
      console.warn('[Database Pool Warning]:', error.message || error.code || 'unknown');
    });
  }

  async checkConnection() {
    try {
      await this.pool.query('SELECT 1');
      this.isOnline = true;
      return true;
    } catch (err) {
      this.isOnline = false;
      return false;
    }
  }

  async query(text, params) {
    return this.pool.query(text, params);
  }

  // Consultas de solo lectura: un cliente del pool, sin transacción.
  async withClient(operation) {
    if (typeof operation !== 'function') {
      throw new TypeError('La operación de base de datos no es válida');
    }
    const client = await this.pool.connect();
    try {
      return await operation(client);
    } finally {
      client.release();
    }
  }

  // Operaciones sin sesión de usuario (p. ej. el autoregistro al iniciar sesión con Google):
  // transacción que solo deja el motivo para la tabla `auditoria`.
  async withSystemContext(auditReason, operation) {
    if (typeof operation !== 'function') {
      throw new TypeError('La operación de base de datos no es válida');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.audit_reason', $1, true)", [String(auditReason || 'Sistema')]);
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('PostgreSQL transaction rollback failed', rollbackError.code || 'unknown');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  // Escrituras: transacción con el usuario y el motivo disponibles para la tabla `auditoria`
  // (app.user_id y app.audit_reason, leídos por fn_trg_auditar). El backend usa el rol del pool
  // (postgres, BYPASSRLS); RLS queda activo en las tablas para bloquear la API REST de Supabase.
  async withUserContext(user, auditReason, operation) {
    if (!user || !user.id) {
      throw new HttpError(401, 'La sesión no identifica un usuario válido');
    }
    if (typeof operation !== 'function') {
      throw new TypeError('La operación de base de datos no es válida');
    }

    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;

      if (UUID_PATTERN.test(user.id)) {
        await client.query(
          "SELECT set_config('app.user_id', $1, true), set_config('app.audit_reason', $2, true)",
          [user.id, String(auditReason || 'Operación').trim()]
        );
      }

      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('PostgreSQL transaction rollback failed', rollbackError.code || 'unknown');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = new Database();
