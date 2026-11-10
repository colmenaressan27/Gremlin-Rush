import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
} from 'three';
import { CONFIG, PALETTE } from '../config/gameConfig';
import { clamp, damp } from '../core/math';
import type { GrabController } from '../interaction/GrabController';
import type { HandState } from '../input/GestureInterpreter';

const FLAT = -Math.PI / 2;
const TH = CONFIG.throwing;
const ARROW_MIN = 0.22;
const ARROW_MAX = 0.75;
const HEAD_LENGTH = 0.1;

/**
 * Indicadores discretos de la mano sobre la arena: anillo del punto de agarre y flecha de trayectoria
 * (solo cuando el movimiento actual produciría un lanzamiento). Sin nube de puntos técnicos.
 */
export class CursorView {
  readonly group = new Group();
  private readonly ring: Mesh;
  private readonly ringMaterial: MeshBasicMaterial;
  private readonly arrow = new Group();
  private readonly shaft: Mesh;
  private readonly head: Mesh;
  private ringScale = 1;

  constructor() {
    this.ringMaterial = new MeshBasicMaterial({
      color: PALETTE.smokeWhite,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
    });
    this.ring = new Mesh(new RingGeometry(0.052, 0.07, 28), this.ringMaterial);
    this.ring.rotation.x = FLAT;
    this.ring.renderOrder = 5;

    const arrowMaterial = new MeshBasicMaterial({
      color: PALETTE.scoreYellow,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    // Astil: plano de longitud 1 que empieza en el origen y se estira con scale.x.
    const shaftGeometry = new PlaneGeometry(1, 0.04);
    shaftGeometry.rotateX(FLAT);
    shaftGeometry.translate(0.5, 0, 0);
    this.shaft = new Mesh(shaftGeometry, arrowMaterial);

    const headGeometry = new BufferGeometry();
    headGeometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, -0.06, 0, 0, 0.06, HEAD_LENGTH, 0, 0], 3),
    );
    this.head = new Mesh(headGeometry, arrowMaterial);
    this.arrow.add(this.shaft, this.head);
    this.arrow.position.y = 0.012;
    this.arrow.visible = false;

    this.group.add(this.ring, this.arrow);
  }

  sync(hand: HandState, grab: GrabController, dtSeconds: number): void {
    const held = grab.held;
    this.ring.visible = grab.cursorValid && !held;
    if (this.ring.visible) {
      this.ring.position.set(grab.cursor.x, CONFIG.arena.cursorPlaneY, grab.cursor.y);
      this.ringScale = damp(this.ringScale, hand.pinching ? 0.6 : grab.hovered ? 1.35 : 1, 22, dtSeconds);
      this.ring.scale.setScalar(this.ringScale);
      this.ringMaterial.color.setHex(
        hand.pinching || grab.hovered ? PALETTE.scoreYellow : PALETTE.smokeWhite,
      );
      this.ringMaterial.opacity = hand.tracking === 'ok' ? 0.9 : 0.4;
    }

    const throwing = !!held && grab.aimSpeed >= TH.minSpeed;
    this.arrow.visible = throwing;
    if (held && throwing) {
      const launch = clamp(grab.aimSpeed * TH.gain, TH.minLaunch, TH.maxLaunch);
      const length = ARROW_MIN + ((launch - TH.minLaunch) / (TH.maxLaunch - TH.minLaunch)) * (ARROW_MAX - ARROW_MIN);
      this.arrow.position.x = held.x;
      this.arrow.position.z = held.y;
      this.arrow.rotation.y = -Math.atan2(grab.aim.y, grab.aim.x);
      this.shaft.scale.x = length;
      this.head.position.x = length;
    }
  }
}
