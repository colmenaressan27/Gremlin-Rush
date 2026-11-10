import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config/gameConfig';
import { GestureInterpreter, type HandSample } from '../src/input/GestureInterpreter';
import { HoldConfirm } from '../src/input/HoldConfirm';

const G = CONFIG.gesture;
const FRAME_MS = 1000 / 30;
const OPEN = 0.9;
const CLOSED = 0.1;
const BETWEEN = (G.pinchCloseRatio + G.pinchOpenRatio) / 2 - 0.02;

describe('GestureInterpreter', () => {
  let gi: GestureInterpreter;
  let t: number;

  const feed = (ratio: number, frames: number, fingers = 2): void => {
    for (let i = 0; i < frames; i++) {
      t += FRAME_MS;
      const s: HandSample = {
        t,
        x: 400,
        y: 300,
        palmX: 400,
        palmY: 340,
        knuckleX: 400,
        knuckleY: 320,
        pinchRatio: ratio,
        extendedFingers: fingers,
        viewportHeight: 600,
      };
      gi.pushSample(s);
      gi.tick(t);
    }
  };
  const wait = (ms: number): void => {
    t += ms;
    gi.tick(t);
  };

  beforeEach(() => {
    gi = new GestureInterpreter();
    t = 1000;
  });

  it('empieza sin mano y la detecta como estable tras un instante', () => {
    expect(gi.state.tracking).toBe('lost');
    feed(OPEN, 1);
    expect(gi.state.tracking).toBe('ok');
    expect(gi.state.stable).toBe(false);
    feed(OPEN, 6);
    expect(gi.state.stable).toBe(true);
  });

  it('no agarra si la mano entra en cuadro ya pellizcando', () => {
    feed(CLOSED, 20);
    expect(gi.state.pinching).toBe(false);
    expect(gi.events.pinchStart).toBe(false);
  });

  it('ignora un pellizco de un solo fotograma errático', () => {
    feed(OPEN, 8);
    feed(CLOSED, 1);
    feed(OPEN, 3);
    expect(gi.events.pinchStart).toBe(false);
    expect(gi.state.pinching).toBe(false);
  });

  it('confirma el pellizco con permanencia mínima y lo mantiene con histéresis', () => {
    feed(OPEN, 8);
    feed(CLOSED, 1);
    expect(gi.state.pinching).toBe(false);
    feed(CLOSED, 1);
    expect(gi.state.pinching).toBe(true);
    expect(gi.events.pinchStart).toBe(true);
    gi.clearEvents();
    // Temblor entre ambos umbrales: no debe soltar.
    feed(BETWEEN, 15);
    expect(gi.state.pinching).toBe(true);
    expect(gi.events.pinchEnd).toBeNull();
  });

  it('suelta al abrir los dedos y registra cuándo empezó la apertura', () => {
    feed(OPEN, 8);
    feed(CLOSED, 4);
    gi.clearEvents();
    const openStart = t + FRAME_MS;
    feed(OPEN, 1);
    expect(gi.state.pinching).toBe(true);
    feed(OPEN, 2);
    expect(gi.state.pinching).toBe(false);
    expect(gi.events.pinchEnd).toBe('open');
    expect(gi.events.releaseStartT).toBeCloseTo(openStart, 3);
  });

  it('tolera una pérdida breve mientras sostiene y nunca inventa un lanzamiento al perder la mano', () => {
    feed(OPEN, 8);
    feed(CLOSED, 4);
    gi.clearEvents();
    gi.setHolding(true);
    wait(G.holdGraceMs - 100);
    expect(gi.state.tracking).toBe('grace');
    expect(gi.state.pinching).toBe(true);
    expect(gi.events.pinchEnd).toBeNull();
    wait(200);
    expect(gi.state.tracking).toBe('lost');
    expect(gi.state.pinching).toBe(false);
    expect(gi.events.pinchEnd).toBe('lost');
  });

  it('sin agarre la tolerancia es más corta', () => {
    feed(OPEN, 8);
    wait(G.graceMs + 20);
    expect(gi.state.tracking).toBe('lost');
  });

  it('tras perder la mano exige verla abierta antes de volver a agarrar', () => {
    feed(OPEN, 8);
    feed(CLOSED, 4);
    wait(G.graceMs + G.holdGraceMs);
    gi.clearEvents();
    feed(CLOSED, 12);
    expect(gi.events.pinchStart).toBe(false);
    feed(OPEN, 2);
    feed(CLOSED, 3);
    expect(gi.events.pinchStart).toBe(true);
  });

  it('reconoce la palma abierta con retardo y nunca mientras pellizca', () => {
    feed(OPEN, 8, 4);
    expect(gi.state.openPalm).toBe(true);
    feed(CLOSED, 6, 4);
    expect(gi.state.pinching).toBe(true);
    expect(gi.state.openPalm).toBe(false);
  });

  it('la sensibilidad desplaza ambos umbrales conservando la histéresis', () => {
    gi.setSensitivity(1);
    const high = gi.thresholds;
    gi.setSensitivity(0);
    const low = gi.thresholds;
    expect(high.close).toBeGreaterThan(low.close);
    expect(high.open - high.close).toBeCloseTo(low.open - low.close, 6);
  });
});

describe('HoldConfirm', () => {
  it('se completa una sola vez tras mantener el gesto, respetando el bloqueo inicial', () => {
    const hold = new HoldConfirm();
    hold.arm(0);
    expect(hold.update(100, G.confirmLockoutMs - 1, true)).toBe(false);
    expect(hold.progress).toBe(0);
    let now = G.confirmLockoutMs;
    let fired = 0;
    for (let i = 0; i < 100; i++) {
      now += 50;
      if (hold.update(50, now, true)) fired++;
    }
    expect(fired).toBe(1);
  });

  it('retrocede si el gesto se interrumpe', () => {
    const hold = new HoldConfirm();
    hold.arm(-10_000);
    hold.update(G.confirmHoldMs / 2, 0, true);
    const half = hold.progress;
    hold.update(100, 100, false);
    expect(hold.progress).toBeLessThan(half);
  });
});
