// Prepara los recursos de visión para que el juego funcione 100 % en local:
//  1. Copia el runtime WASM de MediaPipe desde node_modules a public/.
//  2. Descarga (una sola vez) el modelo Hand Landmarker oficial de Google (Apache-2.0).
// Así el navegador nunca pide nada a un CDN de terceros mientras se juega.
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const soft = process.argv.includes('--soft');

const WASM_SRC = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const WASM_DST = join(root, 'public', 'mediapipe', 'wasm');
const MODEL_DST = join(root, 'public', 'models', 'hand_landmarker.task');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';
const MODEL_MIN_BYTES = 1_000_000;

let failed = false;

async function copyWasm() {
  if (!existsSync(WASM_SRC)) {
    throw new Error(`No existe ${WASM_SRC}. Ejecuta primero "npm install".`);
  }
  await mkdir(WASM_DST, { recursive: true });
  await cp(WASM_SRC, WASM_DST, { recursive: true });
  console.log('[recursos] Runtime WASM de MediaPipe copiado a public/mediapipe/wasm');
}

async function downloadModel() {
  if (existsSync(MODEL_DST) && (await stat(MODEL_DST)).size > MODEL_MIN_BYTES) {
    console.log('[recursos] Modelo de mano ya presente (public/models/hand_landmarker.task)');
    return;
  }
  console.log('[recursos] Descargando modelo de mano (~8 MB)...');
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Descarga fallida: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < MODEL_MIN_BYTES) throw new Error('El modelo descargado parece incompleto.');
  await mkdir(dirname(MODEL_DST), { recursive: true });
  await writeFile(MODEL_DST, bytes);
  console.log(`[recursos] Modelo guardado (${(bytes.length / 1e6).toFixed(1)} MB)`);
}

for (const step of [copyWasm, downloadModel]) {
  try {
    await step();
  } catch (err) {
    failed = true;
    console.error(`[recursos] ERROR: ${err instanceof Error ? err.message : err}`);
  }
}

if (failed) {
  console.error('[recursos] Faltan recursos. Revisa tu conexión y ejecuta: npm run prepare-assets');
  process.exit(soft ? 0 : 1);
}
