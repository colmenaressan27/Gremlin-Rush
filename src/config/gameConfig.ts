/**
 * Único lugar para los valores ajustables del juego.
 * Unidades de arena: el radio de la arena vale 1. Tiempos en ms salvo que se indique "Seconds".
 * Los valores marcados "pendiente de playtest" son hipótesis iniciales, no mediciones.
 */
export const CONFIG = {
  camera: {
    idealWidth: 1280,
    idealHeight: 720,
    idealFps: 30,
  },

  vision: {
    wasmDir: 'mediapipe/wasm',
    modelFile: 'models/hand_landmarker.task',
    minDetectionConfidence: 0.5,
    minPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    /** Límite de detecciones por segundo; la cámara rara vez entrega más de 30. */
    maxDetectHz: 30,
  },

  gesture: {
    /** Distancia pulgar–índice / tamaño de mano. Cerrar y abrir usan umbrales distintos (histéresis). */
    pinchCloseRatio: 0.3,
    pinchOpenRatio: 0.46,
    /** Cuánto desplaza los umbrales el ajuste de sensibilidad (0..1) en cada sentido. */
    sensitivitySpan: 0.1,
    /** Peso de los landmarks 3D (invariantes a rotación) frente a los 2D de imagen. */
    worldWeight: 0.5,
    /** Permanencia mínima: a 30 Hz equivale a 2 muestras para cerrar y 3 para abrir. */
    closeDwellMs: 30,
    openDwellMs: 60,
    /** Tiempo con mano visible antes de aceptar gestos. */
    stableMs: 150,
    /** Tolerancia a pérdidas de seguimiento: sin agarre / con agarre (oclusión). */
    graceMs: 350,
    holdGraceMs: 650,
    /** Filtro One Euro del cursor (en alturas de pantalla). */
    cursorMinCutoffHz: 1.4,
    cursorBeta: 9,
    cursorDerivCutoffHz: 1,
    /** Dedo extendido si punta–muñeca supera este múltiplo de nudillo–muñeca. */
    fingerExtendedRatio: 1.45,
    openPalmOnMs: 120,
    openPalmOffMs: 120,
    /** Gesto de confirmación en menús: palma abierta mantenida dentro de la zona. */
    confirmHoldMs: 1200,
    confirmLockoutMs: 700,
    confirmZoneFraction: 0.22,
    /** Segundos sin mano durante la partida antes de mostrar ayuda. */
    absentHintMs: 2500,
  },

  arena: {
    radius: 1,
    coreRadius: 0.15,
    portalCount: 6,
    fovDeg: 45,
    /** Fracción de media pantalla que ocupa la arena con escala 1. */
    fitWidth: 0.66,
    fitHeight: 0.72,
    defaultTiltDeg: 52,
    defaultOffsetY: 0,
    /** Altura del plano donde se proyecta el cursor (centro del cuerpo de un gremlin). */
    cursorPlaneY: 0.07,
    holdHeight: 0.2,
    maxCursorRadius: 1.6,
  },

  grab: {
    /** Radio de captura asistida alrededor del cursor (pendiente de playtest). */
    assistRadius: 0.25,
    /** Un pellizco sin objetivo sigue "armado" este tiempo por si entra un gremlin. */
    bufferMs: 180,
    followK: 30,
    chargeSeconds: 0.8,
    holdClampRadius: 1.12,
  },

  throwing: {
    windowMs: 150,
    minSamples: 3,
    /** Por debajo de esta velocidad de mano (arena/s) se suelta sin lanzar. */
    minSpeed: 1.7,
    gain: 0.85,
    minLaunch: 2.4,
    maxLaunch: 6.5,
    chargeSpeedBonus: 0.3,
    aimAssistDeg: 13,
    aimAssistStrength: 0.55,
    aimAssistRange: 2.2,
  },

  physics: {
    stepSeconds: 1 / 60,
    maxStepsPerFrame: 4,
    thrownDrag: 1.15,
    wallRestitution: 0.72,
    /** Fracción de velocidad que conserva el proyectil tras un impacto. */
    impactRetain: 0.7,
    minImpactSpeed: 0.9,
    settleSpeed: 0.55,
    stunSeconds: 0.7,
    dropStunSeconds: 0.45,
    knockbackSpeed: 2.6,
    /** Un gremlin lanzado que golpeó a alguien se "gasta": desaparece al detenerse. Si falló, sobrevive. */
    projectileSpentOnHit: true,
    dyingSeconds: 0.45,
    spawnSeconds: 0.4,
    separationK: 6,
  },

  /** Movimiento al caminar, común a todos los tipos. "speed" es la velocidad al deambular. */
  runner: {
    radius: 0.105,
    speed: 0.24,
    swayAmplitude: 0.35,
    swayHz: 0.9,
    wanderMinRadius: 0.3,
    wanderMaxRadius: 0.82,
    /** Cerca del núcleo el vaivén se apaga para que la llegada sea legible. */
    attackSwayFadeRadius: 0.45,
  },

  /**
   * Tipos de enemigo. speedFactor multiplica la velocidad de ataque de la oleada;
   * hp = golpes que aguanta; grabbable = se puede levantar con el pellizco.
   */
  kinds: {
    runner: { radius: 0.105, speedFactor: 1, hp: 1, points: 100, grabbable: true },
    bomb: { radius: 0.115, speedFactor: 0.8, hp: 1, points: 150, grabbable: true },
    tank: { radius: 0.165, speedFactor: 0.5, hp: 3, points: 250, grabbable: false },
  },

  bomb: {
    /** Radio de la explosión (desde el centro del Bomb hasta el borde de la víctima). */
    blastRadius: 0.42,
    /** Daño de la explosión: suficiente para destruir un Tank intacto. */
    blastDamage: 3,
    /** Un Bomb lanzado explota al chocar con alguien o, como mucho, tras este tiempo de vuelo. */
    thrownFuseSeconds: 0.9,
    /** Retardo con el que una explosión detona a otro Bomb cercano (reacción en cadena legible). */
    chainDelaySeconds: 0.16,
    blastKnockback: 2.4,
  },

  tank: {
    /** Fracción de velocidad que conserva el proyectil al rebotar en la armadura. */
    bounceRetain: 0.5,
    /** Duración de la vibración al resistir un golpe. */
    hurtSeconds: 0.4,
  },

  /** Partida: práctica sin reloj y combate cronometrado por oleadas (valores pendientes de playtest). */
  match: {
    /** Tamaño del pool de entidades (enemigos vivos + los que se están desvaneciendo). */
    maxGremlins: 14,
    /** Máximo de enemigos vivos a la vez, para mantener rendimiento y legibilidad. */
    maxEnemies: 9,
    durationSeconds: 90,
    lives: 3,
    /** Práctica: gremlins que deambulan hasta que el jugador consigue su primer golpe. */
    practicePopulation: 3,
    practiceRespawnSeconds: 1.1,
    /** Tras el primer golpe: pausa breve "defiende el núcleo" antes de que empiece el combate. */
    introSeconds: 2.6,
    openingSpawns: 2,
    /** Respiro sin apariciones al cambiar de oleada, mientras se muestra el rótulo. */
    waveBreatherSeconds: 2.4,
    maxBombs: 3,
    maxTanks: 2,
    /** Los portales a menos de esta distancia de la mano se evitan al hacer aparecer enemigos. */
    spawnAvoidRadius: 0.55,
    /** Segundos sin mano durante el combate antes de pausar (no se pausa por ausencias breves). */
    pauseAfterMs: 3500,
    /** Modo asistido: enemigos más lentos y apariciones más espaciadas. */
    assistSpeedFactor: 0.72,
    assistIntervalFactor: 1.3,
  },

  /**
   * Oleadas del combate. "until" y "tankFrom" son fracciones de la duración total (0..1), de modo
   * que una partida acortada en pruebas conserva la misma estructura. Con 90 s: 0–25, 25–55 y 55–90.
   * El intervalo de aparición y la velocidad progresan dentro de cada oleada.
   */
  waves: [
    {
      title: 'Oleada 1',
      subtitle: 'Llegan los Runners',
      until: 25 / 90,
      intervalStart: 3,
      intervalEnd: 2.4,
      speedStart: 0.14,
      speedEnd: 0.16,
      maxAttackers: 4,
      bombWeight: 0,
      tankWeight: 0,
      tankFrom: 1,
      firstKind: 'runner',
    },
    {
      title: 'Oleada 2',
      subtitle: '¡Cuidado: Bombs y Tanks!',
      until: 55 / 90,
      intervalStart: 2.7,
      intervalEnd: 2.1,
      speedStart: 0.15,
      speedEnd: 0.18,
      maxAttackers: 6,
      bombWeight: 0.3,
      tankWeight: 0.1,
      tankFrom: 40 / 90,
      firstKind: 'bomb',
    },
    {
      title: 'Oleada final',
      subtitle: '¡Aguanta!',
      until: 1,
      intervalStart: 1.9,
      intervalEnd: 1.3,
      speedStart: 0.17,
      speedEnd: 0.21,
      maxAttackers: 8,
      bombWeight: 0.3,
      tankWeight: 0.14,
      tankFrom: 0,
      firstKind: 'runner',
    },
  ],

  score: {
    /** Impactos dentro de esta ventana mantienen el combo (el GDD propone ~2 s; pendiente de playtest). */
    comboWindowSeconds: 2.5,
    /** El multiplicador del combo no pasa de este valor. */
    maxMultiplier: 5,
    lifeBonus: 500,
    storageKey: 'gremlinrush.record.v1',
  },

  feel: {
    hitStopMs: 60,
    explosionHitStopMs: 90,
    /** Sacudida máxima de la arena virtual (unidades de arena); el vídeo real no se mueve. */
    shakeMax: 0.03,
    shakeDecayPerSecond: 1.6,
    particleMax: 96,
    popupMax: 6,
  },

  quality: {
    /** Si el FPS medio cae bajo el umbral durante la ventana, se degrada un nivel visual. */
    minFps: 27,
    windowMs: 2500,
    pixelRatioTiers: [2, 1.5, 1],
    particleScaleTiers: [1, 0.6, 0.35],
  },

  audio: {
    masterVolume: 0.5,
    pitchJitter: 0.05,
  },

  storageKey: 'gremlinrush.ajustes.v1',
} as const;

export const PALETTE = {
  ink: 0x14152b,
  gremlinGreen: 0xa5f02d,
  chaosOrange: 0xff7d31,
  armorViolet: 0x8062f2,
  scoreYellow: 0xffe15a,
  smokeWhite: 0xf5f2ed,
  alertRed: 0xf14f65,
} as const;
