# Feature Specification: Ponencias especializadas

**Created**: 2026-10-20 · **Status**: Implementado · **Backend**: `backend-ciisic/specs/019-ponencias-especializadas/`

Pantallas del panel para el programa de ponencias especializadas, sus inscripciones y la asistencia en
puerta. El backend es la autoridad (permisos, cupos, cruces y nombres del DNI); el panel solo los presenta.
No confundir con `/ponencias`, que son los trabajos del Call for Papers.

## Escenarios

1. **Programa** (`/ponencias-especializadas`, `especializadas.ver` o `.gestionar`): las ponencias por día con
   horario, duración, ambiente y modalidad, precio («Gratuita»), cupo `inscritos / cupo` (verde, ámbar desde el
   80 %, rojo si está llena), ponente y estado de publicación. Con `especializadas.gestionar`: **Nueva
   ponencia** (la hora de fin se calcula con la duración), editar, publicar/despublicar y eliminar (409 si
   tiene inscritos vigentes). Enlaces a **Inscritos** (filtrados por esa ponencia) y **Puerta**.
2. **Inscripciones** (`/ponencias-especializadas/inscripciones`, `especializadas.ver`): filtros por día,
   ponencia, estado, asistencia, procedencia, modalidad y origen, y búsqueda por documento, nombres, correo o
   celular (con espera de 350 ms); los filtros viajan en la URL. Cada fila muestra persona, ponencia,
   procedencia, estado (con el motivo si se canceló: staff o cambio en puerta), origen y asistencia (con «fuera
   de horario»). Con `especializadas.inscribir`: **Inscribir manualmente** (ponencia + documento; correo,
   celular y procedencia opcionales; «Consultar DNI» si la cuenta tiene `consultas_dni.gestionar`; el
   backend completa los nombres al guardar), cancelar, reactivar y corregir los datos de la persona. Con
   `especializadas.asistencia`: anular una asistencia.
3. **Asistencia en puerta** (`/ponencias-especializadas/asistencia`, `especializadas.asistencia`): se elige la
   ponencia (por defecto la de hoy en curso o por empezar; `?ponencia=` desde el programa), se escribe el DNI
   y Enter. Verde: estaba inscrito. Ámbar: se inscribió en el acto, liberó el cupo de otra ponencia del mismo
   horario («Se liberó su cupo en …») o llegó fuera de horario. Rojo: sin cupos o documento inválido. Si el
   DNI no trae nombres (`NAMES_REQUIRED`) se piden a mano y se conserva el documento. Contadores de la ponencia
   y últimas 12 lecturas.
4. **Menú**: sección «Ponencias especializadas» (Programa, Inscripciones, Asistencia en puerta). Una cuenta
   que solo tiene `especializadas.asistencia` (y `.ver`, que implica) empieza en la puerta. Solo se resalta el
   ítem de la ruta más específica.

## Requisitos

- **FR-001**: los cuatro permisos nuevos (`especializadas.gestionar`, `.ver`, `.inscribir`, `.asistencia`) en
  `Permiso`, `ETIQUETAS_PERMISO` y `DEPENDENCIAS` (los dos últimos implican `.ver`); `GET /roles` ya ofrece los
  tres por evento a la Comisión.
- **FR-002**: ningún botón se decide por el código del rol: todo con `auth.puede(permiso)`.
- **FR-003**: errores del backend por código en `app/utils/errores.ts` (`TALK_FULL`, `ROOM_CONFLICT`,
  `SCHEDULE_CONFLICT`, `TALK_NOT_FOUND`, `REGISTRATION_NOT_FOUND`, `ALREADY_ATTENDED`,
  `CAPACITY_BELOW_REGISTERED`, `TALK_HAS_REGISTRATIONS`, `INVALID_HOURS`, `INVALID_FILTER`).
- **FR-004**: las respuestas que llegan tarde (otro evento o filtros) se descartan, como en Inscripciones.
- **FR-005**: sin cambios en el BFF (`/api/backend/**` ya reenvía `/api/v1/*`).

## Compatibilidad

Con un backend sin la spec 019 las cuentas no reciben los permisos nuevos y el menú no muestra la sección;
abrir la URL lleva a la página de inicio de la cuenta.

## Criterios de éxito

- `bun run lint`, `typecheck`, `test` y `build` en verde.
- Probado en el navegador contra el backend local: programa, inscripciones (listado y modal) y puerta (DNI
  nuevo, cupo, cambio de ponencia y lectura repetida).
