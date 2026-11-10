import { CONFIG } from '../config/gameConfig';
import { clamp } from '../core/math';

const DECAY_FACTOR = 2;

/**
 * Confirmación por gesto mantenido (palma abierta dentro de una zona), solo para menús.
 * Tras armarse ignora la mano un instante, para no confundir "soltar un gremlin" con "confirmar".
 */
export class HoldConfirm {
  /** Avance 0..1, para dibujar la cuenta atrás. */
  progress = 0;
  private lockUntil = 0;
  private fired = false;

  arm(now: number): void {
    this.progress = 0;
    this.fired = false;
    this.lockUntil = now + CONFIG.gesture.confirmLockoutMs;
  }

  /** Devuelve true una sola vez, cuando el gesto se completa. */
  update(dtMs: number, now: number, active: boolean): boolean {
    if (this.fired) return false;
    if (now < this.lockUntil) {
      this.progress = 0;
      return false;
    }
    const step = dtMs / CONFIG.gesture.confirmHoldMs;
    this.progress = clamp(this.progress + (active ? step : -step * DECAY_FACTOR), 0, 1);
    if (this.progress >= 1) {
      this.fired = true;
      return true;
    }
    return false;
  }
}
