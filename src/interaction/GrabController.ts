import type { ArenaAnchor } from '../ar/ArenaAnchor';
import { CONFIG } from '../config/gameConfig';
import { angleDelta, clamp, damp, lerp, type Vec2 } from '../core/math';
import type { Gremlin } from '../game/Gremlin';
import type { World } from '../game/World';
import type { GestureInterpreter } from '../input/GestureInterpreter';
import { ThrowEstimator } from '../input/ThrowEstimator';

export type DropReason = 'slow' | 'lost' | 'cancel';

export interface GrabListener {
  onHoverChange(g: Gremlin | null): void;
  onGrab(g: Gremlin): void;
  /** Pellizco deliberado sin ningún gremlin al alcance. */
  onMiss(): void;
  /** Pellizco sobre un enemigo que pesa demasiado para levantarlo (Tank). */
  onTooHeavy(g: Gremlin): void;
  onChargeFull(g: Gremlin): void;
  onThrow(g: Gremlin, handSpeed: number, launchSpeed: number): void;
  onDrop(g: Gremlin, reason: DropReason, handSpeed: number): void;
}

const GR = CONFIG.grab;
const TH = CONFIG.throwing;
const AR = CONFIG.arena;
const LIFT_RATE = 14;
const DEG = Math.PI / 180;
/** Fracción de la velocidad mínima de lanzamiento a partir de la cual se marca el objetivo previsto. */
const AIM_PREVIEW = 0.6;

/**
 * Traduce el estado gestual en acciones de juego: resaltar, agarrar, cargar, lanzar o soltar.
 * Trabaja en coordenadas de arena (2.5D): no pretende que el dedo toque una malla 3D real.
 */
export class GrabController {
  listener: GrabListener | null = null;
  hovered: Gremlin | null = null;
  held: Gremlin | null = null;
  /** Cursor de agarre proyectado a la arena. Solo válido si cursorValid. */
  readonly cursor: Vec2 = { x: 0, y: 0 };
  cursorValid = false;
  /** Velocidad de mano estimada mientras se sostiene (arena/s): alimenta la flecha de trayectoria. */
  readonly aim: Vec2 = { x: 0, y: 0 };
  aimSpeed = 0;
  /** Enemigo al que iría el lanzamiento si se soltara ahora (para marcarlo en pantalla). */
  aimTarget: Gremlin | null = null;
  /** Elevación visual 0..1 del gremlin sostenido. */
  lift = 0;

  private readonly estimator = new ThrowEstimator();
  private readonly knuckle: Vec2 = { x: 0, y: 0 };
  private readonly velocity: Vec2 = { x: 0, y: 0 };
  private pendingPinchUntil = -1;
  private lastSeq = -1;
  private chargeNotified = false;

  constructor(
    private readonly world: World,
    private readonly anchor: ArenaAnchor,
    private readonly gestures: GestureInterpreter,
  ) {}

  /** Suelta lo que haya en la mano sin lanzarlo (fin de partida, pausa). */
  cancel(): void {
    this.pendingPinchUntil = -1;
    this.setHovered(null);
    if (!this.held) return;
    const g = this.held;
    this.clearHeld();
    this.world.drop(g);
    this.listener?.onDrop(g, 'cancel', 0);
  }

  /**
   * @param interactive false fuera de la partida (menús): solo se proyecta el cursor,
   *                    sin resaltar ni agarrar nada.
   */
  update(dtSeconds: number, now: number, interactive: boolean): void {
    const hand = this.gestures.state;
    const events = this.gestures.events;

    this.lift = damp(this.lift, this.held ? 1 : 0, LIFT_RATE, dtSeconds);
    const planeY = lerp(AR.cursorPlaneY, AR.holdHeight, this.held ? this.lift : 0);
    this.cursorValid =
      hand.tracking !== 'lost' && this.anchor.screenToArena(hand.x, hand.y, planeY, this.cursor);
    if (this.cursorValid) this.clampRadius(this.cursor, AR.maxCursorRadius);

    if (!interactive) {
      this.pendingPinchUntil = -1;
      this.setHovered(null);
      this.gestures.clearEvents();
      return;
    }

    if (events.pinchEnd) {
      this.pendingPinchUntil = -1;
      if (this.held) this.release(events.pinchEnd, events.releaseStartT, hand.sampleT);
    }
    if (events.pinchStart && !this.held) this.pendingPinchUntil = now + GR.bufferMs;
    this.gestures.clearEvents();

    if (this.held) this.updateHeld(dtSeconds);
    else this.updateFree(now);
  }

  private updateFree(now: number): void {
    const hand = this.gestures.state;
    const candidate =
      this.cursorValid && hand.stable
        ? this.world.findGrabbable(this.cursor.x, this.cursor.y, GR.assistRadius)
        : null;
    this.setHovered(candidate);

    if (this.pendingPinchUntil < 0) return;
    if (candidate && hand.pinching) {
      this.pendingPinchUntil = -1;
      this.grab(candidate);
    } else if (now > this.pendingPinchUntil || !hand.pinching) {
      this.pendingPinchUntil = -1;
      const heavy = this.cursorValid
        ? this.world.findTooHeavy(this.cursor.x, this.cursor.y, GR.assistRadius)
        : null;
      if (heavy) this.listener?.onTooHeavy(heavy);
      else this.listener?.onMiss();
    }
  }

  private grab(g: Gremlin): void {
    this.setHovered(null);
    this.held = g;
    this.world.grab(g);
    this.gestures.setHolding(true);
    this.estimator.reset();
    this.lastSeq = -1;
    this.chargeNotified = false;
    this.aimSpeed = 0;
    this.listener?.onGrab(g);
  }

  private updateHeld(dtSeconds: number): void {
    const g = this.held;
    if (!g) return;
    if (g.state !== 'held') {
      // La simulación lo sacó de la mano (p. ej. reinicio de la arena): no hay nada que sostener.
      this.clearHeld();
      return;
    }
    const hand = this.gestures.state;

    if (this.cursorValid) {
      this.clampRadius(this.cursor, GR.holdClampRadius);
      g.x = damp(g.x, this.cursor.x, GR.followK, dtSeconds);
      g.y = damp(g.y, this.cursor.y, GR.followK, dtSeconds);
    }

    g.charge = clamp(g.charge + dtSeconds / GR.chargeSeconds, 0, 1);
    if (g.charge >= 1 && !this.chargeNotified) {
      this.chargeNotified = true;
      this.listener?.onChargeFull(g);
    }

    // La velocidad se mide con el nudillo del índice: no se mueve al abrir los dedos,
    // así que soltar con la mano quieta no genera un lanzamiento falso.
    if (hand.seq !== this.lastSeq && hand.tracking === 'ok') {
      this.lastSeq = hand.seq;
      if (this.anchor.screenToArena(hand.knuckleX, hand.knuckleY, AR.cursorPlaneY, this.knuckle)) {
        this.clampRadius(this.knuckle, AR.maxCursorRadius);
        this.estimator.push(hand.sampleT, this.knuckle.x, this.knuckle.y);
      }
    }
    const ok = this.estimator.estimate(hand.sampleT, TH.windowMs, TH.minSamples, this.aim);
    this.aimSpeed = ok ? Math.hypot(this.aim.x, this.aim.y) : 0;
    this.aimTarget =
      this.aimSpeed >= TH.minSpeed * AIM_PREVIEW
        ? this.world.findAimTarget(
            g,
            Math.atan2(this.aim.y, this.aim.x),
            TH.aimAssistDeg * DEG,
            TH.aimAssistRange,
          )
        : null;
  }

  private release(reason: 'open' | 'lost', releaseStartT: number, sampleT: number): void {
    const g = this.held;
    if (!g) return;
    this.clearHeld();

    if (reason === 'lost') {
      this.world.drop(g);
      this.listener?.onDrop(g, 'lost', 0);
      return;
    }

    // Se mide en dos ventanas —hasta que los dedos empezaron a abrirse y hasta la última muestra—
    // y se toma la más rápida: el gesto cuenta aunque la mano frene mientras se confirma la apertura.
    this.estimator.estimate(releaseStartT, TH.windowMs, TH.minSamples, this.velocity);
    this.estimator.estimate(sampleT, TH.windowMs, TH.minSamples, this.aim);
    if (Math.hypot(this.aim.x, this.aim.y) > Math.hypot(this.velocity.x, this.velocity.y)) {
      this.velocity.x = this.aim.x;
      this.velocity.y = this.aim.y;
    }
    const handSpeed = Math.hypot(this.velocity.x, this.velocity.y);
    if (handSpeed < TH.minSpeed) {
      this.world.drop(g);
      this.listener?.onDrop(g, 'slow', handSpeed);
      return;
    }

    const launch =
      clamp(handSpeed * TH.gain, TH.minLaunch, TH.maxLaunch) * (1 + TH.chargeSpeedBonus * g.charge);
    let angle = Math.atan2(this.velocity.y, this.velocity.x);
    const target = this.world.findAimTarget(g, angle, TH.aimAssistDeg * DEG, TH.aimAssistRange);
    if (target) {
      const toTarget = Math.atan2(target.y - g.y, target.x - g.x);
      angle += angleDelta(angle, toTarget) * TH.aimAssistStrength;
    }
    this.world.throwGremlin(g, Math.cos(angle) * launch, Math.sin(angle) * launch, g.charge);
    this.listener?.onThrow(g, handSpeed, launch);
  }

  private clearHeld(): void {
    this.held = null;
    this.aimSpeed = 0;
    this.aimTarget = null;
    this.gestures.setHolding(false);
  }

  private setHovered(g: Gremlin | null): void {
    if (g === this.hovered) return;
    this.hovered = g;
    this.listener?.onHoverChange(g);
  }

  private clampRadius(p: Vec2, max: number): void {
    const r = Math.hypot(p.x, p.y);
    if (r > max) {
      p.x = (p.x / r) * max;
      p.y = (p.y / r) * max;
    }
  }
}
