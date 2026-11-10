import { ARENA_LIMITS, type Settings } from '../config/settings';
import type { TrackingStatus } from '../input/GestureInterpreter';
import { el, nextFieldId, setText } from './dom';

export type HudMode = 'hidden' | 'prepare' | 'playing' | 'result';

export interface HudCallbacks {
  onCalibrationChange(): void;
  onOpenSettings(): void;
}

export interface ResultRow {
  label: string;
  value: string;
}

const RING_RADIUS = 46;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Interfaz mínima sobre la cámara. Durante la partida solo informa (no hay nada que tocar);
 * los controles táctiles —calibración y ajustes— existen únicamente antes y después de jugar.
 */
export class Hud {
  private readonly modeChip: HTMLElement;
  private readonly handChip: HTMLElement;
  private readonly objective: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly calibration: HTMLElement;
  private readonly settingsButton: HTMLButtonElement;
  private readonly result: HTMLElement;
  private readonly resultTitle: HTMLElement;
  private readonly resultList: HTMLElement;
  private readonly confirm: HTMLElement;
  private readonly confirmArc: SVGCircleElement;
  private readonly banner: HTMLElement;
  private lastHand = '';
  private lastProgress = -1;
  private lastConfirmBox = '';

  constructor(
    private readonly root: HTMLElement,
    private readonly settings: Settings,
    private readonly callbacks: HudCallbacks,
  ) {
    this.modeChip = el('p', 'chip chip-mode');
    this.handChip = el('p', 'chip chip-hand');
    this.handChip.setAttribute('role', 'status');
    this.objective = el('p', 'chip chip-objective');
    this.hint = el('p', 'hint');
    this.hint.setAttribute('role', 'status');
    this.banner = el('p', 'chip chip-banner');
    this.banner.hidden = true;

    this.settingsButton = el('button', 'button-ghost', 'Ajustes');
    this.settingsButton.type = 'button';
    this.settingsButton.addEventListener('click', () => this.callbacks.onOpenSettings());

    this.calibration = this.buildCalibration();

    this.result = el('section', 'result');
    this.result.setAttribute('aria-live', 'polite');
    this.resultTitle = el('h2', 'subtitle');
    this.resultList = el('dl', 'stats');
    this.result.append(
      this.resultTitle,
      this.resultList,
      el('p', 'result-next', 'Otra ronda: palma abierta sobre el núcleo.'),
    );

    // Cuenta atrás del gesto de confirmación: anillo que se llena alrededor del núcleo.
    this.confirm = el('div', 'confirm');
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    const track = document.createElementNS(SVG_NS, 'circle');
    track.setAttribute('class', 'confirm-track');
    this.confirmArc = document.createElementNS(SVG_NS, 'circle');
    this.confirmArc.setAttribute('class', 'confirm-arc');
    for (const circle of [track, this.confirmArc]) {
      circle.setAttribute('cx', '50');
      circle.setAttribute('cy', '50');
      circle.setAttribute('r', String(RING_RADIUS));
    }
    this.confirmArc.setAttribute('stroke-dasharray', String(RING_LENGTH));
    svg.append(track, this.confirmArc);
    this.confirm.append(svg, el('span', 'confirm-label', 'Palma abierta aquí'));

    root.append(
      this.modeChip,
      this.handChip,
      this.objective,
      this.banner,
      this.confirm,
      this.hint,
      this.calibration,
      this.settingsButton,
      this.result,
    );
    this.setMode('hidden');
  }

  setMode(mode: HudMode): void {
    this.root.dataset.mode = mode;
    this.root.hidden = mode === 'hidden';
    this.calibration.hidden = mode !== 'prepare';
    this.settingsButton.hidden = mode !== 'prepare' && mode !== 'result';
    this.result.hidden = mode !== 'result';
    this.objective.hidden = mode !== 'playing';
    this.confirm.hidden = mode !== 'prepare' && mode !== 'result';
  }

  setAnchorLabel(text: string): void {
    setText(this.modeChip, text);
  }

  setBanner(text: string): void {
    this.banner.hidden = text === '';
    setText(this.banner, text);
  }

  setHand(tracking: TrackingStatus): void {
    if (tracking === this.lastHand) return;
    this.lastHand = tracking;
    this.handChip.dataset.state = tracking;
    this.handChip.textContent =
      tracking === 'ok' ? '✋ Mano detectada' : tracking === 'grace' ? '✋ Recuperando…' : '✋ Acerca la mano';
  }

  setObjective(text: string): void {
    setText(this.objective, text);
  }

  setHint(text: string): void {
    this.hint.hidden = text === '';
    setText(this.hint, text);
  }

  /** Coloca el anillo de confirmación (px de pantalla) y actualiza su avance 0..1. */
  setConfirm(x: number, y: number, radius: number, progress: number): void {
    const box = `${Math.round(x)}|${Math.round(y)}|${Math.round(radius)}`;
    if (box !== this.lastConfirmBox) {
      this.lastConfirmBox = box;
      const style = this.confirm.style;
      style.left = `${x - radius}px`;
      style.top = `${y - radius}px`;
      style.width = `${radius * 2}px`;
      style.height = `${radius * 2}px`;
    }
    const rounded = Math.round(progress * 100) / 100;
    if (rounded !== this.lastProgress) {
      this.lastProgress = rounded;
      this.confirmArc.setAttribute('stroke-dashoffset', String(RING_LENGTH * (1 - rounded)));
      this.confirm.classList.toggle('confirm-active', rounded > 0);
    }
  }

  showResult(title: string, rows: ResultRow[]): void {
    this.resultTitle.textContent = title;
    this.resultList.replaceChildren();
    for (const row of rows) {
      this.resultList.append(el('dt', '', row.label), el('dd', '', row.value));
    }
  }

  private buildCalibration(): HTMLElement {
    const s = this.settings;
    // Plegado por defecto: la calibración inicial suele servir y así no tapa la arena.
    const panel = el('details', 'calibration');
    panel.append(el('summary', '', 'Ajustar arena'));
    const sliders = el('div', 'calibration-sliders');
    sliders.append(
      this.slider('Tamaño', ARENA_LIMITS.scale, s.arenaScale, (v) => (s.arenaScale = v)),
      this.slider('Posición', ARENA_LIMITS.offsetY, s.arenaOffsetY, (v) => (s.arenaOffsetY = v)),
      this.slider('Inclinación', ARENA_LIMITS.tiltDeg, s.arenaTiltDeg, (v) => (s.arenaTiltDeg = v)),
    );
    panel.append(sliders);
    return panel;
  }

  private slider(
    label: string,
    limits: { min: number; max: number; step: number },
    value: number,
    apply: (v: number) => void,
  ): HTMLElement {
    const id = nextFieldId();
    const row = el('div', 'field');
    const text = el('label', '', label);
    text.htmlFor = id;
    const input = el('input');
    input.id = id;
    input.type = 'range';
    input.min = String(limits.min);
    input.max = String(limits.max);
    input.step = String(limits.step);
    input.value = String(value);
    input.addEventListener('input', () => {
      apply(Number(input.value));
      this.callbacks.onCalibrationChange();
    });
    row.append(text, input);
    return row;
  }
}
