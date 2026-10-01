# Panel administrativo CIISIC

- **Documentación** (pantallas, BFF y sesiones, Google, configuración y despliegue): [`docs/`](docs/README.md)
- **Guía para agentes de IA y forma de trabajar con el resto del ecosistema**: [`AGENTS.md`](AGENTS.md)

Panel del Congreso Internacional de Ingeniería de Sistemas e Investigación Científica
(UNDC) para gestionar **eventos**, **inscripciones** (revisión de vouchers, aprobación y
credenciales), **tipos de inscripción**, **asistencia**, **consultas DNI** (pool de tokens
Decolecta/apiperu), **ponencias**, **mensajes**, **participantes**, **administradores**, los
**tokens de acceso** de cada evento, el **correo** (Brevo), la configuración del **sistema**
(API UNDC, Google, URL del panel) y la **integración con deportes-fi** (resumen de la Semana
Sistémica). Incluye un **escáner de asistencia** para la puerta (cámara del celular, lector USB o
DNI). Los inscritos también entran, con Google o con un código a su correo, a su **portal del
participante**: inscripciones, fotocheck virtual con QR, asistencia, certificados y perfil.

- **Stack**: Nuxt 4 (SPA + Nitro como BFF) · Vue 3 · Pinia · Tailwind CSS v4 con
  `@tailwindcss/vite` (sin `@nuxtjs/tailwindcss`) · Chart.js · TypeScript · bun
- **API**: [`backend-ciisic`](https://github.com/gians96/backend-ciisic) — contratos en
  `specs/*/contracts` y `docs/arquitectura-ecosistema.md` de ese repositorio.
- **SDD**: constitución en [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
  y especificaciones en [`specs/`](specs).

## Desarrollo

```bash
cp .env.example .env     # NUXT_BACKEND_BASE_URL=http://localhost:3010
bun install
bun run dev              # http://localhost:3001
```

Calidad: `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`.

La única variable de entorno es `NUXT_BACKEND_BASE_URL`: la sesión dura lo que el JWT que
emite el backend (`expiraEn`) y el resto de la configuración vive en el backend.

## Acceso

- **Staff** (Owner, Administrador del sistema, Tesorero y Comisión tecnológica): correo y
  contraseña, o «Continuar con Google» con la cuenta de su correo (Gmail o institucional). La
  primera vez queda vinculada esa cuenta de Google; en **Equipo y administradores** se ve
  «Google vinculado» y se puede desvincular. Al crear o editar una cuenta se elige el acceso:
  **Solo Google** (sin contraseña) o **Contraseña o Google**. Cada cuenta ve las pantallas y
  botones de sus permisos (ver [`docs/overview.md`](docs/overview.md)).
- **Inscritos**: «Continuar con Google» con el correo de su inscripción o «Entrar con un código a
  mi correo» (6 dígitos, vence en 10 min; solo si el backend lo ofrece). El código siempre abre el
  portal, nunca el panel, y la sesión dura 12 h. Solo ven su **portal**: inscripciones (estado,
  motivo de rechazo y credencial en PDF), fotocheck virtual con el QR para la asistencia,
  asistencia por actividad, certificados (llegan con la spec 015 del backend) y perfil (celular y
  foto opcional con consentimiento). Los administradores ven su vínculo con Google en Participantes
  y pueden desvincularlo.
- **Staff inscrito**: «Mi portal de participante» en el menú de su cuenta (directo si entró con
  Google; con contraseña, con un código a su correo). Para volver al panel ingresa de nuevo.
- **Google**: el Owner pega el Client ID (cliente OAuth de tipo Web) en **Sistema** y
  autoriza en Google Cloud los orígenes JavaScript del panel (por ejemplo
  `http://localhost:3001` y el dominio de producción). Sin Client ID no aparece el botón y la
  contraseña sigue funcionando. Solo sirven cuentas cuyo correo confirma Google (Gmail o
  Google Workspace como `@undc.edu.pe`); Outlook o Yahoo no.

## Seguridad

- El JWT del backend se guarda en la cookie httpOnly `ciisic_admin_session`
  (`SameSite=Strict`) con la misma vida que el JWT; el navegador nunca lo ve.
- Todas las llamadas pasan por `/api/backend/**` (proxy Nitro) que agrega el Bearer y
  valida el `Origin` en mutaciones. Las sesiones de inscrito solo pueden usar
  `/api/portal/**` (→ `/api/v1/me/**`); en `/api/backend/**` reciben 403 `FORBIDDEN_PROFILE`.
- El login con Google exige un `nonce` guardado en la cookie httpOnly `ciisic_google_nonce`
  (15 min): un ID token emitido para otra aplicación con el mismo Client ID (la landing) no
  sirve para entrar al panel.
- Los límites por IP del backend (login, Google, código por correo) ven la IP real del visitante:
  el BFF reenvía la última entrada de `X-Forwarded-For` (la de Traefik), nunca la primera, y llama
  al backend por su URL interna.
- Los tokens de proveedores e integraciones se envían una sola vez y el backend los guarda
  cifrados; el panel solo muestra `••••` + últimos 4 caracteres.

## Despliegue

Imagen Docker (`Dockerfile`): Node 22 Alpine sirviendo `.output/server/index.mjs` en el
puerto 3000. Única variable: `NUXT_BACKEND_BASE_URL` (URL interna del backend, obligatoria por
los límites por IP). Servir detrás de HTTPS (la cookie es `Secure` y la cámara del escáner lo
exige). Este panel (spec 009) se despliega **antes** que el backend con la spec 014 y funciona con
el anterior (013); ver [`docs/configuracion-y-despliegue.md`](docs/configuracion-y-despliegue.md).
