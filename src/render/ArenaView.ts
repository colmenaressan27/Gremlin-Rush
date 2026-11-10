import {
  BoxGeometry,
  CircleGeometry,
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

/**
 * Arena y núcleo con geometría provisional (placeholder): disco translúcido, borde luminoso,
 * portales en el perímetro y un cristal central con tres segmentos de integridad.
 */
export class ArenaView {
  readonly group = new Group();
  private readonly crystal: Mesh;
  private readonly segments: Mesh[] = [];
  private readonly portals: Mesh[] = [];
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

  update(dtSeconds: number): void {
    this.time += dtSeconds;
    this.crystal.rotation.y += dtSeconds * 0.9;
    this.crystal.position.y = CORE_HEIGHT + Math.sin(this.time * 2.2) * 0.012;
    const pulse = 0.85 + Math.sin(this.time * 3) * 0.15;
    for (const portal of this.portals) portal.scale.y = pulse;
  }
}
