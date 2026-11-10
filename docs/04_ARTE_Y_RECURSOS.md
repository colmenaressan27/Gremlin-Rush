# 04 — Dirección de arte, audio y kit de recursos

## Dirección artística
**Tema:** invasión de pequeños monstruos traviesos en una arena de laboratorio arcano/arcade sobre una mesa real. **Tono:** humor, caos, expresividad, personalidad, sin gore. **Look:** low-poly pulido / stylized 3D con materiales simples y siluetas fuertes, luces emissive medidas y VFX legibles. Más próximo a un juguete de mesa caótico que a horror realista.

## Paleta propuesta (identidad del juego, no marca personal)
| Rol | Color HEX | Uso |
|---|---|---|
| Noche tinta | `#14152B` | Base de arena y marcos |
| Verde gremlin | `#A5F02D` | Runner, capturable, energía positiva |
| Naranja caos | `#FF7D31` | Bomb, explosiones y peligro emergente |
| Violeta armadura | `#8062F2` | Tank, resistencias |
| Amarillo score | `#FFE15A` | Combos, multiplicadores |
| Blanco humo | `#F5F2ED` | Tipografía, contraste |
| Rojo alerta | `#F14F65` | Daño del núcleo / estado crítico |

**Tipografía:** grotesca redondeada contundente (licencia OFL o equivalente), excelente legibilidad móvil. No depender de una fuente cerrada.

## Personajes prioritarios (brief)
- **Runner:** cuerpo ovalado pequeño, patas cortas rápidas, ojos grandes, orejas asimétricas, silueta reconocible, verde. Animaciones: correr, mirar mano, ser agarrado, girar, choque, desaparecer.
- **Bomb:** redondo, naranja, detalles brillantes, mecha/medidor luminoso, expresiones nerviosas. Animaciones: balancearse, carga, explosión simpática en ráfaga de partículas.
- **Tank:** ancho, violeta, placas grandes, cuernos cortos, cejas firmes. Animaciones: caminar pesado, tambalearse, grietas en armadura, romperse en piezas.
- **Núcleo:** cristal central con tres segmentos evidentes de salud; cada impacto fragmenta un segmento y desata pulso rojo controlado.
- **Arena:** hexágono/círculo portátil, rutas visibles y portales de spawn, borde antidesbordamiento.

## Manifest de activos (todos aún POR PRODUCIR)
| ID | Activo | Tipo | Prioridad | Estado |
|---|---|---|---|---|
| A01 | Runner modelo optimizado y animaciones | 3D | P0 | Pendiente |
| A02 | Bomb modelo optimizado y animaciones | 3D | P1 | Pendiente |
| A03 | Tank modelo optimizado y animaciones | 3D | P1 | Pendiente |
| A04 | Núcleo y 3 estados de daño | 3D/VFX | P0 | Pendiente |
| A05 | Arena de mesa y portales | 3D | P0 | Pendiente |
| A06 | Efectos captura, carga, estela, impacto, explosión, combo | VFX | P1 | Pendiente |
| A07 | Indicadores de mano / captura / trayectoria | UI/VFX | P0 | Pendiente |
| A08 | Pantallas de inicio, calibración, resultado, tutorial | UI | P0 | Pendiente |
| A09 | Tipografía de licencia abierta | Fuente | P0 | Pendiente |
| A10 | SFX captura, carga, lanzamiento, golpes, combo, alarma y fin | Audio | P1 | Pendiente |
| A11 | Loop musical opcional energizante y corto | Audio | P2 | Pendiente |
| A12 | Patrón físico imprimible para seguimiento de imagen si procede | Imagen | P0 | Pendiente |
| A13 | Ícono/favicon y banner proyecto | Gráfico | P2 | Pendiente |

**Nota:** el kit es documental; NO incluye modelos, sonidos ni ilustraciones finales. El agente puede crear placeholders propios, pero no debe presentarlos como arte terminado.

## Composición visual y ergonomía
- La mano real ocupará parte de la pantalla; ubicar score/cronómetro en bordes seguros.
- No saturar la escena: enemigos claramente separados por forma, color y sonido.
- Cada tipo de enemigo debe ser reconocible sin depender solo del color.
- Efectos de explosión y rebote deben reforzar la trayectoria, no ocultarla.
- VFX de agarre deben indicar que la criatura fue capturada, incluso si queda parcialmente cubierta por los dedos.
- Adaptar HUD a diferentes proporciones y orientar de preferencia en paisaje/horizontal.

## Prompts creativos para el arte (solo briefs, no renders)
**Runner:** «Criatura gremlin arcade 3D original, verde lima, cuerpo ovalado, piernas pequeñas y veloces, ojos enormes expresivos, orejas irregulares, silueta legible en pantalla móvil, estilo juego indie low-poly premium, proporciones exageradas, apariencia simpática y traviesa, sin texto, turnaround conceptual, fondo neutro».

**Bomb:** «Gremlin esférico naranja original, ojos asustados pero divertidos, barriga luminosa con símbolo abstracto de explosión, mecha de energía sin fuego realista, diseño 3D estilizado, animación exagerada, legible a escala pequeña, fondo neutro, sin texto».

**Tank:** «Gremlin fortificado violeta, cuerpo grande y achatado, placas de armadura geométricas, expresión desafiante, patas cortas, grietas visibles como estados de daño, estética juguete 3D, silueta fuerte, fondo neutro, sin texto».

**Arena:** «Arena arcade en miniatura sobre mesa, hexagonal, núcleo central mágico luminoso, portales alrededor, laberinto sencillo con líneas de peligro, estética toy-like 3D futurista, materiales ligeros, iluminación dramática controlada, vista de tres cuartos, sin texto».

**Key art:** «Miniaturas originales de gremlins verdes, naranjas y violetas saltando sobre una arena holográfica encima de una mesa real, una mano humana atrapando un gremlin con pulgar e índice y lanzándolo contra otros, sensación de movimiento y reacción en cadena, estética videojuego arcade premium, sin logos, sin letras».

## Sonido
- SFX nítidos, cortos, caricaturescos y distintos según acción; volúmenes controlados.
- Un combo de tres golpes debe ser más satisfactorio que tres sonidos aislados (subida musical breve).
- Música opcional, nunca requisito para entender qué ocurre.
- Evitar sonidos descargados sin licencia o música de juegos comerciales.
