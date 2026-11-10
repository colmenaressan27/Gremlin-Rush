# 01 — Game Design Document (GDD)

## Identidad
**Nombre provisional:** GREMLIN RUSH  
**Género:** arcade de habilidad / defensa de núcleo / combo score-chase  
**Formato:** WebAR móvil, partidas breves  
**Audiencia:** demostraciones universitarias, ferias tecnológicas y jugadores casuales/competitivos  
**Promesa:** convertir enemigos en armas usando solo una mano, con caos legible y dominio de habilidad.

## Pilares de diseño
1. **Manipulación tangible:** atrapar y lanzar se siente preciso y causa consecuencias claras.
2. **Caos con criterio:** la pantalla ofrece oportunidades de cadenas, no ruido incontrolable.
3. **Aprendizaje en segundos:** tutorial mayormente visual, no manual de gestos.
4. **Rejugabilidad:** puntaje, dominio de trayectorias, selección táctica de presa y riesgo-recompensa.
5. **Realidad aumentada con sentido:** los gremlins invaden una arena sobre el escritorio real; el espacio físico enmarca la acción, no obliga a escanear una habitación.

## Fantasy / primera impresión
La cámara revela una pequeña plataforma con un núcleo luminoso. Del borde emergen gremlins. La mano del jugador entra en escena; uno de ellos mira la mano y trata de huir. El jugador lo pellizca, lo carga, lo lanza y ve cómo otro explota. La UI celebra el combo y una nueva oleada aparece.

## Bucle central, 2 a 5 segundos
1. Identifica cuál gremlin es útil y cuál amenaza al núcleo.
2. Acerca el punto de captura y pellizca para agarrar.
3. Desplázalo/cárgalo brevemente mientras eliges un objetivo.
4. Suelta con un movimiento direccional para lanzarlo.
5. Mira choques, rebotes, explosiones y puntuación; decide el siguiente agarre.

## Bucle completo de 90 segundos
- **0–10 s, presentación/tutorial activo:** aparición del núcleo y de un Runner. Enseñar pellizcar y soltar con feedback contextual; si el jugador necesita más, tiempo de partida todavía no empieza.
- **10–35 s, aprendizaje:** llegan Runners y primeras oportunidades de doble impacto. Ritmo contenido.
- **35–65 s, decisión:** aparece Bomb y luego Tank; los lanzamientos deben elegirse por utilidad táctica.
- **65–90 s, clímax:** oleada de presión creciente, varios blancos y posibilidad de combos altos. Evitar saturación irrecuperable.
- **Final:** puntaje, máximo combo, gremlins derrotados, daño recibido, récord local, posibilidad de reiniciar con gesto mantenido.

**Tiempo objetivo total:** 90 s de combate tras tutorial. Si el núcleo pierde las tres vidas, derrota anticipada. Si resiste, supervivencia/victoria al finalizar el tiempo.

## Mecánicas concretas
### Captura
Pellizcar índice + pulgar cerca de un gremlin. El objetivo debe quedar adherido con retroalimentación visual y sonido corto. Captura con región generosa adaptada a tamaño de pantalla. El estado de agarre persiste hasta que se abre el pellizco, se pierde seguimiento demasiado tiempo o termina la partida.

### Carga
Al sostener: indicador circular/pulso crece y eleva potencia hasta un máximo en ~0.8 s (ajustable tras pruebas). Mantener más tiempo no multiplica indefinidamente. Opcional posterior: carga excesiva hace que el enemigo forcejee; NO incluir al principio si dificulta el control.

### Lanzamiento
La dirección nace del desplazamiento reciente de la mano justo antes de soltar. Un lanzamiento suave hace un desplazamiento corto; un flick nítido alcanza blancos lejanos. La física debe ser legible, permisiva y divertida; no totalmente realista.

### Choque y cadena
Impactar a un gremlin le inflige daño y empuja. Rebotes sucesivos y explosiones pueden generar una cadena. Impactos en una ventana de ~2 s mantienen combo. Multiplicador x1–x5 para MVP, tunable. Mostrar un 'COMBO x3' grande pero breve. No ofrecer puntos por simplemente sujetar un enemigo.

### Núcleo
Centro o zona protegida claramente visible. Tiene tres puntos de integridad. Si enemigo toca el núcleo: aplica daño una vez, retrocede o desaparece, y se comunica con destello/sonido de peligro. Sin daños invisibles.

## Enemigos MVP
| Nombre | Comportamiento | Papel táctico | Feedback visual |
|---|---|---|---|
| Runner | Corre al núcleo, cambia ligeramente de ruta | Presión; munición básica | Ojos grandes, extremidades rápidas, verde ácido |
| Bomb | Movimiento medio; explota al impacto significativo o cuando es lanzado | Desencadena AoE y combos | Cuerpo naranja, mecha pulsante y sonido de alerta |
| Tank | Lento, resiste varios golpes, bloquea trayectoria | Requiere dirigir Bomb / encadenar golpes | Cuerpo morado/azul, placas de armadura con grietas |

**Enemigos futuros:** Splitter (se divide), Thief (roba energía), Magnet (atrae proyectiles), Boss (intercala escudos y zonas débiles).

## Sistema de puntuación (valores iniciales ajustables)
- Runner destruido: 100 pts.
- Bomb destruido: 150 pts.
- Tank destruido: 250 pts.
- Combo: multiplicador x1–x5 mientras hay impactos encadenados.
- Bonus final por integridad del núcleo: +500 pts por vida restante.
- Puntuación solo local, sin leaderboard online en MVP.

## Dificultad y decisiones
- **Decisión 1:** eliminar amenaza inmediata o preparar un combo mayor.
- **Decisión 2:** lanzar ya o cargar más potencia.
- **Decisión 3:** usar Bomb como munición o quitarlo antes de que alcance el núcleo.
- Los spawn son dirigidos: no poner todos los enemigos bajo la mano ni tapar siempre el núcleo.
- No superar un máximo inicial de 7–9 enemigos simultáneos hasta validar rendimiento y legibilidad.
- Hacer que fallar el agarre tenga coste bajo; el fracaso debe provenir de decisiones, no de la visión artificial.

## Pantallas / estados
1. Acceso a cámara y explicación breve de privacidad.
2. Preparación: detectar arena (AR) o activar fallback, calibrar mano.
3. Tutorial gestual breve y no cronometrado.
4. Juego activo 90 s.
5. Pausa/recuperación si cámara o mano deja de ser utilizable (regla clara, sin explotar la puntuación).
6. Resultado + récord local + gesto para reiniciar.

## HUD
Mínimo: cronómetro, tres corazones/integridad, puntuación, combo efímero, señal de estado de mano (detectada/perdida), carga sobre el objeto capturado. Evitar tapar la zona donde entran los dedos.

## Nivel y espacio
- Arena virtual circular/hexagonal sobre mesa, con núcleo central y accesos periféricos.
- 2.5D jugable: unidades y físicas sobre un plano virtual anclado, alturas animadas solo para claridad.
- No requerir reconocimiento perfecto de profundidad real ni colisiones con muebles.
- La cámara permanece relativamente fija en un soporte durante combate.

## Sonido y game feel
- SFX individuales: inicio, hover elegible, captura, carga, lanzamiento, impacto, chain, explosión, daño, fin.
- Cada acción debería generar **feedback audiovisual** en menos de lo perceptualmente molesto, sujeto a prueba.
- Microanimaciones: ojos siguen la mano, Runner patalea mientras está agarrado, Tank vibra cuando resiste, Bomb cambia de expresión antes de explotar.
- Sacudida visual local del entorno virtual y partículas controladas; sin sacudir el video real excesivamente.

## Fuera de alcance para MVP
Multijugador, backend, cuentas, compras, cosméticos, mundo abierto, 6DOF de mano exacto, oclusión 3D de toda la habitación, realidad mixta nativa, historias largas, jefes elaborados, modelos complejos.
