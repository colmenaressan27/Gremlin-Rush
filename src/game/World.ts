import { CONFIG } from '../config/gameConfig';
import { angleDelta, clamp, randRange } from '../core/math';
import {
  createGremlin,
  isGrabbable,
  isHittable,
  type Gremlin,
  type GremlinBehavior,
  type GremlinKind,
} from './Gremlin';

/** Avisos de la simulación hacia efectos, sonido, puntuación y métricas. */
export interface WorldListener {
  onSpawn(g: Gremlin): void;
  onImpact(projectile: Gremlin, victim: Gremlin, speed: number): void;
  onWallBounce(g: Gremlin, speed: number): void;
  onSettle(g: Gremlin): void;
  /** Un proyectil que había golpeado a alguien se detiene y desaparece ("munición gastada"). */
  onSpent(g: Gremlin): void;
  /** Un atacante toca el núcleo: se avisa una sola vez y el gremlin desaparece. */
  onCoreReached(g: Gremlin): void;
  onDefeated(g: Gremlin): void;
}

const P = CONFIG.physics;
const A = CONFIG.arena;
const R = CONFIG.runner;
const TWO_PI = Math.PI * 2;
const ARRIVE_DISTANCE = 0.06;
const TURN_RATE = 10;
const TUMBLE_RATE = 14;
/** Desvío lateral del proyectil al chocar, como fracción de su velocidad. */
const IMPACT_DEFLECTION = 0.25;
const WALL_BOUNCE_MIN_SPEED = 0.4;
/** Fracción del radio del gremlin que debe solaparse con el núcleo para contar como contacto. */
const CORE_CONTACT = 0.4;

/**
 * Simulación 2.5D de la arena: círculos sobre un plano con paso fijo.
 * No se usa un motor de física externo: con menos de una docena de cuerpos circulares
 * una solución propia es más ligera y más fácil de ajustar al "game feel".
 */
export class World {
  readonly gremlins: Gremlin[] = [];
  listener: WorldListener | null = null;
  private accumulator = 0;
  private time = 0;

  constructor(capacity: number) {
    for (let i = 0; i < capacity; i++) this.gremlins.push(createGremlin(i));
  }

  reset(): void {
    for (const g of this.gremlins) g.state = 'inactive';
    this.accumulator = 0;
  }

  /** Gremlins vivos (no cuentan los que están desapareciendo). Opcionalmente, solo los de un comportamiento. */
  countActive(behavior?: GremlinBehavior): number {
    let n = 0;
    for (const g of this.gremlins) {
      if (g.state === 'inactive' || g.state === 'dying') continue;
      if (behavior === undefined || g.behavior === behavior) n++;
    }
    return n;
  }

  /** Cambia el comportamiento de todos los gremlins vivos (p. ej. al acabar la práctica o la partida). */
  setAllBehavior(behavior: GremlinBehavior, speed: number): void {
    for (const g of this.gremlins) {
      if (g.state === 'inactive') continue;
      g.behavior = behavior;
      g.speed = speed;
      if (behavior === 'wander') this.pickTarget(g);
    }
  }

  spawn(
    kind: GremlinKind,
    x: number,
    y: number,
    behavior: GremlinBehavior = 'wander',
    speed: number = R.speed,
  ): Gremlin | null {
    for (const g of this.gremlins) {
      if (g.state !== 'inactive') continue;
      g.kind = kind;
      g.behavior = behavior;
      g.speed = speed;
      g.state = 'spawning';
      g.x = x;
      g.y = y;
      g.vx = 0;
      g.vy = 0;
      g.radius = R.radius;
      g.facing = Math.atan2(-y, -x);
      g.stateTime = 0;
      g.stateDuration = P.spawnSeconds;
      g.phase = Math.random() * TWO_PI;
      g.charge = 0;
      g.power = 0;
      g.chain = 0;
      this.pickTarget(g);
      this.listener?.onSpawn(g);
      return g;
    }
    return null;
  }

  /** Gremlin agarrable más cercano al punto, dentro del radio de captura asistida. */
  findGrabbable(x: number, y: number, radius: number): Gremlin | null {
    let best: Gremlin | null = null;
    let bestDist = radius;
    for (const g of this.gremlins) {
      if (!isGrabbable(g)) continue;
      const d = Math.hypot(g.x - x, g.y - y);
      if (d <= bestDist) {
        bestDist = d;
        best = g;
      }
    }
    return best;
  }

  /**
   * Objetivo para la ayuda de puntería: el gremlin golpeable más alineado con la dirección
   * de lanzamiento, dentro de un cono estrecho. Devuelve null si no hay ninguno claro.
   */
  findAimTarget(from: Gremlin, dirAngle: number, maxAngle: number, range: number): Gremlin | null {
    let best: Gremlin | null = null;
    let bestAngle = maxAngle;
    for (const g of this.gremlins) {
      if (g === from || !isHittable(g)) continue;
      const dx = g.x - from.x;
      const dy = g.y - from.y;
      if (Math.hypot(dx, dy) > range) continue;
      const off = Math.abs(angleDelta(dirAngle, Math.atan2(dy, dx)));
      if (off <= bestAngle) {
        bestAngle = off;
        best = g;
      }
    }
    return best;
  }

  grab(g: Gremlin): void {
    g.state = 'held';
    g.stateTime = 0;
    g.vx = 0;
    g.vy = 0;
    g.charge = 0;
    g.chain = 0;
  }

  throwGremlin(g: Gremlin, vx: number, vy: number, power: number): void {
    g.state = 'thrown';
    g.stateTime = 0;
    g.vx = vx;
    g.vy = vy;
    g.power = power;
    g.chain = 0;
  }

  /** Suelta sin impulso: el gremlin cae en un punto seguro dentro de la arena. */
  drop(g: Gremlin): void {
    g.state = 'stunned';
    g.stateTime = 0;
    g.stateDuration = P.dropStunSeconds;
    g.vx = 0;
    g.vy = 0;
    this.keepInside(g);
    this.keepOffCore(g);
  }

  update(dtSeconds: number): void {
    this.accumulator = Math.min(this.accumulator + dtSeconds, P.stepSeconds * P.maxStepsPerFrame);
    while (this.accumulator >= P.stepSeconds) {
      this.accumulator -= P.stepSeconds;
      this.step(P.stepSeconds);
    }
  }

  private step(dt: number): void {
    this.time += dt;
    for (const g of this.gremlins) {
      if (g.state === 'inactive') continue;
      g.stateTime += dt;
      switch (g.state) {
        case 'spawning':
          if (g.stateTime >= g.stateDuration) this.setWalking(g);
          break;
        case 'walking':
          this.stepWalking(g, dt);
          break;
        case 'held':
          break;
        case 'thrown':
          this.stepThrown(g, dt);
          break;
        case 'stunned':
          if (g.stateTime >= g.stateDuration) this.setWalking(g);
          break;
        case 'dying':
          this.stepDying(g, dt);
          break;
      }
    }
    this.separateWalkers(dt);
  }

  private setWalking(g: Gremlin): void {
    g.state = 'walking';
    g.stateTime = 0;
    g.vx = 0;
    g.vy = 0;
    if (g.behavior === 'wander') this.pickTarget(g);
  }

  private pickTarget(g: Gremlin): void {
    const angle = Math.random() * TWO_PI;
    const radius = randRange(R.wanderMinRadius, R.wanderMaxRadius);
    g.targetX = Math.cos(angle) * radius;
    g.targetY = Math.sin(angle) * radius;
  }

  private stepWalking(g: Gremlin, dt: number): void {
    const attacking = g.behavior === 'attack';
    const dx = (attacking ? 0 : g.targetX) - g.x;
    const dy = (attacking ? 0 : g.targetY) - g.y;
    const d = Math.hypot(dx, dy);
    if (attacking) {
      if (d <= A.coreRadius + g.radius * CORE_CONTACT) {
        // Contacto válido con el núcleo: daño una sola vez y el gremlin desaparece.
        g.state = 'inactive';
        this.listener?.onCoreReached(g);
        return;
      }
    } else if (d < ARRIVE_DISTANCE) {
      this.pickTarget(g);
      return;
    }
    // Avance hacia el destino con un vaivén lateral: ruta "ligeramente cambiante".
    let sway = Math.sin(this.time * TWO_PI * R.swayHz + g.phase) * R.swayAmplitude;
    if (attacking) sway *= Math.min(1, d / R.attackSwayFadeRadius);
    let mx = dx / d - (dy / d) * sway;
    let my = dy / d + (dx / d) * sway;
    const m = Math.hypot(mx, my);
    mx /= m;
    my /= m;
    g.vx = mx * g.speed;
    g.vy = my * g.speed;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.facing += angleDelta(g.facing, Math.atan2(my, mx)) * Math.min(1, TURN_RATE * dt);
    this.keepInside(g);
    if (!attacking) this.keepOffCore(g);
  }

  private stepThrown(g: Gremlin, dt: number): void {
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    const drag = Math.exp(-P.thrownDrag * dt);
    g.vx *= drag;
    g.vy *= drag;
    g.facing += TUMBLE_RATE * dt;

    // Rebote contra el borde de la arena.
    const limit = A.radius - g.radius;
    const r = Math.hypot(g.x, g.y);
    if (r > limit) {
      const nx = g.x / r;
      const ny = g.y / r;
      const outward = g.vx * nx + g.vy * ny;
      if (outward > 0) {
        g.vx -= (1 + P.wallRestitution) * outward * nx;
        g.vy -= (1 + P.wallRestitution) * outward * ny;
        if (outward > WALL_BOUNCE_MIN_SPEED) this.listener?.onWallBounce(g, outward);
      }
      g.x = nx * limit;
      g.y = ny * limit;
    }

    for (const other of this.gremlins) {
      if (other === g || !isHittable(other)) continue;
      const dx = other.x - g.x;
      const dy = other.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d > g.radius + other.radius) continue;
      const speed = Math.hypot(g.vx, g.vy);
      if (speed < P.minImpactSpeed) continue;
      this.resolveImpact(g, other, dx, dy, d, speed);
    }

    if (Math.hypot(g.vx, g.vy) < P.settleSpeed) {
      g.vx = 0;
      g.vy = 0;
      g.stateTime = 0;
      if (P.projectileSpentOnHit && g.chain > 0) {
        g.state = 'dying';
        g.stateDuration = P.dyingSeconds;
        this.listener?.onSpent(g);
        return;
      }
      g.state = 'stunned';
      g.stateDuration = P.stunSeconds;
      this.keepOffCore(g);
      this.listener?.onSettle(g);
    }
  }

  private resolveImpact(
    projectile: Gremlin,
    victim: Gremlin,
    dx: number,
    dy: number,
    d: number,
    speed: number,
  ): void {
    const dirX = projectile.vx / speed;
    const dirY = projectile.vy / speed;

    victim.state = 'dying';
    victim.stateTime = 0;
    victim.stateDuration = P.dyingSeconds;
    victim.vx = dirX * P.knockbackSpeed;
    victim.vy = dirY * P.knockbackSpeed;

    // El proyectil pierde algo de velocidad y se desvía un poco hacia el lado contrario a la víctima,
    // pero sigue su camino: así una buena línea puede encadenar varios golpes.
    const nx = d > 0 ? -dx / d : -dirX;
    const ny = d > 0 ? -dy / d : -dirY;
    let vx = dirX + nx * IMPACT_DEFLECTION;
    let vy = dirY + ny * IMPACT_DEFLECTION;
    const m = Math.hypot(vx, vy) || 1;
    vx /= m;
    vy /= m;
    const retained = speed * P.impactRetain;
    projectile.vx = vx * retained;
    projectile.vy = vy * retained;
    projectile.chain++;
    this.listener?.onImpact(projectile, victim, speed);
  }

  private stepDying(g: Gremlin, dt: number): void {
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    const drag = Math.exp(-P.thrownDrag * 3 * dt);
    g.vx *= drag;
    g.vy *= drag;
    g.facing += TUMBLE_RATE * dt;
    if (g.stateTime >= g.stateDuration) {
      g.state = 'inactive';
      this.listener?.onDefeated(g);
    }
  }

  private separateWalkers(dt: number): void {
    const list = this.gremlins;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      if (a.state !== 'walking') continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        if (b.state !== 'walking') continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const overlap = a.radius + b.radius - d;
        if (overlap <= 0 || d === 0) continue;
        const push = Math.min(overlap, overlap * P.separationK * dt) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }

  private keepInside(g: Gremlin): void {
    const limit = A.radius - g.radius;
    const r = Math.hypot(g.x, g.y);
    if (r > limit) {
      g.x = (g.x / r) * limit;
      g.y = (g.y / r) * limit;
    }
  }

  private keepOffCore(g: Gremlin): void {
    const min = A.coreRadius + g.radius;
    const r = Math.hypot(g.x, g.y);
    if (r >= min) return;
    if (r === 0) {
      g.x = min;
      return;
    }
    g.x = (g.x / r) * min;
    g.y = (g.y / r) * min;
  }

  /** Punto de aparición en el portal indicado (borde de la arena). */
  static portalPosition(index: number, out: { x: number; y: number }): void {
    const angle = (index / A.portalCount) * TWO_PI + Math.PI / A.portalCount;
    const radius = clamp(A.radius - R.radius * 1.6, 0, A.radius);
    out.x = Math.cos(angle) * radius;
    out.y = Math.sin(angle) * radius;
  }
}
