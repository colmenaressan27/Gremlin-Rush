import { CONFIG } from './gameConfig';

/** Ajustes que el jugador puede cambiar ANTES de la partida. Se guardan solo en este dispositivo. */
export interface Settings {
  cameraFacing: 'environment' | 'user';
  /** Invierte el espejo calculado automáticamente (por si los movimientos salen al revés). */
  flipMirror: boolean;
  /** 0 = pellizco muy estricto, 1 = pellizco muy permisivo. */
  sensitivity: number;
  reduceEffects: boolean;
  sound: boolean;
  diagnostics: boolean;
  /** Texto del HUD y de los menús más grande. */
  largeText: boolean;
  /** Modo asistido: enemigos más lentos y apariciones más espaciadas. */
  assisted: boolean;
  arenaScale: number;
  arenaOffsetY: number;
  arenaTiltDeg: number;
}

export const ARENA_LIMITS = {
  scale: { min: 0.5, max: 1.4, step: 0.02 },
  offsetY: { min: -0.3, max: 0.3, step: 0.01 },
  tiltDeg: { min: 25, max: 85, step: 1 },
} as const;

export function defaultSettings(): Settings {
  const reduce =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    cameraFacing: 'environment',
    flipMirror: false,
    sensitivity: 0.5,
    reduceEffects: reduce,
    sound: true,
    diagnostics: false,
    largeText: false,
    assisted: false,
    arenaScale: 1,
    arenaOffsetY: CONFIG.arena.defaultOffsetY,
    arenaTiltDeg: CONFIG.arena.defaultTiltDeg,
  };
}

export function loadSettings(): Settings {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    const merged = base as unknown as Record<string, unknown>;
    for (const key of Object.keys(merged)) {
      // Solo se aceptan claves conocidas y del mismo tipo que el valor por defecto.
      if (typeof saved[key] === typeof merged[key]) merged[key] = saved[key];
    }
    return base;
  } catch {
    return base;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(settings));
  } catch {
    // Almacenamiento no disponible (modo privado): el juego sigue funcionando sin guardar.
  }
}
