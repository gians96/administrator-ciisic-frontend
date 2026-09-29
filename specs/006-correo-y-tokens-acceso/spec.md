# Feature Specification: Credenciales de correo (Brevo) y tokens de acceso por evento

**Feature Branch**: `feat/panel-admin` · **Created**: 2026-09-29 · **Status**: En implementación
**Contrato**: acordado con `backend-ciisic` (se implementa en paralelo; resumen en [plan.md](plan.md))
**Input**: "Credenciales de correo (Brevo), solo SUPERADMIN… Tokens de acceso por evento (para que la
landing del evento consuma el backend), solo SUPERADMIN… En el formulario General del evento, nuevo
campo «Credencial de correo»."

## User Scenarios & Testing

### User Story 1 - Registrar credenciales de Brevo (Priority: P1)
Como SuperAdmin quiero registrar una o más API keys de Brevo con su remitente (correo y nombre),
sabiendo que la key se guarda cifrada y que solo veré `••••abcd`, y elegir cuál es la predeterminada.

**Acceptance Scenarios**:
1. **Given** que no hay credenciales, **When** agrego la primera, **Then** queda como predeterminada.
2. **Given** que edito una credencial, **When** dejo vacía la API key ("Dejar vacío para conservar"),
   **Then** se conserva la actual y solo se envían los campos que cambié.
3. **Given** una credencial activa, **When** la marco como predeterminada, **Then** la anterior deja de serlo.
4. **Given** que elimino una credencial (con confirmación), **Then** desaparece de la lista; si era la
   predeterminada, el backend promueve otra activa. Si está en uso y el backend lo impide
   (`EMAIL_CREDENTIAL_IN_USE`), veo qué hacer.
5. **Given** un Admin (no SuperAdmin), **When** intento abrir `/correo`, **Then** se me redirige al inicio y
   no veo "Correo" en el menú.

### User Story 2 - Verificar que la credencial funciona (Priority: P1)
Quiero probar la API key contra Brevo sin enviar correos (ver la cuenta y sus créditos), enviar un
correo de prueba a una dirección y ver el último estado (OK / con error y su detalle), la última
prueba y el último envío.

**Acceptance Scenarios**:
1. **Given** una key válida, **When** pulso Probar, **Then** veo el correo y la empresa de la cuenta Brevo
   y los créditos por plan, y el estado pasa a OK.
2. **Given** una key inválida, **When** pulso Probar, **Then** veo el error y el estado pasa a "Con error".
3. **Given** que pulso Enviar prueba, **When** ingreso un correo válido, **Then** se envía y veo el resultado;
   si Brevo rechaza (p. ej. remitente no verificado), veo el error sin cerrar el diálogo.

### User Story 3 - Credencial por evento (Priority: P2)
En General del evento quiero elegir una credencial activa o "Usar la predeterminada". Un Admin ve la
credencial actual en solo lectura (sin consultar `/email-credentials`, que es solo SuperAdmin).

### User Story 4 - Tokens de acceso de la landing (Priority: P1)
Como SuperAdmin, en la pestaña "Acceso" del evento quiero generar un token (nombre y expiración
opcional) para que la landing de ese evento consuma el backend, copiarlo una única vez, ver prefijo,
estado, último uso, expiración y quién lo creó, y revocarlo.

**Acceptance Scenarios**:
1. **Given** que genero un token, **Then** veo "Copia este token ahora; no se volverá a mostrar", el valor en
   un campo de solo lectura, el botón Copiar y la instrucción de configurarlo como
   `NUXT_BACKEND_EVENT_TOKEN` (solo servidor) en la landing.
2. **Given** que cierro el diálogo sin haber copiado, **Then** se me pide confirmación; al cerrarlo el valor se
   descarta (no queda en Pinia, `localStorage` ni en la lista).
3. **Given** un token activo, **When** lo revoco (con confirmación), **Then** su estado pasa a "Revocado".
4. **Given** un Admin, **Then** no ve la pestaña "Acceso".

### Edge Cases
- La credencial asignada a un evento está inactiva o ya no existe: el selector la conserva como
  "(inactiva)" / "(no disponible)" para no perder el valor sin que el usuario lo decida.
- No se pudieron cargar las credenciales en el formulario del evento: se muestra el error y se conserva
  la credencial actual.
- El portapapeles no está disponible (contexto no seguro o permiso denegado): se selecciona el token y
  se pide copiarlo con Ctrl+C; la copia manual también cuenta como "copiado".
- Token con estado ACTIVO pero `expiraEn` ya vencido: se muestra como "Expirado".

## Requirements
- **FR-001**: Página `/correo` con `definePageMeta({ soloSuperAdmin: true })` (el middleware global
  redirige a un Admin) y entrada "Correo" en el menú solo para SuperAdmin.
- **FR-002**: API key write-only: campo `password`, obligatoria al crear; al editar va vacía con placeholder
  "Dejar vacío para conservar" y solo se envía si se escribió. El PUT es parcial (solo lo que cambió).
- **FR-003**: Por credencial: nombre, remitente, key enmascarada, insignias (Predeterminada,
  Activa/Inactiva, último estado OK/ERROR con el error visible), eventos que la usan, última prueba y
  último envío. Acciones: Probar, Enviar prueba, Editar, Marcar como predeterminada,
  Activar/Desactivar y Eliminar (con confirmación).
- **FR-004**: Texto de ayuda: el remitente debe estar verificado en Brevo; cada evento puede elegir su
  credencial y, si no, se usa la predeterminada.
- **FR-005**: Pestaña "Acceso" en `/eventos/:id` solo para SuperAdmin (`?tab=acceso` de un Admin vuelve a
  General) con `TokensAccesoPanel`.
- **FR-006**: El token en claro vive solo en el estado local del diálogo y se descarta al cerrarlo o al
  desmontar el componente.
- **FR-007**: `EventoForm` envía `credencialCorreoId: number | null` en alta y edición solo si el usuario es
  SuperAdmin; el Admin no lo envía (conserva el valor del backend).
- **FR-008**: Mensajes por código en `app/utils/errores.ts`: `EMAIL_CREDENTIAL_NOT_FOUND`,
  `EMAIL_CREDENTIAL_IN_USE`, `ACCESS_TOKEN_NOT_FOUND`; `VALIDATION_ERROR` muestra `fields` junto a cada
  campo y, en la notificación, con nombres legibles.
- **FR-009**: Estados de carga, vacío y error (con "Reintentar") en ambas listas.

## Success Criteria
- **SC-001**: Tras cerrar el diálogo, el token completo no está en Pinia, `localStorage` ni en la lista.
- **SC-002**: Un Admin no puede abrir `/correo` ni ver la pestaña "Acceso".
- **SC-003**: Lint, typecheck, pruebas y build en verde.
