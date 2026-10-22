# Tasks: Ponencias especializadas solo para congresistas con pago aprobado (panel)

- [x] T001 `app/utils/ponenciasEspecializadas.ts`: cupo por modo (`presenciales`, `textoCupo`, `tonoCupo`), `etiquetaValidacion`, `etiquetaModo`, `textoCambioAcceso`, filtros `validacion` y `modo`, mensajes de la puerta (virtual y errores del congreso) con pruebas
- [x] T002 Mensajes de los códigos `CONGRESS_*` en `app/utils/errores.ts`
- [x] T003 `composables/useAccesoPonencias.ts` y componentes `AccesoPonenciasCard` / `AvisoAccesoLibre`
- [x] T004 Programa: tarjeta del interruptor, totales y cupo por modo
- [x] T005 Inscripciones: columna «Congreso», filtros de validación y modo, contador «sin validar» y franja de acceso libre
- [x] T006 Alta manual y puerta: textos según el acceso libre, contadores presencial/virtual y aviso del congresista virtual
- [x] T007 `docs/overview.md` y AGENTS.md
- [ ] T008 Prueba en el navegador contra el backend 030 local (interruptor, congresista presencial y virtual, no inscrito, pago pendiente, filtros)
- [ ] T009 Producción: desplegar tras el backend 030 y decidir si el acceso libre queda encendido durante la transición
