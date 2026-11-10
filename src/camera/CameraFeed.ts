import { CONFIG } from '../config/gameConfig';

export type CameraErrorKind = 'insecure' | 'unsupported' | 'denied' | 'notfound' | 'busy' | 'unknown';

export class CameraError extends Error {
  constructor(
    readonly kind: CameraErrorKind,
    detail?: string,
  ) {
    super(detail ?? kind);
    this.name = 'CameraError';
  }
}

function classify(err: unknown): CameraError {
  const name = err instanceof DOMException ? err.name : '';
  const detail = err instanceof Error ? err.message : String(err);
  if (name === 'NotAllowedError' || name === 'SecurityError') return new CameraError('denied', detail);
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return new CameraError('notfound', detail);
  if (name === 'NotReadableError' || name === 'AbortError') return new CameraError('busy', detail);
  return new CameraError('unknown', detail);
}

/**
 * Ciclo de vida de la cámara: un único flujo a la vez, procesado solo en este dispositivo.
 * No graba ni envía nada; al cerrar u ocultar la página se liberan las pistas.
 */
export class CameraFeed {
  /** Se invoca si el sistema corta la cámara (permiso revocado, otra app la toma, etc.). */
  onLost: (() => void) | null = null;

  private stream: MediaStream | null = null;
  private starting: Promise<void> | null = null;
  private autoMirror = false;
  private facingLabel = 'desconocida';

  constructor(readonly video: HTMLVideoElement) {
    video.playsInline = true;
    video.muted = true;
    window.addEventListener('pagehide', () => this.stop());
  }

  /** Arranca la cámara. Llamadas simultáneas comparten el mismo intento (nunca dos flujos). */
  start(facing: 'environment' | 'user'): Promise<void> {
    this.starting ??= this.open(facing).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async open(facing: 'environment' | 'user'): Promise<void> {
    this.stop();
    if (!window.isSecureContext) throw new CameraError('insecure');
    if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: CONFIG.camera.idealWidth },
          height: { ideal: CONFIG.camera.idealHeight },
          frameRate: { ideal: CONFIG.camera.idealFps },
        },
      });
    } catch (err) {
      throw classify(err);
    }

    this.stream = stream;
    const track = stream.getVideoTracks()[0];
    if (!track) {
      this.stop();
      throw new CameraError('notfound');
    }
    track.addEventListener('ended', () => {
      if (this.stream === stream) {
        this.stop();
        this.onLost?.();
      }
    });

    const reported = track.getSettings().facingMode;
    // Una cámara que no declara ser trasera (webcam de PC, cámara frontal) se muestra en espejo.
    this.autoMirror = reported !== 'environment';
    this.facingLabel = reported ?? 'sin declarar';

    this.video.srcObject = stream;
    try {
      await this.video.play();
      if (this.video.videoWidth === 0) {
        await new Promise<void>((resolve) =>
          this.video.addEventListener('loadedmetadata', () => resolve(), { once: true }),
        );
      }
    } catch (err) {
      this.stop();
      throw classify(err);
    }
  }

  stop(): void {
    if (!this.stream) return;
    for (const track of this.stream.getTracks()) track.stop();
    this.stream = null;
    this.video.srcObject = null;
  }

  get active(): boolean {
    const track = this.stream?.getVideoTracks()[0];
    return !!track && track.readyState === 'live';
  }

  get mirroredByDefault(): boolean {
    return this.autoMirror;
  }

  get facing(): string {
    return this.facingLabel;
  }

  get width(): number {
    return this.video.videoWidth;
  }

  get height(): number {
    return this.video.videoHeight;
  }
}
