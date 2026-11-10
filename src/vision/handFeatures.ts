/**
 * Convierte los 21 landmarks de una mano en las pocas magnitudes que usa el juego.
 * Funciones puras: aquí no hay reglas de juego ni estado temporal.
 */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface HandFeatures {
  /** Punto de agarre: medio entre puntas de pulgar e índice, normalizado al fotograma (0..1). */
  cursorU: number;
  cursorV: number;
  /** Centro de la palma, normalizado al fotograma. */
  palmU: number;
  palmV: number;
  /** Nudillo del índice: referencia de velocidad que no se altera al abrir o cerrar los dedos. */
  knuckleU: number;
  knuckleV: number;
  /** Separación pulgar–índice relativa al tamaño de la mano (mezcla 2D/3D). */
  pinchRatio: number;
  pinchRatio2D: number;
  pinchRatio3D: number;
  /** Dedos extendidos entre índice, corazón, anular y meñique. */
  extendedFingers: number;
  /** Tamaño aparente de la mano en alturas de fotograma. */
  handSize: number;
}

export const LM = {
  wrist: 0,
  thumbTip: 4,
  indexMcp: 5,
  indexTip: 8,
  middleMcp: 9,
  middleTip: 12,
  ringMcp: 13,
  ringTip: 16,
  pinkyMcp: 17,
  pinkyTip: 20,
} as const;

const FINGERS: ReadonlyArray<readonly [mcp: number, tip: number]> = [
  [LM.indexMcp, LM.indexTip],
  [LM.middleMcp, LM.middleTip],
  [LM.ringMcp, LM.ringTip],
  [LM.pinkyMcp, LM.pinkyTip],
];

/** Relación ancho de palma → largo de palma, para que ambas medidas sean comparables. */
const PALM_WIDTH_TO_LENGTH = 1.4;
const EPS = 1e-6;

const d3 = (a: Point3, b: Point3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function createHandFeatures(): HandFeatures {
  return {
    cursorU: 0,
    cursorV: 0,
    palmU: 0,
    palmV: 0,
    knuckleU: 0,
    knuckleV: 0,
    pinchRatio: 1,
    pinchRatio2D: 1,
    pinchRatio3D: 1,
    extendedFingers: 0,
    handSize: 0,
  };
}

/**
 * @param image  21 landmarks normalizados al fotograma.
 * @param world  21 landmarks métricos relativos a la mano (invariantes a la rotación).
 * @param aspect ancho/alto del fotograma, para medir distancias 2D sin deformación.
 */
export function extractHandFeatures(
  image: ReadonlyArray<Point3>,
  world: ReadonlyArray<Point3>,
  aspect: number,
  worldWeight: number,
  fingerExtendedRatio: number,
  out: HandFeatures,
): HandFeatures {
  const d2 = (a: number, b: number): number =>
    Math.hypot((image[a]!.x - image[b]!.x) * aspect, image[a]!.y - image[b]!.y);

  // El tamaño 2D toma la mayor de varias medidas: así un escorzo en un eje no lo encoge.
  const size2D = Math.max(
    d2(LM.wrist, LM.middleMcp),
    d2(LM.wrist, LM.indexMcp),
    d2(LM.wrist, LM.pinkyMcp),
    d2(LM.indexMcp, LM.pinkyMcp) * PALM_WIDTH_TO_LENGTH,
  );
  const size3D = d3(world[LM.wrist]!, world[LM.middleMcp]!);

  out.pinchRatio2D = d2(LM.thumbTip, LM.indexTip) / Math.max(size2D, EPS);
  out.pinchRatio3D = d3(world[LM.thumbTip]!, world[LM.indexTip]!) / Math.max(size3D, EPS);
  out.pinchRatio = out.pinchRatio2D * (1 - worldWeight) + out.pinchRatio3D * worldWeight;
  out.handSize = size2D;

  out.cursorU = (image[LM.thumbTip]!.x + image[LM.indexTip]!.x) / 2;
  out.cursorV = (image[LM.thumbTip]!.y + image[LM.indexTip]!.y) / 2;
  out.palmU = (image[LM.wrist]!.x + image[LM.indexMcp]!.x + image[LM.pinkyMcp]!.x) / 3;
  out.palmV = (image[LM.wrist]!.y + image[LM.indexMcp]!.y + image[LM.pinkyMcp]!.y) / 3;
  out.knuckleU = image[LM.indexMcp]!.x;
  out.knuckleV = image[LM.indexMcp]!.y;

  let extended = 0;
  const wrist = world[LM.wrist]!;
  for (const [mcp, tip] of FINGERS) {
    if (d3(wrist, world[tip]!) > d3(wrist, world[mcp]!) * fingerExtendedRatio) extended++;
  }
  out.extendedFingers = extended;
  return out;
}
