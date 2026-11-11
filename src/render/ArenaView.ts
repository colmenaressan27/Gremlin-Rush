import {
  BoxGeometry,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  RingGeometry,
  type Object3D,
} from 'three';
import { CONFIG, PALETTE } from '../config/gameConfig';
import { World } from '../game/World';

const A = CONFIG.arena;
const FLAT = -Math.PI / 2;
const CORE_SEGMENTS = 3;
const CORE_HEIGHT = 0.2;
const LOST_SEGMENT_OPACITY = 0.18;
const PULSE_DECAY = 2.2;

/**
 * Arena y núcleo con geometría provisional (placeholder): disco translúcido, borde luminoso,
 * portales en el perímetro y un cristal central con tres segmentos de integridad.
 */
export class ArenaView {
  readonly group = new Group();
  private readonly crystal: Mesh;
  private readonly segments: Mesh[] = [];
  private readonly portals: Mesh[] = [];
  private readonly baseEmissive = new Color(PALETTE.scoreYellow);
  private readonly hitColor = new Color(PALETTE.alertRed);
  private lives = CORE_SEGMENTS;
  private pulse = 0;
  private time = 0;

  constructor() {
    const floor = new Mesh(
      new CircleGeometry(A.radius, 48),
      new MeshBasicMaterial({ color: PALETTE.ink, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    floor.rotation.x = FLAT;
    floor.renderOrder = -3;

    const rim = this.flatRing(A.radius, A.radius + 0.045, PALETTE.gremlinGreen, 0.95);
    const guide = this.flatRing(A.radius * 0.6, A.radius * 0.6 + 0.008, PALETTE.smokeWhite, 0.16);
    const danger = this.flatRing(A.coreRadius + 0.1, A.coreRadius + 0.115, PALETTE.alertRed, 0.5);
    this.group.add(floor, rim, guide, danger);

    const portalGeometry = new BoxGeometry(0.2, 0.012, 0.07);
    const portalMaterial = new MeshBasicMaterial({ color: PALETTE.chaosOrange });
    const spot = { x: 0, y: 0 };
    for (let i = 0; i < A.portalCount; i++) {
      World.portalPosition(i, spot);
      const portal = new Mesh(portalGeometry, portalMaterial);
      const angle = Math.atan2(spot.y, spot.x);
      portal.position.set(Math.cos(angle) * (A.radius + 0.02), 0.01, Math.sin(angle) * (A.radius + 0.02));
      portal.rotation.y = -angle + Math.PI / 2;
      this.portals.push(portal);
      this.group.add(portal);
    }

    this.crystal = new Mesh(
      new OctahedronGeometry(A.coreRadius * 0.72, 0),
      new MeshLambertMaterial({
        color: PALETTE.smokeWhite,
        emissive: PALETTE.scoreYellow,
        emissiveIntensity: 0.55,
        flatShading: true,
      }),
    );
    this.crystal.position.y = CORE_HEIGHT;
    this.crystal.scale.y = 1.5;
    this.group.add(this.crystal);

    // Tres arcos alrededor del núcleo: cada uno representa un punto de integridad.
    const arc = (Math.PI * 2) / CORE_SEGMENTS;
    const gap = 0.22;
    for (let i = 0; i < CORE_SEGMENTS; i++) {
      const segment = new Mesh(
        new RingGeometry(A.coreRadius, A.coreRadius + 0.035, 16, 1, i * arc + gap / 2, arc - gap),
        new MeshBasicMaterial({ color: PALETTE.scoreYellow, transparent: true, depthWrite: false }),
      );
      segment.rotation.x = FLAT;
      segment.position.y = 0.006;
      this.segments.push(segment);
      this.group.add(segment);
    }
  }

  private flatRing(inner: number, outer: number, color: number, opacity: number): Object3D {
    const ring = new Mesh(
      new RingGeometry(inner, outer, 64),
      new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
    ring.rotation.x = FLAT;
    ring.position.y = 0.003;
    ring.renderOrder = -2;
    return ring;
  }

  /** Muestra la integridad del núcleo: un arco encendido por vida; el cristal se enrojece al quedar una. */
  setLives(lives: number): void {
    if (lives === this.lives) return;
    this.lives = lives;
    for (let i = 0; i < this.segments.length; i++) {
      const material = this.segments[i]!.material as MeshBasicMaterial;
      material.opacity = i < lives ? 1 : LOST_SEGMENT_OPACITY;
      material.color.setHex(i < lives ? PALETTE.scoreYellow : PALETTE.alertRed);
    }
    this.baseEmissive.setHex(lives <= 1 ? PALETTE.alertRed : PALETTE.scoreYellow);
  }

  /** Destello rojo breve al recibir daño. */
  hit(): void {
    this.pulse = 1;
  }

  update(dtSeconds: number): void {
    this.time += dtSeconds;
    this.pulse = Math.max(0, this.pulse - dtSeconds * PULSE_DECAY);
    const material = this.crystal.material as MeshLambertMaterial;
    material.emissive.copy(this.baseEmissive).lerp(this.hitColor, this.pulse);
    material.emissiveIntensity = 0.55 + this.pulse * 0.9;
    this.crystal.scale.x = this.crystal.scale.z = 1 + this.pulse * 0.35;
    this.crystal.rotation.y += dtSeconds * 0.9;
    this.crystal.position.y = CORE_HEIGHT + Math.sin(this.time * 2.2) * 0.012;
    const pulse = 0.85 + Math.sin(this.time * 3) * 0.15;
    for (const portal of this.portals) portal.scale.y = pulse;
  }
}
