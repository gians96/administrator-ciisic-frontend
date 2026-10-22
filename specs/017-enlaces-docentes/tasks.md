# Tasks: enlace público por docente y rediseño de Reportes (spec 017)

- [x] T001 Tipos (`EnlaceAsesor`, `VistaDocente`, `ConteosSituacion`), meta de página `publica` y salto del middleware de sesión
- [x] T002 `app/utils/enlacesDocentes.ts` (URL con el token tras el `#`, estado, «hace cuánto», mensaje para el docente, WhatsApp) y `app/utils/seguimientoDocente.ts` (filtros y contadores)
- [x] T003 BFF público sin sesión: `server/api/publico/seguimiento/index.post.ts` y `export.post.ts` con `server/utils/enlace-publico.ts` (token a `X-Link-Token`, IP real, errores propagados)
- [x] T004 Página pública `app/pages/seguimiento.vue` (móvil primero, refresco cada minuto, estados de enlace inválido y de error)
- [x] T005 Componentes: `AppMenu` y `AppMenuItem` (API `popover`), `KpiReporte`, `FiltroSituacion` y `EnlacesDocentes`
- [x] T006 Rediseño de `app/pages/reportes.vue` (encabezado con menús, etiquetas de filtros, indicadores clicables, esqueletos, tarjetas en el celular, columna de enlace en «Por asesor»)
- [x] T007 Pruebas Vitest (`enlacesDocentes`, `seguimientoDocente`, `enlacePublicoBff`) y documentación
- [x] T008 Probado en el navegador contra el backend local: crear enlaces, vista del docente sin sesión (390 px y 820 px), enlace inválido, menús y diálogo, sin desborde a 1311 px
- [ ] T009 Producción: tras desplegar el backend 026, crear los enlaces desde Reportes y enviarlos; probar un enlace real en el celular de un docente
