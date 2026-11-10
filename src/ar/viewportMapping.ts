import type { Vec2 } from '../core/math';

/**
 * Convierte un punto normalizado del fotograma de cámara (0..1) a píxeles de pantalla,
 * replicando cómo se muestra el vídeo: "object-fit: cover" centrado y, si procede, en espejo.
 */
export function videoToScreen(
  u: number,
  v: number,
  videoWidth: number,
  videoHeight: number,
  viewWidth: number,
  viewHeight: number,
  mirrored: boolean,
  out: Vec2,
): Vec2 {
  const scale = Math.max(viewWidth / videoWidth, viewHeight / videoHeight);
  const shownWidth = videoWidth * scale;
  const shownHeight = videoHeight * scale;
  const x = (viewWidth - shownWidth) / 2 + u * shownWidth;
  out.x = mirrored ? viewWidth - x : x;
  out.y = (viewHeight - shownHeight) / 2 + v * shownHeight;
  return out;
}
