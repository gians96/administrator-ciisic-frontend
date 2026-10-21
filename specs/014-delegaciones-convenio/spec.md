# Feature Specification: Delegaciones con convenio en el panel

**Created**: 2026-10-21 · **Status**: Implementado · **Contrato**: `backend-ciisic/specs/023-delegaciones-convenio/contracts/api-delegaciones-convenio.md`

**Input**: hay convenio con delegaciones de otras universidades (UNH, UNAT). Un delegado inscribe a su
grupo y paga por todos; el staff también debe poder registrarlas, editarlas y aprobarlas. Parte de la
pestaña **Delegaciones** de `Eventos` que dejó la rama `delegacionesd` (Atuncar) y la adapta al
contrato 023: modalidad, tarifa y tipo decididos por el servidor, vouchers múltiples y aprobación del grupo.

## User Scenarios & Testing

### User Story 1 - Registro una delegación (Priority: P1)

1. **Given** estoy en Eventos → Delegaciones, **When** pulso «Nueva delegación» y escribo el DNI del
   delegado, **Then** se completan sus nombres con la consulta DNI; agrego correo y celular.
2. **Given** elijo Presencial o Virtual y voy agregando integrantes (filas o una lista pegada),
   **Then** veo en vivo «N × S/ precio = total» y cuántos faltan para la tarifa de S/ 50.
3. **Given** guardo, **Then** se abre el detalle con el **link** para enviárselo al delegado.

### User Story 2 - Gestiono el grupo (Priority: P1)

1. **Given** abro una delegación, **Then** veo integrantes, precio por persona, total, declarado,
   verificado y saldo, y puedo copiar el link, agregar o quitar integrantes (no aprobados) y editar los
   datos del delegado.
2. **Given** el delegado o yo subimos vouchers, **Then** cada uno muestra fecha, medio, operación, monto
   y estado; lo abro, lo **verifico**, lo **rechazo con motivo**, lo devuelvo a pendiente o lo elimino.
3. **Given** los vouchers están conformes, **When** pulso «Aprobar al grupo», **Then** todos los
   integrantes por revisar pasan a APROBADO y sus credenciales salen en segundo plano; si hay saldo o
   vouchers sin verificar, el panel lo avisa antes de confirmar.

### User Story 3 - Veo la delegación en Inscripciones (Priority: P2)

1. **Given** una inscripción pertenece a una delegación, **Then** el listado muestra su grupo y el
   detalle, la modalidad y el resumen de pagos del grupo (solo con «pagos.ver»).

## Requirements

- **FR-001**: la tarifa que muestra el formulario sale de los tipos activos `delegacion_general`,
  `delegacion_grupal` y `delegacion_virtual` de la categoría `DELEGACIONES`; el monto es un **estimado**,
  el servidor calcula el definitivo.
- **FR-002**: la modalidad virtual solo se ofrece si existe el tipo `delegacion_virtual`; si no, el
  formulario explica cómo crearlo.
- **FR-003**: un DNI de 7 dígitos (Excel pierde el cero) se completa a 8 al salir del campo, al pegar una
  lista y al enviar.
- **FR-004**: los vouchers se envían en multipart (`pagos` en JSON y un archivo por pago en `vouchers`),
  hasta 6 por envío, PDF/JPG/PNG/WebP de hasta 5 MB.
- **FR-005**: el delegado, con su link, solo agrega; el panel es el único lugar para quitar integrantes,
  eliminar vouchers y verificarlos.
- **FR-006**: los códigos de error nuevos del backend tienen mensaje en español (`app/utils/errores.ts`).

## Success Criteria

- **SC-001**: `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde.
- **SC-002**: contra el backend local se crea una delegación presencial de 9 → 10 integrantes (S/ 60 → S/ 50),
  una virtual (S/ 30), se suben dos vouchers, se verifica uno y se aprueba al grupo.

## Despliegue

Backend 023 primero (crea las tablas y columnas); el panel después. Contra un backend anterior la pestaña
Delegaciones no existe (la API no está), el resto del panel no cambia.
