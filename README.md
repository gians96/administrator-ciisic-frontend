# Panel administrativo CIISIC

- **Documentación** (pantallas, BFF y sesiones, Google, configuración y despliegue): [`docs/`](docs/README.md)
- **Guía para agentes de IA y forma de trabajar con el resto del ecosistema**: [`AGENTS.md`](AGENTS.md)

Panel del Congreso Internacional de Ingeniería de Sistemas e Investigación Científica
(UNDC) para gestionar **eventos**, **inscripciones** (revisión de vouchers, aprobación y
credenciales), **tipos de inscripción**, **asistencia**, **consultas DNI** (pool de tokens
Decolecta/apiperu), **ponencias**, **mensajes**, **participantes**, **administradores**, los
**tokens de acceso** de cada evento, el **correo** (Brevo), la configuración del **sistema**
(API UNDC, Google, URL del panel) y la **integración con deportes-fi** (resumen de la Semana
Sistémica). Los inscritos también entran, con Google, a **Mis inscripciones**.

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

- **Administradores**: correo y contraseña, o «Continuar con Google» con la cuenta de su
  correo (Gmail o institucional). La primera vez queda vinculada esa cuenta de Google; el
  SuperAdmin ve «Google vinculado» en Administradores y puede desvincularla.
- **Inscritos**: «Continuar con Google» con el correo de su inscripción. Solo ven
  **Mis inscripciones** (evento, estado, motivo de rechazo y credencial en PDF cuando está
  aprobada). Los administradores ven su vínculo en Participantes y pueden desvincularlo.
- **Google**: el SuperAdmin pega el Client ID (cliente OAuth de tipo Web) en **Sistema** y
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
- Los tokens de proveedores e integraciones se envían una sola vez y el backend los guarda
  cifrados; el panel solo muestra `••••` + últimos 4 caracteres.

## Despliegue

Imagen Docker (`Dockerfile`): Node 22 Alpine sirviendo `.output/server/index.mjs` en el
puerto 3000. Única variable: `NUXT_BACKEND_BASE_URL` (URL interna del backend). Servir
detrás de HTTPS (la cookie es `Secure`).
