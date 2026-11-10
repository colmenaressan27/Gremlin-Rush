import type { Vec2 } from '../core/math';

const CAPACITY = 32;
/** Con menos recorrido temporal que esto la pendiente no es fiable. */
const MIN_SPAN_MS = 35;

/**
 * Estima la velocidad de la mano con una regresión lineal sobre una ventana corta de muestras,
 * en lugar de la diferencia entre dos fotogramas (demasiado ruidosa para un lanzamiento justo).
 */
export class ThrowEstimator {
  private readonly ts = new Float64Array(CAPACITY);
  private readonly xs = new Float64Array(CAPACITY);
  private readonly ys = new Float64Array(CAPACITY);
  private head = 0;
  private count = 0;

  reset(): void {
    this.head = 0;
    this.count = 0;
  }

  push(tMs: number, x: number, y: number): void {
    this.ts[this.head] = tMs;
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.head = (this.head + 1) % CAPACITY;
    if (this.count < CAPACITY) this.count++;
  }

  /**
   * Velocidad media (unidades/segundo) en la ventana [endMs - windowMs, endMs].
   * Devuelve false, con velocidad cero, si no hay datos suficientes.
   */
  estimate(endMs: number, windowMs: number, minSamples: number, out: Vec2): boolean {
    out.x = 0;
    out.y = 0;
    const startMs = endMs - windowMs;
    let n = 0;
    let sumT = 0;
    let sumX = 0;
    let sumY = 0;
    let minT = Number.POSITIVE_INFINITY;
    let maxT = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < this.count; i++) {
      const t = this.ts[i]!;
      if (t < startMs || t > endMs) continue;
      n++;
      sumT += t;
      sumX += this.xs[i]!;
      sumY += this.ys[i]!;
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    }
    if (n < minSamples || maxT - minT < MIN_SPAN_MS) return false;

    const meanT = sumT / n;
    const meanX = sumX / n;
    const meanY = sumY / n;
    let covX = 0;
    let covY = 0;
    let varT = 0;
    for (let i = 0; i < this.count; i++) {
      const t = this.ts[i]!;
      if (t < startMs || t > endMs) continue;
      const dt = t - meanT;
      covX += dt * (this.xs[i]! - meanX);
      covY += dt * (this.ys[i]! - meanY);
      varT += dt * dt;
    }
    if (varT <= 0) return false;
    out.x = (covX / varT) * 1000;
    out.y = (covY / varT) * 1000;
    return true;
  }
}
