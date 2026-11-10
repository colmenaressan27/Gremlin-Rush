import type { VisionResult } from '../vision/VisionLoop';

const EMA = 0.12;
const WINDOW_MS = 1000;
/** Los primeros instantes de una sesión (arranque, compilación de shaders) no cuentan para el mínimo. */
const WARMUP_WINDOWS = 2;

export interface GestureCounters {
  /** Pellizcos deliberados detectados (con o sin objetivo). */
  pinches: number;
  grabs: number;
  misses: number;
  throws: number;
  dropsSlow: number;
  /** Agarres perdidos porque la mano dejó de verse. */
  dropsLost: number;
  hits: number;
  trackingLosses: number;
}

/**
 * Métricas locales y no personales para el modo diagnóstico y el informe de fase.
 * No se envían a ningún sitio.
 */
export class Metrics {
  fps = 0;
  /** FPS mínimo y medio por ventanas de 1 s desde resetSession(). */
  sessionFpsMin = 0;
  sessionFpsAvg = 0;
  worstFrameMs = 0;
  inferenceMs = 0;
  detectHz = 0;
  /** Tiempo aproximado entre el fotograma de cámara y el dibujo que lo refleja. */
  latencyMs = 0;
  latencySource = '—';
  lastRelease = '—';
  readonly counters: GestureCounters = {
    pinches: 0,
    grabs: 0,
    misses: 0,
    throws: 0,
    dropsSlow: 0,
    dropsLost: 0,
    hits: 0,
    trackingLosses: 0,
  };

  private windowStart = 0;
  private windowFrames = 0;
  private windowDetections = 0;
  private windowWorst = 0;
  private sessionWindows = 0;
  private sessionFpsSum = 0;

  resetSession(): void {
    const c = this.counters;
    c.pinches = c.grabs = c.misses = c.throws = 0;
    c.dropsSlow = c.dropsLost = c.hits = c.trackingLosses = 0;
    this.sessionWindows = 0;
    this.sessionFpsSum = 0;
    this.sessionFpsMin = 0;
    this.sessionFpsAvg = 0;
    this.lastRelease = '—';
  }

  frame(now: number, dtMs: number): void {
    this.windowFrames++;
    if (dtMs > this.windowWorst) this.windowWorst = dtMs;
    const elapsed = now - this.windowStart;
    if (elapsed < WINDOW_MS) return;

    this.fps = (this.windowFrames * 1000) / elapsed;
    this.detectHz = (this.windowDetections * 1000) / elapsed;
    this.worstFrameMs = this.windowWorst;
    this.sessionWindows++;
    if (this.sessionWindows > WARMUP_WINDOWS) {
      const counted = this.sessionWindows - WARMUP_WINDOWS;
      this.sessionFpsSum += this.fps;
      this.sessionFpsAvg = this.sessionFpsSum / counted;
      this.sessionFpsMin = counted === 1 ? this.fps : Math.min(this.sessionFpsMin, this.fps);
    }
    this.windowStart = now;
    this.windowFrames = 0;
    this.windowDetections = 0;
    this.windowWorst = 0;
  }

  vision(result: VisionResult): void {
    this.windowDetections++;
    this.inferenceMs =
      this.inferenceMs === 0
        ? result.inferenceMs
        : this.inferenceMs + (result.inferenceMs - this.inferenceMs) * EMA;
    this.latencySource = result.frameTimeSource;
  }

  latency(ms: number): void {
    if (ms < 0 || ms > 1000) return;
    this.latencyMs = this.latencyMs === 0 ? ms : this.latencyMs + (ms - this.latencyMs) * EMA;
  }

  /** Porcentaje de pellizcos deliberados que acabaron en agarre. */
  grabRate(): number {
    const c = this.counters;
    return c.pinches === 0 ? 0 : (c.grabs / c.pinches) * 100;
  }
}
