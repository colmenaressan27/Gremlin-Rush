export type GremlinKind = 'runner';

/** 'wander' = deambula sin amenazar (práctica); 'attack' = corre hacia el núcleo. */
export type GremlinBehavior = 'wander' | 'attack';

export type GremlinState =
  | 'inactive'
  | 'spawning'
  | 'walking'
  | 'held'
  | 'thrown'
  | 'stunned'
  | 'dying';

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
  /** Golpes encadenados por este gremlin en su lanzamiento actual. */
  chain: number;
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
  };
}

export const isGrabbable = (g: Gremlin): boolean => g.state === 'walking' || g.state === 'stunned';

/** Puede recibir el impacto de un gremlin lanzado. */
export const isHittable = (g: Gremlin): boolean =>
  g.state === 'walking' || g.state === 'stunned' || g.state === 'spawning';
