# 02 — Sistema de control por manos: especificación funcional

## Contrato de interacción
**La mano es el mando.** No existen botones táctiles ni joystick para jugar. La cámara observa una mano sobre o frente a la mesa; el videojuego deriva una posición de agarre y estados estables usando landmarks de la mano. Los gestos deben ser tan intuitivos como el movimiento que representan.

## Configuración recomendada
- Teléfono colocado en soporte estable, pantalla visible al jugador y cámara con visión de la superficie y mano.
- Diseñar para **una mano libre**. Permitir izquierda o derecha. No invertir direcciones según la mano.
- Comenzar con cámara trasera si resulta ergonómico; validar físicamente encuadre, iluminación, postura y ángulo de visión.
- Una prueba de 30 s debe verificar alcance a toda la arena sin tapar el núcleo o marcador constantemente.

## Estados y gestos del MVP
| Estado | Detección conceptual | Respuesta del juego |
|---|---|---|
| Mano ausente | Confianza insuficiente / sin landmarks | No ejecutar acciones; indicar 'Acerca la mano' y congelar interacciones inestables |
| Mano presente | Landmarks estables | Mostrar indicador discreto de interacción/calibración |
| Cerca de enemigo | Cursor de agarre entra a radio tolerante | Contorno y sonido suaves de 'capturable' |
| Pellizco inicia | Pulgar–índice se acercan, con umbral relativo y estabilidad | Capturar un enemigo elegible cercano (uno a la vez) |
| Sosteniendo | Pellizco sigue cerrado | Enemigo sigue cursor suavizado; crecer medidor de carga |
| Pellizco se abre | Separación supera umbral de liberación | Soltar o lanzar según velocidad/dirección recientes |
| Gesto de confirmación | Mano abierta estable o gesto claramente diferenciable por ~1 s, solo en menús | Iniciar/reiniciar sin tocar pantalla |

**No usar de base** diez señales de gestos confusos. El gesto de ataque del MVP es **atrapar + lanzar**. Todo lo demás se añade solo si la diversión lo exige.

## Definición del 'cursor' de agarre
- Posición de referencia entre las puntas de pulgar e índice; ajuste para la proyección y el plano de juego.
- Interpretación **2.5D**: se traduce el cursor de imagen a coordenadas de arena; no afirmar que el dedo toca físicamente una malla 3D con precisión real.
- Usar tamaño aparente de mano para normalizar tolerancias, evitando comparar píxeles absolutos entre dispositivos y distancias.
- Considerar calibración breve de alcance: la mano puede recorrer cómodo toda el área de la arena.

## Filtros anti-frustración (especificación, no algoritmo obligatorio)
1. **Histéresis:** cerrar y abrir deben tener umbrales distintos; evita parpadeos de agarre.
2. **Permanencia breve:** no registrar un pellizco si ocurre solo un fotograma errático.
3. **Captura asistida:** radio de captura algo más grande que el sprite visible, pero sin atrapar enemigos muy alejados.
4. **Punto de retención:** al capturar, la criatura debe seguir un punto suavizado, sin teletransportarse por ruido.
5. **Lanzamiento robusto:** evaluar movimiento a lo largo de una ventana corta, no un solo frame; limitar velocidad y errores extremos.
6. **Pérdida de tracking:** tolerancia breve, durante la cual no se inventan gestos; si persiste, soltar sin impulso falso o pausar según estado.
7. **Oclusión:** cuando la mano tapa un enemigo, mantener captura confirmada por un lapso razonable en lugar de soltarlo inmediatamente.
8. **Prevención de dobles acciones:** una liberación solo debe generar un lanzamiento; no activar reinicio por confundir mano abierta al soltar.
9. **Indicadores:** visualización de hover, carga, flecha de trayectoria al sujetar y estado de detección sin llenar la pantalla de puntos técnicos.
10. **Física justa:** si suelta despacio, no disparar; si hace un flick, el resultado debe seguir dirección predecible.

## Decisiones concretas de interfaz gestual
- **Inicio:** mantener palma abierta dentro de una zona de inicio destacada en pantalla mientras no haya gameplay. Evita iniciar accidentalmente al calibrar: exigir mano detectada estable y una transición visual cuenta atrás.
- **Durante partida:** no interpreta palma abierta como menú. Solo pellizco / movimiento / soltar.
- **Pausa:** cuando la cámara deja de transmitir o la mano lleva ausente varios segundos, activar recuperación razonable; no paralizar a voluntad por pequeñas ausencias.
- **Reintento:** después del resultado, palma abierta mantenida en área de confirmación por ~1–1.5 s. Mostrar cuenta atrás clara.

## Opcionales fuera del MVP
- Barrido con palma para empujar enemigos (alto riesgo de falsos positivos al mover la mano para agarrar).
- Dos manos para fusionar gremlins, si hay soporte para móvil y suficiente CPU.
- Gestos más complejos de combate, solo si superan pruebas de claridad y fiabilidad.

## Pruebas humanas mínimas
- 5 participantes sin instrucciones extensas, incluidos diestros y zurdos.
- ¿Con qué frecuencia falla un intento legítimo de captura? ¿Cuántos lanzamientos salen sin querer?
- En prueba de 20 lanzamientos por persona: comparar dirección percibida vs dirección real.
- Verificar distintas pieles, iluminación cálida/fría, mesa clara/oscura, antebrazos con manga, tamaños de mano; reportar sesgos o problemas, no asumir funcionamiento universal.
- Evaluar cansancio del brazo tras tres partidas; el soporte y campo de juego deben minimizar esfuerzo sostenido.

## Métricas aspiracionales, sujetas a playtest
- Capturas exitosas en ≥85% de intentos deliberados después de familiarización.
- Lanzamientos no deseados muy poco frecuentes (objetivo <1 por partida).
- La mayoría aprende a capturar y lanzar en ≤30 s de práctica.
- Pérdidas breves de seguimiento no reinician estados ni causan muerte injusta.

**Importante:** son **objetivos de calidad**, no mediciones o compatibilidad prometida.
