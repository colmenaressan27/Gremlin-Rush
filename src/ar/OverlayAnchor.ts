import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { CONFIG } from '../config/gameConfig';
import type { Vec2 } from '../core/math';
import type { ArenaAnchor, ArenaCalibration } from './ArenaAnchor';

const NEAR = 0.05;
const FAR = 60;
/** Componente vertical mínima del rayo para considerar que apunta hacia el suelo. */
const MIN_DOWNWARD = 1e-4;
const FIT_PASSES = 8;
const FIT_TOLERANCE = 0.005;
const RIM_SAMPLES = 16;

/**
 * Modo "arena superpuesta": una cámara virtual fija mira la arena con la inclinación calibrada
 * y el resultado se dibuja encima del vídeo. NO hay anclaje espacial: si el móvil se mueve,
 * la arena se queda en el mismo sitio de la pantalla. Con el móvil en un soporte fijo
 * el resultado es equivalente y no gasta GPU en seguimiento.
 */
export class OverlayAnchor implements ArenaAnchor {
  readonly mode = 'overlay' as const;
  readonly label = 'Arena superpuesta · no anclada a la mesa';
  readonly tracking = true;
  readonly camera = new PerspectiveCamera(CONFIG.arena.fovDeg, 1, NEAR, FAR);

  private viewWidth = 1;
  private viewHeight = 1;
  private readonly point = new Vector3();
  private readonly origin = new Vector3();

  layout(viewWidth: number, viewHeight: number, calibration: ArenaCalibration): void {
    this.viewWidth = Math.max(1, viewWidth);
    this.viewHeight = Math.max(1, viewHeight);
    const A = CONFIG.arena;
    const cam = this.camera;
    cam.aspect = this.viewWidth / this.viewHeight;

    const tilt = MathUtils.degToRad(calibration.tiltDeg);
    const tanV = Math.tan(MathUtils.degToRad(A.fovDeg) / 2);
    const tanH = tanV * cam.aspect;
    const fitW = A.fitWidth * calibration.scale;
    const fitH = A.fitHeight * calibration.scale;
    // Estimación inicial sin perspectiva; después se corrige midiendo el borde proyectado
    // (el lado cercano de la arena se ve más grande que el lejano).
    let distance = Math.max(A.radius / (tanH * fitW), (A.radius * Math.sin(tilt)) / (tanV * fitH));
    cam.clearViewOffset();
    for (let pass = 0; pass < FIT_PASSES; pass++) {
      cam.position.set(0, distance * Math.sin(tilt), distance * Math.cos(tilt));
      cam.up.set(0, 1, 0);
      cam.lookAt(0, 0, 0);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      let worst = 0;
      for (let i = 0; i < RIM_SAMPLES; i++) {
        const angle = (i / RIM_SAMPLES) * Math.PI * 2;
        this.point.set(Math.cos(angle) * A.radius, 0, Math.sin(angle) * A.radius).project(cam);
        worst = Math.max(worst, Math.abs(this.point.x) / fitW, Math.abs(this.point.y) / fitH);
      }
      if (Math.abs(worst - 1) < FIT_TOLERANCE) break;
      distance *= worst;
    }

    // Desplazamiento vertical en pantalla sin alterar la perspectiva.
    cam.setViewOffset(
      this.viewWidth,
      this.viewHeight,
      0,
      -calibration.offsetY * this.viewHeight,
      this.viewWidth,
      this.viewHeight,
    );
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }

  screenToArena(xPx: number, yPx: number, planeY: number, out: Vec2): boolean {
    const ndcX = (xPx / this.viewWidth) * 2 - 1;
    const ndcY = -((yPx / this.viewHeight) * 2 - 1);
    this.origin.setFromMatrixPosition(this.camera.matrixWorld);
    this.point.set(ndcX, ndcY, 0.5).unproject(this.camera).sub(this.origin);
    if (this.point.y > -MIN_DOWNWARD) return false;
    const t = (planeY - this.origin.y) / this.point.y;
    out.x = this.origin.x + this.point.x * t;
    out.y = this.origin.z + this.point.z * t;
    return true;
  }

  arenaToScreen(x: number, height: number, z: number, out: Vec2): Vec2 {
    this.point.set(x, height, z).project(this.camera);
    out.x = (this.point.x * 0.5 + 0.5) * this.viewWidth;
    out.y = (-this.point.y * 0.5 + 0.5) * this.viewHeight;
    return out;
  }
}
