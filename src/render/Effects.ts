import { Mesh, MeshBasicMaterial, RingGeometry, type Group } from 'three';
import type { ArenaAnchor } from '../ar/ArenaAnchor';
import { CONFIG, PALETTE } from '../config/gameConfig';
import type { Vec2 } from '../core/math';
import type { GremlinKind } from '../game/Gremlin';
import { Particles } from './Particles';

const F = CONFIG.feel;
const REDUCED_INTENSITY = 0.3;
const POPUP_HEIGHT = 0.22;
const SHOCKWAVE_POOL = 3;
const SHOCKWAVE_SECONDS = 0.38;

const KIND_COLOR: Record<GremlinKind, number> = {
  runner: PALETTE.gremlinGreen,
  bomb: PALETTE.chaosOrange,
  tank: PALETTE.armorViolet,
};

interface Shockwave {
  mesh: Mesh;
  material: MeshBasicMaterial;
  age: number;
  radius: number;
}

/**
 * "Juice" dosificado: partículas, ondas de explosión, sacudida de la arena virtual (nunca del
 * vídeo real), micro-pausa de impacto y textos efímeros. Todo se atenúa con "reducir efectos"
 * y con el nivel de calidad.
 */
export class Effects {
  readonly particles = new Particles();
  /** Hasta este instante (ms) la simulación queda congelada para dar peso al impacto. */
  hitStopUntil = 0;

  private intensity = 1;
  private particleScale = 1;
  private trauma = 0;
  private time = 0;
  private readonly shockwaves: Shockwave[] = [];
  private nextShockwave = 0;
  private readonly popups: HTMLElement[] = [];
  private nextPopup = 0;
  private readonly screen: Vec2 = { x: 0, y: 0 };

  constructor(
    private readonly root: Group,
    private readonly anchor: ArenaAnchor,
    popupLayer: HTMLElement,
  ) {
    root.add(this.particles.mesh);
    const ring = new RingGeometry(0.84, 1, 40);
    for (let i = 0; i < SHOCKWAVE_POOL; i++) {
      const material = new MeshBasicMaterial({
        color: PALETTE.chaosOrange,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new Mesh(ring, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.04;
      mesh.visible = false;
      root.add(mesh);
      this.shockwaves.push({ mesh, material, age: SHOCKWAVE_SECONDS, radius: 0 });
    }
    for (let i = 0; i < F.popupMax; i++) {
      const el = document.createElement('div');
      el.className = 'popup';
      el.setAttribute('aria-hidden', 'true');
      popupLayer.appendChild(el);
      this.popups.push(el);
    }
  }

  setReduced(reduced: boolean): void {
    this.intensity = reduced ? REDUCED_INTENSITY : 1;
  }

  setParticleScale(scale: number): void {
    this.particleScale = scale;
  }

  grab(x: number, z: number): void {
    this.burst(x, CONFIG.arena.cursorPlaneY, z, PALETTE.scoreYellow, 8, 0.9);
  }

  throwTrail(x: number, z: number): void {
    this.burst(x, 0.1, z, PALETTE.smokeWhite, 5, 0.6);
  }

  wall(x: number, z: number): void {
    this.burst(x, 0.08, z, PALETTE.smokeWhite, 6, 0.8);
    this.addTrauma(0.2);
  }

  /**
   * Un enemigo cae derribado.
   * @param multiplier multiplicador de combo aplicado.
   * @param points     puntos concedidos; 0 muestra solo la onomatopeya (práctica).
   */
  defeat(x: number, z: number, kind: GremlinKind, multiplier: number, points: number, now: number): void {
    this.burst(x, 0.1, z, PALETTE.scoreYellow, 12, 1.7);
    this.burst(x, 0.1, z, KIND_COLOR[kind], 9, 1.1);
    this.addTrauma(0.4 + 0.1 * multiplier);
    this.hitStop(now, F.hitStopMs);
    const text = points > 0 ? `+${points}` : '¡ZAS!';
    this.popup(multiplier > 1 ? `x${multiplier} ${text}` : text, x, z, multiplier > 1 ? 'popup-chain' : '');
  }

  /** La armadura del Tank aguanta: chispas y un golpe seco, sin puntos. */
  armorHit(x: number, z: number, now: number): void {
    this.burst(x, 0.14, z, PALETTE.smokeWhite, 8, 1.5);
    this.burst(x, 0.14, z, PALETTE.armorViolet, 8, 1.1);
    this.addTrauma(0.35);
    this.hitStop(now, F.hitStopMs);
    this.popup('¡CRAC!', x, z, 'popup-armor');
  }

  tooHeavy(x: number, z: number): void {
    this.popup('¡Pesa mucho!', x, z, 'popup-armor');
  }

  /** Explosión de un Bomb: onda que marca el radio real de daño. */
  explosion(x: number, z: number, radius: number, now: number): void {
    this.burst(x, 0.12, z, PALETTE.chaosOrange, 24, 2.4);
    this.burst(x, 0.12, z, PALETTE.scoreYellow, 14, 1.6);
    this.burst(x, 0.12, z, PALETTE.smokeWhite, 6, 0.9);
    this.addTrauma(0.85);
    this.hitStop(now, F.explosionHitStopMs);
    const wave = this.shockwaves[this.nextShockwave]!;
    this.nextShockwave = (this.nextShockwave + 1) % this.shockwaves.length;
    wave.age = 0;
    wave.radius = radius;
    wave.mesh.position.x = x;
    wave.mesh.position.z = z;
    wave.mesh.visible = true;
    this.popup('¡BUM!', x, z, 'popup-boom');
  }

  /** El proyectil gastado se desvanece: puntos sin multiplicador. */
  spent(x: number, z: number, kind: GremlinKind, points: number): void {
    this.burst(x, 0.08, z, KIND_COLOR[kind], 8, 0.9);
    if (points > 0) this.popup(`+${points}`, x, z, '');
  }

  /** Daño al núcleo: lo más llamativo de la partida, para que nunca pase desapercibido. */
  coreHit(): void {
    this.burst(0, 0.2, 0, PALETTE.alertRed, 22, 1.9);
    this.addTrauma(0.9);
    this.popup('−1 vida', 0, 0, 'popup-danger');
  }

  popup(text: string, x: number, z: number, extraClass: string): void {
    const el = this.popups[this.nextPopup]!;
    this.nextPopup = (this.nextPopup + 1) % this.popups.length;
    this.anchor.arenaToScreen(x, POPUP_HEIGHT, z, this.screen);
    el.textContent = text;
    el.style.left = `${this.screen.x}px`;
    el.style.top = `${this.screen.y}px`;
    // Reinicia la animación CSS reutilizando el mismo elemento.
    el.className = 'popup';
    void el.offsetWidth;
    el.className = `popup popup-show ${extraClass}`;
  }

  update(dtSeconds: number): void {
    this.time += dtSeconds;
    this.particles.update(dtSeconds);
    for (const wave of this.shockwaves) {
      if (!wave.mesh.visible) continue;
      wave.age += dtSeconds;
      const k = wave.age / SHOCKWAVE_SECONDS;
      if (k >= 1) {
        wave.mesh.visible = false;
        continue;
      }
      // Sale rápido y frena (ease-out): el borde exterior termina justo en el radio de daño.
      const eased = 1 - (1 - k) * (1 - k);
      wave.mesh.scale.setScalar(Math.max(0.01, wave.radius * eased));
      wave.material.opacity = 0.9 * (1 - k);
    }
    this.trauma = Math.max(0, this.trauma - F.shakeDecayPerSecond * dtSeconds);
    const amount = F.shakeMax * this.trauma * this.trauma * this.intensity;
    // Ruido barato y continuo: dos senos desfasados por eje.
    this.root.position.x = amount * Math.sin(this.time * 71) * Math.cos(this.time * 13);
    this.root.position.z = amount * Math.sin(this.time * 59 + 1.7) * Math.cos(this.time * 17);
  }

  private hitStop(now: number, ms: number): void {
    this.hitStopUntil = Math.max(this.hitStopUntil, now + ms * this.intensity);
  }

  private addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private burst(x: number, y: number, z: number, color: number, count: number, speed: number): void {
    const n = Math.round(count * this.particleScale * (this.intensity < 1 ? 0.5 : 1));
    if (n > 0) this.particles.burst(x, y, z, color, n, speed);
  }
}
