import type { GestureInterpreter } from '../input/GestureInterpreter';
import type { Metrics } from '../qa/Metrics';
import { el } from './dom';

const REFRESH_MS = 250;
const LANDMARKS = 21;
const TWO_PI = Math.PI * 2;

export interface DiagnosticsContext {
  camera: string;
  delegate: string;
  qualityTier: number;
  anchorMode: string;
  extendedFingers: number;
}

/**
 * Modo diagnóstico para desarrollo y pruebas en dispositivo: FPS, coste de visión, latencia aproximada,
 * estado del gesto y puntos de la mano. Desactivado por defecto en la partida normal.
 */
export class DiagnosticsPanel {
  /** Landmarks de la última detección en píxeles de pantalla (x0, y0, x1, y1, …). */
  readonly points = new Float32Array(LANDMARKS * 2);
  hasPoints = false;

  private readonly panel: HTMLElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private enabled = false;
  private lastRefresh = 0;

  constructor(
    root: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.panel = el('pre', 'diagnostics');
    this.panel.setAttribute('aria-hidden', 'true');
    this.panel.hidden = true;
    root.append(this.panel);
    this.ctx = canvas.getContext('2d');
    canvas.hidden = true;
  }

  get active(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.panel.hidden = !enabled;
    this.canvas.hidden = !enabled;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  update(now: number, metrics: Metrics, gestures: GestureInterpreter, info: DiagnosticsContext): void {
    if (!this.enabled) return;
    this.drawHand(gestures);
    if (now - this.lastRefresh < REFRESH_MS) return;
    this.lastRefresh = now;

    const hand = gestures.state;
    const th = gestures.thresholds;
    const c = metrics.counters;
    this.panel.textContent = [
      `FPS ${metrics.fps.toFixed(0)} · peor frame ${metrics.worstFrameMs.toFixed(0)} ms · calidad ${info.qualityTier}`,
      `Sesión: media ${metrics.sessionFpsAvg.toFixed(0)} · mín ${metrics.sessionFpsMin.toFixed(0)} FPS`,
      `Visión ${metrics.inferenceMs.toFixed(1)} ms · ${metrics.detectHz.toFixed(0)} Hz · ${info.delegate}`,
      metrics.latencyMs > 0
        ? `Latencia ≈ ${metrics.latencyMs.toFixed(0)} ms (desde ${metrics.latencySource})`
        : 'Latencia: sin datos (falta mano)',
      `Cámara ${info.camera} · ${info.anchorMode}`,
      `Mano ${hand.tracking}${hand.stable ? '' : ' (inestable)'} · dedos ${info.extendedFingers}${hand.openPalm ? ' PALMA' : ''}`,
      `Pellizco ${hand.pinchRatio.toFixed(2)} [${th.close.toFixed(2)}/${th.open.toFixed(2)}]${hand.pinching ? ' CERRADO' : ''}`,
      `Agarres ${c.grabs}/${c.pinches} (${metrics.grabRate().toFixed(0)} %) · vacíos ${c.misses}`,
      `Lanzados ${c.throws} · soltados ${c.dropsSlow} · golpes ${c.hits}`,
      `Mano perdida ${c.trackingLosses} · caídos ${c.dropsLost}`,
      `Último: ${metrics.lastRelease}`,
    ].join('\n');
  }

  private drawHand(gestures: GestureInterpreter): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const hand = gestures.state;
    if (hand.tracking === 'lost') return;

    if (this.hasPoints) {
      ctx.fillStyle = 'rgba(245, 242, 237, 0.85)';
      for (let i = 0; i < LANDMARKS; i++) {
        ctx.beginPath();
        ctx.arc(this.points[i * 2]!, this.points[i * 2 + 1]!, 3, 0, TWO_PI);
        ctx.fill();
      }
    }
    // Punto de agarre suavizado: es lo que el juego usa de verdad.
    ctx.strokeStyle = hand.pinching ? '#ffe15a' : '#a5f02d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, hand.pinching ? 9 : 14, 0, TWO_PI);
    ctx.stroke();
    ctx.fillStyle = '#ff7d31';
    ctx.beginPath();
    ctx.arc(hand.knuckleX, hand.knuckleY, 5, 0, TWO_PI);
    ctx.fill();
  }
}
