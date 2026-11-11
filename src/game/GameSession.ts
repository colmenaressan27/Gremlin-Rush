import { CONFIG } from '../config/gameConfig';
import { lerp } from '../core/math';
import { World } from './World';

const M = CONFIG.match;
const S = CONFIG.score;

/**
 * 'practice' = sin reloj ni peligro, hasta el primer golpe del jugador.
 * 'combat'   = los Runners atacan el núcleo durante el tiempo de partida.
 * 'won' / 'lost' = partida terminada.
 */
export type MatchPhase = 'practice' | 'combat' | 'won' | 'lost';

/**
 * Reglas de una partida: fases, vidas del núcleo, puntuación, cronómetro y apariciones.
 * No sabe nada de render, sonido ni gestos; la aplicación le comunica lo que ocurre en la arena.
 */
export class GameSession {
  phase: MatchPhase = 'practice';
  lives: number = M.lives;
  score = 0;
  timeLeft: number = M.durationSeconds;
  defeated = 0;
  bestChain = 0;
  /** Puntos añadidos al ganar por las vidas conservadas. */
  lifeBonus = 0;

  private duration: number = M.durationSeconds;
  private spawnTimer = 0;
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

  /**
   * @param withPractice true para empezar con la práctica; false para entrar directo al combate.
   * @param durationSeconds duración del combate (solo se cambia en pruebas).
   */
  start(withPractice: boolean, durationSeconds: number = M.durationSeconds): void {
    this.world.reset();
    this.lives = M.lives;
    this.score = 0;
    this.duration = durationSeconds;
    this.timeLeft = durationSeconds;
    this.defeated = 0;
    this.bestChain = 0;
    this.lifeBonus = 0;
    this.nextPortal = Math.floor(Math.random() * CONFIG.arena.portalCount);
    if (withPractice) {
      this.phase = 'practice';
      this.spawnTimer = M.practiceRespawnSeconds;
      for (let i = 0; i < M.practicePopulation; i++) this.spawnWanderer();
    } else {
      this.beginCombat();
    }
  }

  /**
   * @param avoidValid si hay mano, (avoidX, avoidY) es su posición en la arena:
   *                   los enemigos no aparecen justo debajo.
   */
  update(dtSeconds: number, avoidX: number, avoidY: number, avoidValid: boolean): void {
    if (this.phase === 'practice') {
      this.updatePractice(dtSeconds);
    } else if (this.phase === 'combat') {
      this.updateCombat(dtSeconds, avoidX, avoidY, avoidValid);
    }
  }

  /** Un gremlin lanzado derriba a otro. Devuelve los puntos concedidos (0 durante la práctica). */
  registerImpact(chain: number): number {
    if (this.finished) return 0;
    if (chain > this.bestChain) this.bestChain = chain;
    if (this.phase === 'practice') {
      // El primer golpe demuestra que el jugador sabe atrapar y lanzar: empieza la partida real.
      this.bestChain = 0;
      this.beginCombat();
      return 0;
    }
    this.defeated++;
    const points = S.runner * Math.min(chain, S.maxMultiplier);
    this.score += points;
    return points;
  }

  /** El proyectil que golpeó también se gasta: cuenta como derrotado, sin multiplicador. */
  registerSpent(): number {
    if (this.phase !== 'combat') return 0;
    this.defeated++;
    this.score += S.runner;
    return S.runner;
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
    this.spawnTimer = M.spawnIntervalStart;
    // Los gremlins de la práctica que queden siguen deambulando: son munición gratis para el
    // primer ataque. Convertirlos en atacantes los dejaría a un paso del núcleo, lo cual sería injusto.
    for (let i = 0; i < M.openingSpawns; i++) this.spawnAttacker(0, 0, false);
  }

  private finish(outcome: 'won' | 'lost'): void {
    this.phase = outcome;
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
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    if (this.world.countActive('attack') >= M.maxAttackers) return; // se reintenta en cuanto haya hueco
    this.spawnTimer = lerp(M.spawnIntervalStart, M.spawnIntervalEnd, this.progress);
    this.spawnAttacker(avoidX, avoidY, avoidValid);
  }

  private spawnWanderer(): void {
    this.advancePortal();
    World.portalPosition(this.nextPortal, this.spot);
    this.world.spawn('runner', this.spot.x, this.spot.y, 'wander', CONFIG.runner.speed);
  }

  private spawnAttacker(avoidX: number, avoidY: number, avoidValid: boolean): void {
    // Portales alternos; si el elegido queda bajo la mano, se prueba con los siguientes.
    for (let attempt = 0; attempt < CONFIG.arena.portalCount; attempt++) {
      this.advancePortal();
      World.portalPosition(this.nextPortal, this.spot);
      const tooClose =
        avoidValid && Math.hypot(this.spot.x - avoidX, this.spot.y - avoidY) < M.spawnAvoidRadius;
      if (!tooClose) break;
    }
    const speed = lerp(M.attackSpeedStart, M.attackSpeedEnd, this.progress);
    this.world.spawn('runner', this.spot.x, this.spot.y, 'attack', speed);
  }

  private advancePortal(): void {
    this.nextPortal = (this.nextPortal + 2 + Math.floor(Math.random() * 2)) % CONFIG.arena.portalCount;
  }
}
