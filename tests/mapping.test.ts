import { describe, expect, it } from 'vitest';
import { OverlayAnchor } from '../src/ar/OverlayAnchor';
import { videoToScreen } from '../src/ar/viewportMapping';
import { CONFIG } from '../src/config/gameConfig';
import { OneEuroFilter } from '../src/input/OneEuroFilter';
import { ThrowEstimator } from '../src/input/ThrowEstimator';
import { createHandFeatures, extractHandFeatures, LM, type Point3 } from '../src/vision/handFeatures';

describe('videoToScreen', () => {
  const out = { x: 0, y: 0 };

  it('el centro del fotograma cae en el centro de la pantalla', () => {
    videoToScreen(0.5, 0.5, 1280, 720, 800, 400, false, out);
    expect(out).toEqual({ x: 400, y: 200 });
  });

  it('replica el recorte de object-fit: cover', () => {
    // Vídeo 4:3 en pantalla 2:1 → se ajusta al ancho y se recorta arriba/abajo.
    videoToScreen(0, 0, 640, 480, 800, 400, false, out);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(-100);
  });

  it('invierte el eje horizontal en modo espejo (y solo ese eje)', () => {
    videoToScreen(0.25, 0.3, 1280, 720, 1280, 720, true, out);
    expect(out.x).toBeCloseTo(960);
    expect(out.y).toBeCloseTo(216);
  });
});

describe('OverlayAnchor', () => {
  const anchor = new OverlayAnchor();
  const calib = { scale: 1, offsetY: 0, tiltDeg: CONFIG.arena.defaultTiltDeg };
  const screen = { x: 0, y: 0 };
  const arena = { x: 0, y: 0 };

  it('sin desplazamiento, el núcleo queda en el centro de la pantalla', () => {
    anchor.layout(844, 390, calib);
    anchor.arenaToScreen(0, 0, 0, screen);
    expect(screen.x).toBeCloseTo(422, 1);
    expect(screen.y).toBeCloseTo(195, 1);
  });

  it('la arena completa cabe en pantalla en horizontal y en vertical', () => {
    for (const [w, h] of [
      [844, 390],
      [390, 844],
    ] as const) {
      anchor.layout(w, h, calib);
      for (let a = 0; a < 8; a++) {
        const angle = (a / 8) * Math.PI * 2;
        anchor.arenaToScreen(Math.cos(angle), 0, Math.sin(angle), screen);
        expect(screen.x).toBeGreaterThan(0);
        expect(screen.x).toBeLessThan(w);
        expect(screen.y).toBeGreaterThan(0);
        expect(screen.y).toBeLessThan(h);
      }
    }
  });

  it('pantalla → arena → pantalla es coherente, también con calibración distinta', () => {
    anchor.layout(844, 390, { scale: 0.8, offsetY: 0.12, tiltDeg: 40 });
    for (const [x, z] of [
      [0, 0],
      [0.6, -0.3],
      [-0.9, 0.2],
    ] as const) {
      anchor.arenaToScreen(x, 0.07, z, screen);
      expect(anchor.screenToArena(screen.x, screen.y, 0.07, arena)).toBe(true);
      expect(arena.x).toBeCloseTo(x, 4);
      expect(arena.y).toBeCloseTo(z, 4);
    }
  });

  it('el desplazamiento positivo baja la arena en pantalla', () => {
    anchor.layout(844, 390, { ...calib, offsetY: 0.1 });
    anchor.arenaToScreen(0, 0, 0, screen);
    expect(screen.y).toBeCloseTo(195 + 39, 1);
  });

  it('un rayo que apunta por encima del horizonte no toca la arena', () => {
    anchor.layout(844, 390, { scale: 1, offsetY: 0, tiltDeg: 25 });
    expect(anchor.screenToArena(422, -4000, 0, arena)).toBe(false);
  });
});

describe('ThrowEstimator', () => {
  const v = { x: 0, y: 0 };

  it('mide una velocidad constante', () => {
    const est = new ThrowEstimator();
    for (let i = 0; i < 6; i++) est.push(i * 33, i * 0.033 * 3, i * 0.033 * -1.5);
    expect(est.estimate(165, 150, 3, v)).toBe(true);
    expect(v.x).toBeCloseTo(3, 3);
    expect(v.y).toBeCloseTo(-1.5, 3);
  });

  it('solo considera la ventana reciente', () => {
    const est = new ThrowEstimator();
    for (let i = 0; i < 10; i++) est.push(i * 33, i * 0.2, 0); // rápido, antiguo
    for (let i = 10; i < 16; i++) est.push(i * 33, 9 * 0.2, 0); // quieto, reciente
    expect(est.estimate(15 * 33, 150, 3, v)).toBe(true);
    expect(Math.abs(v.x)).toBeLessThan(0.2);
  });

  it('sin muestras suficientes no inventa velocidad', () => {
    const est = new ThrowEstimator();
    est.push(0, 0, 0);
    est.push(10, 5, 5);
    expect(est.estimate(10, 150, 3, v)).toBe(false);
    expect(v).toEqual({ x: 0, y: 0 });
  });
});

describe('OneEuroFilter', () => {
  it('atenúa el temblor en reposo y sigue los movimientos rápidos', () => {
    const still = new OneEuroFilter(1.4, 9, 1);
    let out = 0;
    for (let i = 0; i < 60; i++) out = still.filter(0.5 + (i % 2 === 0 ? 0.004 : -0.004), i / 30);
    expect(Math.abs(out - 0.5)).toBeLessThan(0.002);

    const fast = new OneEuroFilter(1.4, 9, 1);
    for (let i = 0; i < 12; i++) out = fast.filter(i * 0.05, i / 30);
    expect(11 * 0.05 - out).toBeLessThan(0.03);
  });
});

describe('extractHandFeatures', () => {
  /** Mano sintética plana: muñeca abajo, dedos hacia arriba (y decrece), en metros / normalizado. */
  const makeHand = (pinched: boolean, curled: boolean): Point3[] => {
    const pts: Point3[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8, z: 0 }));
    const set = (i: number, x: number, y: number): void => {
      pts[i] = { x, y, z: 0 };
    };
    set(LM.wrist, 0.5, 0.8);
    set(LM.indexMcp, 0.46, 0.6);
    set(LM.middleMcp, 0.5, 0.59);
    set(LM.ringMcp, 0.54, 0.6);
    set(LM.pinkyMcp, 0.58, 0.63);
    const tipY = curled ? 0.66 : 0.38;
    set(LM.middleTip, 0.5, tipY);
    set(LM.ringTip, 0.54, tipY + 0.02);
    set(LM.pinkyTip, 0.58, tipY + 0.06);
    if (pinched) {
      set(LM.indexTip, 0.42, 0.52);
      set(LM.thumbTip, 0.41, 0.53);
    } else {
      set(LM.indexTip, 0.46, 0.4);
      set(LM.thumbTip, 0.34, 0.62);
    }
    return pts;
  };
  const G = CONFIG.gesture;
  const run = (pts: Point3[]) =>
    extractHandFeatures(pts, pts, 1, G.worldWeight, G.fingerExtendedRatio, createHandFeatures());

  it('distingue mano abierta de pellizco con umbrales relativos al tamaño de la mano', () => {
    const open = run(makeHand(false, false));
    const pinch = run(makeHand(true, false));
    expect(open.pinchRatio).toBeGreaterThan(G.pinchOpenRatio);
    expect(pinch.pinchRatio).toBeLessThan(G.pinchCloseRatio);
    expect(open.extendedFingers).toBe(4);
  });

  it('el resultado no cambia con la distancia a la cámara (escala)', () => {
    const near = makeHand(true, false);
    const far = near.map((p) => ({ x: 0.5 + (p.x - 0.5) * 0.4, y: 0.5 + (p.y - 0.5) * 0.4, z: 0 }));
    expect(run(far).pinchRatio).toBeCloseTo(run(near).pinchRatio, 5);
  });

  it('con los dedos recogidos no hay palma abierta', () => {
    expect(run(makeHand(false, true)).extendedFingers).toBeLessThan(4);
  });

  it('el cursor es el punto medio entre pulgar e índice', () => {
    const f = run(makeHand(true, false));
    expect(f.cursorU).toBeCloseTo(0.415, 5);
    expect(f.cursorV).toBeCloseTo(0.525, 5);
  });
});
