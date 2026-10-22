# Feature Specification: Ponencias especializadas solo para congresistas con pago aprobado (panel)

**Created**: 2026-10-22 · **Status**: Implementado (pendiente de probar en el navegador y de desplegar)

**Contrato**: `backend-ciisic/specs/030-ponencias-validacion-congreso/contracts/api-ponencias-validacion-congreso.md`.
**Orden de despliegue: el backend 030 primero** (un backend anterior no envía lo nuevo y las pantallas se ven como antes).

> **Numeración**: es la spec **020** del panel; la 019 es «docentes con DNI y página común» (otra línea de trabajo).

## Qué cambia en el panel

- **Programa** (`/ponencias-especializadas`): tarjeta **«Acceso a la inscripción»** con el interruptor «Acceso libre (gratuito): entra
  solo con su DNI» (`GET|PUT events/:id/specialized-talks/access`). Solo `especializadas.gestionar` (Owner y Administrador) lo cambia,
  con confirmación porque toma efecto de inmediato. El cupo `inscritos / cupo` pasa a contar solo a los **presenciales** y suma
  aparte los virtuales («18 / 20 · +7 virtuales»); «Con cupo lleno» es el aforo presencial.
- **Inscripciones**: columna **«Congreso»** (Presencial / Virtual con el tipo de inscripción, «Sin validar» en ámbar, «pago no vigente»
  en rojo si el congreso ya no está aprobado), filtros **Validación** y **Modo de asistencia** (sincronizados con la URL), y el
  contador «N sin validar» que filtra al hacer clic.
- **Alta manual** y **puerta**: con el acceso libre apagado basta el documento, pero debe ser congresista aprobado; los errores
  `CONGRESS_REGISTRATION_NOT_FOUND`, `CONGRESS_PAYMENT_PENDING` y `CONGRESS_REGISTRATION_REJECTED` se muestran con su motivo. Un
  congresista **virtual** se marca con aviso ámbar («asiste en línea y no ocupa aforo»). Los contadores de la puerta usan
  `ponencia.presenciales` y `ponencia.virtuales`.
- **Franja «Acceso libre activo»** en Inscripciones, Asistencia y el alta manual mientras el interruptor esté encendido.

## Decisiones

- Todo es tolerante con un backend anterior: `inscritosPresenciales`, `validada`, `modoAsistencia` y `congreso` son opcionales; sin
  ellos todos cuentan como presenciales y no se marca nada (`presenciales()`, `etiquetaValidacion()` devuelve `null`).
- El panel no calcula quién puede inscribirse: el backend decide; el panel solo muestra el motivo.
- Lógica pura en `app/utils/ponenciasEspecializadas.ts` (`presenciales`, `textoCupo`, `tonoCupo`, `etiquetaValidacion`, `etiquetaModo`,
  `textoCambioAcceso`, filtros `validacion` y `modo`), el estado del interruptor en `composables/useAccesoPonencias.ts` y los
  componentes `AccesoPonenciasCard` y `AvisoAccesoLibre` en `components/especializadas/`.

## Success Criteria

- **SC-001**: `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde.
- **SC-002**: contra el backend 030 local: apagar el interruptor hace que un DNI no inscrito al congreso sea rechazado en el alta
  manual y en la puerta con su motivo; un virtual se marca sin consumir aforo; el listado filtra por validación y modo.
