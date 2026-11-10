# AGENTS.md — Instrucciones comunes para agentes de desarrollo

Este repositorio comienza como kit documental. El agente debe crear **la implementación del videojuego** siguiendo `PROMPT_MAESTRO.md` y las especificaciones de `docs/`.

## Orden de prioridad
1. Control con la mano fiable en navegador móvil.
2. Juego completo y divertido, no solo visual.
3. Rendimiento en Safari iOS/Chrome Android y fallback honesto.
4. Código legible, pruebas y documentación.
5. Arte y pulido opcional.

## Restricciones
- No añadir botones táctiles durante la partida. Permisos del sistema y ajustes previos sí pueden requerir interacción normal.
- No fingir que un seguimiento de pantalla es AR anclada. Etiquetar correctamente el modo alternativo.
- No usar servicios de pago, claves secretas ni servicios backend innecesarios.
- No transmitir video de la cámara salvo consentimiento explícito y necesidad demostrada (no existe en este alcance).
- No introducir dependencias sin comprobar su mantenimiento, licencia y compatibilidad.
- Antes de prometer precisión real 3D, demostrar que puede medirse de forma robusta.
- No declarar pruebas manuales en dispositivos que no fueron ejecutadas.
- Modificar documentación solo cuando cambien requisitos aprobados o se registren decisiones.

## Forma de trabajo
- Mantener tareas y checklist de fases; completar de a una unidad verificable.
- Construir primero una vertical slice; no hacer un sistema general gigantesco antes de poder lanzar un enemigo.
- Si un enfoque falla en Safari, probar alternativa y registrar por qué.
- Reportar qué funciona, qué falta y cómo reproducirlo.
- Mantenibilidad: separar visión, input, interacciones, juego, AR, rendering, audio y QA.

## Definition of Done
Juego realmente ejecutable y probadamente jugable donde se pueda iniciar, atrapar, lanzar, dañar, puntuar, perder/ganar y reiniciar sin controles táctiles de juego.
