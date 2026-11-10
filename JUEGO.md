# JUEGO — Gremlin Rush

> Biblia del juego: fuente de verdad de concepto, arte y sensaciones. Resume y concreta `docs/01_GDD.md`, `docs/02_CONTROLES_MANOS.md` y `docs/04_ARTE_Y_RECURSOS.md`. Si el código la contradice, gana la biblia (o se actualiza primero la biblia). Los valores numéricos viven en `src/config/gameConfig.ts`.

## 1. Concepto
- **En una frase:** atrapas gremlins con los dedos y los lanzas contra los demás para defender un núcleo; los enemigos son tu munición.
- **Pilares (3):** manipulación tangible con la mano · caos legible con combos · partidas de 90 segundos que piden revancha.
- **Bucle principal:** elegir presa → pellizcar → cargar/apuntar → soltar con impulso → choque y cadena → siguiente presa.
- **Plataforma y controles:** web móvil (Safari iOS, Chrome Android), móvil en soporte apuntando a la mesa. **Una mano frente a la cámara; ningún control táctil durante la partida.**

| Gesto | Acción | Dónde |
|---|---|---|
| Pellizco pulgar–índice sobre un gremlin | Agarrar | Partida |
| Mantener el pellizco | Cargar (máx. ~0,8 s) | Partida |
| Abrir los dedos con la mano en movimiento | Lanzar en esa dirección | Partida |
| Abrir los dedos con la mano quieta | Soltar sin lanzar | Partida |
| Palma abierta mantenida ~1,2 s sobre el núcleo | Empezar / repetir | Solo menús |

## 2. Dirección de arte
- **Estilo:** juguete de mesa caótico; 3D estilizado low-poly con materiales simples, siluetas fuertes y brillos medidos. Humor, sin gore.
- **Estado actual:** todo es **placeholder** hecho con geometrías básicas. No es arte final.
- **Resolución y escalado:** canvas WebGL a pantalla completa sobre el vídeo; `devicePixelRatio` limitado a 2 y degradable a 1,5 y 1.
- **Paleta (hex):** noche tinta `#14152B` (arena, paneles) · verde gremlin `#A5F02D` (Runner, borde, acción positiva) · naranja caos `#FF7D31` (portales, Bomb, peligro) · violeta armadura `#8062F2` (Tank) · amarillo score `#FFE15A` (combos, resaltado, carga) · blanco humo `#F5F2ED` (texto) · rojo alerta `#F14F65` (daño, mano perdida).
- **Tipografía:** Fredoka Variable (OFL-1.1), servida en local. Texto de HUD ≥ 16 px sobre panel oscuro.
- **Formas:** redondo = gremlin vivo; anillo en el suelo = interacción (amarillo capturable, blanco→naranja carga); flecha amarilla = «esto será un lanzamiento».
- **Cada enemigo se reconoce por silueta, no solo por color:** Runner ovalado con orejas asimétricas; Bomb esférico con mecha; Tank ancho con placas.
- **UI/HUD:** píldoras en los bordes superiores (objetivo, modo de anclaje, estado de mano), ayuda contextual abajo, nada sobre el centro de la arena.

## 3. Game feel
| Parámetro | Valor | Nota |
|---|---|---|
| Seguimiento del gremlin agarrado | amortiguación exponencial k = 30 | sin saltos, independiente del FPS |
| Carga | 0 → 1 en 0,8 s | +30 % de velocidad a carga máxima |
| Umbral de lanzamiento | 1,7 arena/s de mano | por debajo, se suelta sin lanzar |
| Velocidad de lanzamiento | 2,4 – 6,5 arena/s | rebote en borde 0,72 |
| Ayuda de puntería | cono de 13°, fuerza 0,55 | suave, nunca cambia de objetivo evidente |
| Hit stop | 60 ms | al impactar |
| Sacudida | máx. 0,03 unidades de arena | solo la arena virtual; el vídeo real no se mueve |
| Partículas | 96 en pool, 0,3–0,6 s | se reducen con calidad baja y «reducir efectos» |
| Combo sonoro | escala pentatónica ascendente | cada golpe encadenado sube una nota |

Todos estos valores son hipótesis iniciales **pendientes de playtest en móvil real**.

## 4. Audio
- **Música:** ninguna por ahora (opcional, fase de pulido).
- **Efectos:** sintetizados con Web Audio (sin archivos externos): resaltar, agarrar, pellizco vacío, carga completa, lanzar, soltar, rebote, golpe (más agudo por cadena), confirmar, fin, mano perdida. Variación de tono ±5 %. Se activan con el toque inicial de «Activar cámara».

## 5. Accesibilidad del juego
- [x] Reducir efectos (sacudida, partículas, vibración); respeta `prefers-reduced-motion` por defecto
- [x] Sonido activable; todo aviso sonoro tiene señal visual
- [x] Información no solo por color (formas, texto, bordes distintos en el estado de mano)
- [x] Sensibilidad del pellizco ajustable antes de jugar; mano izquierda o derecha
- [x] Pausa automática si se corta la cámara
- [ ] Tamaño de texto del HUD y contraste alto (fase de pulido)
- [ ] Dificultad/velocidad asistida (fase MVP)
- **Excepción deliberada:** no hay control por teclado ni táctil durante la partida; el control gestual es la premisa del juego.

## 6. Rendimiento
- **Meta:** ≥ 30 FPS estables en iPhone 13 Pro Max y Android de gama media, con detección de mano a la cadencia de la cámara (~30 Hz).
- **Presupuestos:** ≤ 9 enemigos simultáneos · 96 partículas · sin sombras dinámicas · geometrías y materiales compartidos · cero asignaciones en el bucle propio.
- **Regla:** si falta rendimiento se degradan los efectos visuales, nunca la detección de la mano.

## 7. Contenido y estado
- **Modos:** P0 «prueba de manipulación» (5 golpes, sin reloj) — implementado · partida de 90 s con núcleo — pendiente (P1/P2).
- **Enemigos:** Runner — implementado como placeholder que deambula · Bomb, Tank — pendientes (P2).
- **Anclaje:** arena superpuesta calibrable — implementado · anclaje por imagen — descartado por ahora (ver decisiones).

## 8. Decisiones
| Fecha | Decisión | Por qué |
|---|---|---|
| 2026-11-10 | Vite + TypeScript + Three.js + MediaPipe Hand Landmarker, todo servido en local | Pila sugerida por el kit; mantenida y con licencias MIT/Apache-2.0 |
| 2026-11-10 | Anclaje por defecto: arena superpuesta calibrable, etiquetada «no anclada» | Con el móvil en soporte fijo equivale a un anclaje y no compite por GPU con la detección de mano; MindAR no publica versiones desde enero de 2024 |
| 2026-11-10 | Física 2.5D propia (círculos en un plano), sin Rapier | Menos de una docena de cuerpos; más ligera y más fácil de ajustar |
| 2026-11-10 | La velocidad de lanzamiento se mide con el nudillo del índice, no con las puntas | Las puntas se mueven al abrir los dedos y provocarían lanzamientos falsos |
| 2026-11-10 | Inicio/reinicio con palma abierta mantenida sobre el núcleo | Gesto muy distinto del pellizco; con bloqueo inicial para no confundirlo con «soltar» |
| 2026-11-10 | Ayuda contextual abajo, no arriba | Arriba tapa el fondo de la arena, por donde entran los gremlins |
