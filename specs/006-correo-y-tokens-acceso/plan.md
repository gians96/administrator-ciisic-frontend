# Implementation Plan: Credenciales de correo y tokens de acceso

## Contrato (backend-ciisic, en paralelo)

Respuestas `{ success: true, data }`; errores `{ success: false, code, message, fields? }`. Todas las
rutas pasan por el BFF (`useApi`: `api('email-credentials')` → `/api/backend/email-credentials` →
`<backend>/api/v1/email-credentials`). Solo SUPERADMIN.

| Método y ruta | Cuerpo | Respuesta (`data`) |
|---|---|---|
| `GET email-credentials` | — | `CredencialCorreo[]` |
| `POST email-credentials` | `{ nombre, apiKey, remitenteCorreo, remitenteNombre?, esPredeterminada?, activo? }` | 201 `CredencialCorreo` (la primera queda predeterminada) |
| `PUT email-credentials/:id` | parcial; `apiKey` opcional (si viene, la reemplaza) | `CredencialCorreo` |
| `DELETE email-credentials/:id` | — | `null` (si era la predeterminada, se promueve otra activa) |
| `POST email-credentials/:id/test` | — | `{ ok, cuenta?: { correo, empresa, planes: [{ tipo, creditos, tipoCreditos }] }, error?, credencial }` |
| `POST email-credentials/:id/send-test` | `{ correo }` | `{ ok, error?, credencial }` |
| `GET events/:eventId/access-tokens` | — | `TokenAcceso[]` |
| `POST events/:eventId/access-tokens` | `{ nombre, expiraEn?: ISO \| null }` | 201 `{ ...TokenAcceso, token: 'ciisic_…' }` (único momento con el valor en claro) |
| `DELETE access-tokens/:id` | — | `TokenAcceso` con estado `REVOCADO` |

`CredencialCorreo`: `id, proveedor: 'BREVO', nombre, apiKeyEnmascarada, remitenteCorreo,
remitenteNombre, esPredeterminada, activo, ultimoEstado: 'OK'|'ERROR'|null, ultimoError,
ultimaPruebaEn, ultimoEnvioEn, eventos: [{ id, codigo, nombreCorto }], creadoEn, actualizadoEn`.

`TokenAcceso`: `id, eventoId, nombre, prefijo, estado: 'ACTIVO'|'REVOCADO'|'EXPIRADO', ultimoUsoEn,
expiraEn, revocadoEn, creadoPor: { id, nombres, apellidos } | null, creadoEn`.

Evento (listado y detalle): `credencialCorreoId: number | null` y
`credencialCorreo: { id, nombre, remitenteCorreo } | null`; alta/edición aceptan `credencialCorreoId`.

Detalles confirmados en los contratos del backend (`specs/006-credenciales-correo`,
`specs/007-tokens-acceso-evento`): la lista de credenciales llega con la predeterminada primero;
`cuenta.correo`, `planes[].creditos` y `planes[].tipoCreditos` pueden ser `null`; quitar la marca a la
predeterminada responde `422 DEFAULT_CREDENTIAL_REQUIRED`; al eliminar una credencial sus eventos quedan
con `credencialCorreoId = null`; un `credencialCorreoId` inexistente en el evento responde
`422 EMAIL_CREDENTIAL_NOT_FOUND` con `fields.credencialCorreoId`; al crear un evento con
`copiarDeEventoId` y sin `credencialCorreoId`, se copia la del origen; el prefijo del token es
`ciisic_` + 8 caracteres y revocar es idempotente.

## Archivos

| Archivo | Rol |
|---|---|
| `app/pages/correo.vue` | Credenciales de Brevo: lista, alta/edición, probar, enviar prueba, predeterminada, activar, eliminar |
| `app/components/eventos/TokensAccesoPanel.vue` | Tokens de acceso del evento: lista, generar, mostrar una sola vez, revocar |
| `app/pages/eventos/[id].vue` | Pestaña "Acceso" (solo SuperAdmin) |
| `app/components/eventos/EventoForm.vue` | Campo "Credencial de correo" (select o solo lectura según el rol) |
| `app/components/layout/AppSidebar.vue` | Entrada "Correo" solo para SuperAdmin |
| `app/utils/credencialesCorreo.ts` | Formulario → cuerpo (PUT parcial), validación, estado, planes Brevo, opciones del evento |
| `app/utils/tokensAcceso.ts` | Estado efectivo, prefijo visible, expiración (presets y fecha en hora de Lima) |
| `app/composables/useCopiar.ts` | Copia al portapapeles con estado "Copiado" (sin UI) |
| `app/utils/errores.ts` | Mensajes por código y etiquetas legibles de `fields` |
| `app/types/api.ts` | Tipos del contrato |
| `tests/*.test.ts` | Pruebas Vitest de las utilidades y del composable |

## Decisiones

- **PUT parcial por diferencias**: al editar una credencial solo se envían los campos que cambiaron;
  `apiKey` solo si se escribió; `remitenteNombre` vacío se envía como `null` para borrarlo;
  `esPredeterminada` solo se envía como `true` (para cambiar la predeterminada se marca otra).
- **Alta**: `esPredeterminada` se envía solo si está marcada (si no hay credenciales, la primera queda
  predeterminada: el interruptor aparece marcado y bloqueado). Una credencial no puede nacer
  predeterminada e inactiva.
- **Mensajes por código**: los códigos del dominio (`EMAIL_CREDENTIAL_*`, `ACCESS_TOKEN_NOT_FOUND`)
  usan el texto del panel, que explica qué hacer; `VALIDATION_ERROR` conserva el texto del backend y
  muestra `fields` junto a cada campo.
- **Token en claro**: solo en un `ref` local del panel mientras el diálogo está abierto; la fila que se
  agrega a la lista no incluye `token`. No se usa Pinia ni `localStorage`. La respuesta del BFF ya lleva
  `cache-control: no-store`.
- **Expiración**: presets (30, 90, 180 y 365 días) o fecha; la fecha expira al final del día en hora de
  Lima (UTC−5, sin horario de verano). Vacío = sin expiración (`expiraEn: null`).
- **Rol en el formulario del evento**: solo el SuperAdmin consulta `email-credentials` y envía
  `credencialCorreoId`; el Admin ve `credencialCorreo` del evento en un campo de solo lectura.
- **Copia de evento**: al elegir "Copiar de…" en el alta se propone la credencial del origen (lo mismo
  que haría el backend) mientras el SuperAdmin no cambie el selector a mano.
- **Validación en el navegador**: mismas reglas que el backend (nombre 2–120, API key ≥ 10, correo,
  expiración futura) porque los mensajes de yup del backend llegan en inglés.

## Constitution Check

- I. El JWT sigue en la cookie httpOnly; las API keys son write-only (solo `••••abcd`). El token de
  acceso se muestra completo una única vez, por diseño del contrato, y no se persiste en el navegador.
- II. Solo clases de Tailwind v4 y tokens de marca existentes.
- III. Los tokens de acceso son por evento (pestaña del evento); las credenciales son globales.
- IV. Etiquetas, foco y `<dialog>` nativo; confirmación en eliminar, revocar, desactivar una
  credencial en uso y cerrar el token sin copiar.
- V. Utilidades puras y composable con pruebas Vitest; lint, typecheck, test y build en verde.
