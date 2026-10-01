# Arquitectura

```
Navegador (SPA) ──cookie httpOnly──► Nitro (BFF) ──Authorization: Bearer <JWT>──► backend-ciisic
                                     /api/auth/*      (login, Google, sesión, salir)
                                     /api/backend/**  → /api/v1/**     (solo staff: tipo ADMIN)
                                     /api/portal/**   → /api/v1/me/**  (solo sesión PARTICIPANTE)
```

## Sesión

- El backend emite un JWT de 1 h con audiencia `ciisic-admin` (staff) o `ciisic-participante`
  (inscrito). El BFF lo guarda en la cookie httpOnly `ciisic_admin_session` (SameSite Strict,
  Secure en producción) con la misma vida que el token; el navegador nunca lo ve.
- `server/utils/jwt-publico.ts` lee la audiencia y `exp` solo para enrutar y decidir la renovación;
  la verificación real la hace el backend.
- **Renovación** (`server/utils/renovar-sesion.ts`): cuando al JWT del staff le quedan menos de
  20 min, el proxy y `/api/auth/session` piden `POST /api/v1/auth/refresh` con el Bearer actual y
  guardan el JWT nuevo en la cookie antes de reenviar la petición. Las peticiones que llegan a la
  vez con el mismo JWT comparten una sola renovación (60 s), porque el backend permite 30 cada
  15 min por cuenta (y varias estaciones pueden compartir una cuenta). El backend conserva el inicio
  de la sesión y la corta a las 12 h (401 `SESSION_EXPIRED`); si la cuenta cambió de correo,
  contraseña o Google, o se desactivó, responde 401 `SESSION_INVALIDATED`. Si la renovación falla,
  la petición sigue con el JWT actual: tras un 401 o 403 ese JWT no se vuelve a intentar renovar
  hasta que caduca; tras un 429 o un backend caído, se reintenta a los 60 s.
- Al cerrar sesión (`/api/auth/logout`) el BFF recuerda el JWT (su hash) hasta que caduca: una
  petición aún en curso con él no lo renueva ni vuelve a guardar la cookie.
- Si el backend responde 401, el BFF borra la cookie y la SPA vuelve a `/login?motivo=…`, que
  explica el motivo. `/api/auth/session` solo borra la cookie ante un 401: si el backend no
  responde, devuelve 503 `SESSION_UNAVAILABLE` y la sesión se conserva; al abrir el panel, el login
  lo avisa con «Reintentar» y `/api/auth/login` responde 503 `LOGIN_UNAVAILABLE` (no «contraseña
  incorrecta»).

## Permisos del staff

- La sesión del staff trae `usuario.acceso = { alcance: 'GLOBAL' | 'EVENTO', permisos, eventoIds,
  perfilParticipante }` (en `/api/auth/login`, `/api/auth/google` y `/api/auth/session`). El backend
  la lee de la BD en cada petición y es la autoridad (403 `FORBIDDEN` o `EVENT_NOT_ASSIGNED`).
- `app/utils/permisos.ts`: catálogo de permisos y dependencias (copiado de
  `backend-ciisic/src/core/permisos.ts`), `tienePermiso`, `accesoDeSesion`, el `MENU` con el permiso
  de cada ítem, `menuPara` e `inicioPara`. Es el único archivo con códigos de rol (nombre visible y
  tono): Owner = `SUPERADMIN`, Administrador del sistema = `ADMIN`, Tesorero, Comisión.
- Páginas: `definePageMeta({ permiso: '…' })` (o una lista: basta uno), el mismo que su ítem del
  menú. Menús y botones: `auth.puede(permiso)`. Nunca se decide con el código del rol; el
  `tipo: 'ADMIN'` de la sesión es el perfil (staff), no el rol.
- Las cuentas por evento reciben de `GET /events` solo sus eventos (vista reducida, sin la
  configuración de correo: tipo `EventoResumido`; el evento completo es `Evento`); `useEventoStore`
  recuerda el evento elegido por cuenta y se vacía al cambiar de cuenta o cerrar sesión. Una cuenta
  por evento sin eventos asignados va a `/sin-acceso` aunque tenga permisos.

## Proxies

`server/utils/proxy.ts` (usado por `/api/backend/**` y `/api/portal/**`):
- valida la ruta (sin `..`) y el `Origin` en mutaciones (`assertSameOrigin`);
- rechaza el perfil equivocado con `403 FORBIDDEN_PROFILE`;
- no reenvía `Origin`, `Referer` ni cookies del navegador (llamada servidor a servidor);
- transmite multipart y archivos (vouchers, credenciales, CSV) sin cargarlos en memoria.

## Acceso con Google

1. `GET /api/auth/google` pide al backend `GET /api/v1/auth/config` y devuelve el client ID y un
   `nonce` aleatorio, guardado en la cookie httpOnly `ciisic_google_nonce` (15 min, un solo uso).
2. El botón de Google Identity Services (popup) incluye ese nonce en el ID token.
3. `POST /api/auth/google` consume la cookie del nonce, envía `{ idToken, nonce }` a
   `POST /api/v1/auth/google` y guarda la sesión que devuelve el backend (ADMIN o PARTICIPANTE).
4. Tras un intento fallido se pide un nonce nuevo. Los errores llegan con su `code`
   (`GOOGLE_ACCOUNT_NOT_REGISTERED`, `GOOGLE_ACCOUNT_MISMATCH`, …) y se traducen en `app/utils/errores.ts`.

## Enrutamiento por perfil y permiso

`app/middleware/auth.global.ts` con `app/utils/sesion.ts`:
- sin sesión → `/login?redirect=…` (solo `/login` es pública);
- PARTICIPANTE → solo páginas con `definePageMeta({ perfil: 'participante' })` (`/mis-inscripciones`);
- staff (ADMIN) en una página de inscrito o sin el `permiso` de la página → su página de inicio
  (`inicioPara`: la primera del menú que puede abrir; la Comisión que marca asistencia, `/asistencia`;
  sin ninguna, `/sin-acceso`). Tras el login, `redirect` solo si la cuenta puede abrirla.
- sesión sin verificar (backend caído) → `/login?motivo=SESSION_UNAVAILABLE&redirect=…`; la siguiente
  navegación (o «Reintentar») vuelve a leerla.
- 401 de la API → `/login?motivo=SESSION_EXPIRED|SESSION_INVALIDATED&redirect=…` (si ya se está en el
  login, se conservan su `redirect` y su motivo); 403 `FORBIDDEN` o `EVENT_NOT_ASSIGNED` → se relee el
  acceso (como máximo cada 15 s) y los eventos, y se sale de la página si ya no está permitida. Los 403
  de un permiso concreto (`STATUS_NOT_ALLOWED`, `OUT_OF_HOURS_NOT_ALLOWED`) releen el acceso al
  momento (`releerAcceso`) para ocultar la acción.
