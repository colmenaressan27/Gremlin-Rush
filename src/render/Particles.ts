import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicMaterial, OctahedronGeometry } from 'three';
import { CONFIG } from '../config/gameConfig';

const GRAVITY = 2.4;
const DRAG = 2.2;
const TWO_PI = Math.PI * 2;

/** Partículas con pooling: un único InstancedMesh, sin crear objetos durante la partida. */
export class Particles {
  readonly mesh: InstancedMesh;
  private readonly max = CONFIG.feel.particleMax;
  private readonly px = new Float32Array(this.max);
  private readonly py = new Float32Array(this.max);
  private readonly pz = new Float32Array(this.max);
  private readonly vx = new Float32Array(this.max);
  private readonly vy = new Float32Array(this.max);
  private readonly vz = new Float32Array(this.max);
  private readonly life = new Float32Array(this.max);
  private readonly maxLife = new Float32Array(this.max);
  private readonly size = new Float32Array(this.max);
  private readonly matrix = new Matrix4();
  private readonly color = new Color();
  private next = 0;
  private alive = 0;

  constructor() {
    this.mesh = new InstancedMesh(new OctahedronGeometry(1, 0), new MeshBasicMaterial(), this.max);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.matrix.makeScale(0, 0, 0);
    for (let i = 0; i < this.max; i++) {
      this.mesh.setMatrixAt(i, this.matrix);
      this.mesh.setColorAt(i, this.color);
    }
  }

  burst(x: number, y: number, z: number, colorHex: number, count: number, speed: number): void {
    this.color.setHex(colorHex);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const angle = Math.random() * TWO_PI;
      const s = speed * (0.45 + Math.random() * 0.55);
      this.px[i] = x;
      this.py[i] = y;
      this.pz[i] = z;
      this.vx[i] = Math.cos(angle) * s;
      this.vy[i] = 0.5 + Math.random() * speed * 0.6;
      this.vz[i] = Math.sin(angle) * s;
      this.maxLife[i] = 0.3 + Math.random() * 0.3;
      this.life[i] = this.maxLife[i]!;
      this.size[i] = 0.016 + Math.random() * 0.018;
      this.mesh.setColorAt(i, this.color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.alive = this.max;
  }

  update(dtSeconds: number): void {
    if (this.alive === 0) return;
    let alive = 0;
    const drag = Math.exp(-DRAG * dtSeconds);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i]! <= 0) continue;
      this.life[i]! -= dtSeconds;
      if (this.life[i]! <= 0) {
        this.matrix.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.matrix);
        continue;
      }
      alive++;
      this.vy[i]! -= GRAVITY * dtSeconds;
      this.vx[i]! *= drag;
      this.vz[i]! *= drag;
      this.px[i]! += this.vx[i]! * dtSeconds;
      this.py[i] = Math.max(0.01, this.py[i]! + this.vy[i]! * dtSeconds);
      this.pz[i]! += this.vz[i]! * dtSeconds;
      const s = this.size[i]! * (this.life[i]! / this.maxLife[i]!);
      this.matrix.makeScale(s, s, s).setPosition(this.px[i]!, this.py[i]!, this.pz[i]!);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.alive = alive;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
