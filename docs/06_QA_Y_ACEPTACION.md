# 06 — QA y criterios de aceptación

## Convención
Marcar cada caso como **PASA / FALLA / NO PROBADO**, con dispositivo y navegador. Nunca convertir «compila» en «funciona en iPhone».

## Casos funcionales
| ID | Caso | Aceptación |
|---|---|---|
| F01 | Primera apertura | Explica cámara/privacidad y solicita permiso del navegador correctamente |
| F02 | Cámara denegada | Mensaje útil y ruta de recuperación sin pantalla en blanco |
| F03 | Una mano | Detecta izquierda o derecha y proyecta el cursor coherentemente |
| F04 | Adquisición | El objetivo se resalta al entrar en rango, pellizco confirma una sola captura |
| F05 | Sostener | Gremlin sigue al punto de agarre sin saltos abruptos |
| F06 | Soltar en reposo | No se lanza accidentalmente a velocidad máxima |
| F07 | Lanzar rápido | Trayectoria coherente con dirección del movimiento reciente |
| F08 | Colisiones | Impactos realizan daño, empuje, rebote o explosión definida |
| F09 | Enemigos | Runner, Bomb y Tank tienen comportamientos distinguibles |
| F10 | Núcleo | Pierde una vida por un contacto válido, sin daño duplicado infinito |
| F11 | Combos | Se acumulan en ventana estable y muestran puntos correctos |
| F12 | Partida | Termina tras 90 s o al llegar núcleo a cero |
| F13 | Resultado | Muestra puntaje y estado de victoria/derrota |
| F14 | Reinicio | Se puede volver a jugar mediante gesto, sin tocar pantalla |
| F15 | Pérdida mano | No se disparan acciones fantasmas ni lanzamientos injustos |
| F16 | Pérdida anclaje | Mensaje claro; recuperar/pasar a fallback sin perder estado indebidamente |
| F17 | Permiso revocado | Recupera o explica bloqueo adecuadamente |
| F18 | Privacidad | Cámara no enviada a servicios externos; datos locales documentados |

## Pruebas físicas en móvil
- iPhone Safari (ideal: iPhone 13 Pro Max) y Android Chrome de gama media.
- Mesa clara, mesa oscura, fondo con textura y marcador parcialmente tapado.
- Buena iluminación y luz lateral; también una prueba con luz imperfecta razonable.
- Mano izquierda, derecha, pieles y tamaños distintos; brazos con manga, uñas, accesorios comunes.
- Orientación fijada en horizontal; recuperación al girar si ocurre.
- Audio y cámara tras bloqueo/desbloqueo, pestaña en segundo plano y retorno.
- Veinte intentos de captura/lanzamiento por persona con registro básico.

## Rendimiento
- Objetivo ≥30 FPS durante situaciones normales en móvil de prueba; reportar rango real, no prometer universalidad.
- Evitar bloqueos evidentes cuando aparecen varios enemigos.
- Control con respuesta rápida: registrar latencia aproximada y sensación percibida.
- Probar consumo/batería y calentamiento en una sesión de tres partidas.
- Fallback gráfico cuando efectos o modelo de visión saturan GPU/CPU.

## UX y diversión
- El 80% de personas de un grupo pequeño entiende capturar/lanzar después de tutorial (objetivo, no dato).
- Tras 2–3 partidas, las personas saben explicar por qué el gremlin Bomb es útil.
- Al menos 3 personas de 5 piden repetir espontáneamente o aceptan una segunda partida (indicador cualitativo).
- No existe una espera prolongada en pantalla sin causa y sin feedback.

## Casos críticos de fallo
1. Un pellizco accidental toma un objetivo lejano.
2. La captura se suelta con microtemblores.
3. Una pérdida temporal de mano hace disparar el objeto.
4. El Bomb explota sin colisión clara.
5. La mano tapa completamente el target y desaparece la arena en plena acción.
6. El marcador se reubica al recuperarse y el objeto atraviesa el núcleo.
7. La cámara se ve reflejada/mirrored y los movimientos salen al revés.
8. Un segundo intento de cámara genera dos flujos simultáneos o pantalla negra.
9. El cronómetro sigue corriendo mientras la cámara está caída.
10. Reiniciar requiere tocar un botón durante una partida.

## Criterio de entrega
No aprobar hasta marcar F01–F15 como PASA en el entorno de referencia del usuario o declarar explícitamente las excepciones de compatibilidad y el fallback. Entregar matriz de resultados con evidencia.
