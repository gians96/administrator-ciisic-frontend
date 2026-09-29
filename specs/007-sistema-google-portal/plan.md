# Implementation Plan: Sistema, inicio de sesión con Google y portal del inscrito

## Contrato (backend-ciisic, en paralelo)

Respuestas `{ success: true, data }`; errores `{ success: false, code, message, fields? }`. El BFF reenvía
`/api/backend/<ruta>` → `<backend>/api/v1/<ruta>` (sesión de administrador) y `/api/portal/<ruta>` →
`<backend>/api/v1/me/<ruta>` (sesión de inscrito).

| Método y ruta | Cuerpo | Respuesta (`data`) |
|---|---|---|
| `GET settings` (SuperAdmin) | — | `ConfiguracionSistema` |
| `PUT settings` (SuperAdmin) | parcial: `undcApiUrl?`, `undcApiKey?` (omitir = conservar, `null` = quitar, 10–500), `undcApiTimeoutMs?` (1000–30000), `googleClientId?`, `urlPanel?`, `rutasLegacyActivas?` | `ConfiguracionSistema`; 422 `VALIDATION_ERROR`, `INVALID_URL`, `HOST_NOT_ALLOWED` |
| `POST settings/undc-api/test` | — | `{ ok, mensaje, codigoHttp, latenciaMs, configuracion }`; 409 `UNDC_API_NOT_CONFIGURED` |
| `GET /api/v1/auth/config` (pública) | — | `{ google: { clientId }, urlPanel }` |
| `POST /api/v1/auth/google` | `{ idToken, nonce }` | `{ jwt, tipo, usuario? \| participante?, expiraEn }`; 503 `GOOGLE_NOT_CONFIGURED` / `GOOGLE_UNAVAILABLE`, 401 `INVALID_GOOGLE_TOKEN`, 403 `GOOGLE_EMAIL_NOT_VERIFIED` / `GOOGLE_NOT_AUTHORITATIVE` / `GOOGLE_ACCOUNT_MISMATCH` / `GOOGLE_ACCOUNT_NOT_REGISTERED`, 409 `GOOGLE_ACCOUNT_IN_USE`, 429 `RATE_LIMITED` |
| `POST /api/v1/auth/login` | `{ correo, contrasena }` | sin `data`: `{ jwt, usuario, expiraEn, tipo: 'ADMIN' }` |
| `GET /api/v1/auth/session` | Bearer | sin `data`: `{ tipo: 'ADMIN', user }` o `{ tipo: 'PARTICIPANTE', participante }` |
| `GET /api/v1/me` | Bearer de inscrito | `{ id, nombres, apellidos, correo, tipoDocumento, numeroDocumento }` |
| `GET /api/v1/me/inscriptions` | Bearer de inscrito | `InscripcionPropia[]` (más recientes primero) |
| `GET /api/v1/me/inscriptions/:id/credential` | Bearer de inscrito | PDF (`attachment`); 404 `INSCRIPTION_NOT_FOUND`, 409 `NOT_APPROVED` |
| `PUT admin/:id`, `PUT participants/:id` | `{ desvincularGoogle: true }` | el registro con `googleVinculado: false` |

`ConfiguracionSistema`: `undcApi: { url, apiKeyEnmascarada ('••••9f3a'), timeoutMs, configurada, ultimoEstado:
'OK'|'ERROR'|null, ultimoError, ultimaPruebaEn }`, `google: { clientId, configurado }`, `urlPanel`,
`rutasLegacy: { activas }`, `actualizadoPor: { id, nombres, apellidos } | null`, `actualizadoEn`.

`InscripcionPropia`: `id, evento: { codigo, nombre, nombreCorto, fechaInicio, fechaFin, sede }, tipoInscripcion:
{ nombre, etiqueta, categoria } | null, clasificacion: { nombre } | null, monto, precioRegular, descuento, pago:
{ modalidad, banco, tipoOperacion, billeteraDigital, numeroOperacion, fechaPago }, estado: { codigo, nombre },
motivoRechazo, revisadoEn, credencial: { disponible, enviadaEn }, creadoEn`.

Otros campos: administradores y participantes traen `googleVinculado` y `googleVinculadoEn`; el detalle de
inscripción, `verificacion.correo = { verificado, detalle: { metodo: 'GOOGLE', tipoCuenta: 'ESTUDIANTE' |
'PERSONAL' | 'EXTERNO', hd, verificadoEn } | null }`, y las filas de la lista, `esCorreoVerificado`.

Los JWT llevan `iss: backend-ciisic` y `aud: ciisic-admin | ciisic-participante`. Un token de otro perfil
recibe 403 `FORBIDDEN`; un inscrito cuyo correo cambió o ya no existe, 401 `SESSION_INVALIDATED`.

## Arquitectura

```
Login ─ GET  /api/auth/google ─► backend GET /api/v1/auth/config      → { clientId, nonce } + cookie nonce
      ─ GIS (popup, nonce) ─► credential (ID token de Google)
      ─ POST /api/auth/google { credential } ─► backend POST /api/v1/auth/google { idToken, nonce }
                                               → cookie de sesión (vida del JWT) + { tipo, usuario|participante }
Admin       ─► /api/backend/<ruta> ─► /api/v1/<ruta>     (sesión de inscrito → 403 FORBIDDEN_PROFILE)
Inscrito    ─► /api/portal/<ruta>  ─► /api/v1/me/<ruta>  (sesión de admin    → 403 FORBIDDEN_PROFILE)
```

El BFF lee `aud` del JWT **sin verificar la firma** (`server/utils/jwt-publico.ts`) solo para enrutar; la
autoridad es el backend, que verifica firma, emisor, audiencia y vigencia en cada llamada.

## Archivos

| Archivo | Rol |
|---|---|
| `app/pages/sistema.vue` | Página Sistema (SuperAdmin): cuatro tarjetas, prueba de API_UNDC, orígenes de Google |
| `app/utils/configuracionSistema.ts` | Formulario, PUT parcial por tarjeta, key write-only, validaciones, estado, orígenes, avisos |
| `app/components/layout/AppSidebar.vue` | Entrada «Sistema» solo para SuperAdmin |
| `app/types/google-identity-services.d.ts` | Tipos de Google Identity Services (desde app-web-sigenet, con `nonce`, `ux_mode`…) |
| `server/api/auth/google.get.ts` / `google.post.ts` | Client ID + nonce; intercambio del ID token por la sesión |
| `server/utils/session.ts` | Cookies de sesión y del nonce |
| `server/utils/jwt-publico.ts` | `aud` del JWT sin verificar, formato de la credencial de Google |
| `server/utils/proxy.ts` | Validación de rutas y reenvío autenticado (compartido por `backend` y `portal`) |
| `server/utils/errores-backend.ts` | Lectura del error del backend para propagarlo con su `code` |
| `server/api/portal/[...path].ts` | Proxy del portal del inscrito |
| `app/components/auth/BotonGoogle.vue` | Carga GIS una vez, pide client ID + nonce, renderiza el botón y renueva el nonce |
| `app/pages/login.vue` | Separador, botón de Google y texto para inscritos; aviso de sesión invalidada |
| `app/stores/auth.ts` | `sesion` por perfil, `loginGoogle`, getters `tipo`, `usuario`, `participante`, `esParticipante` |
| `app/utils/sesion.ts` | `leerSesion`, `redireccionPara`, `destinoTrasLogin`, `avisoLogin` |
| `app/middleware/auth.global.ts`, `app/types/router.d.ts` | Reglas por perfil y meta `perfil` |
| `app/composables/usePortal.ts` | Cliente del portal (`/api/portal`) |
| `app/layouts/participante.vue`, `app/pages/mis-inscripciones.vue` | Portal del inscrito |
| `app/utils/misInscripciones.ts` | Fechas del evento, tipo, monto, pago, mensaje por estado, URL de la credencial |
| `app/utils/cuentaGoogle.ts` | Vínculo con Google y verificación del correo (etiquetas y confirmaciones) |
| `app/pages/administradores.vue`, `app/pages/participantes.vue` | «Google vinculado» y «Desvincular Google» |
| `app/components/inscripciones/InscripcionDetalle.vue`, `app/pages/inscripciones/index.vue` | Correo verificado con Google |
| `app/utils/errores.ts` | Mensajes por código |

## Decisiones

- **Un solo cookie de sesión** (`ciisic_admin_session`) para ambos perfiles: una sesión por navegador; entrar
  con otra cuenta reemplaza la anterior.
- **Nonce de un solo uso**: el POST lo borra al leerlo. Tras cualquier intento fallido el botón pide otro nonce
  y se vuelve a inicializar (así también se recupera de `GOOGLE_SESSION_EXPIRED`). No se renueva en paralelo
  al POST para no pisar la cookie que el POST necesita.
- **Errores de Google**: el BFF propaga el `code` y el estado del backend; el panel muestra su texto por
  código (explica qué hacer). Sin respuesta del backend: 503 `GOOGLE_UNAVAILABLE`.
- **Perfiles**: el inscrito solo entra a páginas con `perfil: 'participante'`; un administrador que abre una
  de ellas vuelve a `/`. Tras el login el inscrito siempre va a `/mis-inscripciones` y el administrador a
  `redirect` si es interno (empieza con `/`, no con `//` ni contiene `\`).
- **JWT sin `aud`** (sesiones anteriores): no se tratan como inscrito; el backend decide.
- **Sistema por tarjetas**: cada tarjeta envía solo sus campos cambiados; al guardar se actualizan solo esos
  campos del formulario (los cambios sin guardar de las otras tarjetas se conservan). La API key escrita se
  borra del formulario al guardar. Las rutas legacy se cambian al instante con el interruptor.
- **Confirmaciones**: quitar la key o la URL de API_UNDC, borrar el client ID de Google y desactivar las rutas
  legacy.
- **Credencial del inscrito**: enlace directo `/api/portal/inscriptions/:id/credential` (misma cookie
  SameSite=Strict); solo se muestra si `credencial.disponible`.
- **Sesión invalidada**: `usePortal` lleva al login con `?motivo=SESSION_INVALIDATED` y el login muestra el
  aviso (solo códigos conocidos).

## Constitution Check

- I. El JWT sigue en la cookie httpOnly; el nonce también (path `/api/auth/google`). La API key de API_UNDC
  es write-only (`••••9f3a`). El client ID de Google no es secreto.
- II. Solo Tailwind v4 y tokens de marca; el botón de Google usa el tema `filled_black`.
- III. Sistema es global (no depende del evento); el portal no usa el selector de evento.
- IV. Etiquetas, `<dialog>` nativo, confirmaciones en acciones destructivas, textos en español.
- V. Utilidades puras con pruebas Vitest; lint, typecheck, test y build en verde.
- VI (enmienda 1.1.0). Dos perfiles: el inscrito solo llega a `/mis-inscripciones` y `/api/portal/**`.
