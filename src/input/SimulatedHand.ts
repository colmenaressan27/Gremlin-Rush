import type { HandSample } from './GestureInterpreter';

const PINCH_CLOSED = 0.12;
const PINCH_OPEN = 0.85;
const FINGERS_OPEN = 4;
const FINGERS_RELAXED = 2;
const PALM_BUTTON = 2;

/**
 * SOLO DESARROLLO (?sim=1): sustituye la mano por el ratón para depurar en un PC sin cámara
 * y para las pruebas automáticas. Botón izquierdo = pellizco; botón derecho o tecla O = palma abierta.
 * No es un modo de juego: el producto se controla exclusivamente con la mano.
 */
export class SimulatedHand {
  private inside = false;
  private x = 0;
  private y = 0;
  private pinch = false;
  private palm = false;
  private readonly sample: HandSample = {
    t: 0,
    x: 0,
    y: 0,
    palmX: 0,
    palmY: 0,
    knuckleX: 0,
    knuckleY: 0,
    pinchRatio: PINCH_OPEN,
    extendedFingers: FINGERS_RELAXED,
    viewportHeight: 1,
  };

  constructor(target: HTMLElement) {
    target.addEventListener('pointermove', (e) => {
      this.inside = true;
      this.x = e.clientX;
      this.y = e.clientY;
    });
    target.addEventListener('pointerdown', (e) => {
      this.inside = true;
      this.x = e.clientX;
      this.y = e.clientY;
      if (e.button === PALM_BUTTON) this.palm = true;
      else this.pinch = true;
    });
    target.addEventListener('pointerup', (e) => {
      if (e.button === PALM_BUTTON) this.palm = false;
      else this.pinch = false;
    });
    target.addEventListener('pointerleave', () => {
      this.inside = false;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'o') this.palm = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.key.toLowerCase() === 'o') this.palm = false;
    });
  }

  /** Muestra actual, o null si el puntero está fuera (equivale a "mano ausente"). */
  poll(now: number, viewportHeight: number): HandSample | null {
    if (!this.inside) return null;
    const s = this.sample;
    s.t = now;
    s.x = this.x;
    s.y = this.y;
    s.palmX = this.x;
    s.palmY = this.y;
    s.knuckleX = this.x;
    s.knuckleY = this.y;
    s.pinchRatio = this.pinch ? PINCH_CLOSED : PINCH_OPEN;
    s.extendedFingers = this.palm && !this.pinch ? FINGERS_OPEN : FINGERS_RELAXED;
    s.viewportHeight = viewportHeight;
    return s;
  }
}
