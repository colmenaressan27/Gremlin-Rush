# 08 — Fuentes técnicas y políticas de verificación

Documentación consultada para preparar el kit (10 nov 2026). El agente debe volver a comprobar compatibilidad y versiones antes de instalar.

1. **Google AI Edge — MediaPipe Hand Landmarker (guía web).** Detección por imagen/vídeo con 21 landmarks, coordenadas y lateralidad; nota sobre bloqueo de hilo principal y uso de workers:  
   https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js
2. **Google AI Edge — Hand Landmarker overview.** Alcance real del detector y variables de confianza:  
   https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker
3. **Google AI Edge — Gesture Recognizer (Web).** Gestos reconocidos de fábrica y landmarks; no reemplaza los estados de agarre personalizados:  
   https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js
4. **MindAR — repositorio oficial.** Seguimiento de imagen y rostro, integración WebAR:  
   https://github.com/hiukim/mind-ar-js
5. **MindAR — documentación instalación Three.js.** Opciones del bundle y dependencia de Three.js:  
   https://github.com/hiukim/mind-ar-js-doc/blob/master/docs/installation.md
6. **MDN — MediaDevices.getUserMedia().** Orígenes seguros, acceso a cámara y permisos:  
   https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
7. **MindAR — reporte de incompatibilidad en dispositivo/versiones de iOS específicos.** Ejemplo de por qué hay que probar y tener fallback, no prueba de que falle universalmente:  
   https://github.com/hiukim/mind-ar-js/issues/581

## Principios derivados de fuentes
- No confundir landmarks 3D de la mano con rastreo del entorno físico en profundidad.
- No prometer que combinar dos bibliotecas de visión complejas dará 60 FPS en todos los dispositivos.
- Probar Safari real antes de elegir librerías definitivas.
- Usar cámara con permiso explícito y entorno HTTPS adecuado.
- Mantener el proyecto sin dependencia fuerte de un único proveedor de anclaje.
