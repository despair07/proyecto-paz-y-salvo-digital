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

const startServer = () => {
  app.listen(env.PORT, async () => {
    console.log(`Servidor corriendo en el puerto ${env.PORT}`);
    await reportDatabaseStatus();
  });
};

startServer();
