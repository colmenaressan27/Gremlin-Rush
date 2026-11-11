# 11 — Guía de instalación y uso (Windows 11 + móvil)

No hace falta programar ni tener un Mac. Todo lo que se instala es gratuito.

## 1. Instalar en Windows 11 (una sola vez)

1. Abre la carpeta del proyecto en el Explorador de archivos.
2. Doble clic en **`setup.cmd`**.
   - Si no tienes Node.js, lo instala con `winget` y te pide cerrar la ventana y volver a ejecutar `setup.cmd`.
   - Después instala las dependencias y descarga el modelo de detección de manos (unos 8 MB). Necesita Internet solo esta vez.
3. Cuando diga «Instalación completa», ya está.

Requisito: Node.js 22 o superior (el script lo comprueba).

## 2. Arrancar el juego

Doble clic en **`iniciar.cmd`**. Se abre una ventana con dos direcciones:

- **Local** (`https://localhost:8443/`): para abrir el juego en este PC.
- **Network** (`https://192.168.x.x:8443/`): para abrirlo en el móvil.

Deja esa ventana abierta mientras juegas. Para parar: `Ctrl + C` o cierra la ventana.

La primera vez, Windows puede preguntar por el Firewall: permite **Node.js** en **redes privadas**. Sin eso el móvil no puede conectarse.

## 3. Abrirlo en el móvil

1. PC y móvil en la **misma Wi-Fi**.
2. Escribe en el navegador del móvil la dirección **Network** completa, empezando por `https://`.
3. Aparece un aviso de certificado. Es normal: el certificado lo genera tu propio PC y ninguna autoridad lo conoce.
   - **iPhone (Safari):** «Mostrar detalles» → «visitar este sitio web» → confirmar.
   - **Android (Chrome):** «Configuración avanzada» → «Acceder a … (no seguro)».
4. Pulsa **Activar cámara** y acepta el permiso.

> Pendiente de validación manual: este acceso por certificado local está comprobado con Chrome de escritorio, no todavía con un iPhone ni un Android reales.

### Plan B si el certificado local da problemas: túnel HTTPS gratuito

Esto hace que la **página** del juego sea accesible desde Internet mientras el túnel esté abierto (el vídeo de la cámara sigue sin salir del móvil). Úsalo solo si estás de acuerdo con eso.

1. Instala la herramienta una vez, en una terminal: `winget install -e --id Cloudflare.cloudflared`
2. En una terminal dentro de la carpeta del proyecto: `npm run dev:tunel`
3. En otra terminal: `cloudflared tunnel --url http://localhost:5190`
4. Abre en el móvil la dirección `https://….trycloudflare.com` que muestra la segunda terminal. No hay aviso de certificado ni hace falta cuenta.

## 4. Montaje físico recomendado

- Móvil en un **soporte estable**, en **horizontal**, cámara trasera mirando a la mesa en diagonal (unos 45°), a 30–40 cm de la superficie.
- Te sientas detrás del móvil, viendo la pantalla, y metes **una mano** en la imagen por un lado o por debajo.
- Luz uniforme y abundante. Evita una ventana o lámpara justo detrás de la mesa (contraluz).
- Mesa despejada. Mejor una superficie que contraste con tu piel.
- La mano debe verse entera, con el pulgar y el índice visibles para la cámara.

Esta postura es una recomendación de partida **sin validar todavía**. Si resulta incómoda, prueba la cámara frontal (Ajustes → Cámara → Frontal) con el móvil mirando hacia ti.

## 5. Cómo se juega

**Objetivo:** que el núcleo del centro aguante 90 segundos. Los gremlins salen de los portales naranjas y corren hacia él; cada uno que lo toca le quita una de sus tres vidas. Para eliminarlos, atrapa uno y lánzalo contra otro: caen los dos y sumas puntos. Si con un lanzamiento golpeas a varios, cada golpe vale más.

La primera vez hay una **práctica** sin reloj ni peligro: termina cuando consigues tu primer golpe. Si quitas la mano más de unos segundos en pleno combate, la partida se pausa sola y sigue cuando la mano vuelve.

| Quieres… | Haz… |
|---|---|
| Empezar o repetir | Palma abierta y quieta sobre el núcleo hasta que se llene el anillo |
| Atrapar | Acerca la mano a un gremlin (se marca con un anillo amarillo) y junta pulgar e índice |
| Cargar | Mantén el pellizco; el anillo crece y cambia de blanco a naranja |
| Lanzar | Mueve la mano hacia el objetivo y abre los dedos **durante** el movimiento; la flecha amarilla indica hacia dónde saldrá |
| Soltar sin lanzar | Abre los dedos con la mano quieta |

La pantalla solo se toca antes de jugar: para dar permiso, cambiar ajustes y colocar la arena.

**Ajustes disponibles** (pantalla inicial): cámara trasera/frontal, sensibilidad del pellizco, invertir espejo, reducir efectos, sonido y diagnóstico. **Ajustar arena** (pantalla de preparación): tamaño, posición e inclinación. Todo se guarda solo en ese dispositivo.

**Privacidad:** el vídeo se analiza dentro del navegador del móvil. No se graba, no se envía a ningún servidor y no hay cuentas ni analíticas. Para apagar la cámara: botón «Ajustes» (antes o después de una ronda) o cierra la pestaña.

## 6. Si algo falla

| Síntoma | Qué hacer |
|---|---|
| El móvil no carga la página | Si el PC cambió de Wi-Fi desde que abriste `iniciar.cmd`, la dirección «Network» ya no vale: cierra la ventana y ábrela de nuevo. Además: misma Wi-Fi; dirección con `https://` y `:8443`; permite Node.js en el Firewall; algunas redes de invitados bloquean la conexión entre dispositivos |
| «Sin permiso de cámara» | Sigue los pasos de la pantalla y pulsa «Reintentar» |
| «Hace falta una conexión segura» | Abriste `http://`; usa la dirección `https://` |
| La mano se mueve al revés | Ajustes → Invertir espejo |
| Cuesta atrapar | Ajustes → sube la sensibilidad; mejora la luz; acerca la mano a la cámara |
| Se lanza sin querer | Baja la sensibilidad y avísame con la línea «Último» del diagnóstico |
| «No se pudo cargar el detector de mano» | Ejecuta `setup.cmd` otra vez (faltó la descarga del modelo) |
| Va a tirones | Activa el diagnóstico y anota FPS y Visión; prueba añadiendo `?delegate=cpu` a la dirección |

## 7. Comandos para quien quiera revisar el proyecto

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor local sin HTTPS (`http://localhost:5190`), solo para este PC |
| `npm run dev:movil` | Lo mismo que `iniciar.cmd` |
| `npm test` | Pruebas unitarias |
| `npm run smoke` | Prueba de humo automática en Chrome (cámara falsa + mano simulada); capturas en `qa-artifacts/` |
| `npm run build` | Versión estática en `dist/`, lista para un alojamiento gratuito con HTTPS (se documentará en P4) |

Parámetros de dirección útiles: `?diag=1` (diagnóstico), `?delegate=cpu` (detección sin GPU), `?sim=1` (solo desarrollo: el ratón hace de mano; botón izquierdo = pellizco, botón derecho o tecla O = palma abierta).

## 8. Dependencias y licencias

| Paquete | Uso | Licencia |
|---|---|---|
| three 0.187 | Render 3D | MIT |
| @mediapipe/tasks-vision 1.2 | Detección de mano (runtime WASM) | Apache-2.0 |
| Modelo `hand_landmarker.task` (Google) | Modelo de 21 puntos de la mano | Apache-2.0 |
| @fontsource-variable/fredoka | Tipografía Fredoka | OFL-1.1 |
| vite 8, vitest 5 | Servidor de desarrollo, compilación y pruebas | MIT |
| typescript 7 | Comprobación de tipos | Apache-2.0 |
| @vitejs/plugin-basic-ssl | Certificado local para HTTPS | MIT |
| playwright-core | Prueba de humo (usa el Chrome ya instalado) | Apache-2.0 |

No hay modelos 3D, imágenes, sonidos ni música de terceros: las figuras son geometría generada por código y los sonidos se sintetizan en el navegador. Ningún servicio de pago, clave ni cuenta.
