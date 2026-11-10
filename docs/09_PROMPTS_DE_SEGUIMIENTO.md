# 09 — Prompts breves de seguimiento para Claude Code o Codex

## A. Inicio automático del proyecto
«Lee `PROMPT_MAESTRO.md`, `AGENTS.md` y todos los documentos en `docs/`. No me pidas escribir código. Trabaja por fases y empieza por P0: demostrar cámara, detección de mano, un gremlin y manipulación en un móvil. Si puedes usar terminal, instala lo necesario, ejecuta y corrige. En tu reporte distingue lo probado de lo pendiente de móvil real.»

## B. Si el agente se queda en una demo visual
«No quiero una simulación vacía. Completa el ciclo jugable de Gremlin Rush: agarrar, cargar, lanzar, colisiones, daño al núcleo, puntuación, combos, fin y reintento gestual. Usa `docs/01_GDD.md` y los criterios F01–F15 de `docs/06_QA_Y_ACEPTACION.md`. Prioriza jugabilidad real sobre decoración.»

## C. Si detectar dedos falla
«Audita el sistema de input con `docs/02_CONTROLES_MANOS.md`. Identifica falsos positivos, pérdidas de agarre, espejo, latencia, oclusiones y umbrales no normalizados. Mejora máquina de estados, histéresis, filtrado y captura asistida. Añade diagnóstico, mide y muestra qué pruebas ejecutaste, sin inventar compatibilidad móvil.»

## D. Si funciona en PC pero no en iPhone
«Realiza una auditoría de compatibilidad Safari móvil: HTTPS, permisos, cámara trasera, recursos GPU, dependencias de AR y MediaPipe, orientación, audio y consumo. No recurras a botones táctiles en partida. Define una alternativa con arena superpuesta si el anclaje de imagen falla; informa claramente el modo y sus límites.»

## E. Para que el juego sea más divertido
«Haz un pase de game feel y balance. La jugabilidad debe recompensar captura fluida, lanzamientos precisos, rebotes, combos y decisiones tácticas entre Runner, Bomb y Tank. No agregues más gestos ni enemigos hasta que una sesión de 90 s sea divertida. Prepara 3 hipótesis de mejora para playtest.»

## F. Auditoría final antes de mostrárselo al jefe
«Compara el proyecto real con `PROMPT_MAESTRO.md` y `docs/06_QA_Y_ACEPTACION.md`. Entrega una matriz de PASA/FALLA/NO PROBADO, evidencia de ejecución, guía Windows 11, guía de montaje físico y pruebas pendientes en iPhone/Android. No declares finalizadas funciones que solo son placeholders.»
