# Feature Specification: Tarifa de delegaciones administrable en el panel

**Created**: 2026-10-21 · **Status**: Implementado · **Contrato**: `backend-ciisic/specs/024-tarifa-delegaciones/contracts/api-tarifa-delegaciones.md`

**Input**: en Eventos → Delegaciones el precio presencial (S/ 60 y S/ 50 desde 10 integrantes) y el virtual (S/ 30) eran
solo texto: el staff no podía cambiarlos ni elegir si la modalidad virtual se ofrece, y el detalle de cada delegación no
mostraba su tarifa ni su modalidad aunque el backend (spec 023) ya acepta editarlas. Amplía la
[spec 014](../014-delegaciones-convenio/spec.md) sin cambiar su regla: **el servidor decide el tipo y el precio de cada
inscripción**; el panel solo administra la **tarifa del evento** y la de cada delegación, nunca el monto de una persona.

## User Scenarios & Testing

### User Story 1 - Edito la tarifa de las delegaciones (Priority: P1)

1. **Given** estoy en Eventos → Delegaciones, **Then** veo en una tarjeta el precio presencial para menos de N
   integrantes, el promocional desde N y el virtual.
2. **When** pulso «Editar tarifa», cambio los precios o el mínimo y guardo, **Then** la tarjeta se actualiza y la landing
   (`/delegaciones`) muestra la tarifa nueva; las delegaciones ya creadas conservan la suya.
3. **Given** el promocional queda por encima del estándar, un precio vacío o negativo, o un mínimo fuera de 1–1000,
   **Then** el formulario lo marca y no envía nada.

### User Story 2 - Ofrezco u oculto la modalidad virtual (Priority: P1)

1. **Given** el evento no tiene el tipo virtual, **When** enciendo «Ofrecer la modalidad virtual» con su precio, **Then**
   el backend lo crea y «Nueva delegación» ya permite elegir Virtual.
2. **When** la apago, **Then** la tarjeta dice «No se ofrece» y el alta no permite Virtual.

### User Story 3 - Aplico la tarifa a delegaciones que aún no empiezan (Priority: P2)

1. **Given** hay delegaciones sin integrantes ni vouchers, **When** marco «Aplicar también a las N delegaciones…»,
   **Then** pide confirmación y esas reciben la tarifa; el aviso dice cuántas fueron.

### User Story 4 - Corrijo la tarifa o la modalidad de una delegación (Priority: P1)

1. **Given** abro «Gestionar», **Then** veo la tarifa que cobra, si es de convenio y puedo editarla en «Tarifa de esta delegación».
2. **When** cambio precios o mínimo con integrantes, **Then** el panel avisa que se recalcula a todo el grupo y pide confirmación.
3. **Given** el grupo no tiene integrantes, **When** cambio la modalidad, **Then** los precios se precargan con los del
   evento para esa modalidad; con integrantes la modalidad está bloqueada.

## Requirements

- **FR-001**: la tarjeta lee `GET events/:id/delegations/tarifa`; con un backend sin la ruta (404 de ruta) cae a los tipos
  de la categoría `DELEGACIONES` y oculta «Editar tarifa».
- **FR-002**: `PUT` envía **solo lo que cambió** (`cuerpoTarifa`); sin tipo virtual, el precio virtual solo viaja al
  encender la modalidad (enviarlo crea el tipo).
- **FR-003**: las validaciones locales coinciden con el backend (mínimo entero 1–1000, precios ≥ 0 con hasta dos
  decimales, promocional ≤ estándar) y los errores del servidor se muestran por campo.
- **FR-004**: en una delegación virtual el precio es único (se envían estándar y promocional iguales).
- **FR-005**: el mínimo que muestra y usa el alta sale de la tarifa del backend (`tarifaDeAdmin`), no de una constante.

## Success Criteria

- **SC-001**: `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde.
- **SC-002**: contra el backend local se cambia el mínimo a 8 y el estándar a 70, se crea una delegación y paga S/ 70
  hasta 7 integrantes y el promocional desde el 8.º; la landing muestra los mismos números.

## Despliegue

Backend 024 primero (rutas nuevas, sin migración); la edición por delegación funciona ya con el backend 023.
