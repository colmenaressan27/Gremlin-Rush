import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArenaAnchor } from '../src/ar/ArenaAnchor';
import { CONFIG } from '../src/config/gameConfig';
import type { Gremlin, GremlinKind } from '../src/game/Gremlin';
import { GameSession } from '../src/game/GameSession';
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

/** Coloca un gremlin quieto y ya caminando (sin la animación de aparición). */
function place(world: World, kind: GremlinKind, x: number, y: number): Gremlin {
  const g = world.spawn(kind, x, y)!;
  g.state = 'walking';
  g.speed = 0;
  g.targetX = x;
  g.targetY = y;
  return g;
}
const placeWalking = (world: World, x: number, y: number): Gremlin => place(world, 'runner', x, y);

const simulate = (world: World, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) world.update(STEP);
};

const gone = (g: Gremlin): boolean => g.state === 'dying' || g.state === 'inactive';

describe('World', () => {
  let world: World;
  const impacts: Array<{ chain: number; killed: boolean }> = [];
  const explosions: Array<{ hits: number; thrown: boolean }> = [];
  const blasts: Array<{ kind: GremlinKind; killed: boolean }> = [];
  let bounces = 0;
  let defeated = 0;
  let spent = 0;
  let coreHits = 0;

  const launch = (g: Gremlin, vx: number, vy: number): void => {
    world.grab(g);
    world.throwGremlin(g, vx, vy, 0.5);
  };

  beforeEach(() => {
    world = new World(10);
    impacts.length = 0;
    explosions.length = 0;
    blasts.length = 0;
    bounces = 0;
    defeated = 0;
    spent = 0;
    coreHits = 0;
    world.listener = {
      onSpawn: () => undefined,
      onImpact: (p, _v, _s, killed) => impacts.push({ chain: p.chain, killed }),
      onExplosion: (_b, hits, thrown) => explosions.push({ hits, thrown }),
      onBlast: (_b, v, killed) => blasts.push({ kind: v.kind, killed }),
      onWallBounce: () => bounces++,
      onSettle: () => undefined,
      onSpent: () => spent++,
      onCoreReached: () => coreHits++,
      onDefeated: () => defeated++,
    };
  });

  it('un gremlin lanzado derriba a otro una sola vez, sigue su camino y al detenerse se gasta', () => {
    const projectile = placeWalking(world, -0.6, 0);
    const victim = placeWalking(world, 0.3, 0.02);
    launch(projectile, 4, 0);
    simulate(world, 0.4);
    expect(impacts).toEqual([{ chain: 1, killed: true }]);
    expect(gone(victim)).toBe(true);
    expect(projectile.state).toBe('thrown');
    simulate(world, 3);
    expect(victim.state).toBe('inactive');
    expect(impacts.length).toBe(1);
    expect(spent).toBe(1);
    expect(projectile.state).toBe('inactive');
    expect(defeated).toBe(2);
  });

  it('un atacante camina hasta el núcleo, lo daña una sola vez y desaparece', () => {
    const g = world.spawn('runner', 0.8, 0, 'attack', 0.2)!;
    simulate(world, 8);
    expect(coreHits).toBe(1);
    expect(g.state).toBe('inactive');
    simulate(world, 3);
    expect(coreHits).toBe(1);
  });

  it('un atacante agarrado o aturdido no daña al núcleo hasta que vuelve a caminar', () => {
    const g = world.spawn('runner', 0.5, 0, 'attack', 0.2)!;
    simulate(world, 0.6);
    world.grab(g);
    simulate(world, 6);
    expect(coreHits).toBe(0);
    world.drop(g);
    simulate(world, 6);
    expect(coreHits).toBe(1);
  });

  it('una buena línea encadena dos golpes con el mismo lanzamiento', () => {
    const projectile = placeWalking(world, -0.7, 0);
    placeWalking(world, -0.2, 0.02);
    placeWalking(world, 0.4, -0.05);
    launch(projectile, 6, 0);
    simulate(world, 0.6);
    expect(impacts.map((i) => i.chain)).toEqual([1, 2]);
  });

  it('rebota en el borde y nunca sale de la arena', () => {
    const g = placeWalking(world, 0, 0.4);
    launch(g, 6, 1);
    let maxR = 0;
    for (let i = 0; i < 240; i++) {
      world.update(STEP);
      maxR = Math.max(maxR, Math.hypot(g.x, g.y));
    }
    expect(bounces).toBeGreaterThan(0);
    expect(maxR).toBeLessThanOrEqual(CONFIG.arena.radius - g.radius + 1e-6);
  });

  it('el proyectil que falla se frena, queda aturdido y vuelve a caminar', () => {
    const g = placeWalking(world, 0.3, 0.3);
    launch(g, 2.5, 0);
    simulate(world, 2);
    expect(['stunned', 'walking']).toContain(g.state);
    simulate(world, 1.5);
    expect(g.state).toBe('walking');
    expect(spent).toBe(0);
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

  describe('Tank', () => {
    it('aguanta un golpe: pierde armadura, vibra y el proyectil rebota y se gasta', () => {
      const tank = place(world, 'tank', 0.3, 0);
      const projectile = placeWalking(world, -0.6, 0);
      launch(projectile, 4, 0);
      simulate(world, 0.35);
      expect(impacts).toEqual([{ chain: 1, killed: false }]);
      expect(tank.hp).toBe(CONFIG.kinds.tank.hp - 1);
      expect(tank.state).toBe('walking');
      expect(tank.hurtTime).toBeLessThan(CONFIG.tank.hurtSeconds);
      expect(projectile.vx).toBeLessThan(0); // rebota: el Tank bloquea la trayectoria
      simulate(world, 4);
      expect(impacts.length).toBe(1); // el rebote no cuenta como un segundo golpe
      expect(spent).toBe(1);
      expect(tank.state).toBe('walking');
    });

    it('cae al tercer golpe', () => {
      const tank = place(world, 'tank', 0.3, 0);
      for (let i = 0; i < CONFIG.kinds.tank.hp; i++) {
        launch(placeWalking(world, -0.6, 0), 4, 0);
        simulate(world, 4);
      }
      expect(impacts.map((i) => i.killed)).toEqual([false, false, true]);
      expect(tank.state).toBe('inactive');
    });

    it('no se puede levantar con el pellizco, pero se detecta que está ahí', () => {
      const tank = place(world, 'tank', 0.3, 0);
      expect(world.findGrabbable(0.3, 0, CONFIG.grab.assistRadius)).toBeNull();
      expect(world.findTooHeavy(0.32, 0.02, CONFIG.grab.assistRadius)).toBe(tank);
      expect(world.findTooHeavy(-0.7, 0.5, CONFIG.grab.assistRadius)).toBeNull();
    });
  });

  describe('Bomb', () => {
    it('lanzado, explota al chocar y derriba a todos los que están dentro del radio', () => {
      const bomb = place(world, 'bomb', -0.6, 0);
      const direct = placeWalking(world, 0.2, 0);
      const near = placeWalking(world, 0.4, 0.15);
      const far = placeWalking(world, 0, -0.85);
      launch(bomb, 4, 0);
      simulate(world, 0.4);
      expect(explosions).toEqual([{ hits: 2, thrown: true }]);
      expect(blasts).toEqual([
        { kind: 'runner', killed: true },
        { kind: 'runner', killed: true },
      ]);
      expect(gone(bomb) && gone(direct) && gone(near)).toBe(true);
      expect(far.state).toBe('walking');
      expect(impacts.length).toBe(0); // un Bomb no golpea: explota
    });

    it('si no choca con nadie explota al agotarse la mecha, sin víctimas', () => {
      const bomb = place(world, 'bomb', 0, 0.5);
      const far = placeWalking(world, 0, -0.85);
      launch(bomb, 0.7, 0);
      simulate(world, CONFIG.bomb.thrownFuseSeconds + 0.1);
      expect(explosions).toEqual([{ hits: 0, thrown: true }]);
      expect(far.state).toBe('walking');
      simulate(world, 1);
      expect(bomb.state).toBe('inactive');
    });

    it('golpeado por un gremlin lanzado explota donde está', () => {
      const bomb = place(world, 'bomb', 0.3, 0);
      const bystander = placeWalking(world, 0.55, 0.2);
      launch(placeWalking(world, -0.6, 0), 4, 0);
      simulate(world, 0.4);
      expect(impacts).toEqual([{ chain: 1, killed: true }]);
      expect(explosions).toEqual([{ hits: 1, thrown: false }]);
      expect(gone(bomb) && gone(bystander)).toBe(true);
    });

    it('una explosión destruye a un Tank intacto de una vez', () => {
      const tank = place(world, 'tank', 0.3, 0);
      launch(place(world, 'bomb', -0.6, 0), 4, 0);
      simulate(world, 0.4);
      expect(blasts).toEqual([{ kind: 'tank', killed: true }]);
      expect(gone(tank)).toBe(true);
    });

    it('detona en cadena a otro Bomb cercano, con un pequeño retardo', () => {
      const first = place(world, 'bomb', -0.6, 0);
      placeWalking(world, 0.2, 0);
      const second = place(world, 'bomb', 0.3, 0.3);
      const onlyNearSecond = placeWalking(world, 0.72, 0.45);
      launch(first, 4, 0);
      simulate(world, 0.25);
      expect(explosions.length).toBe(1);
      expect(second.fuse).toBeGreaterThan(0);
      expect(world.findGrabbable(second.x, second.y, 0.1)).toBeNull(); // con la mecha encendida no se agarra
      expect(onlyNearSecond.state).toBe('walking');
      simulate(world, CONFIG.bomb.chainDelaySeconds + 0.1);
      expect(explosions.length).toBe(2);
      expect(explosions[1]!.thrown).toBe(false);
      expect(gone(second) && gone(onlyNearSecond)).toBe(true);
    });
  });
});

describe('GameSession (reglas de la partida)', () => {
  const M = CONFIG.match;
  const WAVES = CONFIG.waves;
  let world: World;
  let session: GameSession;

  /** Conecta el mundo con la sesión como lo hace la aplicación. */
  const wire = (): void => {
    world.listener = {
      onSpawn: () => undefined,
      onImpact: (_p, v, _s, killed) => void session.registerHit(v.kind, killed),
      onExplosion: (_b, hits, thrown) => {
        if (thrown && hits > 0) session.registerSpent('bomb');
      },
      onBlast: (_b, v, killed) => void session.registerHit(v.kind, killed),
      onWallBounce: () => undefined,
      onSettle: () => undefined,
      onSpent: (g) => void session.registerSpent(g.kind),
      onCoreReached: () => void session.registerCoreHit(),
      onDefeated: () => undefined,
    };
  };
  const run = (seconds: number, handX = 0, handY = 0, hand = false): void => {
    for (let i = 0; i < Math.round(seconds / STEP); i++) {
      world.update(STEP);
      session.update(STEP, handX, handY, hand);
    }
  };
  /** Recién aparecido en este paso: todavía no ha avanzado su reloj de estado. */
  const justSpawned = (g: Gremlin): boolean => g.state === 'spawning' && g.stateTime === 0;

  beforeEach(() => {
    world = new World(M.maxGremlins);
    session = new GameSession(world);
    wire();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('la práctica no tiene reloj ni peligro y repone gremlins', () => {
    session.start(true);
    expect(session.phase).toBe('practice');
    expect(world.countActive()).toBe(M.practicePopulation);
    world.gremlins[0]!.state = 'inactive';
    run(20);
    expect(session.phase).toBe('practice');
    expect(session.timeLeft).toBe(M.durationSeconds);
    expect(session.lives).toBe(M.lives);
    expect(world.countActive()).toBe(M.practicePopulation);
    expect(world.gremlins.every((g) => g.state === 'inactive' || (g.behavior === 'wander' && g.kind === 'runner'))).toBe(true);
  });

  it('el primer golpe termina la práctica: respiro sin reloj y después empieza el combate', () => {
    session.start(true);
    expect(session.registerHit('runner', true)).toBe(0);
    expect(session.phase).toBe('intro');
    run(M.introSeconds - 0.3);
    expect(session.phase).toBe('intro');
    expect(world.countActive('attack')).toBe(0);
    expect(session.timeLeft).toBe(M.durationSeconds);
    run(0.5);
    expect(session.phase).toBe('combat');
    expect(session.score).toBe(0);
    // Los de la práctica siguen deambulando (munición gratis) y entran los primeros atacantes.
    expect(world.countActive('wander')).toBe(M.practicePopulation);
    expect(world.countActive('attack')).toBe(M.openingSpawns);
  });

  it('puntúa según el tipo y el combo; los golpes resistidos alimentan el combo sin dar puntos', () => {
    const K = CONFIG.kinds;
    session.start(false);
    expect(session.registerHit('runner', true)).toBe(K.runner.points);
    expect(session.registerHit('bomb', true)).toBe(K.bomb.points * 2);
    expect(session.registerHit('tank', false)).toBe(0);
    expect(session.combo).toBe(3);
    expect(session.registerHit('tank', true)).toBe(K.tank.points * 4);
    expect(session.registerHit('runner', true)).toBe(K.runner.points * 5);
    expect(session.registerHit('runner', true)).toBe(K.runner.points * CONFIG.score.maxMultiplier);
    expect(session.registerSpent('runner')).toBe(K.runner.points); // munición gastada: sin multiplicador
    expect(session.bestCombo).toBe(6);
    expect(session.defeated).toBe(6);
    expect(session.defeatedByKind).toEqual({ runner: 4, bomb: 1, tank: 1 });
    const total = 100 + 300 + 1000 + 500 + 500 + 100;
    expect(session.score).toBe(total);

    // Sujetar un gremlin no da puntos.
    world.grab(world.gremlins.find((g) => g.state !== 'inactive')!);
    run(1);
    expect(session.score).toBe(total);
  });

  it('el combo caduca al pasar la ventana de tiempo sin impactos', () => {
    session.start(false);
    session.registerHit('runner', true);
    session.registerHit('runner', true);
    expect(session.multiplier).toBe(2);
    run(CONFIG.score.comboWindowSeconds * 0.5);
    expect(session.combo).toBe(2);
    expect(session.comboFraction).toBeGreaterThan(0.3);
    expect(session.comboFraction).toBeLessThan(0.7);
    run(CONFIG.score.comboWindowSeconds * 0.5 + 0.1);
    expect(session.combo).toBe(0);
    expect(session.registerHit('runner', true)).toBe(CONFIG.kinds.runner.points);
    expect(session.bestCombo).toBe(2);
  });

  it('si nadie defiende, el núcleo pierde sus tres vidas y la partida termina en derrota', () => {
    session.start(false);
    run(40);
    expect(session.lives).toBe(0);
    expect(session.phase).toBe('lost');
    expect(session.timeLeft).toBeGreaterThan(0);
    // Tras el final ya no hay atacantes ni más daño.
    const timeAtEnd = session.timeLeft;
    run(10);
    expect(session.timeLeft).toBe(timeAtEnd);
    expect(world.gremlins.every((g) => g.state === 'inactive' || g.behavior === 'wander')).toBe(true);
  });

  it('si el núcleo aguanta hasta agotar el tiempo se gana, con bonus por vida conservada', () => {
    session.start(false, { durationSeconds: 2 }); // demasiado corto para que alguien llegue al núcleo
    run(2.2);
    expect(session.phase).toBe('won');
    expect(session.lives).toBe(M.lives);
    expect(session.lifeBonus).toBe(M.lives * CONFIG.score.lifeBonus);
    expect(session.score).toBe(session.lifeBonus);
  });

  it('las oleadas presentan a los enemigos de uno en uno: Runners, luego Bomb y después Tank', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // sin sorteos: solo las presentaciones fijas
    session.start(false);
    const spawns: Array<{ kind: GremlinKind; progress: number; wave: number }> = [];
    while (session.phase === 'combat') {
      world.update(STEP);
      session.update(STEP, 0, 0, false);
      for (const g of world.gremlins) {
        if (justSpawned(g)) spawns.push({ kind: g.kind, progress: session.progress, wave: session.wave });
      }
      // Se retira a los que ya caminan para que siga habiendo hueco y no lleguen al núcleo.
      for (const g of world.gremlins) if (g.state === 'walking') g.state = 'inactive';
    }
    expect(session.phase).toBe('won');
    const first = spawns.filter((s) => s.wave === 0);
    const second = spawns.filter((s) => s.wave === 1);
    const last = spawns.filter((s) => s.wave === 2);
    expect(first.length).toBeGreaterThan(5);
    expect(first.every((s) => s.kind === 'runner')).toBe(true);
    expect(second[0]!.kind).toBe('bomb');
    expect(second[0]!.progress).toBeGreaterThanOrEqual(WAVES[0].until);
    const tanks = spawns.filter((s) => s.kind === 'tank');
    expect(tanks.length).toBe(1);
    expect(tanks[0]!.wave).toBe(1);
    expect(tanks[0]!.progress).toBeGreaterThanOrEqual(WAVES[1].tankFrom);
    expect(last.length).toBeGreaterThan(second.length); // la oleada final aprieta más
  });

  it('nunca supera los topes de enemigos, de Bombs ni de Tanks, ni siquiera con el sorteo más duro', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // el sorteo siempre pide el enemigo más pesado posible
    session.start(false);
    let max = 0;
    let maxBombs = 0;
    let maxTanks = 0;
    let maxInFirstWave = 0;
    while (session.phase === 'combat') {
      // Se frena a todos en el sitio (como si nadie llegara ni cayera) para que se acumulen.
      for (const g of world.gremlins) if (g.state === 'walking') g.speed = 0.0001;
      world.update(STEP);
      session.update(STEP, 0, 0, false);
      max = Math.max(max, world.countActive());
      maxBombs = Math.max(maxBombs, world.countKind('bomb'));
      maxTanks = Math.max(maxTanks, world.countKind('tank'));
      if (session.wave === 0) maxInFirstWave = world.countActive();
    }
    expect(maxInFirstWave).toBe(WAVES[0].maxAttackers);
    expect(max).toBe(WAVES[2].maxAttackers);
    expect(max).toBeLessThanOrEqual(M.maxEnemies);
    expect(maxBombs).toBe(M.maxBombs);
    expect(maxTanks).toBe(M.maxTanks);
  });

  it('el modo asistido ralentiza a los enemigos y espacia las apariciones', () => {
    const count = (assisted: boolean): { speed: number; spawned: number } => {
      session.start(false, { assisted });
      const speed = world.gremlins.find((g) => g.behavior === 'attack')!.speed;
      let spawned = 0;
      for (let i = 0; i < 60 * 15; i++) {
        world.update(STEP);
        session.update(STEP, 0, 0, false);
        for (const g of world.gremlins) if (justSpawned(g)) spawned++;
        for (const g of world.gremlins) if (g.state === 'walking') g.state = 'inactive';
      }
      return { speed, spawned };
    };
    const normal = count(false);
    const assisted = count(true);
    expect(assisted.speed).toBeCloseTo(normal.speed * M.assistSpeedFactor, 5);
    expect(assisted.spawned).toBeLessThan(normal.spawned);
  });

  it('una partida de prueba puede empezar con tiempo ya transcurrido, en la oleada que toca', () => {
    session.start(false, { startAtSeconds: 45 });
    expect(session.timeLeft).toBe(M.durationSeconds - 45);
    run(0.1);
    expect(session.wave).toBe(1);
  });

  it('los enemigos no aparecen justo debajo de la mano', () => {
    const hand = { x: 0, y: 0 };
    World.portalPosition(0, hand);
    session.start(false);
    let spawned = 0;
    for (let i = 0; i < 60 * 60 && session.phase === 'combat'; i++) {
      world.update(STEP);
      session.update(STEP, hand.x, hand.y, true);
      for (const g of world.gremlins) {
        if (!justSpawned(g)) continue;
        spawned++;
        expect(Math.hypot(g.x - hand.x, g.y - hand.y)).toBeGreaterThanOrEqual(M.spawnAvoidRadius);
      }
      for (const g of world.gremlins) if (g.state === 'walking') g.state = 'inactive';
    }
    expect(spawned).toBeGreaterThan(10);
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
      onTooHeavy: () => log.push('heavy'),
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

  it('mientras se apunta, marca el enemigo hacia el que saldría el lanzamiento', () => {
    placeWalking(world, 0.5, 0.2);
    const target = placeWalking(world, -0.6, 0.22);
    placeWalking(world, 0.5, -0.7);
    hold(0.5, 0.2, false, 8);
    hold(0.5, 0.2, true, 6);
    expect(grab.aimTarget).toBeNull(); // con la mano quieta no se señala a nadie
    let x = 0.5;
    for (let i = 0; i < 4; i++) {
      x -= 0.15;
      frame(x, 0.2, true);
    }
    expect(grab.aimTarget).toBe(target);
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

  it('un pellizco sobre un Tank no lo levanta y avisa de que pesa demasiado', () => {
    const tank = place(world, 'tank', 0.4, 0);
    hold(0.4, 0.02, false, 8);
    expect(grab.hovered).toBeNull();
    hold(0.4, 0.02, true, 10);
    expect(grab.held).toBeNull();
    expect(tank.state).toBe('walking');
    expect(log).toContain('heavy');
    expect(log).not.toContain('miss');
  });

  it('un Bomb se agarra y se lanza como cualquier otro, con la mecha encendida', () => {
    const bomb = place(world, 'bomb', 0.5, 0.2);
    hold(0.5, 0.2, false, 8);
    hold(0.5, 0.2, true, 6);
    expect(grab.held).toBe(bomb);
    expect(bomb.fuse).toBeLessThan(0);
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
    expect(bomb.fuse).toBeGreaterThan(0);
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
