# 10 — Informe de la fase P0 (factibilidad)

**Fecha:** 10 de noviembre de 2026 · **Estado del gate P0:** ABIERTO — falta la prueba en teléfono real (sección 4).

Este informe sigue el formato de `docs/05_ROADMAP.md`: implementado, evidencia, bloqueos, próxima tarea y cómo probar. Distingue siempre lo **verificado** de lo **pendiente de validación manual**.

## 1. Qué se construyó

Una «prueba de manipulación» jugable de principio a fin, sin tocar la pantalla durante el juego:

1. Pantalla inicial con explicación de privacidad y ajustes previos → permiso de cámara.
2. Preparación: la arena aparece sobre la imagen de la cámara y se puede recolocar («Ajustar arena»).
3. Inicio por gesto: palma abierta mantenida sobre el núcleo.
4. Juego: cuatro Runners deambulan. Pellizcar para atrapar, mantener para cargar, soltar con impulso para lanzar. Un gremlin lanzado derriba a los que toca, rebota en el borde y puede encadenar golpes.
5. Fin al conseguir 5 golpes → panel con las mediciones de la sesión → repetir con el mismo gesto.

Incluye modo diagnóstico (FPS, coste y cadencia de la detección, latencia aproximada, estado del pellizco, puntos de la mano, contadores de agarres y lanzamientos).

**Lo que todavía NO es:** no hay núcleo que defender, ni puntuación, ni cronómetro de 90 s, ni Bomb ni Tank. Eso es P1 y P2. Todo el arte y el sonido son provisionales.

## 2. Decisiones técnicas registradas

| Tema | Decisión | Motivo |
|---|---|---|
| Proyecto | Vite 8 + TypeScript 7 | Arranque con un doble clic en Windows; sin backend |
| Render | Three.js 0.187, canvas transparente sobre un `<video>` | Más barato que subir el vídeo como textura |
| Mano | MediaPipe Hand Landmarker 1.2 (`@mediapipe/tasks-vision`), GPU con cambio automático a CPU | Opción oficial y mantenida; runtime y modelo servidos desde el propio sitio |
| **Anclaje** | **Arena superpuesta calibrable**, etiquetada en pantalla como «no anclada a la mesa» | Ver 2.1 |
| Física | Propia, 2.5D, paso fijo de 1/60 s | Menos de una docena de círculos: un motor externo no aporta nada |
| Audio | Web Audio sintetizado | Sin archivos ni licencias de terceros |
| HTTPS local | `@vitejs/plugin-basic-ssl` (certificado autofirmado) | Gratis, sin cuentas y sin salir de la red local |

### 2.1 Método de anclaje

El kit pide priorizar el seguimiento de imagen (MindAR) **solo si resiste las pruebas y convive con la detección de manos**. No se adoptó en P0 por tres razones:

1. **Mantenimiento:** la última versión publicada de `mind-ar` es de enero de 2024 y empaqueta su propia copia de TensorFlow.js. El kit prohíbe añadir dependencias sin comprobar su mantenimiento.
2. **Coste:** ejecutaría un segundo modelo de visión en la misma GPU que MediaPipe, justo donde está el mayor riesgo de rendimiento en Safari.
3. **Beneficio escaso en este montaje:** con el móvil en un soporte fijo la cámara no se mueve, así que una arena colocada una vez queda donde debe.

El código no depende de esta decisión: gestos, física y render solo conocen la interfaz `ArenaAnchor` (`src/ar/ArenaAnchor.ts`). Si la prueba en teléfono muestra margen de rendimiento y se quiere anclaje real, se puede añadir otro proveedor sin tocar el resto.

**Límite honesto:** si alguien mueve el móvil durante la partida, la arena no acompaña a la mesa. Por eso el modo se muestra siempre en pantalla.

### 2.2 Decisiones de control gestual

- **Pellizco** = distancia pulgar–índice dividida por el tamaño de la mano (mezcla de medida 2D y 3D), con umbrales distintos para cerrar (0,30) y abrir (0,46), permanencia mínima de 2 muestras para cerrar y 3 para abrir.
- **Solo se agarra si antes se vio la mano abierta**: una mano que entra en cuadro ya cerrada no captura nada.
- **Captura asistida:** radio de 0,25 unidades alrededor del punto de agarre; un pellizco sin objetivo queda «armado» 180 ms por si entra un gremlin.
- **Lanzamiento:** velocidad medida por regresión sobre 150 ms del **nudillo del índice** (no se mueve al abrir los dedos). Por debajo de 1,7 unidades/s, el gremlin se suelta sin lanzarse.
- **Pérdida de mano:** 350 ms de tolerancia (650 ms si se sostiene un gremlin). Si persiste, el gremlin cae sin impulso: nunca se inventa un lanzamiento.
- **Confirmación en menús:** palma abierta (4 dedos extendidos) 1,2 s dentro de la zona del núcleo, con 0,7 s de bloqueo inicial.

Todos los umbrales están en `src/config/gameConfig.ts` y son **hipótesis sin validar con manos reales**.

## 3. Evidencia: qué se ejecutó de verdad

Equipo: PC del propietario, Windows 11, GPU integrada Intel UHD. Sin acceso a ningún teléfono.

| Comprobación | Cómo | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | Sin errores |
| 41 pruebas unitarias | `npm test` | 41/41 |
| Compilación de producción | `npm run build` | Correcta |
| Instalación | `setup.cmd` ejecutado en este PC | Correcta |
| Servidor HTTPS en red local | Chrome contra `https://<IP-del-PC>:8443` | Contexto seguro, cámara y detector arrancan |
| Cámara + MediaPipe + arena | `npm run smoke`, parte A (Chrome con cámara falsa) | Detección a 20 Hz (límite de la cámara falsa), 12–21 ms por fotograma con GPU, sin errores |
| Privacidad | `npm run smoke`, parte A | Ninguna petición de red sale del propio servidor |
| Cámara denegada | `npm run smoke`, parte A2 | Mensaje con pasos de recuperación y botón «Reintentar» |
| Ciclo completo | `npm run smoke`, parte B (mano simulada con el ratón) | Inicio por gesto → agarre → soltar en reposo sin lanzar → 5 golpes → resultado → reinicio por gesto |

Última ejecución de `npm run smoke`: 17/17 comprobaciones. Capturas en `qa-artifacts/`.

Las pruebas unitarias cubren, entre otras cosas: histéresis y permanencia del pellizco, que un fotograma errático no agarre, que perder la mano nunca lance, que soltar en reposo no lance, dirección del lanzamiento, captura del gremlin más cercano, rebote dentro de la arena, cadena de dos golpes y coherencia de la proyección pantalla ↔ arena.

**Lo que estas pruebas NO demuestran:**

- La cámara falsa de Chrome no muestra ninguna mano. **Ninguna mano real ha sido detectada todavía por este juego.**
- La «mano simulada» (`?sim=1`) es el ratón: valida la lógica del juego, no la visión por computador.
- Los FPS de un PC no dicen nada del rendimiento en un móvil.

### 3.1 Matriz de criterios (`docs/06_QA_Y_ACEPTACION.md`)

| ID | Caso | PC (automático) | Teléfono real |
|---|---|---|---|
| F01 | Primera apertura | PASA | NO PROBADO |
| F02 | Cámara denegada | PASA (denegación simulada) | NO PROBADO |
| F03 | Una mano, izquierda o derecha, sin espejo | NO PROBADO | NO PROBADO |
| F04 | Adquisición: resalta y captura una sola vez | PASA (simulada) | NO PROBADO |
| F05 | Sostener sin saltos | PASA (unitaria) | NO PROBADO |
| F06 | Soltar en reposo no lanza | PASA (simulada) | NO PROBADO |
| F07 | Lanzar rápido sigue la dirección | PASA (simulada) | NO PROBADO |
| F08 | Colisiones | PARCIAL: daño, empuje y rebote; explosión en P2 | NO PROBADO |
| F09 | Runner, Bomb y Tank distinguibles | NO IMPLEMENTADO (P2) | — |
| F10 | Núcleo pierde vida | NO IMPLEMENTADO (P1) | — |
| F11 | Combos | PARCIAL: cadena por lanzamiento; multiplicador en P2 | — |
| F12 | Partida de 90 s | PARCIAL: termina a los 5 golpes; cronómetro en P1 | — |
| F13 | Resultado | PARCIAL: mediciones, sin victoria/derrota | NO PROBADO |
| F14 | Reinicio por gesto | PASA (simulada) | NO PROBADO |
| F15 | Pérdida de mano sin acciones fantasma | PASA (unitaria) | NO PROBADO |
| F16 | Pérdida de anclaje | NO APLICA en arena superpuesta | — |
| F17 | Permiso revocado / cámara cortada | PARCIAL: reintento automático y pantalla de error | NO PROBADO |
| F18 | Privacidad | PASA: sin peticiones a servidores externos | NO PROBADO |

## 4. Pendiente de validación manual: prueba en teléfono (≈15 minutos)

Esta prueba es la que cierra el gate P0. Necesitas: el PC, el móvil en la misma Wi-Fi, un soporte para el móvil, una mesa y buena luz.

### Preparación

1. En el PC, doble clic en `iniciar.cmd`. Apunta la dirección **Network** que aparece (por ejemplo `https://192.168.1.23:8443/`).
2. Coloca el móvil en el soporte, **en horizontal**, con la cámara trasera mirando a la mesa en diagonal (unos 45°), a 30–40 cm de la superficie. Tú te sientas detrás del móvil y metes la mano por un lado o por debajo, de modo que se vea en la pantalla.
3. En el móvil abre esa dirección. Acepta el aviso de certificado (iPhone: «Mostrar detalles» → «visitar este sitio web»; Android: «Configuración avanzada» → «Acceder»).
4. Abre **Ajustes**, marca **Mostrar diagnóstico** y pulsa **Activar cámara** → **Permitir**.

Si el aviso de certificado impide continuar o la cámara no se activa, usa el plan B de `docs/11_GUIA_DE_USO.md`.

### Pasos y qué anotar

| # | Haz esto | Qué debe pasar | Resultado |
|---|---|---|---|
| T1 | Mira la pantalla tras dar permiso | Se ve la mesa y, encima, la arena con gremlins | ☐ |
| T2 | Mete una mano y muévela a izquierda y derecha | «Mano detectada»; los puntos blancos siguen la mano **en el mismo sentido**. Si van al revés: Ajustes → Invertir espejo | ☐ |
| T3 | Abre «Ajustar arena» y colócala sobre la mesa | La arena queda en una zona que alcanzas entera con la mano | ☐ |
| T4 | Palma abierta sobre el núcleo, quieta | El anillo se llena en ~1 s y empieza la prueba | ☐ |
| T5 | Intenta atrapar un gremlin 20 veces (pellizca y suelta despacio) | Anota la línea «Agarres X/Y» del diagnóstico | ___ / ___ |
| T6 | Atrapa uno, quédate quieto 1 s y abre los dedos, 10 veces | El gremlin cae donde está. Anota cuántas veces salió disparado | ___ de 10 |
| T7 | Atrapa uno y lánzalo hacia otro con un golpe de muñeca, 20 veces | Anota cuántas veces salió hacia donde querías | ___ de 20 |
| T8 | Con un gremlin atrapado, saca la mano de la imagen | El gremlin cae sin salir disparado | ☐ |
| T9 | Consigue los 5 golpes | Aparece el panel de resultado. **Haz una captura de pantalla** | ☐ |
| T10 | Palma abierta sobre el núcleo | Empieza otra ronda sin tocar la pantalla | ☐ |
| T11 | Bloquea el móvil 5 s y desbloquéalo | La cámara vuelve sola y el juego sigue | ☐ |
| T12 | Juega dos rondas más con la otra mano | ¿Funciona igual? ¿Se calienta el móvil? ¿Se cansa el brazo? | ☐ |

### Cómo interpretar las cifras del diagnóstico

| Medida | Bien | Dudoso | Mal (cambia el plan) |
|---|---|---|---|
| FPS (media de sesión) | ≥ 30 | 24–29 | < 24 |
| Visión (Hz) | ≥ 24 | 15–23 | < 15 |
| Latencia aprox. | < 120 ms | 120–200 ms | > 200 ms |
| Agarres (T5) | ≥ 85 % | 70–84 %: sube la sensibilidad y repite | < 70 %: hay que cambiar el enfoque |
| Lanzamientos involuntarios (T6) | 0–1 | 2–3 | > 3 |

Para comparar GPU y CPU en ese teléfono, añade `?delegate=cpu` al final de la dirección y repite T9.

### Qué enviarme

La captura del panel de resultado con el diagnóstico visible, la tabla rellenada, el modelo de teléfono y navegador, y cualquier cosa que te haya resultado incómoda. Con eso se marca el gate P0 como superado o se corrige antes de seguir. Repite la prueba en iPhone (Safari) y en Android (Chrome) si tienes ambos.

## 5. Bloqueos y riesgos abiertos

| Riesgo | Estado | Si se confirma |
|---|---|---|
| Rendimiento de MediaPipe en Safari iOS | Sin medir | Bajar resolución de cámara, probar `?delegate=cpu`, mover la detección a un worker |
| Fiabilidad del pellizco con la mano vista desde atrás/arriba | Sin medir | Ajustar umbrales y el peso 2D/3D; como último recurso, cámara frontal |
| Ergonomía de cámara trasera + mano | Sin medir | Probar cámara frontal (ya seleccionable en Ajustes) |
| Certificado autofirmado en iPhone | Sin probar | Plan B con túnel HTTPS (`docs/11_GUIA_DE_USO.md`) |
| La detección corre en el hilo principal | Conocido | Aceptable si T9 da ≥ 30 FPS; si no, worker |
| Lo virtual siempre se dibuja por encima de la mano | Limitación asumida del 2.5D | Anillos y flecha indican el agarre aunque los dedos «queden debajo» |

Nota de herramientas: en Microsoft Edge de escritorio la cámara **falsa** de pruebas se corta sola a los pocos segundos (reproducido con una página mínima sin código del juego). Por eso `npm run smoke` usa Chrome. No afecta a cámaras reales.

## 6. Próxima tarea

P1 (vertical slice): los Runners atacan el núcleo, tres vidas, puntuación, derrota y victoria, sobre esta misma base. La lógica de P1 no depende del resultado de la prueba en teléfono; **los umbrales gestuales sí**, y se ajustarán con tus cifras.
