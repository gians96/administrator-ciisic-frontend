# Feature Specification: Enlace público por docente y rediseño de Reportes

**Created**: 2026-10-22 · **Status**: Implementado · **Contrato**: `backend-ciisic/specs/026-enlaces-docentes/contracts/api-enlaces-docentes.md`

**Input**: (1) cada docente debe poder ver por sí mismo cómo van los pagos de sus estudiantes, sin cuenta; (2) la pantalla Reportes
(spec 016) tenía defectos de uso: el indicador «Recaudado» se desbordaba y quedaba cortado, la página se ensanchaba por los textos
ocultos de las tablas, el filtro de situación era una lista sin contadores, las acciones por docente eran tres botones sueltos y la
lista de alumnos no se podía usar en un celular.

## Decisiones

- **Página pública en el panel** (`/seguimiento`, layout `blank`, `definePageMeta({ publica: true })`): el middleware no pide ni carga
  la sesión. La landing no se toca (su `main` despliega a producción y es otro repo); el panel ya tiene el diseño y el BFF.
- **El token va tras el `#`**: `<origen del panel>/seguimiento#<token>`. El navegador no envía el fragmento ni en la petición ni en
  `Referer`; la página lo lee de `location.hash` y lo manda por `POST /api/publico/seguimiento` al BFF, que lo reenvía al backend en
  `X-Link-Token` (con la IP real del visitante, como el login). El token nunca queda en la URL de una petición ni en registros.
  La página declara `robots: noindex` y `referrer: no-referrer`.
- **Todo se filtra en el navegador**: un docente tiene unas decenas de estudiantes; el backend los envía todos y la sección, la situación
  y la búsqueda no hacen más consultas. Se refresca sola cada minuto (solo con la pestaña visible) y al volver a ella.
- **Gestión de enlaces solo con `reportes.gestionar`**: «Padrón y enlaces → Enlaces de los docentes» (crear los que faltan, copiar el
  enlace, copiar un mensaje listo para WhatsApp, abrir como lo verá el docente, renovar y desactivar con confirmación) y, en la pestaña
  «Por asesor», el botón «Enlace» (copia el enlace y, si el docente no tiene, lo crea antes: un solo clic).
- **Menús con la API `popover`** (`AppMenu`): se dibujan en la capa superior del navegador, así que no los recortan las tablas con
  desplazamiento ni quedan detrás de un diálogo, y se cierran solos con un clic fuera o con Esc.
- **Rediseño de Reportes**: encabezado con «Actualizar», «Descargar ▾» y «Padrón y enlaces ▾»; filtros con etiquetas que se quitan una
  a una; tarjeta de avance con el porcentaje y los indicadores **clicables** (llevan a la lista filtrada); filtro de situación con
  contadores; esqueletos de carga; listado en tarjetas en el celular; WhatsApp en el celular de cada alumno; turnos con nombre.

## User Scenarios & Testing

### User Story 1 - Envío su enlace a cada docente (Priority: P1)

1. **Given** soy Owner o Administrador y el padrón está cargado, **When** abro «Padrón y enlaces → Enlaces de los docentes» y pulso «Crear los N
   que faltan», **Then** cada docente tiene su enlace.
2. **When** pulso «Copiar mensaje», **Then** copio un texto con su enlace, listo para pegar en WhatsApp o en el correo.
3. **When** renuevo o desactivo un enlace (con confirmación), **Then** el anterior deja de funcionar al instante.

### User Story 2 - El docente ve cómo van sus estudiantes (Priority: P1)

1. **Given** el docente abre su enlace en el celular, **Then** ve su nombre, el porcentaje que pagó, y la lista con la situación y el celular
   (con enlace a WhatsApp) de cada estudiante, sin iniciar sesión.
2. **When** filtra por sección, situación o busca por nombre o código, **Then** la lista y los contadores responden al instante.
3. **When** descarga Excel o PDF, **Then** recibe su reporte sin DNI, correo ni montos.
4. **Given** el enlace está desactivado, es incorrecto o está incompleto, **Then** ve «Este enlace no es válido» y cómo solicitar uno nuevo.

### User Story 3 - Uso Reportes con más claridad (Priority: P2)

1. **When** pulso un indicador (Pagaron, En revisión…), **Then** voy a la lista de alumnos con ese filtro y puedo quitarlo con su etiqueta.
2. **Given** abro Reportes en un celular o en una pantalla de 1300 px, **Then** nada se desborda ni se corta.

## Requirements

- **FR-001**: `/seguimiento` no exige sesión (`meta.publica`); el resto del panel sigue exigiéndola.
- **FR-002**: `POST /api/publico/seguimiento` y `…/export` validan el formato del token antes de llamar al backend y propagan `LINK_NOT_FOUND`,
  el `Retry-After` de los límites y el respaldo `LINK_UNAVAILABLE` si el backend no responde.
- **FR-003**: la vista del docente no muestra DNI, correo, montos ni a otros asesores (no los recibe).
- **FR-004**: los enlaces se administran solo con `reportes.gestionar`; el panel no pide ni muestra tokens sin ese permiso.
- **FR-005**: los contenedores con desplazamiento de las tablas son `relative` (los textos `sr-only` no ensanchan la página).

## Success Criteria

- **SC-001**: `bun run lint`, `bun run typecheck` y `bun run test` en verde.
- **SC-002**: en el navegador, sin sesión, el enlace de un docente abre solo a sus estudiantes en 390 px y en pantalla ancha, sin desborde; con un
  enlace inválido muestra el aviso; con 1311 px Reportes no se desborda.
