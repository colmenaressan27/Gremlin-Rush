import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RingGeometry,
  SphereGeometry,
  type Material,
} from 'three';
import { CONFIG, PALETTE } from '../config/gameConfig';
import { clamp, damp, lerp } from '../core/math';
import type { Gremlin, GremlinKind } from '../game/Gremlin';

const FLAT = -Math.PI / 2;
const P = CONFIG.physics;
const BOMB = CONFIG.bomb;
const TANK = CONFIG.tank;

// Geometrías y materiales compartidos por todos los gremlins (radio unidad; se escala por instancia).
const sphere = new SphereGeometry(1, 16, 12);
const dome = new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const cone = new ConeGeometry(0.3, 0.9, 6);
const box = new BoxGeometry(1, 1, 1);
const cylinder = new CylinderGeometry(1, 1, 1, 10);
const disc = new CircleGeometry(1, 20);
const hoverRingGeometry = new RingGeometry(1.55, 1.85, 32);
const targetRingGeometry = new RingGeometry(1.7, 1.95, 4);
const chargeRingGeometry = new RingGeometry(2.0, 2.3, 40);

const flashMaterial = new MeshBasicMaterial({ color: PALETTE.smokeWhite });
const eyeMaterial = new MeshBasicMaterial({ color: PALETTE.smokeWhite });
const pupilMaterial = new MeshBasicMaterial({ color: PALETTE.ink });
const inkMaterial = new MeshBasicMaterial({ color: 0x0c0d1c });

const runnerBody = new MeshLambertMaterial({ color: PALETTE.gremlinGreen });
const runnerBelly = new MeshLambertMaterial({ color: 0xd3f98a });
const runnerDark = new MeshLambertMaterial({ color: 0x4f8a12 });

const bombBody = new MeshLambertMaterial({ color: PALETTE.chaosOrange });
const bombDark = new MeshLambertMaterial({ color: 0x9a3f12 });
const bombCap = new MeshLambertMaterial({ color: 0x2c2d4a });
const bombAlert = new MeshBasicMaterial({ color: PALETTE.alertRed });
const sparkMaterial = new MeshBasicMaterial({ color: PALETTE.scoreYellow });

const tankBody = new MeshLambertMaterial({ color: PALETTE.armorViolet });
const tankBodyHurt = new MeshLambertMaterial({ color: 0xb48cf5, emissive: PALETTE.alertRed, emissiveIntensity: 0.35 });
const tankArmor = new MeshLambertMaterial({ color: 0x4d3fb0, flatShading: true });
const tankDark = new MeshLambertMaterial({ color: 0x2c2466 });

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
const targetMaterial = new MeshBasicMaterial({
  color: PALETTE.chaosOrange,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
});

const colorIdle = new Color(PALETTE.smokeWhite);
const colorMid = new Color(PALETTE.scoreYellow);
const colorFull = new Color(PALETTE.chaosOrange);

const PUPIL_RANGE = 0.14;
const FLASH_SECONDS = 0.07;
const THROWN_HEIGHT = 0.13;

const easeOutBack = (t: number): number => {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

function part(
  geometry: Mesh['geometry'],
  material: Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

/** Piezas animables comunes a los tres tipos. El eje +X local es "hacia delante". */
interface Rig {
  readonly root: Group;
  readonly body: Mesh;
  readonly bodyMaterial: Material;
  readonly feet: [Mesh, Mesh];
  readonly eyes: [Mesh, Mesh];
  readonly pupils: [Mesh, Mesh];
  readonly eyeSide: number;
  readonly eyeScale: number;
  readonly pupilScale: number;
}

function eyesAndFeet(
  root: Group,
  eyeX: number,
  eyeY: number,
  eyeSide: number,
  eyeScale: number,
  footMaterial: Material,
  footSide: number,
  footScale: number,
): Pick<Rig, 'feet' | 'eyes' | 'pupils' | 'eyeSide' | 'eyeScale' | 'pupilScale'> {
  const pupilScale = eyeScale * 0.5;
  const eye = (side: number): Mesh =>
    part(sphere, eyeMaterial, eyeX, eyeY, side * eyeSide, eyeScale, eyeScale, eyeScale);
  const pupil = (side: number): Mesh =>
    part(sphere, pupilMaterial, eyeX + eyeScale * 0.75, eyeY, side * eyeSide, pupilScale, pupilScale, pupilScale);
  const foot = (side: number): Mesh =>
    part(sphere, footMaterial, 0.1, 0.27 * footScale, side * footSide, 0.42 * footScale, 0.28 * footScale, 0.32 * footScale);
  const eyes: [Mesh, Mesh] = [eye(-1), eye(1)];
  const pupils: [Mesh, Mesh] = [pupil(-1), pupil(1)];
  const feet: [Mesh, Mesh] = [foot(-1), foot(1)];
  root.add(...eyes, ...pupils, ...feet);
  return { feet, eyes, pupils, eyeSide, eyeScale, pupilScale };
}

/**
 * Representación provisional (placeholder) de los tres enemigos, hecha con geometría básica.
 * Cada uno se reconoce por su silueta, no solo por el color:
 *  - Runner: ovalado, orejas asimétricas, brazos cortos que agita al ser atrapado.
 *  - Bomb: esférico, con tapa, mecha y chispa; parpadea en rojo cuando va a explotar.
 *  - Tank: ancho y bajo, con casco y placas que se caen y dejan grietas al recibir golpes.
 */
export class GremlinView {
  readonly group = new Group();
  private readonly lifted = new Group();
  private readonly rigs: Record<GremlinKind, Rig>;
  private readonly runnerArms: [Mesh, Mesh];
  private readonly runnerMouth: Mesh;
  private readonly bombSpark: Mesh;
  private readonly tankHelmet: Mesh;
  private readonly tankFrontPlate: Mesh;
  private readonly tankShoulders: [Mesh, Mesh];
  private readonly tankCracks: [Mesh, Mesh, Mesh];
  private readonly shadow: Mesh;
  private readonly hoverRing: Mesh;
  private readonly targetRing: Mesh;
  private readonly chargeRing: Mesh;
  private readonly chargeMaterial: MeshBasicMaterial;
  private kind: GremlinKind | null = null;
  private height = 0;
  private stretch = 1;
  private time = Math.random() * 10;

  constructor() {
    // ── Runner ──
    const runner = new Group();
    const runnerBodyMesh = part(sphere, runnerBody, 0, 1.45, 0, 1, 1.22, 0.95);
    const belly = part(sphere, runnerBelly, 0.42, 1.22, 0, 0.66, 0.82, 0.72);
    const earLeft = part(cone, runnerBody, -0.1, 2.55, -0.62, 1, 1, 1);
    earLeft.rotation.x = -0.75;
    const earRight = part(cone, runnerBody, -0.15, 2.3, 0.72, 0.75, 0.75, 0.75);
    earRight.rotation.x = 1.15;
    this.runnerMouth = part(sphere, inkMaterial, 0.95, 1.22, 0, 0.12, 0.08, 0.3);
    this.runnerArms = [
      part(sphere, runnerBody, 0.2, 1.3, -1.02, 0.2, 0.2, 0.2),
      part(sphere, runnerBody, 0.2, 1.3, 1.02, 0.2, 0.2, 0.2),
    ];
    runner.add(runnerBodyMesh, belly, earLeft, earRight, this.runnerMouth, ...this.runnerArms);

    // ── Bomb ──
    const bomb = new Group();
    const bombBodyMesh = part(sphere, bombBody, 0, 1.25, 0, 1.05, 1.05, 1.05);
    const cap = part(cylinder, bombCap, 0, 2.36, 0, 0.34, 0.24, 0.34);
    const fuse = part(cylinder, bombCap, -0.1, 2.7, 0, 0.06, 0.5, 0.06);
    fuse.rotation.z = 0.35;
    this.bombSpark = part(sphere, sparkMaterial, -0.2, 2.98, 0, 0.16, 0.16, 0.16);
    bomb.add(bombBodyMesh, cap, fuse, this.bombSpark);

    // ── Tank ──
    const tank = new Group();
    const tankBodyMesh = part(sphere, tankBody, 0, 1.1, 0, 1.1, 1, 1.1);
    this.tankHelmet = part(dome, tankArmor, 0, 1.42, 0, 1.0, 0.85, 1.0);
    this.tankFrontPlate = part(box, tankArmor, 0.98, 0.82, 0, 0.22, 0.75, 1.25);
    this.tankShoulders = [
      part(box, tankArmor, 0, 1.05, -1.08, 0.9, 0.6, 0.22),
      part(box, tankArmor, 0, 1.05, 1.08, 0.9, 0.6, 0.22),
    ];
    const brow = part(box, tankDark, 1.0, 1.66, 0, 0.14, 0.1, 0.95);
    this.tankCracks = [
      part(box, inkMaterial, 1.07, 0.95, 0.22, 0.04, 0.55, 0.06),
      part(box, inkMaterial, 1.04, 0.8, -0.38, 0.04, 0.5, 0.06),
      part(box, inkMaterial, 1.0, 1.25, -0.12, 0.04, 0.42, 0.06),
    ];
    this.tankCracks[0].rotation.x = 0.5;
    this.tankCracks[1].rotation.x = -0.6;
    this.tankCracks[2].rotation.x = 1.1;
    tank.add(
      tankBodyMesh,
      this.tankHelmet,
      this.tankFrontPlate,
      ...this.tankShoulders,
      brow,
      ...this.tankCracks,
    );

    this.rigs = {
      runner: {
        root: runner,
        body: runnerBodyMesh,
        bodyMaterial: runnerBody,
        ...eyesAndFeet(runner, 0.62, 1.8, 0.4, 0.4, runnerDark, 0.48, 1),
      },
      bomb: {
        root: bomb,
        body: bombBodyMesh,
        bodyMaterial: bombBody,
        ...eyesAndFeet(bomb, 0.74, 1.5, 0.36, 0.33, bombDark, 0.5, 0.95),
      },
      tank: {
        root: tank,
        body: tankBodyMesh,
        bodyMaterial: tankBody,
        ...eyesAndFeet(tank, 0.9, 1.42, 0.32, 0.22, tankDark, 0.62, 1.2),
      },
    };
    this.lifted.add(runner, bomb, tank);

    this.shadow = new Mesh(disc, shadowMaterial);
    this.shadow.rotation.x = FLAT;
    this.shadow.position.y = 0.03;
    this.shadow.renderOrder = -1;

    this.hoverRing = new Mesh(hoverRingGeometry, hoverMaterial);
    this.hoverRing.rotation.x = FLAT;
    this.hoverRing.position.y = 0.05;

    // Forma distinta (rombo que gira) para no depender solo del color: "aquí irá el lanzamiento".
    this.targetRing = new Mesh(targetRingGeometry, targetMaterial);
    this.targetRing.rotation.x = FLAT;
    this.targetRing.position.y = 0.055;

    this.chargeMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false });
    this.chargeRing = new Mesh(chargeRingGeometry, this.chargeMaterial);
    this.chargeRing.rotation.x = FLAT;
    this.chargeRing.position.y = 0.06;

    this.group.add(this.shadow, this.hoverRing, this.targetRing, this.chargeRing, this.lifted);
    this.group.visible = false;
  }

  /**
   * @param hovered     el pellizco lo atraparía ahora.
   * @param targeted    el lanzamiento en curso iría hacia él.
   * @param holdLift    elevación 0..1 del gremlin sostenido.
   * @param lookX/lookY punto de la arena al que miran los ojos (la mano), si lookValid.
   */
  sync(
    g: Gremlin,
    dtSeconds: number,
    hovered: boolean,
    targeted: boolean,
    holdLift: number,
    lookValid: boolean,
    lookX: number,
    lookY: number,
  ): void {
    if (g.state === 'inactive') {
      this.group.visible = false;
      return;
    }
    if (g.kind !== this.kind) {
      this.kind = g.kind;
      this.rigs.runner.root.visible = g.kind === 'runner';
      this.rigs.bomb.root.visible = g.kind === 'bomb';
      this.rigs.tank.root.visible = g.kind === 'tank';
    }
    const rig = this.rigs[g.kind];
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
    let eyeGrow = 1;
    let shakeX = 0;

    switch (g.state) {
      case 'spawning':
        scale = easeOutBack(clamp(g.stateTime / P.spawnSeconds, 0, 1));
        break;
      case 'walking':
        footSpeed = g.kind === 'tank' ? 9 : 16;
        targetStretch = 1 + Math.sin(t * footSpeed) * 0.05;
        break;
      case 'held':
        targetHeight = holdLift * CONFIG.arena.holdHeight;
        footSpeed = 30;
        targetStretch = 1.12 + Math.sin(t * 22) * 0.06;
        wobble = Math.sin(t * 19) * 0.16;
        eyeGrow = 1.2;
        break;
      case 'thrown':
        targetHeight = THROWN_HEIGHT;
        targetStretch = 0.82;
        eyeGrow = 1.15;
        break;
      case 'stunned':
        wobble = Math.sin(t * 9) * 0.22;
        targetStretch = 0.9;
        break;
      case 'dying': {
        const k = clamp(g.stateTime / P.dyingSeconds, 0, 1);
        // El Bomb se hincha y desaparece de golpe: la explosión la dibujan los efectos.
        scale = g.kind === 'bomb' ? (k < 0.25 ? 1 + k * 2.4 : 0) : 1 - k * k;
        targetHeight = k * 0.16;
        break;
      }
    }

    // Tank: vibra al resistir un golpe.
    const hurt = g.hurtTime < TANK.hurtSeconds;
    if (hurt) shakeX = Math.sin(t * 75) * 0.12 * (1 - g.hurtTime / TANK.hurtSeconds);

    // Bomb: con la mecha encendida parpadea cada vez más rápido y abre mucho los ojos.
    const armed = g.kind === 'bomb' && g.fuse >= 0;
    let blink = false;
    if (armed) {
      const urgency = 1 - clamp(g.fuse / BOMB.thrownFuseSeconds, 0, 1);
      blink = Math.sin(t * (22 + urgency * 40)) > 0;
      eyeGrow = 1.35;
      targetStretch = 1 + Math.sin(t * 40) * 0.07;
    }

    this.height = damp(this.height, targetHeight, 18, dtSeconds);
    this.stretch = damp(this.stretch, targetStretch, 20, dtSeconds);
    // Squash & stretch conservando volumen aproximado.
    const wide = 1 / Math.sqrt(this.stretch);
    this.lifted.position.set(shakeX, this.height / r, 0);
    this.lifted.scale.set(wide * scale, this.stretch * scale, wide * scale);
    this.lifted.rotation.z = wobble;

    const flashing = (g.state === 'dying' && g.stateTime < FLASH_SECONDS) || g.hurtTime < FLASH_SECONDS;
    let bodyMaterial = rig.bodyMaterial;
    if (flashing) bodyMaterial = flashMaterial;
    else if (blink) bodyMaterial = bombAlert;
    else if (g.kind === 'tank' && g.hp <= 1) bodyMaterial = tankBodyHurt;
    rig.body.material = bodyMaterial;

    const step = Math.sin(t * footSpeed) * (footSpeed > 0 ? 0.28 : 0);
    rig.feet[0].position.x = 0.1 + step;
    rig.feet[1].position.x = 0.1 - step;

    // Los ojos siguen la mano: desplazamiento lateral de las pupilas en el espacio local del cuerpo.
    let side = 0;
    if (lookValid) {
      const dx = lookX - g.x;
      const dy = lookY - g.y;
      const local = -dx * Math.sin(g.facing) + dy * Math.cos(g.facing);
      side = clamp(local * 0.6, -PUPIL_RANGE, PUPIL_RANGE) * (rig.eyeScale / 0.4);
    }
    const pupilScale = rig.pupilScale * (armed ? 0.6 : 1);
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? -1 : 1;
      rig.eyes[i]!.scale.setScalar(rig.eyeScale * eyeGrow);
      const pupil = rig.pupils[i]!;
      pupil.scale.setScalar(pupilScale);
      pupil.position.z = damp(pupil.position.z, sign * rig.eyeSide + side, 14, dtSeconds);
    }

    if (g.kind === 'runner') {
      // Agita los brazos y abre la boca cuando lo atrapan o sale volando.
      const panic = g.state === 'held' || g.state === 'thrown';
      for (let i = 0; i < 2; i++) {
        this.runnerArms[i]!.position.y = 1.3 + (panic ? 0.45 + Math.sin(t * 30 + i * Math.PI) * 0.25 : 0);
      }
      this.runnerMouth.scale.y = panic ? 0.24 : 0.08;
    } else if (g.kind === 'bomb') {
      const spark = 0.16 * (armed ? 2 : 1) * (1 + Math.sin(t * (armed ? 45 : 12)) * 0.35);
      this.bombSpark.scale.setScalar(spark);
    } else {
      // La armadura se pierde por partes: placa frontal al primer golpe, hombreras al segundo.
      this.tankFrontPlate.visible = g.hp >= 3;
      this.tankShoulders[0].visible = g.hp >= 2;
      this.tankShoulders[1].visible = g.hp >= 2;
      this.tankCracks[0].visible = g.hp <= 2;
      this.tankCracks[1].visible = g.hp <= 1;
      this.tankCracks[2].visible = g.hp <= 1;
      this.tankHelmet.rotation.z = g.hp <= 1 ? 0.22 : 0;
    }

    const shadowScale = lerp(1.15, 0.7, clamp(this.height / CONFIG.arena.holdHeight, 0, 1)) * scale;
    this.shadow.scale.setScalar(shadowScale);

    this.hoverRing.visible = hovered;
    if (hovered) this.hoverRing.scale.setScalar(1 + Math.sin(t * 10) * 0.06);

    this.targetRing.visible = targeted;
    if (targeted) {
      this.targetRing.rotation.z = t * 2.4;
      this.targetRing.scale.setScalar(1 + Math.sin(t * 14) * 0.08);
    }

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
