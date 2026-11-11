# 12 — Informe de la fase P1 (vertical slice)

**Fecha:** 11 de noviembre de 2026 · **Estado:** implementada y verificada en PC · **Pendiente:** validación en teléfono real.

## 0. Sobre el gate P0

El propietario informó el 11 de noviembre de 2026 de que realizó la prueba en teléfono y pidió pasar de fase. **No se registraron cifras** (FPS, cadencia de detección, latencia, porcentaje de agarres) ni el modelo de teléfono y navegador. Por tanto:

- La columna «Teléfono real» de `docs/10_P0_FACTIBILIDAD.md` sigue sin datos.
- Los umbrales gestuales no se han tocado en P1: siguen siendo las hipótesis iniciales.

Cuando haya cifras se anotan aquí y se ajusta el control con ellas (ver sección 5).

## 1. Implementado

Una partida mínima completa, de principio a fin y sin tocar la pantalla mientras se juega:

| Elemento | Comportamiento |
|---|---|
| Práctica | Solo la primera vez. Gremlins que deambulan, sin reloj ni peligro. El primer golpe la termina |
| Ataque | Los Runners salen de los portales y corren al núcleo, con una ruta ligeramente cambiante |
| Núcleo | 3 vidas. Cada Runner que lo toca quita una, **una sola vez**, y desaparece. Destello rojo, sacudida, «−1 vida» y alarma |
| Munición | El gremlin lanzado que acierta se gasta al detenerse; el que falla sobrevive y vuelve a atacar |
| Puntuación | 100 por Runner × golpes encadenados en el mismo lanzamiento (máx. ×5). Sujetar no da puntos |
| Ritmo | Aparición cada 3 s al empezar y cada 1,5 s al final; la velocidad de ataque sube; máximo 6 atacantes |
| Apariciones dirigidas | Nunca en un portal pegado a la mano |
| Final | Derrota con el núcleo a 0. Victoria al cumplirse 90 s, con +500 por vida |
| Resultado | Puntuación, récord local, derrotados, mejor cadena. Datos técnicos solo con el diagnóstico activado |
| Reinicio | Palma abierta sobre el núcleo. La segunda partida entra directa al combate |
| Pausa | Automática si la mano falta más de 3,5 s en combate. El cronómetro y los enemigos se congelan. Se reanuda sola |
| HUD | Puntos y corazones arriba a la izquierda, cronómetro en el centro, estado de mano a la derecha |

Lo que **no** incluye todavía (P2): Bomb, Tank, combo por ventana de tiempo, oleadas con fases, tutorial más completo.

## 2. Evidencia

Todo ejecutado en el PC del propietario (Windows 11, Chrome 156). Ningún teléfono.

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | Sin errores |
| `npm test` | 49/49 pruebas unitarias |
| `npm run build` | Correcta |
| `npm run smoke` | 30/30 comprobaciones |

La prueba de humo recorre, con el ratón haciendo de mano:

- **Partida B (derrota):** inicio por gesto → práctica → primer golpe → combate → suma de puntos → la mano desaparece → pausa con el cronómetro detenido → reanudación → sin defender, el núcleo pierde sus tres vidas → «Núcleo destruido» → reinicio por gesto → la nueva partida entra directa al combate.
- **Partida C (victoria):** partida acortada a 3 s (`?duracion=3`, solo disponible en desarrollo) → «¡Núcleo a salvo!» → bonus por vidas → récord guardado en el dispositivo.

Las pruebas unitarias nuevas cubren: daño único al núcleo, que un atacante agarrado o aturdido no daña, proyectil gastado, práctica sin reloj, paso a combate, puntuación y multiplicador, derrota, victoria con bonus, límite de atacantes y apariciones lejos de la mano.

**Lo que esto no demuestra:** que la partida sea jugable y divertida con una mano real. El equilibrio (velocidades, ritmo, vidas) está calculado sobre el papel y probado con un ratón.

## 3. Matriz de criterios (cambios respecto a P0)

| ID | Caso | PC (automático) | Teléfono real |
|---|---|---|---|
| F08 | Colisiones | PARCIAL: daño, empuje, rebote; explosión en P2 | NO PROBADO |
| F09 | Runner, Bomb y Tank distinguibles | NO IMPLEMENTADO (P2) | — |
| F10 | Núcleo pierde una vida por contacto, sin duplicados | **PASA** | NO PROBADO |
| F11 | Combos | PARCIAL: multiplicador por cadena en un lanzamiento; ventana de tiempo en P2 | NO PROBADO |
| F12 | Partida termina a los 90 s o con el núcleo a cero | **PASA** (victoria con duración acortada; derrota real) | NO PROBADO |
| F13 | Resultado con puntuación y victoria/derrota | **PASA** | NO PROBADO |
| F14 | Reinicio por gesto | PASA (simulada) | NO PROBADO |
| Fallo crítico 9 | El cronómetro no corre con la cámara caída o en pausa | **PASA** (pausa); cámara caída sin prueba automática | NO PROBADO |

El resto de casos no cambia respecto a `docs/10_P0_FACTIBILIDAD.md`.

## 4. Bloqueos y riesgos

| Riesgo | Estado | Si se confirma |
|---|---|---|
| Sin cifras de la prueba en teléfono | Abierto | Los umbrales siguen sin calibrar; cualquier dificultad de agarre contamina la valoración del juego |
| Equilibrio sin jugar con mano real | Abierto | Ajustar `match` en `src/config/gameConfig.ts`: intervalo de aparición, velocidad, vidas |
| Dos atacantes simultáneos al empezar pueden ser demasiado para un novato | Hipótesis | Bajar `openingSpawns` a 1 o `attackSpeedStart` |
| Un Runner solitario no se puede eliminar (no hay contra qué lanzarlo) | Asumido | Se puede alejar lanzándolo; en P2 el Bomb y el daño por rebote dan más salidas |

## 5. Cómo probar en el teléfono (≈10 minutos)

1. `iniciar.cmd` en el PC y abre la dirección **Network** en el móvil (si el PC cambió de Wi-Fi, cierra y vuelve a abrir `iniciar.cmd`).
2. Ajustes → **Mostrar diagnóstico** → **Activar cámara**.
3. Palma abierta sobre el núcleo para empezar.
4. **Práctica:** atrapa un gremlin y lánzalo contra otro. Al primer golpe empieza el combate.
5. **Combate:** juega tres partidas seguidas, reiniciando con la palma.

Qué necesito saber:

| Pregunta | Respuesta |
|---|---|
| Teléfono y navegador | |
| FPS medio y mínimo (panel de resultado, con diagnóstico) | |
| «Visión» en ms y Hz, y «Latencia» (panel de diagnóstico) | |
| Agarres X/Y de una partida | |
| ¿Algún lanzamiento salió sin querer? ¿Cuántos? | |
| ¿Cuánto tardaste en conseguir el primer golpe de la práctica? | |
| ¿Ganaste o perdiste? ¿Entendiste por qué? | |
| ¿Viste claramente cuándo el núcleo recibía daño? | |
| ¿Los Runners van demasiado rápido, demasiado lento o bien? | |
| ¿Se pausó sola alguna vez sin que quitaras la mano? | |
| ¿Quisiste jugar otra? | |

## 6. Próxima tarea

P2 (MVP arcade): Bomb con explosión en área, Tank resistente, combo por ventana de ~2 s con multiplicador ×1–×5, oleadas con las fases del GDD (aprendizaje, decisión, clímax) y tutorial algo más guiado. Antes de añadir contenido conviene tener las cifras de la sección 5: si los agarres fallan más del 30 %, el kit manda arreglar el control primero.
