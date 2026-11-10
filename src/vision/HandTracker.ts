import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { CONFIG } from '../config/gameConfig';
import type { Point3 } from './handFeatures';

export interface HandFrame {
  image: ReadonlyArray<Point3>;
  world: ReadonlyArray<Point3>;
  handedness: string;
  score: number;
}

type Delegate = 'GPU' | 'CPU';
type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

const LANDMARK_COUNT = 21;

/**
 * Envoltorio de MediaPipe Hand Landmarker. Solo visión: devuelve landmarks, sin reglas de juego.
 * Runtime y modelo se sirven desde este mismo sitio (public/), no desde un CDN.
 */
export class HandTracker {
  delegate: Delegate = 'GPU';
  /** true si el detector dejó de funcionar y no hay alternativa. */
  failed = false;

  private fileset: Fileset | null = null;
  private landmarker: HandLandmarker | null = null;
  private switching = false;
  private lastTimestamp = 0;
  private readonly frame: HandFrame = { image: [], world: [], handedness: '', score: 0 };

  /** @param forceCpu omite la GPU (útil para comparar rendimiento en un dispositivo concreto). */
  async init(forceCpu = false): Promise<void> {
    const wasmBase = new URL(CONFIG.vision.wasmDir, document.baseURI).href;
    this.fileset = await FilesetResolver.forVisionTasks(wasmBase);
    if (forceCpu) {
      await this.create('CPU');
      return;
    }
    try {
      await this.create('GPU');
    } catch (err) {
      console.warn('[visión] GPU no disponible, se usa CPU:', err);
      await this.create('CPU');
    }
  }

  private async create(delegate: Delegate): Promise<void> {
    if (!this.fileset) throw new Error('HandTracker sin inicializar');
    this.landmarker = await HandLandmarker.createFromOptions(this.fileset, {
      baseOptions: {
        modelAssetPath: new URL(CONFIG.vision.modelFile, document.baseURI).href,
        delegate,
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: CONFIG.vision.minDetectionConfidence,
      minHandPresenceConfidence: CONFIG.vision.minPresenceConfidence,
      minTrackingConfidence: CONFIG.vision.minTrackingConfidence,
    });
    this.delegate = delegate;
  }

  get ready(): boolean {
    return this.landmarker !== null;
  }

  /**
   * Primera detección "en frío": compila shaders y reserva memoria (puede tardar segundos).
   * Se hace durante la pantalla de carga para que el tirón no ocurra con el juego ya visible.
   */
  warmUp(video: HTMLVideoElement): void {
    this.detect(video, performance.now());
  }

  /** Analiza el fotograma actual del vídeo. Devuelve null si no hay mano (el objeto se reutiliza). */
  detect(video: HTMLVideoElement, nowMs: number): HandFrame | null {
    if (!this.landmarker || video.videoWidth === 0) return null;
    // MediaPipe exige marcas de tiempo estrictamente crecientes.
    const timestamp = Math.max(nowMs, this.lastTimestamp + 1);
    this.lastTimestamp = timestamp;

    let result;
    try {
      result = this.landmarker.detectForVideo(video, timestamp);
    } catch (err) {
      this.recover(err);
      return null;
    }

    const image = result.landmarks[0];
    const world = result.worldLandmarks[0];
    if (!image || !world || image.length < LANDMARK_COUNT || world.length < LANDMARK_COUNT) return null;

    const category = result.handedness[0]?.[0];
    this.frame.image = image;
    this.frame.world = world;
    this.frame.handedness = category?.categoryName ?? '';
    this.frame.score = category?.score ?? 0;
    return this.frame;
  }

  /** Si la GPU falla en plena ejecución (ocurre en algunos móviles), se reintenta una vez con CPU. */
  private recover(err: unknown): void {
    console.warn('[visión] Fallo de detección:', err);
    if (this.switching) return;
    if (this.delegate === 'CPU') {
      this.failed = true;
      return;
    }
    this.switching = true;
    this.landmarker?.close();
    this.landmarker = null;
    this.create('CPU')
      .catch((e: unknown) => {
        console.error('[visión] Tampoco funciona con CPU:', e);
        this.failed = true;
      })
      .finally(() => {
        this.switching = false;
      });
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
