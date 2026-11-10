# 03 — Arquitectura técnica y riesgos (sin código)

## Principio
No convertir un juego rápido en un experimento de integración permanente. **Primero prueba la viabilidad de cámara + mano + arena simultáneas en un móvil.** La elección final de librerías le corresponde a Claude Code o Codex basándose en pruebas.

## Pila sugerida, no obligatoria
| Capa | Opción inicial | Decisión exigida al agente |
|---|---|---|
| Proyecto web | Vite + TypeScript | Versiones compatibles y facilidad de ejecutar en Windows |
| Escena 3D | Three.js | Calidad vs rendimiento móvil |
| Hand tracking | MediaPipe Hand Landmarker | Carga, latencia, CPU/GPU, precisión en iOS Safari |
| AR de imagen | MindAR con integración Three.js | Compatibilidad iOS real y coexistencia con MediaPipe |
| Colisiones / movimiento | Física ligera con motor como Rapier o solución propia 2D/2.5D | No introducir motor pesado innecesario |
| Audio | Web Audio API / librería ligera | Restricciones de inicio de audio móvil |
| Publicación | Host estático con HTTPS | Cuenta gratis, dominio de prueba y permisos del usuario |

## Factibilidad y límites
- **MediaPipe Hand Landmarker** detecta 21 landmarks por mano y proporciona coordenadas de imagen y de referencia de mano; no es un sensor de profundidad ambiental infalible. Las interacciones deben ser asistidas, no colisiones físicas exactas dedo-malla.
- **MindAR** ofrece seguimiento de imágenes y versiones integradas con Three.js, pero puede competir por GPU/CPU con MediaPipe. Es imprescindible validación combinada y plan alternativo. No asumir soporte perfecto en todas las versiones de iOS.
- **HTTPS** es necesario normalmente para acceder a cámara desde móvil; localhost es una excepción para desarrollo local. Permiso explícito del navegador es ineludible.
- **WebXR inmersivo** no debe ser dependencia base de Safari iPhone; usar cámara web y renderización overlay/anclaje por imagen.
- Sin soporte estable de marcador, un modo 'cámara + arena superpuesta' puede mantener una demo jugable; debe distinguirse de la arena anclada al mundo.

## Arquitectura por responsabilidades
- Acceso a cámara y ciclo de permisos.
- Detección landmarks (solo visión; no reglas de juego).
- Interpretador gestual con máquina de estados y diagnóstico.
- Proyección imagen → plano arena 2.5D; manejo de espejo y orientación.
- Seguimiento/anclaje AR (capaz de activar fallback).
- Interacciones de agarrar / cargar / lanzar / impacto.
- Estado del juego: oleadas, IA enemiga, núcleo, puntuación, combos, partida.
- Render y efectos visuales.
- Sonido.
- Interfaz mínima e instrucciones.
- Pruebas, métricas locales no personales y herramientas de diagnóstico.

## Riesgos prioritarios y mitigaciones
| Riesgo | Impacto | Mitigación |
|---|---|---|
| MediaPipe y MindAR saturan GPU | Caída de FPS / retraso | Prototipo combinado; reducir resolución, frecuencia y efectos; probar otros anclajes |
| Safari o nueva versión de iOS rompe shaders/compatibilidad | Bloqueo | No fijar diseño a una sola librería; fallback claramente etiquetado y pruebas reales |
| Mano oculta marcador o enemigos | Pérdidas de tracking | Marcador amplio fuera del centro de interacción; persistencia temporal prudente |
| Cámara trasera y mano tienen encuadre incómodo | Juego cansado o inviable | Ergonomía probada, soporte estable, campo de alcance calibrado |
| Detección inestable de pellizco | Frustración | Histéresis, filtrado, generosos radios de captura y sonido/contorno |
| Latencia de movimiento | Lanzamientos impredecibles | Ventana temporal de velocidad, interpolación, medición |
| Distancia Z ambigua | Objetos no se pueden coger de verdad | Proyección 2.5D sin prometer contacto 3D absoluto |
| Audio no se activa | Experiencia muda | Respeta políticas de activación de audio del navegador; fallback visual |
| Baja iluminación / contraluz | Tracking perdido | Calibración, instrucciones prácticas, auto-pausa segura |
| Inicio/reinicio sin botones | Menú frustrante | Gesto simple en zona exclusiva, tiempo de confirmación y alternativa accesible previa |

## Decisión P0 (gate técnico)
**Antes de modelar enemigos complejos**, exigir evidencia de:
1. Cámara activa en dispositivo móvil, en origen HTTPS.
2. Una mano detectada y cursor visible fluido.
3. Un objeto elegible se captura, sigue y se lanza de manera reproducible.
4. Arena se mantiene anclada a un target de imagen si se elige MindAR.
5. Combinación no degrada por debajo del umbral de experiencia aceptable. Registrar FPS aproximados y limitaciones.

Si falla la condición 4/5: reducir carga visual, probar anclaje alternativo o usar overlay explícito. **No bloquear todo el juego por perseguir anclaje perfecto**.

## Requisitos de desarrollo
- PC Windows 11 para desarrollo y servidor local; no se necesita Mac para crear una web.
- Móvil real para test (Safari iOS y Chrome Android), soporte estable y buena iluminación.
- Scripts `setup.cmd` y `iniciar.cmd` como comodidad, creados por el agente después de verificar dependencias reales.
- Servidor público temporal o despliegue gratuito con HTTPS para pruebas móviles, con permiso del propietario cuando precise acceso externo.

## Privacidad, seguridad y accesibilidad
- Vídeo y landmarks procesados localmente, sin subirlos ni retenerlos; no analíticas de terceros por defecto.
- Mostrar claramente cuándo la cámara está activa y cómo detenerla.
- Respetar permisos y suspender vídeo cuando la página se cierra o pierde acceso.
- Modo de contraste alto, tamaño legible, reducción de flashes/partículas y sensibilidad calibrable **antes** de la partida.
- Las condiciones de iluminación y postura forman parte de la guía, no deben atribuirse al jugador como fallos de habilidad.
