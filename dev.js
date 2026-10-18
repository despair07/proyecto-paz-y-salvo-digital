#!/usr/bin/env node
// ============================================================================
// Arranque de desarrollo: backend y frontend en UNA sola terminal, con supervisión.
//
//   npm run dev                 inicia ambos
//   npm run dev -- --liberar    antes libera los puertos 3000 y 5173 si los ocupa un node viejo
//
// · Si un servicio se cae, se reinicia solo (con espera creciente).
// · Si un servicio sigue vivo pero deja de responder, se reinicia.
// · Si el puerto está ocupado, lo dice claramente y no reintenta en bucle.
// · Ctrl+C cierra los dos limpiamente.
// ============================================================================

const { spawn, execFileSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const IS_WIN = process.platform === 'win32';
const EXIT_PORT_IN_USE = 98;

const SERVICES = [
  {
    name: 'api',
    color: '\x1b[36m',
    cwd: path.join(__dirname, 'paz-y-salvo-backend'),
    port: 3000,
    health: 'http://localhost:3000/api/health',
    url: 'http://localhost:3000/api/docs',
  },
  {
    name: 'web',
    color: '\x1b[35m',
    cwd: path.join(__dirname, 'paz-y-salvo-frontend'),
    port: 5173,
    health: 'http://localhost:5173/',
    url: 'http://localhost:5173',
  },
];

const RESET = '\x1b[0m';
const GRACE_MS = 45000; // tiempo para que arranque antes de vigilar su salud
const HEALTH_EVERY_MS = 15000;
const HEALTH_FAILS_TO_RESTART = 4;
const MAX_RAPID_CRASHES = 6;

let stopping = false;

const log = (service, text) => {
  for (const line of String(text).split(/\r?\n/)) {
    if (line.trim()) console.log(`${service.color}[${service.name}]${RESET} ${line}`);
  }
};
const say = (text) => console.log(`\x1b[1m[dev]${RESET} ${text}`);

function portOwner(port) {
  try {
    if (IS_WIN) {
      const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
      const line = out.split(/\r?\n/).find((l) => new RegExp(`:${port}\\s+\\S+\\s+LISTENING`).test(l));
      return line ? Number(line.trim().split(/\s+/).pop()) : null;
    }
    const out = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim();
    return out ? Number(out.split('\n')[0]) : null;
  } catch {
    return null;
  }
}

function killTree(pid) {
  try {
    if (IS_WIN) execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, 'SIGTERM');
  } catch {
    /* ya terminó */
  }
}

function isPortFree(port) {
  if (portOwner(port)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port);
  });
}

class Supervised {
  constructor(service) {
    this.service = service;
    this.child = null;
    this.startedAt = 0;
    this.crashes = [];
    this.healthFails = 0;
    this.timer = null;
    this.restartTimer = null;
  }

  start() {
    const { service } = this;
    this.startedAt = Date.now();
    this.healthFails = 0;
    this.recentOutput = '';
    this.child = spawn(IS_WIN ? 'npm run dev' : 'npm', IS_WIN ? [] : ['run', 'dev'], {
      cwd: service.cwd,
      shell: IS_WIN,
      detached: !IS_WIN,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: '1' },
    });
    const onData = (d) => {
      log(service, d);
      this.recentOutput = (this.recentOutput + d).slice(-2000);
    };
    this.child.stdout.on('data', onData);
    this.child.stderr.on('data', onData);
    this.child.on('exit', (code, signal) => this.onExit(code, signal));
    log(service, 'iniciando…');
  }

  onExit(code, signal) {
    const { service } = this;
    this.child = null;
    if (stopping) return;

    if (code === EXIT_PORT_IN_USE || /already in use|EADDRINUSE/i.test(this.recentOutput)) {
      say(`${service.name}: el puerto ${service.port} está ocupado. Ejecuta "npm run dev -- --liberar" o cierra el otro proceso.`);
      return;
    }

    const now = Date.now();
    this.crashes = this.crashes.filter((t) => now - t < 120000);
    this.crashes.push(now);
    if (this.crashes.length > MAX_RAPID_CRASHES) {
      say(`${service.name}: se cayó ${this.crashes.length} veces en 2 minutos; dejo de reiniciarlo. Revisa el error de arriba y vuelve a ejecutar "npm run dev".`);
      return;
    }

    const wait = Math.min(15000, 1000 * 2 ** (this.crashes.length - 1));
    say(`${service.name} se detuvo (${signal || `código ${code}`}). Reinicio en ${wait / 1000} s…`);
    this.restartTimer = setTimeout(() => this.start(), wait);
  }

  async checkHealth() {
    if (stopping || !this.child || Date.now() - this.startedAt < GRACE_MS) return;
    try {
      const res = await fetch(this.service.health, { signal: AbortSignal.timeout(5000) });
      if (res.status >= 500 && this.service.name === 'api') throw new Error(`HTTP ${res.status}`);
      this.healthFails = 0;
    } catch {
      this.healthFails += 1;
      if (this.healthFails >= HEALTH_FAILS_TO_RESTART) {
        say(`${this.service.name} no responde; lo reinicio.`);
        this.restart();
      }
    }
  }

  restart() {
    this.healthFails = 0;
    if (this.child) killTree(this.child.pid);
    // onExit programa el reinicio
  }

  watch() {
    this.timer = setInterval(() => this.checkHealth(), HEALTH_EVERY_MS);
  }

  stop() {
    clearInterval(this.timer);
    clearTimeout(this.restartTimer);
    if (this.child) killTree(this.child.pid);
  }
}

async function main() {
  const liberar = process.argv.includes('--liberar');

  for (const service of SERVICES) {
    if (await isPortFree(service.port)) continue;
    const pid = portOwner(service.port);
    if (!liberar) {
      say(`El puerto ${service.port} (${service.name}) ya está en uso${pid ? ` por el proceso ${pid}` : ''}.`);
      say('Probablemente quedó un servidor anterior abierto. Usa "npm run dev -- --liberar" para cerrarlo.');
      process.exit(EXIT_PORT_IN_USE);
    }
    if (pid) {
      say(`Liberando el puerto ${service.port} (proceso ${pid})…`);
      killTree(pid);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!(await isPortFree(service.port))) {
      say(`No pude liberar el puerto ${service.port}. Ciérralo manualmente.`);
      process.exit(EXIT_PORT_IN_USE);
    }
  }

  const running = SERVICES.map((service) => new Supervised(service));
  running.forEach((s) => { s.start(); s.watch(); });

  say('Backend: http://localhost:3000   ·   Frontend: http://localhost:5173   ·   Ctrl+C para detener todo');

  const stopAll = () => {
    if (stopping) return;
    stopping = true;
    say('Deteniendo servicios…');
    running.forEach((s) => s.stop());
    setTimeout(() => process.exit(0), 1500);
  };
  process.on('SIGINT', stopAll);
  process.on('SIGTERM', stopAll);
  process.on('SIGHUP', stopAll);
}

main();
