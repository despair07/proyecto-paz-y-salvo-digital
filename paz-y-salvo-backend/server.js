const app = require('./src/app');
const env = require('./src/config/env');
const database = require('./src/config/database');

const REQUIRED_TABLES = [
  'roles', 'usuarios', 'usuario_roles', 'dependencias', 'encargados_dependencia',
  'periodos_academicos', 'catalogo_cargos', 'solicitudes_paz_y_salvo',
  'informes_entrega_cargo', 'bloqueos_dependencia', 'entregables_profesorales',
  'certificados_digitales', 'auditoria', 'notificaciones',
];

// Verifica la conexión a PostgreSQL/Supabase y el estado del esquema, y lo muestra en consola.
async function reportDatabaseStatus() {
  const target = `${env.DB.USER}@${env.DB.HOST}:${env.DB.PORT}/${env.DB.NAME}`;
  const started = Date.now();
  try {
    const { rows: [info] } = await database.query(
      `SELECT current_database() AS db, version() AS version,
              (SELECT COALESCE(array_agg(table_name::text), '{}') FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = ANY($1)) AS tablas`,
      [REQUIRED_TABLES]
    );
    console.log(`✅ Base de datos conectada (${Date.now() - started} ms)`);
    console.log(`   Destino:  ${target}`);
    console.log(`   Servidor: ${info.version.split(' ').slice(0, 2).join(' ')}`);

    const missing = REQUIRED_TABLES.filter((t) => !info.tablas.includes(t));
    if (missing.length) {
      console.warn(`⚠️  Faltan ${missing.length} de ${REQUIRED_TABLES.length} tablas: ${missing.join(', ')}`);
      console.warn('   Crea el esquema con: npm run setup-db -- --reset');
      return;
    }
    const { rows: [counts] } = await database.query(
      `SELECT (SELECT COUNT(*) FROM usuarios) AS usuarios,
              (SELECT COUNT(*) FROM solicitudes_paz_y_salvo) AS solicitudes,
              (SELECT COUNT(*) FROM bloqueos_dependencia) AS bloqueos`
    );
    console.log(`   Esquema:  ${REQUIRED_TABLES.length}/${REQUIRED_TABLES.length} tablas · `
      + `${counts.usuarios} usuarios · ${counts.solicitudes} trámites · ${counts.bloqueos} bloqueos`);
  } catch (err) {
    console.error(`❌ No se pudo conectar a la base de datos (${target})`);
    console.error(`   Motivo: ${err.message}`);
    console.error('   · ¿El proyecto de Supabase está pausado? Restáuralo en supabase.com/dashboard');
    console.error('   · Revisa DB_HOST, DB_USER y DB_PASSWORD en .env');
  }
}

// Código de salida cuando el puerto está ocupado: el supervisor no reintenta en bucle.
const EXIT_PORT_IN_USE = 2;

let server;
let shuttingDown = false;

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Cerrando servidor…');
  // Si algo se cuelga al cerrar, se fuerza la salida
  setTimeout(() => process.exit(code), 5000).unref();
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await database.close();
  } catch (error) {
    console.error('Error al cerrar:', error.message);
  }
  process.exit(code);
}

// Una promesa rechazada sin manejar no debe tumbar el servidor; una excepción sí (estado incierto)
process.on('unhandledRejection', (reason) => {
  console.error('[proceso] Promesa rechazada sin manejar:', reason instanceof Error ? reason.stack : reason);
});
process.on('uncaughtException', (error) => {
  console.error('[proceso] Excepción no capturada:', error.stack || error);
  shutdown(1);
});
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const startServer = () => {
  server = app.listen(env.PORT, async () => {
    console.log(`Servidor corriendo en el puerto ${env.PORT}`);
    await reportDatabaseStatus();
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ El puerto ${env.PORT} ya está en uso: hay otro backend abierto. Ciérralo o cambia PORT en .env`);
      process.exit(EXIT_PORT_IN_USE);
    }
    console.error('[servidor] Error:', error);
    shutdown(1);
  });

  // Evita que conexiones HTTP colgadas mantengan el proceso o saturen el servidor
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 60000;
};

startServer();
