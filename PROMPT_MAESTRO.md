# PROMPT MAESTRO — GREMLIN RUSH

Actúa como **director técnico, diseñador de gameplay, ingeniero de visión por computador, desarrollador WebAR y responsable de QA**. Vas a crear desde cero **GREMLIN RUSH**, una experiencia arcade WebAR para móviles, controlada exclusivamente con la mano captada por la cámara.

**IMPORTANTE:** Quien te entrega este documento **no te está pidiendo que diseñes solamente la interfaz ni que escribas una propuesta**. Tu encargo es desarrollar, instalar, ejecutar, probar y documentar un videojuego realmente funcional. Puedes escribir el código que sea necesario, pero el propietario del proyecto NO necesita escribir código a mano. Lee **todos los documentos del kit antes de modificar archivos**. `AGENTS.md` y `docs/` forman parte de la especificación.

## 1. El producto que debes construir
GREMLIN RUSH es un juego arcade rápido en una arena virtual sobre una mesa. Criaturas pequeñas, traviesas y con comportamientos distintos invaden la arena para destruir un núcleo. El jugador utiliza una mano para **capturarlas mediante pellizco**, **cargar un lanzamiento manteniendo el agarre** y **arrojarlas físicamente contra otros gremlins**. Los enemigos funcionan también como munición. El placer de jugar está en el dominio del lanzamiento, las reacciones en cadena, las decisiones bajo presión y los combos.

**No confundas reconocimiento de gestos con diversión.** No te detengas en un prototipo donde un cubo sigue un dedo. Diseña una experiencia arcade satisfactoria, con objetivos, peligro, consecuencias, feedback y rejugabilidad.

## 2. Requisitos fundamentales
1. **WebAR sin instalación de app nativa.** Funciona desde navegador moderno en iOS Safari y Android Chrome; pruebas en hardware real obligatorias. No depender de una API inmersiva de WebXR que falte en Safari.
2. **Control de una mano, cero botones durante el gameplay.** Ni joystick ni pantalla táctil para atacar, coger, lanzar, reiniciar o pausar. El permiso inicial de cámara es un diálogo del navegador y está permitido. Puedes usar una pantalla inicial informativa y acciones por gesto mantenido.
3. **Móvil en soporte.** El móvil apunta a una mesa donde se encuentra la arena. Usa la cámara trasera si la arquitectura escogida lo permite; prioriza la cámara que permita ver correctamente la mano y el escenario. Explica la posición óptima y permite calibrar un área visible.
4. **Interacciones reales dentro del juego:** detectar mano, capturar un gremlin al pellizcarlo, hacerlo seguir al agarre sin saltos, cargar energía si se mantiene, lanzar según dirección/velocidad estimada, detectar impactos y combos, defender núcleo y finalizar partida.
5. **Modo AR robusto:** prioriza seguimiento mediante imagen/objetivo físico; si el seguimiento falla o es demasiado costoso con el reconocimiento de manos simultáneo, incorpora un modo alternativo de arena superpuesta a cámara, **debidamente identificado** como superposición y no anclaje espacial real. La jugabilidad debe sobrevivir a pérdidas temporales del seguimiento.
6. **MVP acotado, jugable:** 90 segundos, 3 tipos de enemigos iniciales, 3 vidas del núcleo, incremento de intensidad, puntaje, combos, fin de partida, reintento sin tocar pantalla y tutorial corto.
7. **Rendimiento móvil:** objetivo 30 FPS estables y retroalimentación gestual perceptiblemente rápida; medir en iPhone y Android. Escalado dinámico y efectos degradables. No sacrifiques precisión de entrada por partículas decorativas.
8. **Privacidad y costo:** cámara procesada localmente de forma predeterminada, sin subir imágenes ni video; sin cuentas; no usar servicios pagos. Verifica las licencias de las librerías y activos, no copiar material protegido.
9. **Windows 11:** crear instrucciones de instalación, scripts `setup.cmd` e `iniciar.cmd` si resultan apropiados para las herramientas seleccionadas; describir cómo publicar de forma gratuita sobre HTTPS para probar con iPhone.
10. **Proyecto mantenible:** TypeScript y módulos separados para visión de manos, gestos, interacción, enemigos, física/colisiones, oleadas, puntaje, UI, audio y AR. Evita un archivo monolítico y evita variables o configuraciones mágicas esparcidas por el código.

## 3. Mecánicas obligatorias de la primera versión
- **Pellizco para agarrar:** se captura un enemigo solo cuando el cursor gestual está sobre una región de agarre clara. Hay feedback de proximidad, agarre confirmado y liberación.
- **Arrastrar/posicionar:** el enemigo capturado acompaña el punto de agarre con suavizado y sin oscilaciones fuertes.
- **Mantener para cargar:** sostener la presa aumenta la potencia hasta un máximo; mostrar carga visible. No debe ser necesario mantener demasiado tiempo.
- **Lanzamiento direccional:** soltar tras desplazar la mano produce una trayectoria y colisiones útiles. Sin movimiento claro, el enemigo simplemente cae en un punto seguro; no inventar lanzamientos involuntarios.
- **Daño por choque:** arrojar gremlins sobre otros causa daño; ciertos gremlins explotan o generan efectos de área.
- **Cadena de combos:** impactos seguidos aumentan multiplicador y puntuación. Un efecto visual y sonoro debe hacer evidente cada cadena.
- **Defender núcleo:** enemigos que llegan al núcleo le restan vida y generan urgencia visible.
- **Olas dinámicas:** ritmo de dificultad progresivo sin saturar el hardware ni hacer imposibles los agarres.
- **Fin y reinicio gestual:** victoria/supervivencia, derrota, puntuación, mejor puntuación local y 'otra partida' mediante gesto claro, sin obligar a tocar la pantalla.

## 4. Enemigos prioritarios
- **Runner:** pequeño y rápido, fácil de capturar; amenaza principal al núcleo.
- **Bomb Gremlin:** al golpear causa explosión en área. Riesgo-recompensa y principal fuente de combos.
- **Tank:** pesado y lento; exige impactos múltiples o usar un Bomb Gremlin; comunica claramente resistencia.

Extensiones posteriores: Splitter (se divide), Thief (roba energía), mini-jefe y habilidades de defensa. **No implementes 8 enemigos a costa de que los tres básicos funcionen mal.**

## 5. Diseño de controles: no improvises gestos
Usa como documento de verdad `docs/02_CONTROLES_MANOS.md`. El diseño base NO exige un seguimiento real perfecto de dedos en 3D; trabaja en una arena 2.5D, con mapeo explícito desde los puntos de referencia de la mano hacia un plano de juego. Usa detección con tolerancias, umbrales relativos al tamaño de la mano, histéresis, filtrado temporal y estados de agarre para evitar activaciones accidentales. Mantén una visualización de diagnóstico para desarrollo, deshabilitada durante la partida final.

**Prioridad absoluta:** el jugador no debe pelear contra el detector. Si fallan un 30% de los agarres, cambia el enfoque de interacción antes de añadir más contenido.

## 6. Estrategia técnica (elige y justifica, no asumas compatibilidad)
Base sugerida: Vite + TypeScript + Three.js; MediaPipe Hand Landmarker para mano; motor de colisiones físico ligero (por ejemplo Rapier) cuando de verdad beneficie al gameplay; seguimiento de imagen con MindAR **solo si resiste pruebas móviles y coexiste con la detección de manos**. Comprueba el estado y compatibilidad actual de versiones y dependencias oficiales. Puedes sustituir bibliotecas cuando exista evidencia de que una alternativa funciona mejor.

**Fase de riesgo 0 obligatoria antes del juego completo:** en un mismo dispositivo móvil, demostrar cámara + detección de mano + escenario WebAR + manipulación de una entidad + medición básica de rendimiento. Si hay problemas de GPU, Safari, permisos o pérdida de anclaje, documentarlos y ofrecer solución/fallback antes de construir el resto.

Evita WebXR inmersivo como requisito para iPhone. La experiencia debe funcionar como una página web con cámara y representación de objetos virtuales, aunque ciertas capacidades avanzadas de AR no estén disponibles.

## 7. Experiencia visual y audio
Estilo: **arcade caótico, criaturas traviesas expresivas, materiales 3D estilizados, lectura visual inmediata**. Paleta sugerida: índigo oscuro, verde ácido, naranja explosivo, amarillo eléctrico y blanco cálido. Sin gore. El núcleo es visualmente prioritario. Escenarios y partículas ligeros para móviles. Diseña VFX y SFX para las acciones más importantes: aproximación, captura, carga, lanzamiento, impacto, combo, daño al núcleo y fin.

Primero usa geometrías y sonidos temporales si faltan modelos propios; prioriza una **versión funcional**. Después sustituye por arte original con licencias claras. No uses logotipos, criaturas ni música con propiedad intelectual ajena sin licencia.

## 8. Plan de ejecución autónoma
- Lee `README.md`, `AGENTS.md` y toda la carpeta `docs/`. Resume prioridades en cinco líneas, identifica incertidumbres críticas y empieza.
- **P0 Validación de factibilidad:** comprueba cámara, una mano, capturar/soltar y el rendimiento de AR en móvil. Registra la decisión del método de anclaje.
- **P1 Vertical slice jugable:** un Runner, un núcleo, captura, lanzamiento, impacto, daño, score, comienzo y final.
- **P2 Arcade completo MVP:** Bomb, Tank, oleadas, combos, feedback, tutorial, 90 segundos, mejor puntuación, reinicio gestual.
- **P3 Robustez:** variantes de iluminación, oclusión, mano izquierda/derecha, diferentes tamaños de mano, interrupción de cámara, pérdida de target, rendimiento iOS/Android.
- **P4 Entrega:** limpieza, documentación, scripts Windows, despliegue HTTPS opcional, prueba de humo y tabla de criterios aprobados/no aprobados.

**No te detengas al crear el scaffold.** Si tienes acceso a terminal, instala dependencias, ejecuta el proyecto, corrige errores, realiza pruebas automatizables y documenta las pruebas manuales pendientes. Si una prueba requiere físicamente un iPhone que no controlas, **no afirmes haberla realizado**: proporciona enlace/instrucciones reproducibles y marca 'pendiente de validación manual'.

## 9. Entregables que espero de ti
1. Proyecto funcional con código y organización mantenible.
2. Instrucciones paso a paso para Windows 11 y lanzadores prácticos `setup.cmd` / `iniciar.cmd` cuando sean factibles.
3. Guía de uso en iPhone/Android, HTTPS y montaje de cámara; imagen o patrón imprimible si se usa seguimiento de imagen.
4. Modo diagnóstico para sensibilidad, puntos de mano, anclaje, FPS y latencia aproximada.
5. Pruebas y registro de lo que **sí** y **no** se verificó.
6. Lista de dependencias y licencias de activos externos.
7. Lista de limitaciones conocidas y próximos pasos priorizados.

## 10. Criterio de aceptación de producto
No consideres terminado el proyecto solo porque 'se ven gremlins'. Deben funcionar: **agarrar → cargar → lanzar → chocar → destruir → sumar combo → recibir peligro → terminar → reiniciar**, con la mano, en un móvil, usando cámara.

La diversión pesa tanto como la demostración técnica: debe haber un ciclo fácil de entender, margen para mejorar habilidad y al menos tres decisiones tácticas (a quién agarrar, dónde lanzarlo, cuándo cargarlo).

**Regla final:** ante ambigüedades menores decide tú, explica tus supuestos y avanza. No prometas APIs incompatibles. Prioriza juego completo, diversión, seguimiento fiable y rendimiento antes que adornos.
