import { CONFIG } from '../config/gameConfig';
import { World } from './World';

const S = CONFIG.sandbox;

/**
 * Sesión de la fase P0: "prueba de manipulación". Mantiene unos pocos Runners en la arena
 * y termina cuando el jugador consigue cierto número de golpes lanzando gremlins.
 * Valida el ciclo empezar → atrapar → lanzar → golpear → terminar → repetir, sin puntuación ni núcleo.
 */
export class SandboxSession {
  hits = 0;
  bestChain = 0;
  elapsedSeconds = 0;
  done = false;

  private respawnTimer = 0;
  private nextPortal = 0;
  private readonly spot = { x: 0, y: 0 };

  constructor(private readonly world: World) {}

  start(): void {
    this.world.reset();
    this.hits = 0;
    this.bestChain = 0;
    this.elapsedSeconds = 0;
    this.done = false;
    this.respawnTimer = 0;
    this.nextPortal = Math.floor(Math.random() * CONFIG.arena.portalCount);
    for (let i = 0; i < S.population; i++) this.spawnAtNextPortal();
  }

  update(dtSeconds: number): void {
    if (this.done) return;
    this.elapsedSeconds += dtSeconds;
    if (this.world.countActive() >= S.population) {
      this.respawnTimer = S.respawnSeconds;
      return;
    }
    this.respawnTimer -= dtSeconds;
    if (this.respawnTimer <= 0) {
      this.respawnTimer = S.respawnSeconds;
      this.spawnAtNextPortal();
    }
  }

  registerHit(chain: number): void {
    if (this.done) return;
    this.hits++;
    if (chain > this.bestChain) this.bestChain = chain;
    if (this.hits >= S.hitsToWin) this.done = true;
  }

  private spawnAtNextPortal(): void {
    // Portales alternos: los gremlins no aparecen amontonados ni siempre en el mismo sitio.
    this.nextPortal = (this.nextPortal + 2 + Math.floor(Math.random() * 2)) % CONFIG.arena.portalCount;
    World.portalPosition(this.nextPortal, this.spot);
    this.world.spawn('runner', this.spot.x, this.spot.y);
  }
}
