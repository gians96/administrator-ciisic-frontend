# Feature Specification: Base del panel administrativo

**Feature Branch**: `feat/panel-admin` · **Created**: 2026-09-29 · **Status**: Implementado
**Input**: "administrator-ciisic-frontend será el panel visual para administración… usaremos Nuxt con Tailwind, pero no uses el Tailwind que viene de Nuxt sino la fuente de Tailwind."

## User Scenarios & Testing

### User Story 1 - Acceso seguro (Priority: P1)
Como administrador quiero iniciar sesión con mi correo y contraseña y que mi sesión sea
segura (sin tokens accesibles desde JavaScript).

**Acceptance Scenarios**:
1. **Given** credenciales válidas, **When** ingreso, **Then** se crea la cookie httpOnly y veo el resumen.
2. **Given** credenciales inválidas o cuenta inactiva, **Then** veo "Correo o contraseña incorrectos."
3. **Given** que el JWT expiró (1 h), **When** hago cualquier acción, **Then** vuelvo al login y
   luego regreso a la página donde estaba.
4. **Given** un Admin (no SuperAdmin), **When** intento abrir /administradores, **Then** se redirige al inicio.

### User Story 2 - Trabajar por evento (Priority: P1)
Como administrador quiero elegir en la barra superior el evento sobre el que trabajo
(por defecto el principal) y que todas las pantallas usen ese evento.

### User Story 3 - Navegación y feedback (Priority: P2)
Barra lateral con secciones Congreso/Configuración, diseño responsive (menú móvil),
notificaciones (toasts) y confirmaciones para acciones destructivas.

## Requirements
- **FR-001**: Nuxt 4 en modo SPA con Nitro como BFF (`/api/auth/*`, `/api/backend/**`).
- **FR-002**: Cookie `ciisic_admin_session` httpOnly, `SameSite=Strict`, `Secure` en producción, 1 h.
- **FR-003**: El proxy agrega `Authorization: Bearer`, valida `Origin` en mutaciones, rechaza rutas con `..`
  y cierra la sesión si el backend responde 401.
- **FR-004**: Tailwind v4 con `@tailwindcss/vite`; tokens de marca en `@theme`. Sin `@nuxtjs/tailwindcss`.
- **FR-005**: Selector de evento persistido en `localStorage` por navegador.
- **FR-006**: Componentes base propios accesibles: botón, campo, modal/drawer (`<dialog>`), badge,
  paginación, pestañas, interruptor, toasts, confirmación, estado vacío, KPI.

## Success Criteria
- **SC-001**: `document.cookie` no contiene el JWT en ningún momento.
- **SC-002**: Lint, typecheck, pruebas y build en verde.
