import { CONFIG } from './gameConfig';

/** Mejor puntuación, guardada solo en este dispositivo (sin cuentas ni servidor). */
export function loadBestScore(): number {
  try {
    const value = Number(localStorage.getItem(CONFIG.score.storageKey));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

/** Guarda la puntuación si supera el récord. Devuelve true si es un récord nuevo. */
export function submitScore(score: number): boolean {
  if (score <= 0 || score <= loadBestScore()) return false;
  try {
    localStorage.setItem(CONFIG.score.storageKey, String(score));
  } catch {
    // Sin almacenamiento disponible: el récord vale solo para esta sesión.
  }
  return true;
}
