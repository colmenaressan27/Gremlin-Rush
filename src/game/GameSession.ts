import { CONFIG } from '../config/gameConfig';
import { clamp, lerp } from '../core/math';
import type { GremlinKind } from './Gremlin';
import { World } from './World';

const M = CONFIG.match;
const S = CONFIG.score;
const K = CONFIG.kinds;
const WAVES = CONFIG.waves;
type Wave = (typeof WAVES)[number];

/**
 * 'practice' = sin reloj ni peligro, hasta el primer golpe del jugador.
 * 'intro'    = respiro breve tras ese golpe: se anuncia que hay que defender el núcleo.
 * 'combat'   = los gremlins atacan el núcleo durante el tiempo de partida.
 * 'won' / 'lost' = partida terminada.
 */
export type MatchPhase = 'practice' | 'intro' | 'combat' | 'won' | 'lost';

export interface MatchOptions {
  /** Duración del combate en segundos (solo se cambia en pruebas). */
  durationSeconds?: number;
  /** Modo asistido: enemigos más lentos y apariciones más espaciadas. */
  assisted?: boolean;
  /** Segundos de combate que se dan por transcurridos al empezar (solo pruebas). */
  startAtSeconds?: number;
}

/**
 * Reglas de una partida: fases, oleadas, vidas del núcleo, combo, puntuación y apariciones.
 * No sabe nada de render, sonido ni gestos; la aplicación le comunica lo que ocurre en la arena.
 */
export class GameSession {
  phase: MatchPhase = 'practice';
  lives: number = M.lives;
  score = 0;
  timeLeft: number = M.durationSeconds;
  /** Índice de la oleada en curso dentro de CONFIG.waves. */
  wave = 0;
  defeated = 0;
  readonly defeatedByKind: Record<GremlinKind, number> = { runner: 0, bomb: 0, tank: 0 };
  /** Impactos encadenados dentro de la ventana de combo; 0 = sin combo activo. */
  combo = 0;
  bestCombo = 0;
  /** Puntos añadidos al ganar por las vidas conservadas. */
  lifeBonus = 0;
  assisted = false;

  private duration: number = M.durationSeconds;
  private spawnTimer = 0;
  private introTimer = 0;
  private comboTimer = 0;
  private waveSpawns = 0;
  private tankIntroduced = false;
  private nextPortal = 0;
  private readonly spot = { x: 0, y: 0 };

  constructor(private readonly world: World) {}

  get finished(): boolean {
    return this.phase === 'won' || this.phase === 'lost';
  }

  /** Fracción de partida transcurrida, 0..1. */
  get progress(): number {
    return 1 - this.timeLeft / this.duration;
  }

  /** Multiplicador que se aplicará al próximo derribo dentro del combo actual. */
  get multiplier(): number {
    return clamp(this.combo, 1, S.maxMultiplier);
  }

  /** Tiempo que le queda al combo, 0..1 (para la barra del HUD). */
  get comboFraction(): number {
    return this.combo > 0 ? clamp(this.comboTimer / S.comboWindowSeconds, 0, 1) : 0;
  }

  /** @param withPractice true para empezar con la práctica; false para entrar directo al combate. */
  start(withPractice: boolean, options: MatchOptions = {}): void {
    this.world.reset();
    this.lives = M.lives;
    this.score = 0;
    this.duration = options.durationSeconds ?? M.durationSeconds;
    this.timeLeft = this.duration;
    this.assisted = options.assisted ?? false;
    this.wave = 0;
    this.waveSpawns = 0;
    this.tankIntroduced = false;
    this.defeated = 0;
    this.defeatedByKind.runner = 0;
    this.defeatedByKind.bomb = 0;
    this.defeatedByKind.tank = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.lifeBonus = 0;
    this.nextPortal = Math.floor(Math.random() * CONFIG.arena.portalCount);
    if (withPractice) {
      this.phase = 'practice';
      this.spawnTimer = M.practiceRespawnSeconds;
      for (let i = 0; i < M.practicePopulation; i++) this.spawnWanderer();
    } else {
      this.beginCombat();
      const skip = clamp(options.startAtSeconds ?? 0, 0, this.duration * 0.98);
      this.timeLeft = this.duration - skip;
    }
  }

  /**
   * @param avoidValid si hay mano, (avoidX, avoidY) es su posición en la arena:
   *                   los enemigos no aparecen justo debajo.
   */
  update(dtSeconds: number, avoidX: number, avoidY: number, avoidValid: boolean): void {
    if (this.phase === 'practice') {
      this.updatePractice(dtSeconds);
    } else if (this.phase === 'intro') {
      this.introTimer -= dtSeconds;
      if (this.introTimer <= 0) this.beginCombat();
    } else if (this.phase === 'combat') {
      this.updateCombat(dtSeconds, avoidX, avoidY, avoidValid);
    }
  }

  /**
   * El jugador daña a un enemigo (golpe con un gremlin lanzado o explosión).
   * Cada impacto alimenta el combo; solo los derribos dan puntos.
   * @returns puntos concedidos (0 en la práctica o si la víctima resistió).
   */
  registerHit(kind: GremlinKind, killed: boolean): number {
    if (this.phase === 'practice') {
      // El primer golpe demuestra que el jugador sabe atrapar y lanzar: se anuncia el combate.
      this.phase = 'intro';
      this.introTimer = M.introSeconds;
      return 0;
    }
    if (this.phase !== 'combat') return 0;
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = S.comboWindowSeconds;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    if (!killed) return 0;
    this.defeated++;
    this.defeatedByKind[kind]++;
    const points = K[kind].points * this.multiplier;
    this.score += points;
    return points;
  }

  /** El proyectil que acertó también se gasta: cuenta como derrotado, sin multiplicador. */
  registerSpent(kind: GremlinKind): number {
    if (this.phase !== 'combat') return 0;
    this.defeated++;
    this.defeatedByKind[kind]++;
    this.score += K[kind].points;
    return K[kind].points;
  }

  /** Un atacante alcanzó el núcleo. Devuelve true si se perdió una vida. */
  registerCoreHit(): boolean {
    if (this.phase !== 'combat') return false;
    this.lives = Math.max(0, this.lives - 1);
    if (this.lives === 0) this.finish('lost');
    return true;
  }

  private beginCombat(): void {
    this.phase = 'combat';
    this.timeLeft = this.duration;
    this.wave = 0;
    this.waveSpawns = 0;
    this.spawnTimer = this.interval(WAVES[0], 0);
    // Los gremlins de la práctica que queden siguen deambulando: son munición gratis para el
    // primer ataque. Convertirlos en atacantes los dejaría a un paso del núcleo, lo cual sería injusto.
    for (let i = 0; i < M.openingSpawns; i++) this.spawnAttacker('runner', WAVES[0], 0, 0, 0, false);
  }

  private finish(outcome: 'won' | 'lost'): void {
    this.phase = outcome;
    this.combo = 0;
    this.comboTimer = 0;
    if (outcome === 'won') {
      this.lifeBonus = this.lives * S.lifeBonus;
      this.score += this.lifeBonus;
    }
    // Tras el final nadie más amenaza al núcleo: los supervivientes se quedan deambulando.
    this.world.setAllBehavior('wander', CONFIG.runner.speed);
  }

  private updatePractice(dt: number): void {
    if (this.world.countActive() >= M.practicePopulation) {
      this.spawnTimer = M.practiceRespawnSeconds;
      return;
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = M.practiceRespawnSeconds;
      this.spawnWanderer();
    }
  }

  private updateCombat(dt: number, avoidX: number, avoidY: number, avoidValid: boolean): void {
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.finish('won');
      return;
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    const progress = this.progress;
    while (this.wave < WAVES.length - 1 && progress >= WAVES[this.wave]!.until) {
      this.wave++;
      this.waveSpawns = 0;
      // Respiro mientras se anuncia la oleada.
      this.spawnTimer = Math.max(this.spawnTimer, M.waveBreatherSeconds);
    }
    const wave = WAVES[this.wave]!;

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    // Sin hueco: se reintenta en cuanto lo haya.
    if (this.world.countActive('attack') >= wave.maxAttackers) return;
    if (this.world.countActive() >= M.maxEnemies) return;

    const local = this.waveProgress(progress);
    this.spawnTimer = this.interval(wave, local);
    this.spawnAttacker(this.pickKind(wave, progress), wave, local, avoidX, avoidY, avoidValid);
  }

  /** Avance dentro de la oleada en curso, 0..1. */
  private waveProgress(progress: number): number {
    const from = this.wave === 0 ? 0 : WAVES[this.wave - 1]!.until;
    const to = WAVES[this.wave]!.until;
    return clamp((progress - from) / (to - from), 0, 1);
  }

  private interval(wave: Wave, local: number): number {
    const base = lerp(wave.intervalStart, wave.intervalEnd, local);
    return this.assisted ? base * M.assistIntervalFactor : base;
  }

  /**
   * Elige el tipo del siguiente enemigo. Las presentaciones son fijas —el primer enemigo de la
   * oleada 2 es un Bomb y el primer Tank llega en un momento concreto— para que el jugador los
   * descubra de uno en uno; el resto es aleatorio con topes por tipo.
   */
  private pickKind(wave: Wave, progress: number): GremlinKind {
    if (this.waveSpawns === 0 && wave.firstKind !== 'runner') return wave.firstKind;
    const tanksAllowed = wave.tankWeight > 0 && progress >= wave.tankFrom;
    if (tanksAllowed && !this.tankIntroduced) {
      this.tankIntroduced = true;
      return 'tank';
    }
    const r = Math.random();
    if (tanksAllowed && r < wave.tankWeight && this.world.countKind('tank') < M.maxTanks) return 'tank';
    if (r < wave.tankWeight + wave.bombWeight && this.world.countKind('bomb') < M.maxBombs) return 'bomb';
    return 'runner';
  }

  private spawnWanderer(): void {
    this.advancePortal();
    World.portalPosition(this.nextPortal, this.spot);
    this.world.spawn('runner', this.spot.x, this.spot.y, 'wander', CONFIG.runner.speed);
  }

  private spawnAttacker(
    kind: GremlinKind,
    wave: Wave,
    local: number,
    avoidX: number,
    avoidY: number,
    avoidValid: boolean,
  ): void {
    // Portales alternos; si el elegido queda bajo la mano, se prueba con los siguientes.
    for (let attempt = 0; attempt < CONFIG.arena.portalCount; attempt++) {
      this.advancePortal();
      World.portalPosition(this.nextPortal, this.spot);
      const tooClose =
        avoidValid && Math.hypot(this.spot.x - avoidX, this.spot.y - avoidY) < M.spawnAvoidRadius;
      if (!tooClose) break;
    }
    let speed = lerp(wave.speedStart, wave.speedEnd, local) * K[kind].speedFactor;
    if (this.assisted) speed *= M.assistSpeedFactor;
    if (this.world.spawn(kind, this.spot.x, this.spot.y, 'attack', speed)) this.waveSpawns++;
  }

  private advancePortal(): void {
    this.nextPortal = (this.nextPortal + 2 + Math.floor(Math.random() * 2)) % CONFIG.arena.portalCount;
  }
}
