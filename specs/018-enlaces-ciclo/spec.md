# Feature Specification: Enlace público por ciclo

**Created**: 2026-10-22 · **Status**: Implementado · **Contrato**: `backend-ciisic/specs/027-enlaces-ciclo/contracts/api-enlaces-ciclo.md`

**Input**: además del enlace de cada docente (spec 017), la organización necesita compartir el avance de **todo un ciclo** (todas sus
secciones y docentes) con quien lo coordina, sin darle una cuenta ni un Excel: «otro enlace que sea solo por ciclo».

## Decisiones

- **Misma página, otra ruta**: `/seguimiento/ciclo#<token>` es un *alias* de `/seguimiento` (`definePageMeta({ alias })`); la página decide la vista
  por su ruta (`tipoDeSeguimiento`). El enlace del docente (`/seguimiento#<token>`) no cambia: los ya entregados siguen valiendo. El token va tras
  el `#`, como en la 017.
- **El BFF recibe `tipo`** (`asesor` por defecto, o `ciclo`) y reenvía a `public/advisor` o `public/cycle` (`RUTA_BACKEND`); otro valor es `422`. Un
  token de docente no abre un ciclo ni al revés (el backend lo resuelve por tabla): `404 LINK_NOT_FOUND`.
- **Vista del ciclo**: encabezado «Seguimiento del ciclo · Ciclo VI · N secciones», avance, **tarjetas de sección** (porcentaje, barra, «x de y
  pagaron» y el **docente de cada sección**; pulsar una filtra la lista) en lugar de los botones del docente, filtro de situación con
  contadores, búsqueda y lista. **Sin columna de celular** (el backend no lo envía: la lista llega a más gente que al docente) ni DNI, correo o montos.
- **Gestión**: `Padrón y enlaces → Enlaces públicos` abre un diálogo con dos pestañas, **Docentes** y **Ciclos** (crear los que faltan, copiar el
  enlace, copiar un mensaje, abrir, renovar y desactivar con confirmación); `reportes.gestionar`. La nueva pestaña **Por ciclo** de Reportes
  muestra cada ciclo con sus indicadores, sus secciones, el estado de su enlace, «Alumnos», «Enlace» (crea y copia en un clic) y «Descargar» (su
  Excel o PDF interno completo, con los filtros ignorados).
- **«Por ciclo y sección» pasa a «Por sección»** para no confundirse con «Por ciclo».
- El diálogo usa pestañas propias (no `AppTabs`): `AppTabs` pone ids `tab-<id>` que chocarían con los de la pantalla Reportes, que sigue abierta detrás.

## User Scenarios & Testing

### User Story 1 - Entrego el enlace de un ciclo (Priority: P1)

1. **Given** el padrón está cargado, **When** abro «Padrón y enlaces → Enlaces públicos → Ciclos» y pulso «Crear los N que faltan», **Then** cada ciclo tiene enlace.
2. **When** pulso «Enlace» en la fila de un ciclo de «Por ciclo», **Then** se copia su enlace (se crea antes si no existía).
3. **When** renuevo o desactivo un enlace, **Then** el anterior deja de funcionar al instante.

### User Story 2 - Veo cómo va un ciclo (Priority: P1)

1. **Given** abro el enlace del ciclo, **Then** veo el avance del ciclo y de cada sección con su docente, y la lista de estudiantes, sin iniciar sesión.
2. **When** pulso una sección, **Then** el avance y la lista se limitan a ella; «Ver todo el ciclo» vuelve.
3. **When** descargo el reporte, **Then** recibo Excel o PDF sin DNI, correo ni celular.

## Requirements

- **FR-001**: `/seguimiento/ciclo` no exige sesión (`meta.publica`, compartida con `/seguimiento`).
- **FR-002**: `POST /api/publico/seguimiento` y `…/export` aceptan `tipo` (`asesor` | `ciclo`), validan el token y el tipo antes de llamar al backend y propagan errores como en la 017.
- **FR-003**: la vista del ciclo no muestra celular, DNI, correo ni montos (no los recibe).
- **FR-004**: los enlaces de ciclo se administran solo con `reportes.gestionar`.

## Success Criteria

- **SC-001**: `bun run lint`, `bun run typecheck` y `bun run test` en verde.
- **SC-002**: en el navegador, sin sesión, el enlace de un ciclo abre solo a ese ciclo en 375 px y en pantalla ancha, sin desborde; el enlace de un docente sigue funcionando; las descargas Excel y PDF funcionan sin sesión.
