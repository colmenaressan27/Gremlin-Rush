# GREMLIN RUSH — Kit de preproducción para Claude Code y Codex

**Versión:** 1.0 · **Fecha:** 10 de noviembre de 2026 · **Idioma:** español

## Estado de la implementación (10 nov 2026)
La **fase P0** está implementada: cámara, detección de mano, arena superpuesta y una prueba jugable de atrapar y lanzar gremlins. **Falta validarla en un teléfono real.**

- Instalar y arrancar: `setup.cmd` y luego `iniciar.cmd` → guía en `docs/11_GUIA_DE_USO.md`.
- Qué se verificó, qué no, y la prueba de 15 minutos en el móvil: `docs/10_P0_FACTIBILIDAD.md`.
- Biblia de arte y sensaciones: `JUEGO.md`.

El resto de este documento describe el kit original de preproducción.

## Qué es
Un kit **sin código de videojuego** para encargar la implementación de *Gremlin Rush*, un juego arcade WebAR controlado con las manos. El usuario no tiene que programarlo manualmente: entrega este paquete a Claude Code o Codex, y el agente deberá escribir, instalar, probar y documentar el proyecto.

## Premisa
Una invasión de gremlins aparece en una arena virtual anclada a una mesa. Con una mano, el jugador **pellizca para atrapar**, **mantiene para cargar** y **suelta con un movimiento para lanzar** enemigos contra otros enemigos. Se puntúa por cadenas, rebotes, explosiones y supervivencia. La primera experiencia debe ser divertida en 90 segundos y rejugable.

## Condiciones no negociables
- Juego **web**, móvil primero, iPhone/Safari y Android/Chrome, sin aplicación nativa.
- **Sin controles táctiles en la partida**: no joystick ni botones de ataque, apuntado o movimiento. Los permisos del navegador y los ajustes previos de accesibilidad son excepciones del sistema, no mecánicas jugables.
- Mano detectada por cámara; no requiere dispositivos especiales, mandos ni guantes.
- **Una mano** como diseño base; móvil **apoyado en soporte** apuntando a una mesa. Dos manos: ampliación opcional.
- Primera versión con arena **2.5D** (visualmente 3D, interacciones sobre un plano), no prometer colisiones 3D milimétricas.
- Presupuesto objetivo: cero servicios de pago; todos los recursos con licencias verificables.
- Privacidad: procesamiento local de cámara por defecto; no guardar ni subir video; sin login.
- Función real > demo visual: el juego debe ser completado de principio a fin.

## Contenido del paquete
| Archivo | Uso |
|---|---|
| `PROMPT_MAESTRO.md` | Pegar íntegro a Claude Code o Codex: especificación y ejecución delegada |
| `AGENTS.md` | Normas comunes para agentes programadores |
| `CLAUDE.md` | Contexto directo de Claude Code |
| `docs/01_GDD.md` | Game Design Document: mecánicas, balance y experiencia |
| `docs/02_CONTROLES_MANOS.md` | Especificación funcional del seguimiento gestual |
| `docs/03_TECNICA_Y_RIESGOS.md` | Arquitectura deseada, factibilidad, decisiones abiertas |
| `docs/04_ARTE_Y_RECURSOS.md` | Dirección artística, lista de recursos, prompts creativos |
| `docs/05_ROADMAP.md` | Etapas, entregables y prioridades |
| `docs/06_QA_Y_ACEPTACION.md` | Criterios de calidad, checklist de prueba y fallos |
| `docs/07_PLAYTEST.md` | Hoja de pruebas de diversión y seguimiento |
| `docs/08_REFERENCIAS.md` | Documentación verificable y enlaces de investigación |
| `docs/09_PROMPTS_DE_SEGUIMIENTO.md` | Mensajes para continuar, auditar o corregir con IA |

## Cómo entregarlo al agente
1. Descomprime el ZIP en una **carpeta nueva y vacía** de tu PC con Windows 11.
2. Abre esa carpeta como proyecto en Claude Code o Codex. El agente puede empezar leyendo `PROMPT_MAESTRO.md` y `AGENTS.md`.
3. Dile: **«Lee PROMPT_MAESTRO.md y ejecuta el plan por fases. No te quedes en un mockup: necesito una versión jugable y probada».**
4. El agente deberá crear el código y, cuando sea apropiado, los lanzadores `setup.cmd` e `iniciar.cmd` para Windows 11.
5. Valida en iPhone real. Ver una demo en PC **no** confirma que funcione bien en Safari móvil.

## Lo que NO contiene
- Código de implementación, dependencias instaladas, modelos finales, sonidos finales ni garantía de compatibilidad.
- La documentación define **qué construir**, no pretende fingir que ya existe un producto funcional.

## Definición del primer éxito
Una persona que nunca vio Gremlin Rush puede entrar desde un enlace HTTPS, autorizar cámara, calibrar una mano, superar una partida de 90 segundos, entender por qué perdió o ganó, y pedir volver a jugar. Sin tocar controles durante la partida.
