import type { CameraErrorKind } from '../camera/CameraFeed';
import type { Settings } from '../config/settings';
import { el, nextFieldId } from './dom';

export type ScreenName = 'welcome' | 'loading' | 'error' | 'none';

export interface ScreenCallbacks {
  onStart(): void;
  onRetry(): void;
  onSettingsChange(): void;
}

interface ErrorCopy {
  title: string;
  message: string;
  steps: string[];
}

const CAMERA_ERRORS: Record<CameraErrorKind, ErrorCopy> = {
  denied: {
    title: 'Sin permiso de cámara',
    message: 'Gremlin Rush se juega con la mano frente a la cámara, así que necesita ese permiso.',
    steps: [
      'iPhone: toca «aA» en la barra de direcciones → Ajustes del sitio web → Cámara → Permitir.',
      'Android: toca el candado junto a la dirección → Permisos → Cámara → Permitir.',
      'Después pulsa «Reintentar».',
    ],
  },
  insecure: {
    title: 'Hace falta una conexión segura',
    message: 'El navegador solo da acceso a la cámara en direcciones https:// (o en localhost).',
    steps: ['Abre el enlace que empieza por https:// que muestra iniciar.cmd en el PC.'],
  },
  unsupported: {
    title: 'Este navegador no ofrece cámara',
    message: 'No se encontró la función de cámara web.',
    steps: ['Usa Safari en iPhone o Chrome en Android, en su versión actual.'],
  },
  notfound: {
    title: 'No se encontró ninguna cámara',
    message: 'El dispositivo no informó de ninguna cámara disponible.',
    steps: ['Comprueba que la cámara funciona en otra app y pulsa «Reintentar».'],
  },
  busy: {
    title: 'La cámara está ocupada',
    message: 'Otra aplicación o pestaña está usando la cámara.',
    steps: ['Cierra otras apps o pestañas que usen la cámara y pulsa «Reintentar».'],
  },
  unknown: {
    title: 'No se pudo iniciar la cámara',
    message: 'Ocurrió un error inesperado al abrir la cámara.',
    steps: ['Recarga la página y vuelve a intentarlo.'],
  },
};

const VISION_ERROR: ErrorCopy = {
  title: 'No se pudo cargar el detector de mano',
  message: 'Faltan los archivos del detector o el navegador no pudo iniciarlo.',
  steps: [
    'En el PC ejecuta setup.cmd (descarga el modelo) y después iniciar.cmd.',
    'Recarga esta página.',
  ],
};

/** Pantallas previas al juego: bienvenida con ajustes, carga y errores recuperables. */
export class Screens {
  private readonly sections = new Map<ScreenName, HTMLElement>();
  private readonly loadingText: HTMLElement;
  private readonly errorTitle: HTMLElement;
  private readonly errorMessage: HTMLElement;
  private readonly errorSteps: HTMLElement;
  private readonly startButton: HTMLButtonElement;
  private readonly retryButton: HTMLButtonElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly settings: Settings,
    private readonly callbacks: ScreenCallbacks,
  ) {
    // Bienvenida
    const welcome = el('section', 'screen');
    const card = el('div', 'card');
    card.append(
      el('p', 'badge', 'Fase P0 · prueba de manipulación'),
      el('h1', 'title', 'Gremlin Rush'),
      el('p', 'lead', 'Atrapa gremlins con los dedos y lánzalos contra los demás.'),
    );
    const steps = el('ol', 'steps');
    for (const text of [
      'Apoya el móvil en un soporte, en horizontal, apuntando a la mesa.',
      'Mete una mano en la imagen. Solo una, y que se vea entera.',
      'Pellizca un gremlin con pulgar e índice. Suelta con un golpe de muñeca para lanzarlo.',
    ]) {
      steps.append(el('li', '', text));
    }
    card.append(steps);
    card.append(
      el(
        'p',
        'privacy',
        'Privacidad: la cámara se procesa solo en este dispositivo. No se graba ni se envía vídeo. Sin cuentas.',
      ),
    );
    card.append(this.buildSettings());
    this.startButton = el('button', 'button-primary', 'Activar cámara');
    this.startButton.type = 'button';
    this.startButton.addEventListener('click', () => this.callbacks.onStart());
    card.append(this.startButton);
    welcome.append(card);

    // Carga
    const loading = el('section', 'screen');
    const loadingCard = el('div', 'card card-center');
    loadingCard.setAttribute('role', 'status');
    this.loadingText = el('p', 'lead', 'Preparando…');
    loadingCard.append(el('div', 'spinner'), this.loadingText);
    loading.append(loadingCard);

    // Error
    const error = el('section', 'screen');
    const errorCard = el('div', 'card');
    errorCard.setAttribute('role', 'alert');
    this.errorTitle = el('h2', 'subtitle');
    this.errorMessage = el('p', 'lead');
    this.errorSteps = el('ol', 'steps');
    this.retryButton = el('button', 'button-primary', 'Reintentar');
    this.retryButton.type = 'button';
    this.retryButton.addEventListener('click', () => this.callbacks.onRetry());
    errorCard.append(this.errorTitle, this.errorMessage, this.errorSteps, this.retryButton);
    error.append(errorCard);

    this.sections.set('welcome', welcome);
    this.sections.set('loading', loading);
    this.sections.set('error', error);
    for (const section of this.sections.values()) {
      section.hidden = true;
      root.append(section);
    }
  }

  show(name: ScreenName): void {
    for (const [key, section] of this.sections) section.hidden = key !== name;
    this.root.classList.toggle('screens-active', name !== 'none');
    if (name === 'welcome') this.startButton.focus({ preventScroll: true });
    if (name === 'error') this.retryButton.focus({ preventScroll: true });
  }

  setLoading(text: string): void {
    this.loadingText.textContent = text;
  }

  showCameraError(kind: CameraErrorKind): void {
    this.fillError(CAMERA_ERRORS[kind]);
  }

  showVisionError(): void {
    this.fillError(VISION_ERROR);
  }

  private fillError(copy: ErrorCopy): void {
    this.errorTitle.textContent = copy.title;
    this.errorMessage.textContent = copy.message;
    this.errorSteps.replaceChildren(...copy.steps.map((s) => el('li', '', s)));
    this.show('error');
  }

  private buildSettings(): HTMLElement {
    const s = this.settings;
    const details = el('details', 'settings');
    details.append(el('summary', '', 'Ajustes'));
    const changed = (): void => this.callbacks.onSettingsChange();

    const cameraId = nextFieldId();
    const cameraRow = el('div', 'field');
    const cameraLabel = el('label', '', 'Cámara');
    cameraLabel.htmlFor = cameraId;
    const camera = el('select');
    camera.id = cameraId;
    camera.append(new Option('Trasera (recomendada)', 'environment'), new Option('Frontal', 'user'));
    camera.value = s.cameraFacing;
    camera.addEventListener('change', () => {
      s.cameraFacing = camera.value === 'user' ? 'user' : 'environment';
      changed();
    });
    cameraRow.append(cameraLabel, camera);

    const sensId = nextFieldId();
    const sensRow = el('div', 'field');
    const sensLabel = el('label', '', 'Sensibilidad del pellizco');
    sensLabel.htmlFor = sensId;
    const sens = el('input');
    sens.id = sensId;
    sens.type = 'range';
    sens.min = '0';
    sens.max = '1';
    sens.step = '0.05';
    sens.value = String(s.sensitivity);
    sens.setAttribute('aria-describedby', `${sensId}-ayuda`);
    sens.addEventListener('input', () => {
      s.sensitivity = Number(sens.value);
      changed();
    });
    const sensHelp = el('p', 'help', 'Más alta: agarra con los dedos menos juntos.');
    sensHelp.id = `${sensId}-ayuda`;
    sensRow.append(sensLabel, sens, sensHelp);

    details.append(
      cameraRow,
      sensRow,
      this.checkbox('Invertir espejo (si la mano se mueve al revés)', s.flipMirror, (v) => {
        s.flipMirror = v;
        changed();
      }),
      this.checkbox('Reducir efectos (sacudidas y partículas)', s.reduceEffects, (v) => {
        s.reduceEffects = v;
        changed();
      }),
      this.checkbox('Sonido', s.sound, (v) => {
        s.sound = v;
        changed();
      }),
      this.checkbox('Mostrar diagnóstico (FPS, mano, latencia)', s.diagnostics, (v) => {
        s.diagnostics = v;
        changed();
      }),
    );
    return details;
  }

  private checkbox(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
    const id = nextFieldId();
    const row = el('div', 'field field-check');
    const input = el('input');
    input.id = id;
    input.type = 'checkbox';
    input.checked = value;
    input.addEventListener('change', () => onChange(input.checked));
    const text = el('label', '', label);
    text.htmlFor = id;
    row.append(input, text);
    return row;
  }
}
