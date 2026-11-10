import {
  DirectionalLight,
  Group,
  HemisphereLight,
  Scene,
  WebGLRenderer,
  type PerspectiveCamera,
} from 'three';
import { PALETTE } from '../config/gameConfig';

/**
 * Render 3D transparente sobre el vídeo de la cámara (el vídeo es un elemento HTML debajo del canvas,
 * más barato que subirlo como textura). Todo lo virtual cuelga de `root`, que es lo único que se sacude.
 */
export class SceneRenderer {
  readonly scene = new Scene();
  readonly root = new Group();
  private readonly renderer: WebGLRenderer;
  private pixelRatioCap = 2;
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);

    const sky = new HemisphereLight(PALETTE.smokeWhite, PALETTE.ink, 1.5);
    const sun = new DirectionalLight(0xffffff, 1.6);
    sun.position.set(-1.5, 3, 2);
    this.scene.add(sky, sun, this.root);
  }

  setPixelRatioCap(cap: number): void {
    this.pixelRatioCap = cap;
    this.resize(this.width, this.height);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
    this.renderer.setSize(width, height, false);
  }

  render(camera: PerspectiveCamera): void {
    this.renderer.render(this.scene, camera);
  }
}
