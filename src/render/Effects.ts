import type { Group } from 'three';
import type { ArenaAnchor } from '../ar/ArenaAnchor';
import { CONFIG, PALETTE } from '../config/gameConfig';
import type { Vec2 } from '../core/math';
import { Particles } from './Particles';

const F = CONFIG.feel;
const REDUCED_INTENSITY = 0.3;
const POPUP_HEIGHT = 0.22;

/**
 * "Juice" dosificado: partículas, sacudida de la arena virtual (nunca del vídeo real),
 * micro-pausa de impacto y textos efímeros. Todo se atenúa con "reducir efectos" y con el nivel de calidad.
 */
export class Effects {
  readonly particles = new Particles();
  /** Hasta este instante (ms) la simulación queda congelada para dar peso al impacto. */
  hitStopUntil = 0;

  private intensity = 1;
  private particleScale = 1;
  private trauma = 0;
  private time = 0;
  private readonly popups: HTMLElement[] = [];
  private nextPopup = 0;
  private readonly screen: Vec2 = { x: 0, y: 0 };

  constructor(
    private readonly root: Group,
    private readonly anchor: ArenaAnchor,
    popupLayer: HTMLElement,
  ) {
    root.add(this.particles.mesh);
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
    this.burst(x, 0.08, z, PALETTE.gremlinGreen, 6, 0.8);
    this.addTrauma(0.2);
  }

  impact(x: number, z: number, chain: number, now: number): void {
    this.burst(x, 0.1, z, PALETTE.scoreYellow, 14, 1.7);
    this.burst(x, 0.1, z, PALETTE.gremlinGreen, 8, 1.1);
    this.addTrauma(0.45 + 0.12 * Math.min(chain, 4));
    this.hitStopUntil = now + F.hitStopMs * this.intensity;
    this.popup(chain > 1 ? `¡x${chain}!` : '¡ZAS!', x, z, chain > 1 ? 'popup-chain' : '');
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
    this.trauma = Math.max(0, this.trauma - F.shakeDecayPerSecond * dtSeconds);
    const amount = F.shakeMax * this.trauma * this.trauma * this.intensity;
    // Ruido barato y continuo: dos senos desfasados por eje.
    this.root.position.x = amount * Math.sin(this.time * 71) * Math.cos(this.time * 13);
    this.root.position.z = amount * Math.sin(this.time * 59 + 1.7) * Math.cos(this.time * 17);
  }

  private addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private burst(x: number, y: number, z: number, color: number, count: number, speed: number): void {
    const n = Math.round(count * this.particleScale * (this.intensity < 1 ? 0.5 : 1));
    if (n > 0) this.particles.burst(x, y, z, color, n, speed);
  }
}
