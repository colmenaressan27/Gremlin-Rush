import { CONFIG } from '../config/gameConfig';

/** Escala pentatónica mayor (semitonos): cada golpe encadenado sube una nota. */
const CHAIN_SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
const NOISE_SECONDS = 1;

/**
 * Efectos de sonido provisionales sintetizados con Web Audio (sin archivos ni licencias externas).
 * El contexto se desbloquea con el toque inicial de "Activar cámara", como exigen los navegadores móviles.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = true;
  private lastHoverMs = 0;

  /** Debe llamarse dentro de un gesto del usuario (clic/toque). */
  unlock(): void {
    try {
      this.ctx ??= new AudioContext();
      if (!this.master) {
        this.master = this.ctx.createGain();
        this.master.gain.value = CONFIG.audio.masterVolume;
        this.master.connect(this.ctx.destination);
        const length = Math.floor(this.ctx.sampleRate * NOISE_SECONDS);
        this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      }
      void this.ctx.resume();
    } catch {
      // Sin audio disponible: el juego sigue, todo aviso tiene también señal visual.
      this.ctx = null;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Reanuda el audio al volver de segundo plano. */
  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  hover(): void {
    const now = performance.now();
    if (now - this.lastHoverMs < 140) return;
    this.lastHoverMs = now;
    this.tone(880, 990, 0.05, 'sine', 0.12);
  }

  grab(): void {
    this.tone(320, 760, 0.09, 'triangle', 0.4);
    this.tone(1200, 1500, 0.05, 'sine', 0.15, 0.03);
  }

  miss(): void {
    this.tone(220, 160, 0.07, 'sine', 0.15);
  }

  chargeFull(): void {
    this.tone(990, 1320, 0.1, 'square', 0.14);
  }

  throwWhoosh(power: number): void {
    this.sweep(0.18, 500, 2600 + power * 1500, 0.35);
  }

  drop(): void {
    this.tone(300, 150, 0.1, 'sine', 0.25);
  }

  wall(): void {
    this.tone(180, 110, 0.08, 'triangle', 0.3);
  }

  hit(chain: number): void {
    const step = CHAIN_SCALE[Math.min(chain, CHAIN_SCALE.length) - 1] ?? 0;
    const freq = 523.25 * 2 ** (step / 12);
    this.sweep(0.07, 1800, 500, 0.4);
    this.tone(150, 70, 0.12, 'sine', 0.5);
    this.tone(freq, freq * 1.01, 0.16, 'square', 0.2, 0.02);
    this.tone(freq * 2, freq * 2, 0.1, 'sine', 0.15, 0.05);
  }

  confirm(): void {
    this.tone(523, 523, 0.09, 'triangle', 0.3);
    this.tone(784, 784, 0.09, 'triangle', 0.3, 0.09);
    this.tone(1047, 1047, 0.16, 'triangle', 0.3, 0.18);
  }

  win(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.14, 'triangle', 0.3, i * 0.09));
  }

  /** Alarma grave y descendente: daño al núcleo. */
  coreHit(): void {
    this.tone(220, 55, 0.4, 'sawtooth', 0.45);
    this.tone(660, 330, 0.25, 'square', 0.2, 0.02);
    this.sweep(0.25, 900, 200, 0.4);
  }

  lose(): void {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.97, 0.22, 'triangle', 0.3, i * 0.16));
  }

  /** Paso de la práctica al combate. */
  alert(): void {
    this.tone(660, 660, 0.1, 'square', 0.2);
    this.tone(880, 880, 0.16, 'square', 0.2, 0.12);
  }

  trackingLost(): void {
    this.tone(440, 330, 0.16, 'sine', 0.18);
  }

  private jitter(): number {
    return 1 + (Math.random() * 2 - 1) * CONFIG.audio.pitchJitter;
  }

  private tone(
    from: number,
    to: number,
    seconds: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const j = this.jitter();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from * j, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to * j), t0 + seconds);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  /** Ruido filtrado con barrido de frecuencia (silbido de lanzamiento, chasquido de impacto). */
  private sweep(seconds: number, from: number, to: number, volume: number): void {
    if (!this.enabled || !this.ctx || !this.master || !this.noise) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + seconds);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + seconds * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0, Math.random() * (NOISE_SECONDS - seconds));
    src.stop(t0 + seconds + 0.02);
  }
}
