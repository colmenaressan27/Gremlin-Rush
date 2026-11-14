import { OverlayAnchor } from '../ar/OverlayAnchor';
import type { ArenaAnchor } from '../ar/ArenaAnchor';
import { videoToScreen } from '../ar/viewportMapping';
import { Sfx } from '../audio/Sfx';
import { CameraError, CameraFeed } from '../camera/CameraFeed';
import { CONFIG } from '../config/gameConfig';
import { loadBestScore, submitScore } from '../config/records';
import { loadSettings, saveSettings, type Settings } from '../config/settings';
import type { Vec2 } from '../core/math';
import { GameSession } from '../game/GameSession';
import type { Gremlin } from '../game/Gremlin';
import { World, type WorldListener } from '../game/World';
import { GestureInterpreter, type HandSample } from '../input/GestureInterpreter';
import { HoldConfirm } from '../input/HoldConfirm';
import { SimulatedHand } from '../input/SimulatedHand';
import { GrabController, type DropReason, type GrabListener } from '../interaction/GrabController';
import { Metrics } from '../qa/Metrics';
import { ArenaView } from '../render/ArenaView';
import { CursorView } from '../render/CursorView';
import { Effects } from '../render/Effects';
import { GremlinView } from '../render/GremlinView';
import { SceneRenderer } from '../render/SceneRenderer';
import { DiagnosticsPanel } from '../ui/DiagnosticsPanel';
import { Hud, type ResultRow } from '../ui/Hud';
import { Screens } from '../ui/Screens';
import { createHandFeatures, extractHandFeatures } from '../vision/handFeatures';
import { HandTracker } from '../vision/HandTracker';
import { VisionLoop, type VisionResult } from '../vision/VisionLoop';

type AppState = 'welcome' | 'loading' | 'error' | 'prepare' | 'playing' | 'result';
/** Progreso del tutorial contextual: qué le falta aprender al jugador. */
type TutorialStep = 'grab' | 'throw' | 'hit' | 'done';

const MAX_FRAME_MS = 100;
const FINISH_DELAY_SECONDS = 0.9;
const COMBAT_HINT_MS = 3500;
/** Tiempo que se muestra la pista de un tipo de enemigo la primera vez que aparece en la partida. */
const KIND_HINT_MS = 5000;
const KIND_HINTS = {
  bomb: 'Bomb naranja: atrápalo y lánzalo, explota al chocar',
  tank: 'Tank morado: no se levanta. Usa un Bomb o dale 3 golpes',
} as const;
const TUTORIAL_STEPS = 3;
/** Desplazamiento (unidades de arena) entre dos textos que nacen en el mismo punto. */
const POPUP_OFFSET = 0.2;
const HAPTIC_BLAST_MS = 45;
/** Últimos segundos de partida: el cronómetro se marca como urgente. */
const URGENT_SECONDS = 10;
const HAPTIC_CORE_MS = 80;
/** Si la marca de tiempo del fotograma se aleja tanto del reloj local, no es fiable. */
const MAX_FRAME_AGE_MS = 500;
const CONFIRM_ZONE_TOLERANCE = 1.15;
const HAPTIC_GRAB_MS = 12;
const HAPTIC_HIT_MS = 25;

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Falta el elemento #${id} en index.html`);
  return node as T;
}

/**
 * Orquesta el flujo de la aplicación: bienvenida → cámara → preparación → partida → resultado.
 * No contiene reglas de visión, gestos ni física: solo conecta los módulos.
 */
export class App {
  private readonly settings: Settings = loadSettings();
  private readonly query = new URLSearchParams(location.search);
  private readonly simulated = this.query.has('sim');

  private readonly camera = new CameraFeed(byId<HTMLVideoElement>('camera'));
  private readonly tracker = new HandTracker();
  private readonly visionLoop = new VisionLoop(this.camera.video, this.tracker);
  private readonly features = createHandFeatures();
  private readonly gestures = new GestureInterpreter();
  private readonly confirm = new HoldConfirm();
  private readonly simHand = this.simulated ? new SimulatedHand(document.body) : null;

  private readonly anchor: ArenaAnchor = new OverlayAnchor();
  private readonly world = new World(CONFIG.match.maxGremlins);
  private readonly session = new GameSession(this.world);
  private readonly grab = new GrabController(this.world, this.anchor, this.gestures);

  private readonly renderer = new SceneRenderer(byId<HTMLCanvasElement>('scene'));
  private readonly arenaView = new ArenaView();
  private readonly cursorView = new CursorView();
  private readonly gremlinViews: GremlinView[] = [];
  private readonly effects = new Effects(this.renderer.root, this.anchor, byId('popups'));
  private readonly sfx = new Sfx();
  private readonly metrics = new Metrics();

  private readonly screens: Screens;
  private readonly hud: Hud;
  private readonly diagnostics: DiagnosticsPanel;

  private state: AppState = 'welcome';
  private tutorial: TutorialStep = 'grab';
  private viewWidth = 1;
  private viewHeight = 1;
  private mirrored = false;
  private cameraDown = false;
  private recovering = false;
  private lastFrameMs = 0;
  private lastSeq = 0;
  private wasTracking = false;
  private finishTimer = 0;
  /** La práctica solo se ofrece hasta que el jugador consigue su primer golpe. */
  private practiceDone = false;
  private paused = false;
  private combatHintUntil = 0;
  /** Última oleada anunciada en pantalla (-1 = ninguna todavía). */
  private shownWave = -1;
  private kindHint = '';
  private kindHintUntil = 0;
  private seenBomb = false;
  private seenTank = false;
  /** El último intento del tutorial acabó en "soltar sin impulso": se explica cómo lanzar. */
  private droppedSlow = false;
  private qualityTier = 0;
  private lowFpsMs = 0;
  private wakeLock: WakeLockSentinel | null = null;

  private readonly sample: HandSample = {
    t: 0,
    x: 0,
    y: 0,
    palmX: 0,
    palmY: 0,
    knuckleX: 0,
    knuckleY: 0,
    pinchRatio: 1,
    extendedFingers: 0,
    viewportHeight: 1,
  };
  private readonly tmp: Vec2 = { x: 0, y: 0 };
  private readonly corePx: Vec2 = { x: 0, y: 0 };

  constructor() {
    const hudRoot = byId('hud');
    this.screens = new Screens(byId('screens'), this.settings, {
      onStart: () => void this.start(),
      onRetry: () => void this.start(),
      onSettingsChange: () => this.applySettings(),
    });
    this.hud = new Hud(hudRoot, this.settings, {
      onCalibrationChange: () => {
        saveSettings(this.settings);
        this.layout();
      },
      onOpenSettings: () => this.openSettings(),
    });
    this.diagnostics = new DiagnosticsPanel(hudRoot, byId<HTMLCanvasElement>('debug'));

    this.renderer.root.add(this.arenaView.group, this.cursorView.group);
    for (let i = 0; i < this.world.gremlins.length; i++) {
      const view = new GremlinView();
      this.gremlinViews.push(view);
      this.renderer.root.add(view.group);
    }

    this.world.listener = this.worldListener;
    this.grab.listener = this.grabListener;
    this.visionLoop.onResult = (result) => this.onVision(result);
    this.camera.onLost = () => this.onCameraLost();

    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => this.layout());
    document.addEventListener('visibilitychange', () => this.onVisibilityChange());

    this.hud.setAnchorLabel(this.anchor.label);
    this.applySettings();
    this.layout();
    this.screens.show('welcome');
    this.exposeDebugHandle();
    requestAnimationFrame(this.frame);
  }

  // ───────────────────────── Flujo de pantallas ─────────────────────────

  /** Se ejecuta tras el toque inicial: único punto donde el navegador pide permiso de cámara. */
  private async start(): Promise<void> {
    if (this.state === 'loading') return;
    this.state = 'loading';
    this.sfx.unlock();
    this.screens.setLoading('Abriendo la cámara…');
    this.screens.show('loading');

    if (!this.simulated) {
      try {
        await this.camera.start(this.settings.cameraFacing);
      } catch (err) {
        this.state = 'error';
        this.screens.showCameraError(err instanceof CameraError ? err.kind : 'unknown');
        return;
      }
      try {
        this.screens.setLoading('Cargando el detector de mano…');
        if (!this.tracker.ready) {
          await this.tracker.init(this.query.get('delegate') === 'cpu');
          this.tracker.warmUp(this.camera.video);
        }
      } catch (err) {
        console.error('[app] No se pudo iniciar el detector de mano:', err);
        this.camera.stop();
        this.state = 'error';
        this.screens.showVisionError();
        return;
      }
      this.visionLoop.start();
    }

    this.cameraDown = false;
    this.applySettings();
    this.layout();
    void this.requestWakeLock();
    this.enterPrepare();
  }

  private enterPrepare(): void {
    this.state = 'prepare';
    this.screens.show('none');
    this.hud.setMode('prepare');
    // Unos gremlins deambulando sirven de referencia mientras se coloca la arena.
    this.session.start(true);
    this.confirm.arm(performance.now());
  }

  private startSession(): void {
    this.state = 'playing';
    this.tutorial = this.practiceDone ? 'done' : 'grab';
    this.finishTimer = 0;
    this.paused = false;
    this.qualityTier = 0;
    this.lowFpsMs = 0;
    this.applyQuality();
    this.metrics.resetSession();
    this.shownWave = -1;
    this.kindHint = '';
    this.seenBomb = false;
    this.seenTank = false;
    this.droppedSlow = false;
    this.session.start(!this.practiceDone, {
      durationSeconds: this.testParam('duracion') ?? CONFIG.match.durationSeconds,
      startAtSeconds: this.testParam('inicio') ?? 0,
      assisted: this.settings.assisted,
    });
    if (this.practiceDone) this.combatHintUntil = performance.now() + COMBAT_HINT_MS;
    this.hud.setMode('playing');
    this.sfx.confirm();
  }

  /**
   * Parámetros de dirección para las pruebas automáticas (?duracion=N acorta la partida,
   * ?inicio=N la empieza con N segundos ya transcurridos). Solo en desarrollo o simulación.
   */
  private testParam(name: string): number | null {
    const requested = Number(this.query.get(name));
    const allowed = (import.meta.env.DEV || this.simulated) && requested > 0;
    return allowed ? requested : null;
  }

  private finishSession(): void {
    const won = this.session.phase === 'won';
    this.state = 'result';
    this.grab.cancel();
    this.hud.setPaused(false);
    this.hud.showResult(
      won ? '¡Núcleo a salvo!' : 'Núcleo destruido',
      this.buildResultRows(won),
      won ? 'won' : 'lost',
    );
    this.hud.setMode('result');
    this.confirm.arm(performance.now());
    if (won) this.sfx.win();
    else this.sfx.lose();
  }

  private openSettings(): void {
    this.state = 'welcome';
    this.grab.cancel();
    this.visionLoop.stop();
    this.camera.stop();
    this.releaseWakeLock();
    this.hud.setMode('hidden');
    this.screens.show('welcome');
  }

  private buildResultRows(won: boolean): ResultRow[] {
    const s = this.session;
    const m = this.metrics;
    const c = m.counters;
    const previousBest = loadBestScore();
    const isRecord = submitScore(s.score);
    const points = (n: number): string => n.toLocaleString('es');

    const rows: ResultRow[] = [
      { label: 'Puntuación', value: points(s.score) },
      {
        label: 'Récord',
        value: isRecord ? `¡Nuevo! (antes ${points(previousBest)})` : points(previousBest),
      },
      {
        label: 'Combo máximo',
        value: s.bestCombo >= 2 ? `x${Math.min(s.bestCombo, CONFIG.score.maxMultiplier)} (${s.bestCombo} golpes)` : '—',
      },
      { label: 'Derrotados', value: `${s.defeated}` },
      {
        label: 'Runner · Bomb · Tank',
        value: `${s.defeatedByKind.runner} · ${s.defeatedByKind.bomb} · ${s.defeatedByKind.tank}`,
      },
      won
        ? { label: 'Vidas', value: `${s.lives} (+${points(s.lifeBonus)})` }
        : { label: 'Aguantaste', value: `${Math.round(s.progress * 100)} % del tiempo` },
    ];
    // Los datos técnicos solo aparecen con el diagnóstico activado.
    if (this.diagnostics.active) {
      rows.push(
        { label: 'Agarres', value: `${c.grabs}/${c.pinches} (${m.grabRate().toFixed(0)} %)` },
        { label: 'Lanzados', value: `${c.throws} · soltados ${c.dropsSlow}` },
        { label: 'FPS', value: `${m.sessionFpsAvg.toFixed(0)} (mín ${m.sessionFpsMin.toFixed(0)})` },
      );
    }
    return rows;
  }

  // ───────────────────────── Ajustes y disposición ─────────────────────────

  private applySettings(): void {
    const s = this.settings;
    saveSettings(s);
    this.gestures.setSensitivity(s.sensitivity);
    this.effects.setReduced(s.reduceEffects);
    this.sfx.setEnabled(s.sound);
    this.diagnostics.setEnabled(s.diagnostics || this.query.has('diag'));
    if (s.largeText) document.documentElement.dataset.text = 'large';
    else delete document.documentElement.dataset.text;
    this.mirrored = !this.simulated && this.camera.mirroredByDefault !== s.flipMirror;
    this.camera.video.classList.toggle('mirrored', this.mirrored);
  }

  private applyQuality(): void {
    const Q = CONFIG.quality;
    this.renderer.setPixelRatioCap(Q.pixelRatioTiers[this.qualityTier] ?? 1);
    this.effects.setParticleScale(Q.particleScaleTiers[this.qualityTier] ?? 1);
  }

  /** Si el FPS se mantiene bajo, se degradan los efectos visuales; nunca la detección de la mano. */
  private watchQuality(dtMs: number): void {
    const Q = CONFIG.quality;
    if (this.metrics.fps === 0 || this.metrics.fps >= Q.minFps) {
      this.lowFpsMs = 0;
      return;
    }
    this.lowFpsMs += dtMs;
    if (this.lowFpsMs >= Q.windowMs && this.qualityTier < Q.pixelRatioTiers.length - 1) {
      this.qualityTier++;
      this.lowFpsMs = 0;
      this.applyQuality();
    }
  }

  private layout(): void {
    this.viewWidth = window.innerWidth;
    this.viewHeight = window.innerHeight;
    this.renderer.resize(this.viewWidth, this.viewHeight);
    this.diagnostics.resize(this.viewWidth, this.viewHeight);
    this.anchor.layout(this.viewWidth, this.viewHeight, {
      scale: this.settings.arenaScale,
      offsetY: this.settings.arenaOffsetY,
      tiltDeg: this.settings.arenaTiltDeg,
    });
  }

  // ───────────────────────── Cámara y visibilidad ─────────────────────────

  private onCameraLost(): void {
    if (this.state === 'welcome' || this.state === 'error') return;
    this.cameraDown = true;
    this.visionLoop.stop();
    this.grab.cancel();
    if (document.visibilityState === 'visible') void this.recoverCamera();
  }

  private async recoverCamera(): Promise<void> {
    if (this.recovering || this.simulated) return;
    this.recovering = true;
    try {
      await this.camera.start(this.settings.cameraFacing);
      this.cameraDown = false;
      this.applySettings();
      this.visionLoop.start();
    } catch (err) {
      this.state = 'error';
      this.hud.setMode('hidden');
      this.screens.showCameraError(err instanceof CameraError ? err.kind : 'unknown');
    } finally {
      this.recovering = false;
    }
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      // Al salir de la página no se lanza nada: lo que haya en la mano simplemente cae,
      // y el combate queda en pausa hasta que la mano vuelva a verse.
      this.grab.cancel();
      if (this.state === 'playing' && this.session.phase === 'combat') this.paused = true;
      return;
    }
    this.lastFrameMs = performance.now();
    this.sfx.resume();
    const running = this.state === 'prepare' || this.state === 'playing' || this.state === 'result';
    if (!running) return;
    void this.requestWakeLock();
    if (!this.simulated && !this.camera.active) {
      this.cameraDown = true;
      this.visionLoop.stop();
      void this.recoverCamera();
    } else if (!this.simulated) {
      void this.camera.video.play().catch(() => undefined);
    }
  }

  private async requestWakeLock(): Promise<void> {
    try {
      this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      this.wakeLock = null;
    }
  }

  private releaseWakeLock(): void {
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }

  // ───────────────────────── Visión → gestos ─────────────────────────

  private onVision(result: VisionResult): void {
    this.metrics.vision(result);
    const frame = result.frame;
    if (!frame) {
      this.diagnostics.hasPoints = false;
      return;
    }
    const vw = this.camera.width;
    const vh = this.camera.height;
    if (vw === 0 || vh === 0) return;

    const G = CONFIG.gesture;
    const f = extractHandFeatures(frame.image, frame.world, vw / vh, G.worldWeight, G.fingerExtendedRatio, this.features);
    const s = this.sample;
    const W = this.viewWidth;
    const H = this.viewHeight;
    videoToScreen(f.cursorU, f.cursorV, vw, vh, W, H, this.mirrored, this.tmp);
    s.x = this.tmp.x;
    s.y = this.tmp.y;
    videoToScreen(f.palmU, f.palmV, vw, vh, W, H, this.mirrored, this.tmp);
    s.palmX = this.tmp.x;
    s.palmY = this.tmp.y;
    videoToScreen(f.knuckleU, f.knuckleV, vw, vh, W, H, this.mirrored, this.tmp);
    s.knuckleX = this.tmp.x;
    s.knuckleY = this.tmp.y;
    s.pinchRatio = f.pinchRatio;
    s.extendedFingers = f.extendedFingers;
    s.viewportHeight = H;
    const age = result.doneMs - result.frameTimeMs;
    s.t = age >= 0 && age <= MAX_FRAME_AGE_MS ? result.frameTimeMs : result.doneMs;
    this.gestures.pushSample(s);

    if (this.diagnostics.active) {
      const points = this.diagnostics.points;
      for (let i = 0; i < frame.image.length && i * 2 < points.length; i++) {
        const p = frame.image[i]!;
        videoToScreen(p.x, p.y, vw, vh, W, H, this.mirrored, this.tmp);
        points[i * 2] = this.tmp.x;
        points[i * 2 + 1] = this.tmp.y;
      }
      this.diagnostics.hasPoints = true;
    }
  }

  // ───────────────────────── Bucle principal ─────────────────────────

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const dtMs = Math.min(now - this.lastFrameMs, MAX_FRAME_MS);
    this.lastFrameMs = now;
    if (this.state !== 'prepare' && this.state !== 'playing' && this.state !== 'result') return;
    const dt = dtMs / 1000;
    this.metrics.frame(now, dtMs);

    if (this.simHand) {
      const simulated = this.simHand.poll(now, this.viewHeight);
      if (simulated) this.gestures.pushSample(simulated);
    }
    this.gestures.tick(now);
    const hand = this.gestures.state;
    if (hand.seq !== this.lastSeq) {
      this.lastSeq = hand.seq;
      if (!this.simulated) this.metrics.latency(now - hand.sampleT);
    }
    const tracking = hand.tracking !== 'lost';
    if (this.wasTracking && !tracking) {
      this.metrics.counters.trackingLosses++;
      if (this.state === 'playing') this.sfx.trackingLost();
    }
    this.wasTracking = tracking;

    // Con la cámara caída el juego se congela: ni cronómetro ni enemigos avanzan.
    const frozen = this.cameraDown;
    if (this.state === 'playing') {
      if (!frozen) this.updatePlaying(dt, dtMs, now);
    } else {
      this.grab.update(dt, now, false);
      if (!frozen) {
        this.world.update(dt);
        this.updateConfirm(dtMs, now);
      }
    }
    this.gestures.clearEvents();

    this.arenaView.setLives(this.session.lives);
    this.arenaView.update(dt);
    this.effects.update(dt);
    const gremlins = this.world.gremlins;
    for (let i = 0; i < gremlins.length; i++) {
      const g = gremlins[i]!;
      this.gremlinViews[i]!.sync(
        g,
        dt,
        this.grab.hovered === g,
        this.grab.aimTarget === g,
        this.grab.lift,
        this.grab.cursorValid,
        this.grab.cursor.x,
        this.grab.cursor.y,
      );
    }
    this.cursorView.sync(hand, this.grab, dt);
    this.renderer.render(this.anchor.camera);

    this.updateHud();
    if (this.diagnostics.active) {
      this.diagnostics.update(now, this.metrics, this.gestures, {
        camera: this.simulated
          ? 'simulada'
          : `${this.camera.width}×${this.camera.height} ${this.camera.facing}${this.mirrored ? ' espejo' : ''}`,
        delegate: this.simulated ? '—' : this.tracker.delegate,
        qualityTier: this.qualityTier,
        anchorMode: this.anchor.mode,
        extendedFingers: this.features.extendedFingers,
      });
    }
  };

  private updatePlaying(dt: number, dtMs: number, now: number): void {
    this.watchQuality(dtMs);
    this.updatePause();
    if (this.paused) {
      // En pausa nada avanza: ni cronómetro, ni enemigos, ni puntuación.
      this.grab.update(dt, now, false);
      return;
    }
    this.grab.update(dt, now, !this.session.finished);
    if (now >= this.effects.hitStopUntil) {
      this.world.update(dt);
      this.session.update(dt, this.grab.cursor.x, this.grab.cursor.y, this.grab.cursorValid);
    }
    const s = this.session;
    if (s.phase === 'combat' && s.wave !== this.shownWave) {
      this.shownWave = s.wave;
      const wave = CONFIG.waves[s.wave]!;
      this.hud.showWave(wave.title, wave.subtitle);
      if (s.wave === 0) this.sfx.alert();
      else this.sfx.wave();
    }
    if (this.session.finished) {
      this.finishTimer += dt;
      if (this.finishTimer >= FINISH_DELAY_SECONDS) this.finishSession();
    }
  }

  /**
   * Pausa de recuperación: solo si la mano falta varios segundos en pleno combate.
   * Las ausencias breves no pausan, y se reanuda en cuanto la mano vuelve a verse estable.
   */
  private updatePause(): void {
    const hand = this.gestures.state;
    if (this.session.phase !== 'combat') {
      this.paused = false;
    } else if (!this.paused) {
      if (hand.tracking === 'lost' && hand.absentMs > CONFIG.match.pauseAfterMs) {
        this.paused = true;
        this.grab.cancel();
      }
    } else if (hand.tracking === 'ok' && hand.stable) {
      this.paused = false;
    }
    this.hud.setPaused(this.paused);
  }

  /** Menús: palma abierta mantenida sobre el núcleo = empezar / repetir. */
  private updateConfirm(dtMs: number, now: number): void {
    const hand = this.gestures.state;
    this.anchor.arenaToScreen(0, 0, 0, this.corePx);
    const radius = CONFIG.gesture.confirmZoneFraction * Math.min(this.viewWidth, this.viewHeight);
    const inZone =
      Math.hypot(hand.palmX - this.corePx.x, hand.palmY - this.corePx.y) <= radius * CONFIRM_ZONE_TOLERANCE;
    const active = hand.tracking === 'ok' && hand.stable && hand.openPalm && inZone;
    const fired = this.confirm.update(dtMs, now, active);
    this.hud.setConfirm(this.corePx.x, this.corePx.y, radius, this.confirm.progress);
    if (fired) this.startSession();
  }

  private updateHud(): void {
    const hand = this.gestures.state;
    const lost = hand.tracking === 'lost';
    this.hud.setHand(hand.tracking);

    let banner = '';
    if (this.cameraDown) banner = 'Cámara interrumpida · reconectando…';
    else if (this.simulated) banner = 'Simulación con ratón · solo desarrollo';
    else if (this.state !== 'result' && this.viewHeight > this.viewWidth) {
      banner = 'Mejor en horizontal: gira el móvil';
    }
    this.hud.setBanner(banner);

    let hint = '';
    let tutorialStep = 0;
    let tutorialIcon = '';
    let tutorialText = '';
    if (this.state === 'playing') {
      const s = this.session;
      const handMissing = lost && hand.absentMs > CONFIG.gesture.absentHintMs;
      this.hud.setCombo(s.combo, s.multiplier, s.comboFraction);
      if (s.phase === 'practice' || s.phase === 'intro') {
        this.hud.setMatchInfo('Práctica', null, CONFIG.match.lives, '', false);
        // Sin mano, la ayuda de "acerca la mano" sustituye a la tarjeta del tutorial.
        if (handMissing) {
          tutorialStep = 0;
        } else if (s.phase === 'intro') {
          tutorialStep = 3;
          tutorialIcon = '🛡️';
          tutorialText = '¡Defiende el núcleo! Que ningún gremlin lo toque';
        } else if (this.tutorial === 'grab') {
          tutorialStep = 1;
          tutorialIcon = '🤏';
          tutorialText = 'Atrapa un gremlin: junta pulgar e índice sobre él';
        } else {
          tutorialStep = 2;
          tutorialIcon = '💥';
          if (this.grab.held) tutorialText = 'Mueve la mano hacia otro gremlin y abre los dedos';
          else if (this.droppedSlow) tutorialText = 'Atrápalo otra vez y abre los dedos con la mano en movimiento';
          else if (this.tutorial === 'hit') tutorialText = '¡Casi! Atrapa uno y lánzalo contra otro gremlin';
          else tutorialText = 'Lánzalo contra otro gremlin';
        }
      } else {
        const seconds = Math.ceil(s.timeLeft);
        const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        this.hud.setMatchInfo(
          s.score.toLocaleString('es'),
          s.lives,
          CONFIG.match.lives,
          clock,
          seconds <= URGENT_SECONDS,
        );
      }
      const now = performance.now();
      if (this.paused) hint = '';
      else if (handMissing) hint = 'Acerca la mano a la arena';
      else if (tutorialStep > 0) hint = '';
      else if (now < this.kindHintUntil) hint = this.kindHint;
      else if (now < this.combatHintUntil) hint = '¡Defiende el núcleo!';
    } else if (lost) {
      hint = 'Mete una mano en la imagen';
    } else if (this.state === 'prepare') {
      hint = 'Para empezar: palma abierta sobre el núcleo';
    }
    this.hud.setTutorial(tutorialStep, TUTORIAL_STEPS, tutorialIcon, tutorialText);
    this.hud.setHint(hint);
  }

  // ───────────────────────── Reacciones a eventos de juego ─────────────────────────

  private readonly grabListener: GrabListener = {
    onHoverChange: (g: Gremlin | null) => {
      if (g) this.sfx.hover();
    },
    onGrab: (g: Gremlin) => {
      const c = this.metrics.counters;
      c.pinches++;
      c.grabs++;
      this.effects.grab(g.x, g.y);
      this.sfx.grab();
      this.vibrate(HAPTIC_GRAB_MS);
      if (this.tutorial === 'grab') {
        this.tutorial = 'throw';
        this.sfx.stepDone();
      }
    },
    onMiss: () => {
      const c = this.metrics.counters;
      c.pinches++;
      c.misses++;
      this.sfx.miss();
    },
    // No cuenta como agarre fallido: el pellizco fue correcto, el enemigo no se puede levantar.
    onTooHeavy: (g: Gremlin) => {
      this.world.rattle(g);
      this.effects.tooHeavy(g.x, g.y);
      this.sfx.tooHeavy();
    },
    onChargeFull: () => this.sfx.chargeFull(),
    onThrow: (g: Gremlin, handSpeed: number, launchSpeed: number) => {
      this.metrics.counters.throws++;
      this.metrics.lastRelease = `mano ${handSpeed.toFixed(1)} u/s → lanzado a ${launchSpeed.toFixed(1)} u/s`;
      this.effects.throwTrail(g.x, g.y);
      this.sfx.throwWhoosh(g.charge);
      if (g.kind === 'bomb') this.sfx.fuse();
      this.droppedSlow = false;
      if (this.tutorial === 'throw') this.tutorial = 'hit';
    },
    onDrop: (_g: Gremlin, reason: DropReason, handSpeed: number) => {
      const c = this.metrics.counters;
      if (reason === 'slow') {
        c.dropsSlow++;
        this.droppedSlow = true;
        this.metrics.lastRelease = `mano ${handSpeed.toFixed(1)} u/s → soltado (mínimo ${CONFIG.throwing.minSpeed})`;
        this.sfx.drop();
      } else if (reason === 'lost') {
        c.dropsLost++;
        this.metrics.lastRelease = 'mano perdida → soltado sin impulso';
        this.sfx.drop();
      }
    },
  };

  private readonly worldListener: WorldListener = {
    onSpawn: (g: Gremlin) => {
      // La primera vez que aparece un tipo nuevo en la partida se explica qué hacer con él.
      if (this.state !== 'playing' || g.behavior !== 'attack') return;
      if (g.kind === 'bomb' && !this.seenBomb) {
        this.seenBomb = true;
        this.showKindHint(KIND_HINTS.bomb);
      } else if (g.kind === 'tank' && !this.seenTank) {
        this.seenTank = true;
        this.showKindHint(KIND_HINTS.tank);
      }
    },
    onImpact: (_projectile: Gremlin, victim: Gremlin, _speed: number, killed: boolean) => {
      if (this.state !== 'playing') return;
      this.metrics.counters.hits++;
      const wasPractice = this.session.phase === 'practice';
      this.scoreHit(victim, killed);
      this.sfx.hit(Math.max(1, this.session.combo));
      this.vibrate(HAPTIC_HIT_MS);
      this.tutorial = 'done';
      if (wasPractice) {
        // Primer golpe conseguido: termina la práctica y se anuncia la partida de verdad.
        this.practiceDone = true;
        this.sfx.stepDone();
      }
    },
    onExplosion: (bomb: Gremlin, hits: number, thrown: boolean) => {
      this.effects.explosion(bomb.x, bomb.y, CONFIG.bomb.blastRadius + bomb.radius, performance.now());
      this.sfx.explosion();
      this.vibrate(HAPTIC_BLAST_MS);
      // Un Bomb lanzado que alcanza a alguien es munición gastada: puntúa sin multiplicador.
      if (this.state === 'playing' && thrown && hits > 0) {
        const points = this.session.registerSpent('bomb');
        if (points > 0) this.effects.popup(`+${points}`, bomb.x, bomb.y + POPUP_OFFSET, '');
      }
    },
    onBlast: (_bomb: Gremlin, victim: Gremlin, killed: boolean) => {
      if (this.state !== 'playing') return;
      this.scoreHit(victim, killed);
    },
    onWallBounce: (g: Gremlin) => {
      this.effects.wall(g.x, g.y);
      this.sfx.wall();
    },
    onSettle: () => undefined,
    onSpent: (g: Gremlin) => {
      if (this.state !== 'playing') return;
      this.effects.spent(g.x, g.y, g.kind, this.session.registerSpent(g.kind));
    },
    onCoreReached: () => {
      if (this.state !== 'playing' || !this.session.registerCoreHit()) return;
      this.arenaView.hit();
      this.effects.coreHit();
      this.sfx.coreHit();
      this.vibrate(HAPTIC_CORE_MS);
    },
    onDefeated: () => undefined,
  };

  /** Puntúa un impacto del jugador (golpe o explosión) y lanza su respuesta visual y sonora. */
  private scoreHit(victim: Gremlin, killed: boolean): void {
    const points = this.session.registerHit(victim.kind, killed);
    const now = performance.now();
    if (!killed) {
      this.effects.armorHit(victim.x, victim.y, now);
      this.sfx.armorHit();
      return;
    }
    // El texto de puntos de un Bomb se desplaza para no quedar bajo el "¡BUM!" de su explosión.
    const z = victim.kind === 'bomb' ? victim.y + POPUP_OFFSET : victim.y;
    this.effects.defeat(victim.x, z, victim.kind, this.session.multiplier, points, now);
    if (victim.kind === 'tank') this.sfx.tankBreak();
  }

  private showKindHint(text: string): void {
    this.kindHint = text;
    this.kindHintUntil = performance.now() + KIND_HINT_MS;
  }

  private vibrate(ms: number): void {
    if (this.settings.reduceEffects) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      // Vibración no disponible (iOS): se ignora.
    }
  }

  /** Acceso de solo lectura para las pruebas automáticas y la depuración en consola. */
  private exposeDebugHandle(): void {
    if (!import.meta.env.DEV && !this.simulated && !this.query.has('diag')) return;
    const screen: Vec2 = { x: 0, y: 0 };
    (window as unknown as Record<string, unknown>).__gremlinRush = {
      state: () => this.state,
      metrics: this.metrics,
      session: this.session,
      hand: this.gestures.state,
      delegate: () => this.tracker.delegate,
      core: () => ({ ...this.anchor.arenaToScreen(0, 0, 0, screen) }),
      gremlins: () =>
        this.world.gremlins
          .filter((g) => g.state !== 'inactive')
          .map((g) => ({
            id: g.id,
            kind: g.kind,
            hp: g.hp,
            state: g.state,
            ...this.anchor.arenaToScreen(g.x, CONFIG.arena.cursorPlaneY, g.y, screen),
          })),
    };
  }
}
