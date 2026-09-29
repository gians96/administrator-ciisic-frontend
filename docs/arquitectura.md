# Arquitectura

```
Navegador (SPA) ──cookie httpOnly──► Nitro (BFF) ──Authorization: Bearer <JWT>──► backend-ciisic
                                     /api/auth/*      (login, Google, sesión, salir)
                                     /api/backend/**  → /api/v1/**     (solo sesión ADMIN)
                                     /api/portal/**   → /api/v1/me/**  (solo sesión PARTICIPANTE)
```

## Sesión

- El backend emite un JWT de 1 h con audiencia `ciisic-admin` o `ciisic-participante`. El BFF lo
  guarda en la cookie httpOnly `ciisic_admin_session` (SameSite Strict, Secure en producción) con
  la misma vida que el token; el navegador nunca lo ve.
- `server/utils/jwt-publico.ts` lee la audiencia solo para enrutar (qué proxy acepta la sesión);
  la verificación real la hace el backend.
- Si el backend responde 401, el BFF borra la cookie y la SPA vuelve a `/login`.

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

## Enrutamiento por perfil

`app/middleware/auth.global.ts` con `app/utils/sesion.ts`:
- sin sesión → `/login?redirect=…` (solo `/login` es pública);
- PARTICIPANTE → solo páginas con `definePageMeta({ perfil: 'participante' })` (`/mis-inscripciones`);
- ADMIN en una página de inscrito → `/`; `soloSuperAdmin` exige SuperAdmin.
