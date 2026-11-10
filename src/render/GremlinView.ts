import {
  CircleGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RingGeometry,
  SphereGeometry,
} from 'three';
import { CONFIG, PALETTE } from '../config/gameConfig';
import { clamp, damp, lerp } from '../core/math';
import type { Gremlin } from '../game/Gremlin';

const FLAT = -Math.PI / 2;
const P = CONFIG.physics;

// Geometrías y materiales compartidos por todos los gremlins (radio unidad; se escala por instancia).
const sphere = new SphereGeometry(1, 16, 12);
const ear = new ConeGeometry(0.3, 0.9, 6);
const disc = new CircleGeometry(1, 20);
const hoverRingGeometry = new RingGeometry(1.55, 1.85, 32);
const chargeRingGeometry = new RingGeometry(2.0, 2.3, 40);

const bodyMaterial = new MeshLambertMaterial({ color: PALETTE.gremlinGreen });
const flashMaterial = new MeshBasicMaterial({ color: PALETTE.smokeWhite });
const darkMaterial = new MeshLambertMaterial({ color: 0x4f8a12 });
const eyeMaterial = new MeshBasicMaterial({ color: PALETTE.smokeWhite });
const pupilMaterial = new MeshBasicMaterial({ color: PALETTE.ink });
const shadowMaterial = new MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
});
const hoverMaterial = new MeshBasicMaterial({
  color: PALETTE.scoreYellow,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
});

const colorIdle = new Color(PALETTE.smokeWhite);
const colorMid = new Color(PALETTE.scoreYellow);
const colorFull = new Color(PALETTE.chaosOrange);

const EYE_SIDE = 0.4;
const EYE_FORWARD = 0.62;
const PUPIL_RANGE = 0.14;
const FLASH_SECONDS = 0.07;
const THROWN_HEIGHT = 0.13;

const easeOutBack = (t: number): number => {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

/**
 * Representación provisional (placeholder) de un Runner: cuerpo ovalado, ojos grandes que siguen
 * la mano, orejas asimétricas y patas cortas. Se reconoce por silueta, no solo por color.
 */
export class GremlinView {
  readonly group = new Group();
  private readonly lifted = new Group();
  private readonly body: Mesh;
  private readonly feet: [Mesh, Mesh];
  private readonly eyes: [Mesh, Mesh];
  private readonly pupils: [Mesh, Mesh];
  private readonly shadow: Mesh;
  private readonly hoverRing: Mesh;
  private readonly chargeRing: Mesh;
  private readonly chargeMaterial: MeshBasicMaterial;
  private height = 0;
  private stretch = 1;
  private time = Math.random() * 10;

  constructor() {
    this.body = new Mesh(sphere, bodyMaterial);
    this.body.scale.set(1, 1.22, 0.95);
    this.body.position.y = 1.45;

    const earLeft = new Mesh(ear, bodyMaterial);
    earLeft.position.set(-0.1, 2.55, -0.62);
    earLeft.rotation.x = -0.75;
    const earRight = new Mesh(ear, bodyMaterial);
    earRight.position.set(-0.15, 2.3, 0.72);
    earRight.rotation.x = 1.15;
    earRight.scale.setScalar(0.75);

    const makeEye = (side: number): Mesh => {
      const eye = new Mesh(sphere, eyeMaterial);
      eye.scale.setScalar(0.4);
      eye.position.set(EYE_FORWARD, 1.8, side * EYE_SIDE);
      return eye;
    };
    const makePupil = (side: number): Mesh => {
      const pupil = new Mesh(sphere, pupilMaterial);
      pupil.scale.setScalar(0.2);
      pupil.position.set(EYE_FORWARD + 0.3, 1.8, side * EYE_SIDE);
      return pupil;
    };
    const makeFoot = (side: number): Mesh => {
      const foot = new Mesh(sphere, darkMaterial);
      foot.scale.set(0.42, 0.28, 0.32);
      foot.position.set(0.1, 0.26, side * 0.48);
      return foot;
    };
    this.eyes = [makeEye(-1), makeEye(1)];
    this.pupils = [makePupil(-1), makePupil(1)];
    this.feet = [makeFoot(-1), makeFoot(1)];

    this.lifted.add(this.body, earLeft, earRight, ...this.eyes, ...this.pupils, ...this.feet);

    this.shadow = new Mesh(disc, shadowMaterial);
    this.shadow.rotation.x = FLAT;
    this.shadow.position.y = 0.03;
    this.shadow.renderOrder = -1;

    this.hoverRing = new Mesh(hoverRingGeometry, hoverMaterial);
    this.hoverRing.rotation.x = FLAT;
    this.hoverRing.position.y = 0.05;

    this.chargeMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false });
    this.chargeRing = new Mesh(chargeRingGeometry, this.chargeMaterial);
    this.chargeRing.rotation.x = FLAT;
    this.chargeRing.position.y = 0.06;

    this.group.add(this.shadow, this.hoverRing, this.chargeRing, this.lifted);
    this.group.visible = false;
  }

  /**
   * @param lookX/lookY punto de la arena al que miran los ojos (la mano), si lookValid.
   * @param holdLift    elevación 0..1 del gremlin sostenido.
   */
  sync(
    g: Gremlin,
    dtSeconds: number,
    hovered: boolean,
    holdLift: number,
    lookValid: boolean,
    lookX: number,
    lookY: number,
  ): void {
    if (g.state === 'inactive') {
      this.group.visible = false;
      return;
    }
    this.time += dtSeconds;
    const t = this.time;
    const r = g.radius;
    this.group.visible = true;
    this.group.position.set(g.x, 0, g.y);
    this.group.scale.setScalar(r);
    // Las anillas del suelo no giran con el cuerpo; solo la parte "viva".
    this.lifted.rotation.set(0, -g.facing, 0);

    let targetHeight = 0;
    let targetStretch = 1;
    let scale = 1;
    let footSpeed = 0;
    let wobble = 0;
    let eyeScale = 0.4;

    switch (g.state) {
      case 'spawning':
        scale = easeOutBack(clamp(g.stateTime / P.spawnSeconds, 0, 1));
        break;
      case 'walking':
        footSpeed = 16;
        targetStretch = 1 + Math.sin(t * 16) * 0.05;
        break;
      case 'held':
        targetHeight = holdLift * CONFIG.arena.holdHeight;
        footSpeed = 30;
        targetStretch = 1.12 + Math.sin(t * 22) * 0.06;
        wobble = Math.sin(t * 19) * 0.16;
        eyeScale = 0.48;
        break;
      case 'thrown':
        targetHeight = THROWN_HEIGHT;
        targetStretch = 0.82;
        eyeScale = 0.46;
        break;
      case 'stunned':
        wobble = Math.sin(t * 9) * 0.22;
        targetStretch = 0.9;
        break;
      case 'dying': {
        const k = clamp(g.stateTime / P.dyingSeconds, 0, 1);
        scale = 1 - k * k;
        targetHeight = k * 0.16;
        break;
      }
    }

    this.height = damp(this.height, targetHeight, 18, dtSeconds);
    this.stretch = damp(this.stretch, targetStretch, 20, dtSeconds);
    // Squash & stretch conservando volumen aproximado.
    const wide = 1 / Math.sqrt(this.stretch);
    this.lifted.position.y = this.height / r;
    this.lifted.scale.set(wide * scale, this.stretch * scale, wide * scale);
    this.lifted.rotation.z = wobble;

    const flashing = g.state === 'dying' && g.stateTime < FLASH_SECONDS;
    this.body.material = flashing ? flashMaterial : bodyMaterial;

    const step = Math.sin(t * footSpeed) * (footSpeed > 0 ? 0.28 : 0);
    this.feet[0].position.x = 0.1 + step;
    this.feet[1].position.x = 0.1 - step;

    // Los ojos siguen la mano: desplazamiento lateral de las pupilas en el espacio local del cuerpo.
    let side = 0;
    if (lookValid) {
      const dx = lookX - g.x;
      const dy = lookY - g.y;
      const local = -dx * Math.sin(g.facing) + dy * Math.cos(g.facing);
      side = clamp(local * 0.6, -PUPIL_RANGE, PUPIL_RANGE);
    }
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? -1 : 1;
      this.eyes[i]!.scale.setScalar(eyeScale);
      this.pupils[i]!.position.z = damp(this.pupils[i]!.position.z, sign * EYE_SIDE + side, 14, dtSeconds);
    }

    const shadowScale = lerp(1.15, 0.7, clamp(this.height / CONFIG.arena.holdHeight, 0, 1)) * scale;
    this.shadow.scale.setScalar(shadowScale);

    this.hoverRing.visible = hovered;
    if (hovered) this.hoverRing.scale.setScalar(1 + Math.sin(t * 10) * 0.06);

    const held = g.state === 'held';
    this.chargeRing.visible = held;
    if (held) {
      const c = g.charge;
      const full = c >= 1;
      this.chargeRing.scale.setScalar(lerp(0.55, 1, c) * (full ? 1 + Math.sin(t * 18) * 0.05 : 1));
      if (c < 0.5) this.chargeMaterial.color.lerpColors(colorIdle, colorMid, c * 2);
      else this.chargeMaterial.color.lerpColors(colorMid, colorFull, (c - 0.5) * 2);
    }
  }
}
