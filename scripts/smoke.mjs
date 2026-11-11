// Prueba de humo automática en un navegador de escritorio (Chrome o Edge ya instalados).
//
//  A) Canal real: cámara FALSA del navegador + MediaPipe. Comprueba que la cámara abre, el modelo
//     carga y la detección corre sin errores. La cámara falsa no muestra ninguna mano, así que
//     NO valida la detección de manos ni el rendimiento en un teléfono.
//  B) Simulación (?sim=1): el ratón hace de mano. Recorre una partida completa:
//     inicio por gesto → práctica → combate → puntuación → pausa → derrota → reinicio por gesto.
//  C) Simulación con partida corta: victoria por tiempo, bonus y récord.
//
// Uso: npm run smoke   (arranca su propio servidor de desarrollo)
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, 'qa-artifacts');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASA ' : 'FALLA'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEWPORT = { width: 844, height: 390 };

async function launch() {
  const args = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    '--use-angle=d3d11',
  ];
  // Chrome primero: en Edge la cámara falsa se corta sola a los pocos segundos (comprobado en Edge
  // de escritorio con una página mínima, sin código del juego), lo que invalida la parte A.
  for (const channel of ['chrome', 'msedge']) {
    try {
      const browser = await chromium.launch({ channel, headless: true, args });
      console.log(`Navegador de pruebas: ${channel} ${browser.version()}`);
      return browser;
    } catch {
      // Se prueba el siguiente navegador instalado.
    }
  }
  throw new Error('No se encontró Google Chrome ni Microsoft Edge.');
}

const gr = (page, expr) => page.evaluate(`(() => { const g = window.__gremlinRush; return ${expr}; })()`);

async function waitFor(page, expr, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await gr(page, expr)) return true;
    await sleep(100);
  }
  console.log(`      (tiempo agotado esperando: ${label})`);
  return false;
}

async function realPipeline(browser, baseUrl) {
  console.log('\nA) Cámara falsa + MediaPipe');
  const page = await browser.newPage({ viewport: VIEWPORT });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const origin = new URL(baseUrl).origin;
  const external = new Set();
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) external.add(url);
  });
  await page.goto(`${baseUrl}?diag=1`);
  check('F01 primera apertura explica cámara y privacidad', await page.getByText('Privacidad:').isVisible());
  await page.getByRole('button', { name: 'Activar cámara' }).click();
  const prepared = await waitFor(page, `g.state() === 'prepare'`, 60000, 'estado prepare');
  check('cámara y detector de mano arrancan', prepared);
  await sleep(3500);
  const info = await gr(
    page,
    `({ hz: g.metrics.detectHz, ms: g.metrics.inferenceMs, fps: g.metrics.fps, delegate: g.delegate(), hand: g.hand.tracking })`,
  );
  check('la detección procesa fotogramas de cámara', info.hz > 5, `${info.hz.toFixed(0)} Hz, ${info.ms.toFixed(1)} ms, ${info.delegate}`);
  check('sin mano no hay acciones fantasma', info.hand === 'lost');
  check('la arena se dibuja', info.fps > 5, `${info.fps.toFixed(0)} FPS (PC, no representativo del móvil)`);
  check('sin errores de consola', errors.length === 0, errors.slice(0, 3).join(' | '));
  check(
    'F18 ninguna petición sale a servidores externos (ni CDN ni analíticas)',
    external.size === 0,
    [...external].slice(0, 3).join(' | '),
  );
  await page.screenshot({ path: join(shots, 'a-camara-falsa.png') });
  await page.close();
}

async function deniedCamera(browser, baseUrl) {
  console.log('\nA2) Permiso de cámara denegado');
  const context = await browser.newContext({ viewport: VIEWPORT, permissions: [] });
  const page = await context.newPage();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  });
  await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Activar cámara' }).click();
  const shown = await page
    .getByRole('heading', { name: 'Sin permiso de cámara' })
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  check('F02 cámara denegada: mensaje útil y botón de reintento', shown && (await page.getByRole('button', { name: 'Reintentar' }).isVisible()));
  await page.screenshot({ path: join(shots, 'a2-camara-denegada.png') });
  await context.close();
}

/** Mantiene la "palma abierta" (botón derecho) sobre el núcleo hasta que cambie el estado. */
async function confirmWithPalm(page, expected) {
  const core = await gr(page, 'g.core()');
  await page.mouse.move(core.x + 5, core.y + 5);
  await page.mouse.down({ button: 'right' });
  const ok = await waitFor(page, `g.state() === '${expected}'`, 6000, `estado ${expected}`);
  await page.mouse.up({ button: 'right' });
  return ok;
}

/**
 * Atrapa un gremlin y lo lanza hacia otro. Devuelve true si consigue un golpe nuevo,
 * false si falla, y null si todavía no había munición y objetivo (no cuenta como intento).
 */
async function grabAndThrow(page) {
  const before = await gr(page, 'g.metrics.counters.hits');
  const list = (await gr(page, 'g.gremlins()')).filter((g) => g.state === 'walking');
  if (list.length < 2) {
    await sleep(300);
    return null;
  }
  const [ammo, target] = list;
  await page.mouse.move(ammo.x, ammo.y, { steps: 4 });
  await sleep(120);
  await page.mouse.down();
  await sleep(250);
  // Apunta a la posición ACTUAL del objetivo y hace un gesto rápido en esa dirección.
  const now = (await gr(page, 'g.gremlins()')).find((g) => g.id === target.id) ?? target;
  const dx = now.x - ammo.x;
  const dy = now.y - ammo.y;
  const len = Math.hypot(dx, dy) || 1;
  // Como en un lanzamiento real, los dedos se abren en pleno movimiento, no al detenerse.
  const reach = Math.min(len * 0.8, 220);
  const STEPS = 6;
  const RELEASE_AT = 5;
  for (let i = 1; i <= STEPS; i++) {
    await page.mouse.move(ammo.x + (dx / len) * reach * (i / STEPS), ammo.y + (dy / len) * reach * (i / STEPS));
    if (i === RELEASE_AT) await page.mouse.up();
    await sleep(8);
  }
  await sleep(700);
  return (await gr(page, 'g.metrics.counters.hits')) > before;
}

/** Lanza gremlins hasta que se cumpla la condición o se agote el tiempo. */
async function throwUntil(page, expr, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await gr(page, expr)) return true;
    await grabAndThrow(page);
  }
  return gr(page, expr);
}

async function openSimulated(browser, baseUrl, query) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${baseUrl}?sim=1&${query}`);
  await page.evaluate(() => localStorage.clear());
  await page.getByRole('button', { name: 'Activar cámara' }).click();
  await waitFor(page, `g.state() === 'prepare'`, 10000, 'prepare');
  return { page, errors };
}

async function fullMatch(browser, baseUrl) {
  console.log('\nB) Partida completa con mano simulada (derrota)');
  const { page, errors } = await openSimulated(browser, baseUrl, 'diag=1');
  check('llega a la preparación', (await gr(page, 'g.state()')) === 'prepare');
  await page.screenshot({ path: join(shots, 'b1-preparacion.png') });

  // Un clic de ratón (equivalente a tocar la pantalla) sobre el núcleo NO debe iniciar nada.
  const core = await gr(page, 'g.core()');
  await page.mouse.click(core.x, core.y);
  await sleep(400);
  check('tocar/pellizcar en el menú no inicia la partida', (await gr(page, 'g.state()')) === 'prepare');

  check('F14 inicio por gesto: palma abierta mantenida', await confirmWithPalm(page, 'playing'));
  check('la primera partida empieza en práctica, sin reloj ni peligro', (await gr(page, 'g.session.phase')) === 'practice');
  await sleep(700);

  // Soltar con la mano quieta no debe lanzar.
  const [first] = (await gr(page, 'g.gremlins()')).filter((g) => g.state === 'walking');
  await page.mouse.move(first.x, first.y, { steps: 3 });
  await sleep(120);
  await page.mouse.down();
  await sleep(400);
  const grabbed = (await gr(page, 'g.metrics.counters.grabs')) === 1;
  await page.screenshot({ path: join(shots, 'b2-agarre.png') });
  await page.mouse.up();
  await sleep(300);
  const counters = await gr(page, 'g.metrics.counters');
  check('F04 un pellizco sobre un gremlin lo captura (una sola captura)', grabbed);
  check('F06 soltar en reposo no lanza', counters.throws === 0 && counters.dropsSlow === 1);
  await sleep(600);

  const combat = await throwUntil(page, `g.session.phase === 'combat'`, 45000);
  check('F07/F08 el primer golpe termina la práctica y empieza el combate', combat);
  check('la práctica no da puntos', (await gr(page, 'g.session.score')) === 0);

  const scored = await throwUntil(page, `g.session.score > 0 || g.state() !== 'playing'`, 30000);
  const mid = await gr(page, '({ score: g.session.score, lives: g.session.lives, defeated: g.session.defeated, c: g.metrics.counters })');
  check(
    'F11 derrotar gremlins suma puntos',
    scored && mid.score > 0,
    `${mid.score} puntos · ${mid.defeated} derrotados · ${mid.c.throws} lanzados · ${mid.c.grabs}/${mid.c.pinches} agarres`,
  );
  await page.screenshot({ path: join(shots, 'b3-combate.png') });

  // Pausa de recuperación: la mano desaparece varios segundos en pleno combate.
  if ((await gr(page, 'g.state()')) === 'playing') {
    await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerleave')));
    const paused = await page.getByText('Muestra la mano para seguir').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    const t1 = await gr(page, 'g.session.timeLeft');
    await sleep(1200);
    const t2 = await gr(page, 'g.session.timeLeft');
    check('la partida se pausa si la mano falta varios segundos', paused);
    check('F12 en pausa el cronómetro no corre', paused && t1 === t2, `${t1.toFixed(2)} s → ${t2.toFixed(2)} s`);
    await page.screenshot({ path: join(shots, 'b4-pausa.png') });
    await page.mouse.move(60, 330);
    await sleep(900);
    check('se reanuda sola al volver la mano', !(await page.getByText('Muestra la mano para seguir').isVisible()));
  }

  // Sin defender, el núcleo cae: mano presente pero quieta en una esquina.
  const lost = await waitFor(page, `g.state() === 'result'`, 60000, 'resultado');
  const end = await gr(page, '({ phase: g.session.phase, lives: g.session.lives, score: g.session.score })');
  check('F10 el núcleo pierde sus vidas una a una hasta la derrota', lost && end.phase === 'lost' && end.lives === 0);
  check('F13 el resultado explica la derrota y muestra puntuación', await page.getByRole('heading', { name: 'Núcleo destruido' }).isVisible());
  await sleep(400);
  await page.screenshot({ path: join(shots, 'b5-derrota.png') });

  const restarted = lost && (await confirmWithPalm(page, 'playing'));
  check('F14 reinicio por gesto, sin tocar botones', restarted);
  check('la segunda partida entra directa al combate', restarted && (await gr(page, 'g.session.phase')) === 'combat');
  check('sin errores de ejecución', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

async function shortWin(browser, baseUrl) {
  console.log('\nC) Partida corta con mano simulada (victoria)');
  const { page, errors } = await openSimulated(browser, baseUrl, 'duracion=3');
  await confirmWithPalm(page, 'playing');
  await sleep(500);
  const combat = await throwUntil(page, `g.session.phase !== 'practice'`, 45000);
  const finished = combat && (await waitFor(page, `g.state() === 'result'`, 15000, 'resultado'));
  const end = await gr(page, '({ phase: g.session.phase, lives: g.session.lives, score: g.session.score, bonus: g.session.lifeBonus })');
  check('F12 la partida termina al agotarse el tiempo con el núcleo en pie', finished && end.phase === 'won', `fase ${end.phase}, ${end.lives} vidas`);
  check('la victoria suma bonus por vidas conservadas', end.bonus === end.lives * 500 && end.score >= end.bonus, `${end.score} puntos, bonus ${end.bonus}`);
  check('F13 el resultado anuncia la victoria y el récord local', (await page.getByRole('heading', { name: '¡Núcleo a salvo!' }).isVisible()) && (await page.getByText('¡Nuevo!').isVisible()));
  const stored = await page.evaluate(() => Number(localStorage.getItem('gremlinrush.record.v1')));
  check('el récord se guarda solo en el dispositivo', stored === end.score, `guardado ${stored}`);
  await sleep(400);
  await page.screenshot({ path: join(shots, 'c-victoria.png') });
  check('sin errores de ejecución (victoria)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const baseUrl = server.resolvedUrls.local[0];
await mkdir(shots, { recursive: true });
let browser;
try {
  browser = await launch();
  await realPipeline(browser, baseUrl);
  await deniedCamera(browser, baseUrl);
  await fullMatch(browser, baseUrl);
  await shortWin(browser, baseUrl);
} finally {
  await browser?.close();
  await server.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas. Capturas en qa-artifacts/`);
process.exit(failed ? 1 : 0);
