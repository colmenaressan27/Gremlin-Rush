import type { PerspectiveCamera } from 'three';
import type { Vec2 } from '../core/math';

export interface ArenaCalibration {
  scale: number;
  offsetY: number;
  tiltDeg: number;
}

/**
 * Contrato de anclaje: cómo se relaciona la pantalla con el plano de juego.
 * El resto del juego solo conoce esta interfaz, de modo que un anclaje por imagen
 * podría sustituir a la superposición sin tocar gestos, física ni render.
 */
export interface ArenaAnchor {
  /** 'overlay' = arena superpuesta a la cámara (NO anclada al mundo). 'image' = anclada a un patrón físico. */
  readonly mode: 'overlay' | 'image';
  /** Texto honesto que se muestra al jugador sobre el modo activo. */
  readonly label: string;
  readonly camera: PerspectiveCamera;
  /** false si el anclaje se perdió temporalmente (la superposición nunca lo pierde). */
  readonly tracking: boolean;

  layout(viewWidth: number, viewHeight: number, calibration: ArenaCalibration): void;

  /**
   * Proyecta un punto de pantalla al plano horizontal de altura planeY.
   * out.x / out.y son las coordenadas X / Z de la arena. Devuelve false si el rayo no corta el plano.
   */
  screenToArena(xPx: number, yPx: number, planeY: number, out: Vec2): boolean;

  /** Proyecta un punto de la arena (x, altura, z) a píxeles de pantalla. */
  arenaToScreen(x: number, height: number, z: number, out: Vec2): Vec2;
}
