/**
 * Filtro One Euro (Casiez et al., 2012): suaviza mucho cuando la señal está quieta (sin temblor)
 * y casi nada cuando se mueve rápido (sin retraso perceptible en los lanzamientos).
 */
export class OneEuroFilter {
  private value = 0;
  private deriv = 0;
  private lastT = 0;
  private initialized = false;

  constructor(
    private readonly minCutoffHz: number,
    private readonly beta: number,
    private readonly derivCutoffHz: number,
  ) {}

  reset(): void {
    this.initialized = false;
  }

  /** @param tSeconds marca de tiempo de la muestra, en segundos. */
  filter(raw: number, tSeconds: number): number {
    if (!this.initialized) {
      this.initialized = true;
      this.value = raw;
      this.deriv = 0;
      this.lastT = tSeconds;
      return raw;
    }
    const dt = tSeconds - this.lastT;
    if (dt <= 0) return this.value;
    this.lastT = tSeconds;

    const rawDeriv = (raw - this.value) / dt;
    this.deriv += (rawDeriv - this.deriv) * alpha(this.derivCutoffHz, dt);
    const cutoff = this.minCutoffHz + this.beta * Math.abs(this.deriv);
    this.value += (raw - this.value) * alpha(cutoff, dt);
    return this.value;
  }
}

function alpha(cutoffHz: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dt);
}
