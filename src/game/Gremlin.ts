import { CONFIG } from '../config/gameConfig';

export type GremlinKind = 'runner' | 'bomb' | 'tank';

/** 'wander' = deambula sin amenazar (práctica); 'attack' = camina hacia el núcleo. */
export type GremlinBehavior = 'wander' | 'attack';

export type GremlinState =
  | 'inactive'
  | 'spawning'
  | 'walking'
  | 'held'
  | 'thrown'
  | 'stunned'
  | 'dying';

/** Valor de hurtTime que significa "no ha recibido ningún golpe reciente". */
export const NOT_HURT = 99;

/** Entidad de simulación (sin nada de render). Posición en el plano de la arena: x, y(=Z del mundo). */
export interface Gremlin {
  readonly id: number;
  kind: GremlinKind;
  behavior: GremlinBehavior;
  state: GremlinState;
  /** Velocidad al caminar (arena/s). */
  speed: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** Orientación del cuerpo en el plano (radianes). */
  facing: number;
  /** Segundos en el estado actual. */
  stateTime: number;
  /** Duración prevista del estado actual, si es temporal (aparecer, aturdido, derrotado). */
  stateDuration: number;
  /** Destino de paseo. */
  targetX: number;
  targetY: number;
  /** Fase aleatoria para que no todos se balanceen igual. */
  phase: number;
  /** Carga 0..1 mientras está agarrado; potencia con la que fue lanzado. */
  charge: number;
  power: number;
  /** Golpes dados por este gremlin en su lanzamiento actual. */
  chain: number;
  /** Golpes que le quedan por aguantar. */
  hp: number;
  /** Segundos desde el último golpe que resistió (Tank); NOT_HURT si no hay ninguno reciente. */
  hurtTime: number;
  /** Bomb: segundos hasta explotar; negativo = mecha sin encender. */
  fuse: number;
}

export function createGremlin(id: number): Gremlin {
  return {
    id,
    kind: 'runner',
    behavior: 'wander',
    state: 'inactive',
    speed: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 0,
    facing: 0,
    stateTime: 0,
    stateDuration: 0,
    targetX: 0,
    targetY: 0,
    phase: 0,
    charge: 0,
    power: 0,
    chain: 0,
    hp: 1,
    hurtTime: NOT_HURT,
    fuse: -1,
  };
}

const onTheGround = (g: Gremlin): boolean => g.state === 'walking' || g.state === 'stunned';

/** Se puede levantar con el pellizco: en el suelo, de un tipo ligero y sin la mecha encendida. */
export const isGrabbable = (g: Gremlin): boolean =>
  onTheGround(g) && CONFIG.kinds[g.kind].grabbable && g.fuse < 0;

/** Está en el suelo pero pesa demasiado para levantarlo (Tank). */
export const isTooHeavy = (g: Gremlin): boolean => onTheGround(g) && !CONFIG.kinds[g.kind].grabbable;

/** Puede recibir el impacto de un gremlin lanzado o de una explosión. */
export const isHittable = (g: Gremlin): boolean => onTheGround(g) || g.state === 'spawning';
