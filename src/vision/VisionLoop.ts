import { CONFIG } from '../config/gameConfig';
import type { HandFrame, HandTracker } from './HandTracker';

export type FrameTimeSource = 'captura' | 'presentación' | 'proceso';

export interface VisionResult {
  frame: HandFrame | null;
  /** Momento de referencia del fotograma analizado (reloj performance.now). */
  frameTimeMs: number;
  frameTimeSource: FrameTimeSource;
  inferenceMs: number;
  /** Momento en que terminó la detección. */
  doneMs: number;
}

/**
 * Ejecuta la detección una vez por fotograma NUEVO de cámara (no por fotograma de render),
 * para no gastar GPU/CPU analizando dos veces la misma imagen.
 */
export class VisionLoop {
  onResult: ((result: VisionResult) => void) | null = null;

  private running = false;
  private handle = 0;
  private usingVideoCallback = false;
  private lastDetectMs = 0;
  private lastVideoTime = -1;
  private readonly result: VisionResult = {
    frame: null,
    frameTimeMs: 0,
    frameTimeSource: 'proceso',
    inferenceMs: 0,
    doneMs: 0,
  };

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly tracker: HandTracker,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.usingVideoCallback = typeof this.video.requestVideoFrameCallback === 'function';
    this.schedule();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.usingVideoCallback) this.video.cancelVideoFrameCallback(this.handle);
    else cancelAnimationFrame(this.handle);
  }

  private schedule(): void {
    this.handle = this.usingVideoCallback
      ? this.video.requestVideoFrameCallback(this.onVideoFrame)
      : requestAnimationFrame(this.onAnimationFrame);
  }

  private readonly onVideoFrame = (now: number, meta: VideoFrameCallbackMetadata): void => {
    if (!this.running) return;
    if (meta.captureTime !== undefined) this.process(meta.captureTime, 'captura');
    else this.process(meta.presentationTime ?? now, 'presentación');
    this.schedule();
  };

  private readonly onAnimationFrame = (now: number): void => {
    if (!this.running) return;
    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      this.process(now, 'proceso');
    }
    this.schedule();
  };

  private process(frameTimeMs: number, source: FrameTimeSource): void {
    const start = performance.now();
    const minInterval = 1000 / CONFIG.vision.maxDetectHz - 3;
    if (start - this.lastDetectMs < minInterval) return;
    this.lastDetectMs = start;

    const frame = this.tracker.detect(this.video, start);
    const done = performance.now();
    this.result.frame = frame;
    this.result.frameTimeMs = frameTimeMs;
    this.result.frameTimeSource = source;
    this.result.inferenceMs = done - start;
    this.result.doneMs = done;
    this.onResult?.(this.result);
  }
}
