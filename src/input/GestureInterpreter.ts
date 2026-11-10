import { CONFIG } from '../config/gameConfig';
import { clamp } from '../core/math';
import { OneEuroFilter } from './OneEuroFilter';

/** Muestra de mano ya proyectada a píxeles de pantalla (venga de la cámara o del simulador). */
export interface HandSample {
  /** Marca de tiempo en ms (performance.now). */
  t: number;
  x: number;
  y: number;
  palmX: number;
  palmY: number;
  knuckleX: number;
  knuckleY: number;
  pinchRatio: number;
  extendedFingers: number;
  viewportHeight: number;
}

export type TrackingStatus = 'lost' | 'ok' | 'grace';

export interface HandState {
  tracking: TrackingStatus;
  /** Mano visible el tiempo suficiente para aceptar gestos. */
  stable: boolean;
  /** Punto de agarre suavizado, en píxeles de pantalla. */
  x: number;
  y: number;
  palmX: number;
  palmY: number;
  /** Nudillo del índice suavizado: referencia para medir la velocidad de lanzamiento. */
  knuckleX: number;
  knuckleY: number;
  pinching: boolean;
  pinchRatio: number;
  openPalm: boolean;
  /** Se incrementa con cada muestra aceptada. */
  seq: number;
  sampleT: number;
  absentMs: number;
}

/** Eventos de un solo uso: el consumidor los lee y llama a clearEvents(). */
export interface GestureEvents {
  pinchStart: boolean;
  /** 'open' = el jugador abrió los dedos; 'lost' = se perdió la mano (nunca genera lanzamiento). */
  pinchEnd: 'open' | 'lost' | null;
  /** Momento en que empezó a abrirse el pellizco (referencia para medir el lanzamiento). */
  releaseStartT: number;
}

const G = CONFIG.gesture;
/** Sin muestras durante este tiempo, el estado pasa a "en espera" (no se inventan gestos). */
const GRACE_AFTER_MS = 100;
const OPEN_PALM_FINGERS = 4;

/**
 * Máquina de estados gestual: ausente → presente → pellizcando.
 * Aplica histéresis, permanencia mínima, suavizado y tolerancia a pérdidas breves.
 */
export class GestureInterpreter {
  readonly state: HandState = {
    tracking: 'lost',
    stable: false,
    x: 0,
    y: 0,
    palmX: 0,
    palmY: 0,
    knuckleX: 0,
    knuckleY: 0,
    pinching: false,
    pinchRatio: 1,
    openPalm: false,
    seq: 0,
    sampleT: 0,
    absentMs: Number.POSITIVE_INFINITY,
  };

  readonly events: GestureEvents = { pinchStart: false, pinchEnd: null, releaseStartT: 0 };

  private closeThreshold: number = G.pinchCloseRatio;
  private openThreshold: number = G.pinchOpenRatio;
  private holding = false;
  /** Solo se acepta un pellizco si antes se vio la mano abierta (evita agarres al entrar en cuadro). */
  private armed = false;
  private presentSince = 0;
  private lastSeen = Number.NEGATIVE_INFINITY;
  private closeSince = -1;
  private openSince = -1;
  private palmChangeSince = -1;

  /** Un filtro por coordenada: cursor (x, y), palma (x, y) y nudillo (x, y). */
  private readonly filters = Array.from(
    { length: 6 },
    () => new OneEuroFilter(G.cursorMinCutoffHz, G.cursorBeta, G.cursorDerivCutoffHz),
  );

  /** @param sensitivity 0 = estricto, 1 = permisivo. */
  setSensitivity(sensitivity: number): void {
    const shift = (clamp(sensitivity, 0, 1) - 0.5) * 2 * G.sensitivitySpan;
    this.closeThreshold = G.pinchCloseRatio + shift;
    this.openThreshold = G.pinchOpenRatio + shift;
  }

  /** Mientras se sostiene un gremlin se tolera más tiempo de oclusión. */
  setHolding(holding: boolean): void {
    this.holding = holding;
  }

  get thresholds(): { close: number; open: number } {
    return { close: this.closeThreshold, open: this.openThreshold };
  }

  clearEvents(): void {
    this.events.pinchStart = false;
    this.events.pinchEnd = null;
  }

  pushSample(s: HandSample): void {
    const st = this.state;
    if (st.tracking === 'lost') {
      for (const f of this.filters) f.reset();
      this.presentSince = s.t;
      this.armed = false;
      this.closeSince = -1;
      this.openSince = -1;
      this.palmChangeSince = -1;
    }
    st.tracking = 'ok';
    st.absentMs = 0;
    this.lastSeen = s.t;
    st.stable = s.t - this.presentSince >= G.stableMs;
    st.seq++;
    st.sampleT = s.t;

    // Se filtra en "alturas de pantalla" para que el ajuste no dependa de la resolución.
    const h = Math.max(1, s.viewportHeight);
    const ts = s.t / 1000;
    const f = this.filters;
    st.x = f[0]!.filter(s.x / h, ts) * h;
    st.y = f[1]!.filter(s.y / h, ts) * h;
    st.palmX = f[2]!.filter(s.palmX / h, ts) * h;
    st.palmY = f[3]!.filter(s.palmY / h, ts) * h;
    st.knuckleX = f[4]!.filter(s.knuckleX / h, ts) * h;
    st.knuckleY = f[5]!.filter(s.knuckleY / h, ts) * h;
    st.pinchRatio = s.pinchRatio;

    if (st.pinching) this.updateRelease(s);
    else this.updateClose(s);
    this.updateOpenPalm(s);
  }

  private updateClose(s: HandSample): void {
    if (s.pinchRatio > (this.closeThreshold + this.openThreshold) / 2) this.armed = true;
    if (this.state.stable && this.armed && s.pinchRatio < this.closeThreshold) {
      if (this.closeSince < 0) this.closeSince = s.t;
      if (s.t - this.closeSince >= G.closeDwellMs) {
        this.state.pinching = true;
        this.events.pinchStart = true;
        this.closeSince = -1;
        this.openSince = -1;
      }
    } else {
      this.closeSince = -1;
    }
  }

  private updateRelease(s: HandSample): void {
    if (s.pinchRatio > this.openThreshold) {
      if (this.openSince < 0) this.openSince = s.t;
      if (s.t - this.openSince >= G.openDwellMs) {
        this.state.pinching = false;
        this.events.pinchEnd = 'open';
        this.events.releaseStartT = this.openSince;
        this.openSince = -1;
      }
    } else {
      this.openSince = -1;
    }
  }

  private updateOpenPalm(s: HandSample): void {
    const st = this.state;
    const raw =
      !st.pinching && s.extendedFingers >= OPEN_PALM_FINGERS && s.pinchRatio > this.openThreshold;
    if (raw === st.openPalm) {
      this.palmChangeSince = -1;
      return;
    }
    if (this.palmChangeSince < 0) this.palmChangeSince = s.t;
    const needed = raw ? G.openPalmOnMs : G.openPalmOffMs;
    if (s.t - this.palmChangeSince >= needed) {
      st.openPalm = raw;
      this.palmChangeSince = -1;
    }
  }

  /** Llamar en cada fotograma de render: gestiona la pérdida de seguimiento. */
  tick(now: number): void {
    const st = this.state;
    const gap = now - this.lastSeen;
    if (st.tracking === 'lost') {
      st.absentMs = gap;
      return;
    }
    if (gap > GRACE_AFTER_MS) st.tracking = 'grace';
    const tolerance = this.holding ? G.holdGraceMs : G.graceMs;
    if (gap > tolerance) {
      st.tracking = 'lost';
      st.stable = false;
      st.openPalm = false;
      st.absentMs = gap;
      if (st.pinching) {
        st.pinching = false;
        this.events.pinchEnd = 'lost';
      }
    }
  }
}
