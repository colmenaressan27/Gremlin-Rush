import { beforeEach, describe, expect, it } from 'vitest';
import type { ArenaAnchor } from '../src/ar/ArenaAnchor';
import { CONFIG } from '../src/config/gameConfig';
import type { Gremlin } from '../src/game/Gremlin';
import { SandboxSession } from '../src/game/SandboxSession';
import { World } from '../src/game/World';
import { GestureInterpreter } from '../src/input/GestureInterpreter';
import { GrabController, type DropReason } from '../src/interaction/GrabController';

const STEP = CONFIG.physics.stepSeconds;
const FRAME_MS = 1000 / 30;
/** Anclaje de prueba: 100 px de pantalla = 1 unidad de arena, origen en (500, 500). */
const PX = 100;
const fakeAnchor = {
  mode: 'overlay',
  label: 'prueba',
  tracking: true,
  layout: () => undefined,
  screenToArena: (x: number, y: number, _planeY: number, out: { x: number; y: number }) => {
    out.x = (x - 500) / PX;
    out.y = (y - 500) / PX;
    return true;
  },
  arenaToScreen: (x: number, _h: number, z: number, out: { x: number; y: number }) => {
    out.x = 500 + x * PX;
    out.y = 500 + z * PX;
    return out;
  },
} as unknown as ArenaAnchor;

function placeWalking(world: World, x: number, y: number): Gremlin {
  const g = world.spawn('runner', x, y)!;
  g.state = 'walking';
  g.targetX = x;
  g.targetY = y;
  return g;
}

const simulate = (world: World, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) world.update(STEP);
};

describe('World', () => {
  let world: World;
  const impacts: Array<{ chain: number }> = [];
  let bounces = 0;
  let defeated = 0;

  beforeEach(() => {
    world = new World(8);
    impacts.length = 0;
    bounces = 0;
    defeated = 0;
    world.listener = {
      onSpawn: () => undefined,
      onImpact: (p) => impacts.push({ chain: p.chain }),
      onWallBounce: () => bounces++,
      onSettle: () => undefined,
      onDefeated: () => defeated++,
    };
  });

  it('un gremlin lanzado derriba a otro, lo cuenta una sola vez y sigue su camino', () => {
    const projectile = placeWalking(world, -0.6, 0);
    const victim = placeWalking(world, 0.3, 0.02);
    world.grab(projectile);
    world.throwGremlin(projectile, 4, 0, 0.5);
    simulate(world, 0.4);
    expect(impacts).toEqual([{ chain: 1 }]);
    expect(victim.state === 'dying' || victim.state === 'inactive').toBe(true);
    expect(projectile.state).toBe('thrown');
    simulate(world, 1);
    expect(victim.state).toBe('inactive');
    expect(defeated).toBe(1);
    expect(impacts.length).toBe(1);
  });

  it('una buena línea encadena dos golpes con el mismo lanzamiento', () => {
    const projectile = placeWalking(world, -0.7, 0);
    placeWalking(world, -0.2, 0.02);
    placeWalking(world, 0.4, -0.05);
    world.grab(projectile);
    world.throwGremlin(projectile, 6, 0, 1);
    simulate(world, 0.6);
    expect(impacts.map((i) => i.chain)).toEqual([1, 2]);
  });

  it('rebota en el borde y nunca sale de la arena', () => {
    const g = placeWalking(world, 0, 0.4);
    world.grab(g);
    world.throwGremlin(g, 6, 1, 0);
    let maxR = 0;
    for (let i = 0; i < 240; i++) {
      world.update(STEP);
      maxR = Math.max(maxR, Math.hypot(g.x, g.y));
    }
    expect(bounces).toBeGreaterThan(0);
    expect(maxR).toBeLessThanOrEqual(CONFIG.arena.radius - g.radius + 1e-6);
  });

  it('el proyectil se frena, queda aturdido y vuelve a caminar', () => {
    const g = placeWalking(world, 0.3, 0.3);
    world.grab(g);
    world.throwGremlin(g, 2.5, 0, 0);
    simulate(world, 2);
    expect(['stunned', 'walking']).toContain(g.state);
    simulate(world, 1.5);
    expect(g.state).toBe('walking');
  });

  it('soltar fuera de la arena o sobre el núcleo deja al gremlin en un punto seguro', () => {
    const outside = placeWalking(world, 0.5, 0);
    world.grab(outside);
    outside.x = 1.1;
    world.drop(outside);
    expect(Math.hypot(outside.x, outside.y)).toBeLessThanOrEqual(CONFIG.arena.radius);

    const onCore = placeWalking(world, 0.5, 0.5);
    world.grab(onCore);
    onCore.x = 0.01;
    onCore.y = 0;
    world.drop(onCore);
    expect(Math.hypot(onCore.x, onCore.y)).toBeGreaterThanOrEqual(CONFIG.arena.coreRadius);
  });

  it('la sesión repone gremlins y termina al alcanzar los golpes objetivo', () => {
    const session = new SandboxSession(world);
    session.start();
    expect(world.countActive()).toBe(CONFIG.sandbox.population);
    world.gremlins[0]!.state = 'inactive';
    for (let i = 0; i < 200; i++) {
      world.update(STEP);
      session.update(STEP);
    }
    expect(world.countActive()).toBe(CONFIG.sandbox.population);
    for (let i = 0; i < CONFIG.sandbox.hitsToWin; i++) session.registerHit(i + 1);
    expect(session.done).toBe(true);
    expect(session.bestChain).toBe(CONFIG.sandbox.hitsToWin);
  });
});

describe('GrabController (agarrar → cargar → lanzar)', () => {
  let world: World;
  let gestures: GestureInterpreter;
  let grab: GrabController;
  let t: number;
  const log: string[] = [];
  let lastDrop: DropReason | null = null;

  /** Avanza un fotograma de 30 Hz con la mano en (x, y) de arena. */
  const frame = (x: number, y: number, pinched: boolean): void => {
    t += FRAME_MS;
    const px = 500 + x * PX;
    const py = 500 + y * PX;
    gestures.pushSample({
      t,
      x: px,
      y: py,
      palmX: px,
      palmY: py,
      knuckleX: px,
      knuckleY: py,
      pinchRatio: pinched ? 0.1 : 0.9,
      extendedFingers: 2,
      viewportHeight: 1000,
    });
    gestures.tick(t);
    grab.update(FRAME_MS / 1000, t, true);
    world.update(FRAME_MS / 1000);
  };
  const hold = (x: number, y: number, pinched: boolean, frames: number): void => {
    for (let i = 0; i < frames; i++) frame(x, y, pinched);
  };

  beforeEach(() => {
    world = new World(8);
    gestures = new GestureInterpreter();
    grab = new GrabController(world, fakeAnchor, gestures);
    t = 1000;
    log.length = 0;
    lastDrop = null;
    grab.listener = {
      onHoverChange: (g) => log.push(g ? 'hover' : 'unhover'),
      onGrab: () => log.push('grab'),
      onMiss: () => log.push('miss'),
      onChargeFull: () => log.push('full'),
      onThrow: () => log.push('throw'),
      onDrop: (_g, reason) => {
        lastDrop = reason;
        log.push('drop');
      },
    };
  });

  it('resalta al acercarse, agarra con el pellizco y el gremlin sigue a la mano sin saltos', () => {
    const g = placeWalking(world, 0.4, 0);
    hold(0.45, 0.05, false, 8);
    expect(grab.hovered).toBe(g);
    hold(0.45, 0.05, true, 3);
    expect(grab.held).toBe(g);
    expect(g.state).toBe('held');
    expect(log.filter((e) => e === 'grab').length).toBe(1);

    let maxJump = 0;
    let prev = g.x;
    for (let i = 0; i < 15; i++) {
      frame(0.45 - i * 0.02, 0.05, true);
      maxJump = Math.max(maxJump, Math.abs(g.x - prev));
      prev = g.x;
    }
    expect(maxJump).toBeLessThan(0.08);
    expect(Math.abs(g.x - grab.cursor.x)).toBeLessThan(0.05);
  });

  it('carga hasta el máximo en menos de un segundo y avisa una vez', () => {
    placeWalking(world, 0.4, 0);
    hold(0.4, 0, false, 8);
    hold(0.4, 0, true, 32);
    expect(grab.held?.charge).toBe(1);
    expect(log.filter((e) => e === 'full').length).toBe(1);
  });

  it('soltar con la mano quieta deja caer el gremlin: no hay lanzamiento involuntario', () => {
    const g = placeWalking(world, 0.4, 0);
    hold(0.4, 0, false, 8);
    hold(0.4, 0, true, 12);
    hold(0.4, 0, false, 4);
    expect(log).toContain('drop');
    expect(log).not.toContain('throw');
    expect(lastDrop).toBe('slow');
    expect(g.state).toBe('stunned');
    expect(Math.hypot(g.vx, g.vy)).toBe(0);
  });

  it('un movimiento rápido al soltar lanza en la dirección del movimiento', () => {
    const g = placeWalking(world, 0.5, 0.2);
    hold(0.5, 0.2, false, 8);
    hold(0.5, 0.2, true, 6);
    // Barrido hacia -X a ~4.5 unidades/s, abriendo los dedos al final del gesto.
    let x = 0.5;
    for (let i = 0; i < 5; i++) {
      x -= 0.15;
      frame(x, 0.2, true);
    }
    for (let i = 0; i < 3 && !log.includes('throw'); i++) {
      x -= 0.15;
      frame(x, 0.2, false);
    }
    expect(log).toContain('throw');
    expect(g.state).toBe('thrown');
    expect(g.vx).toBeLessThan(-CONFIG.throwing.minLaunch * 0.6);
    expect(Math.abs(g.vy)).toBeLessThan(Math.abs(g.vx) * 0.25);
  });

  it('si se pierde la mano mientras sostiene, el gremlin cae sin impulso', () => {
    const g = placeWalking(world, 0.4, 0);
    hold(0.4, 0, false, 8);
    hold(0.4, 0, true, 4);
    let x = 0.4;
    for (let i = 0; i < 4; i++) {
      x -= 0.15;
      frame(x, 0, true);
    }
    // La mano desaparece en pleno movimiento rápido.
    for (let i = 0; i < 30; i++) {
      t += FRAME_MS;
      gestures.tick(t);
      grab.update(FRAME_MS / 1000, t, true);
      world.update(FRAME_MS / 1000);
    }
    expect(lastDrop).toBe('lost');
    expect(log).not.toContain('throw');
    expect(Math.hypot(g.vx, g.vy)).toBe(0);
  });

  it('un pellizco lejos de cualquier gremlin no captura nada', () => {
    const g = placeWalking(world, 0.6, 0);
    hold(-0.5, -0.4, false, 8);
    hold(-0.5, -0.4, true, 10);
    expect(grab.held).toBeNull();
    expect(g.state).toBe('walking');
    expect(log).toContain('miss');
  });

  it('con dos gremlins cerca captura solo el más próximo', () => {
    const near = placeWalking(world, 0.3, 0);
    const far = placeWalking(world, 0.3, 0.18);
    hold(0.3, 0.03, false, 8);
    hold(0.3, 0.03, true, 3);
    expect(grab.held).toBe(near);
    expect(far.state).toBe('walking');
  });
});
