# Feature Specification: DNI y secciones editables del docente, y página común de consulta

**Created**: 2026-10-22 · **Status**: Implementado · **Contrato**: `backend-ciisic/specs/028-docentes-dni/contracts/api-docentes-dni.md`

**Input**: los docentes (asesores) solo existían por el Excel de la facultad, sin DNI y sin poder corregir su ciclo o sección sin recargar el Excel (que
reemplazaba todo). Se pidió, en Reportes: (1) poner el **DNI** de cada docente; (2) **quitar o agregar** sus ciclos y secciones (y agregar, eliminar y renombrar docentes);
(3) **una página única** donde cada docente escribe su DNI y ve el filtro de *sus* ciclos y secciones y a sus estudiantes que pagaron o no; (4) al recargar el Excel, **conservar lo editado**.

## Decisiones

- **Página común `/docentes`** = *alias* de `/seguimiento` (`definePageMeta({ alias })`) con un tercer modo (`tipoDeSeguimiento` → `'documento'`): primero «Escribe tu DNI» y luego la misma vista del
  docente (avance, secciones, situación, búsqueda, tabla/tarjetas, Excel/PDF). El DNI **solo vive en memoria** (ni URL, ni `localStorage`, ni registros); «Salir» lo olvida. Un DNI desconocido o mal escrito
  muestra el mismo aviso; los intentos fallidos los topa el backend por IP. Los enlaces personales (spec 017) y de ciclo (018) **no cambian**.
- **BFF** (`server/utils/enlace-publico.ts`): `credencialDeCuerpo` lee del cuerpo `{ tipo, token | documento }` y `peticionAlBackend` arma la petición: el token va en `X-Link-Token` (`GET`), el DNI en el **cuerpo** de un `POST` a
  `public/advisor/lookup` (y `/export`); nunca en una URL. Una sola implementación sirve a la vista y a la descarga.
- **Filtro de ciclos y secciones del docente** (en ambas vistas, `/seguimiento` y `/docentes`): chips de **ciclo** (si atiende a más de uno) y, debajo, las **secciones del ciclo elegido**; los indicadores y la lista siguen al filtro.
- **Reportes → Por asesor** (con `reportes.gestionar`): bajo cada nombre, `DNI 12345678` o «Sin DNI»; **Editar** abre `AsesorEditar` (nombre, DNI y casillas de ciclos y secciones del padrón, con «Marcar todas» por ciclo y el resumen de lo que se agrega y quita) y **Agregar docente**;
  **Eliminar** pide confirmación. El catálogo de secciones es el del padrón (las que el docente ya tenía y el padrón ya no trae se muestran para poder quitarlas).
- **Enlaces públicos → Docentes**: bloque «Página única para los docentes» con la dirección `…/docentes`, «Copiar», «Copiar mensaje» (`mensajeParaDocentesDni`), «Abrir» y el conteo «N de M docentes tienen DNI»; cada docente sin DNI lleva la etiqueta «Sin DNI».
- **Recargar el padrón** (`PadronImportar`): si ya hay docentes, elegir «Conservarlos (recomendado)» o «Reemplazarlos por los de la hoja RESUMEN» (envía `asesores`); la revisión indica «los actuales» cuando se conservan.
- **Riesgo asumido y dicho**: entrar solo con el DNI es más débil que el token de un enlace (el DNI es conocido); se mitiga con el tope de intentos del backend y con que quitar el DNI cierra el acceso a ese docente.

## User Scenarios & Testing

### User Story 1 - Mantengo a los docentes (Priority: P1)

1. **Given** soy Owner o Administrador, **When** abro Por asesor → Editar, **Then** pongo el DNI, quito o agrego ciclos y secciones y guardo; el resumen y los indicadores reflejan el cambio.
2. **When** agrego un docente nuevo o elimino uno (con confirmación), **Then** aparece o desaparece de Reportes y de los enlaces.
3. **When** recargo el Excel y dejo «Conservarlos», **Then** los docentes, sus DNI y secciones quedan como estaban.

### User Story 2 - El docente entra con su DNI (Priority: P1)

1. **Given** el docente abre `/docentes` y escribe su DNI registrado, **Then** ve sus ciclos y secciones, quién pagó y quién no, puede buscar y descargar Excel o PDF.
2. **When** escribe un DNI inexistente, **Then** ve «No encontramos un docente con ese DNI» y puede reintentar; **When** pulsa «Salir», **Then** vuelve al formulario y el DNI se olvida.

## Requirements

- **FR-001**: `/docentes` no exige sesión (`meta.publica`, compartida con `/seguimiento`).
- **FR-002**: `POST /api/publico/seguimiento` y `…/export` aceptan `tipo: 'documento'` con `documento` (7 u 8 dígitos); cualquier otro valor es el mismo `404`; el DNI se reenvía por `POST`, nunca en la URL.
- **FR-003**: el formulario y los editores de docentes son solo de `reportes.gestionar`; el DNI de los docentes no se pide ni se muestra sin ese permiso.
- **FR-004**: el filtro de ciclo y sección aplica a los indicadores y a la lista del docente en `/seguimiento` y `/docentes`.

## Success Criteria

- **SC-001**: `bun run lint`, `bun run typecheck` y `bun run test` en verde.
- **SC-002**: en el navegador, contra el backend local: poner un DNI y agregar una sección desde Reportes; entrar sin sesión a `/docentes` con ese DNI (ciclos y secciones filtran, Excel descarga sin credenciales); un DNI inexistente da el aviso; el diálogo de enlaces muestra la página única y el de recarga la opción de docentes.
