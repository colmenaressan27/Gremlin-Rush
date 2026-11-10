# 05 — Plan de ejecución por hitos

**Objetivo:** evitar un proyecto grande que no se puede jugar. Cada fase debe terminar con un artefacto verificable.

| Etapa | Objetivo | Evidencia mínima | Salida |
|---|---|---|---|
| **P0** Factibilidad | Cámara + mano + escena/ar + un objeto | Vídeo/test reproducible y medición básica de estabilidad | Decisión sobre AR, 2.5D y fallback |
| **P1** Vertical slice | Capturar y lanzar un Runner, defender núcleo | Partida mínima con derrota y score | Núcleo jugable |
| **P2** MVP | Bomb, Tank, combos, oleadas, 90s, tutorial y reinicio gestual | Partida completa sin tocar pantalla | Demo para mostrar al jefe |
| **P3** Pulido | VFX, audio, animaciones, calibración, balance | 5 pruebas de usuarios y 2 dispositivos | Prototipo divertido y estable |
| **P4** Entrega | Guía Windows/iPhone, HTTPS, scripts, QA | Checklist firmado de funcionalidades reales | Paquete de entrega |

## Priorización explícita
**P0 crítico:** permiso cámara, detectar una mano, cursor correcto, captura, lanzamiento predecible, daño, score, fin, reinicio, rendimiento.

**P1 importante:** anclaje físico estable, Bomb/Tank, combos, tutorial no invasivo, IA de enemigos, efectos de audio y feedback, calibración, métricas locales.

**P2 después:** extras de enemigos, mutaciones, power-ups, eventos especiales, dos manos, oleadas sin fin, coleccionables.

## Dependencias entre hitos
- No crear arte de producción antes de demostrar que capturar/lanzar funciona.
- No agregar física compleja hasta validar si basta con física 2.5D.
- No aumentar número de enemigos antes de mantener rendimiento y legibilidad.
- No afirmar compatibilidad iPhone sin prueba en Safari real.
- No publicar enlace final si la cámara o la mano no pasan QA.

## Formato de reporte por fase que el agente debe producir
1. **Implementado:** funciones verificadas, no solo creadas.
2. **Evidencia:** qué se ejecutó, en qué dispositivo/navegador y resultado.
3. **Bloqueos:** fallos y posibles soluciones.
4. **Próxima tarea:** siguiente cambio que afecta diversión o confiabilidad.
5. **Cómo probar:** instrucciones reproducibles para el usuario.

## Definición de demostración exitosa ante el jefe
La persona ve una arena en la mesa, acerca la mano, atrapa un gremlin, lo lanza sobre otro, obtiene un combo, sobrevive hasta el final o pierde de forma comprensible, y puede pedir otra partida **sin controles táctiles jugables**. La escena no se congela ni confunde gestos de forma constante.
