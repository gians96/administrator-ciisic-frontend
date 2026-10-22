# AGENTS.md — administrator-ciisic-frontend (panel del congreso)

Guía para agentes de IA y desarrolladores que trabajen en este repositorio.

## Qué es

Panel del Congreso CIISIC (UNDC) con **dos perfiles**:
- **Staff**: Owner, Administrador del sistema (ambos con todos los eventos), Tesorero y Comisión
  tecnológica (solo sus eventos). Cada cuenta ve las pantallas y botones que sus **permisos**
  permiten: resumen, inscripciones, asistencia, escáner de asistencia (QR del fotocheck, lector USB
  o DNI), ponencias (papers) y **ponencias especializadas** (programa, inscripciones con filtros y
  asistencia en puerta con el DNI), mensajes, eventos, tipos de inscripción, consultas DNI, participantes (con
  alta y cortesías), correo, equipo y administradores, y sistema (solo Owner). Tabla de permisos por
  pantalla y por rol en [`docs/overview.md`](docs/overview.md).
- **Portal del inscrito** (entra con Google o con un código a su correo): inscripciones (estado,
  motivo de rechazo, credencial PDF), fotocheck virtual con QR, asistencia, certificados (llegan con
  la spec 015 del backend) y perfil (celular y foto opcional). El staff inscrito con su mismo correo
  pasa a su portal desde el menú de su cuenta.

Todo el dato vive en backend-ciisic; el panel es una SPA con un BFF Nitro. Documentación:
[`docs/`](docs/README.md).

## Entorno y comandos

- Nuxt 4 SPA (`ssr: false`) + servidor Nitro (BFF), **Tailwind v4 vía `@tailwindcss/vite`**
  (nunca `@nuxtjs/tailwindcss`), Pinia, `@nuxt/icon` (heroicons), chart.js, `vue-qrcode-reader`
  (cámara del escáner, con el wasm de ZXing servido por el panel), Vitest. Gestor: **bun**.
- Única variable (runtime, servidor): `NUXT_BACKEND_BASE_URL` (ver [`.env.example`](.env.example)).
  El client ID de Google y la vida de la sesión vienen del backend.
- Comandos:

  | Tarea | Comando |
  |---|---|
  | Desarrollo (puerto 3001) | `bun run dev` |
  | Lint · tipos · pruebas | `bun run lint` · `bun run typecheck` · `bun run test` |
  | Build · vista previa | `bun run build` · `bun run preview` |
  | Copiar el wasm de ZXing del escáner a `public/zxing-wasm/<versión>/` (al actualizar `vue-qrcode-reader`) | `bun run escaner:wasm` |

- Necesitas backend-ciisic en `http://localhost:3010` con un administrador (bootstrap) y, para
  Google, el client ID guardado en Sistema con `http://localhost:3001` autorizado en Google Cloud.
  El código por correo, el fotocheck y el escáner con QR nuevo necesitan el backend con la spec 014
  (rama `feat/portal-fotocheck`) y una credencial de correo predeterminada activa (Correo); con el
  backend 013 el panel debe seguir funcionando (ver «Compatibilidad» abajo).

## Arquitectura

- `server/utils/session.ts`: cookie httpOnly `ciisic_admin_session` (SameSite Strict, Secure en
  producción) con el JWT del backend; su vida = la del JWT (`vida-sesion.ts`).
- `server/utils/proxy.ts`: proxy autenticado reutilizado por:
  - `server/api/backend/[...path].ts` → `/api/v1/*`, solo perfil **ADMIN**;
  - `server/api/portal/[...path].ts` (y `index.ts` para la raíz) → `/api/v1/me/*`, solo perfil
    **PARTICIPANTE**;
  el otro perfil recibe `403 FORBIDDEN_PROFILE`. Valida `Origin` en mutaciones, no reenvía
  `Origin`/`Referer`/cookies del navegador y cierra la sesión si el backend responde 401.
- `server/utils/jwt-publico.ts`: lee la audiencia del JWT **solo para enrutar** (el backend verifica).
- `server/api/auth/*`: `login.post` (contraseña), `google.get` (client ID + nonce en cookie
  httpOnly), `google.post` (canjea el ID token en `/v1/auth/google`), `config.get`
  (`accesoCodigo.disponible`), `codigo/index.post` y `codigo/verificar.post` (código por correo →
  sesión de participante), `portal.post` (el staff pasa a su portal), `session.get`, `logout.post`.
  Lógica pura en `server/utils/acceso-codigo.ts` y `respuestas-auth.ts` (`errorPropagado`: estado,
  `code`, `fields` y `Retry-After`; la ruta inexistente de un backend anterior → 503 con respaldo).
- `server/utils/ip-cliente.ts`: login, Google y código reenvían en `x-forwarded-for` la **última**
  entrada de `X-Forwarded-For` (la de Traefik) o la IP de la conexión, **nunca la primera**; una IPv4
  escrita como IPv6 (`::ffff:a.b.c.d`) va como IPv4. Supone un solo proxy delante (ver
  `docs/configuracion-y-despliegue.md` antes de agregar un CDN o balanceador).
- `server/utils/renovar-sesion.ts`: si al JWT del staff le quedan < 20 min, el BFF lo renueva con
  `POST /v1/auth/refresh` (proxy y `session.get`); el backend corta la sesión a las 12 h. La sesión
  del participante (12 h) no se renueva (`esRenovable`). Si la sesión se cerró o pasó al portal
  mientras una petición renovaba, esa respuesta no devuelve la cookie del staff
  (`descartarRenovacionSiSeCerro`).
- `app/stores/auth.ts` (sesión `{ tipo, usuario | participante }`, `acceso` y `puede(permiso)`),
  `app/middleware/auth.global.ts` + `app/utils/sesion.ts` (redirecciones por perfil y por `permiso`)
  y `app/utils/permisos.ts` (catálogo, menú, `inicioPara` —la cuenta que solo marca asistencia
  empieza en `/escanear`—; único lugar con códigos de rol).
- `app/composables/useApi.ts` (staff: 401 → login con motivo; 403 `FORBIDDEN`/`EVENT_NOT_ASSIGNED`
  → relee el acceso y los eventos) y `usePortal.ts` (inscrito: 401 → login con motivo y `redirect`;
  403 `FORBIDDEN_PROFILE` → relee la sesión y va a donde corresponda);
  `app/utils/errores.ts` traduce los `code` del backend.
- Portal y escáner: `app/utils/portal.ts` (`NAVEGACION_PORTAL`, `esNoDisponible`, tipos del portal),
  `app/utils/codigoAcceso.ts` + `components/auth/AccesoConCodigo.vue` (código por correo),
  `app/utils/lecturaQr.ts` (`interpretarLectura`, `debeProcesar`) y `app/utils/foto.ts` (foto del
  perfil recodificada con canvas).
- Layouts: `default` (menú lateral contraíble con la hamburguesa —preferencia en `localStorage`—,
  selector de evento y menú de usuario `MenuUsuario`, con «Mi portal de participante» si
  `acceso.perfilParticipante`), `escaner` (`/escanear` a pantalla completa: volver, selector de
  evento, actividad y menú de usuario) y `participante` (sin menú lateral: pestañas en escritorio y
  barra inferior en el celular desde `NAVEGACION_PORTAL`, mismo menú de usuario).

## Convenciones de código

- TypeScript; lógica en funciones puras de `app/utils` y `server/utils` con pruebas Vitest.
- Componentes base propios en `app/components/ui` (Button, Input, Select, Modal, Drawer, Table,
  Badge, Tabs, Toast, Confirm); marca navy/cyan, Barlow/Poppins; accesibilidad (labels, foco, aria).
- Copias de datos reactivos con `clonarLista` (`app/utils/clonar.ts`), nunca `structuredClone`
  sobre proxies de Vue.
- Fechas con `app/utils/formato.ts` y `whitespace-nowrap` en tablas.
- Textos en español; errores por código.
- Terminología (spec 012): **modalidad de asistencia** (`ModalidadAsistencia`, `tipo.modalidad`: presencial o
  virtual) ≠ **modalidad de pago** (`modalidadPago`, `pago.modalidad`: banco, billetera, cortesía) ≠
  **fotocheck virtual** (la credencial digital del portal) ≠ «Modalidad 01/02/03» (tarjetas de `/planes` de la
  landing). `modalidad` va siempre dentro del objeto del tipo, nunca en la raíz de una inscripción.

## Reglas de negocio clave (no romper)

- Páginas de administración: sesión de staff y el permiso de la página
  (`definePageMeta({ permiso: '…' })`, mismo permiso que su ítem en `MENU` de `app/utils/permisos.ts`).
  Menús y botones se deciden con `auth.puede(permiso)`, **nunca** con el código del rol (Owner =
  `SUPERADMIN`, Administrador del sistema = `ADMIN`, Tesorero y Comisión con alcance por evento).
  Sin `pagos.ver` los montos llegan en `null` (`soles()` muestra «—»).
- Portal: solo las páginas con `definePageMeta({ layout: 'participante', perfil: 'participante' })`
  (las de `NAVEGACION_PORTAL`) y `/api/portal/**` para el perfil PARTICIPANTE. El código por correo
  **siempre** abre el portal, nunca el panel; el staff pasa a su portal en un solo sentido (para
  volver, ingresa de nuevo).
- Escáner: lo leído se limpia y se interpreta con `interpretarLectura` (10 letras o dígitos →
  `{ codigo }` en mayúsculas; solo dígitos → `{ participanteId }`, QR anterior); cualquier otra cosa
  es «QR no válido» y **no** se envía al backend. `alerta: 'QR_LEGADO'` → resultado ámbar «QR antiguo:
  verifica el DNI», que solo se cierra con «Continuar» (`esperaContinuar`). Las marcas van de una en
  una y en orden por `crearColaEnvios` (`app/utils/colaEnvios.ts`): ninguna lectura se pierde sin
  aviso (cola llena → «No procesada» en la lista). Con un error o el aviso del QR anterior a la vista
  la cámara se pausa (`pausaLaCamara`); al cerrar un error el mismo QR se puede volver a escanear
  (`recienteTrasCerrar`). «Fuera de horario» se desmarca al cambiar de actividad. El wasm de ZXing se
  configura una sola vez (`usarZxingDelPanel`) y se sirve con caché inmutable.
- **Modalidad de asistencia** (spec 012): cada tipo es `PRESENCIAL` (por defecto) o `VIRTUAL`; los virtuales viven
  dentro de las categorías existentes (Estudiantes y Público general), con `precio == precioInstitucional`.
  Todo es tolerante (`modalidadDe`, `esVirtual` en `app/utils/modalidad.ts`): ausente, `null` o desconocida =
  presencial, y contra un backend sin la spec 018 las pantallas se ven como antes. Lo nuevo aparece solo cuando se
  usa: el filtro «Modalidad» del listado y el bloque Presencial / Virtual del Resumen requieren un tipo virtual
  (`hayTiposVirtuales`, `filasModalidadVisibles`), no solo un backend con la 018. **Orden de despliegue: el backend
  018 primero.** El backend anterior descarta `modalidad` sin error y el tipo quedaría presencial: el editor de
  tipos lo advierte (`backendSinModalidad`, `modalidadVirtualNoGuardada`). La tarifa única se precarga solo al
  crear un tipo (nunca al editar) y se confirma al guardar si los precios difieren (`avisoTarifaUnica`).
  **Nada se bloquea**: el escáner y la pantalla Asistencia solo muestran un aviso ámbar (`resultadoDeMarca`,
  `tonoDeMarca`/`textoMarca`) que no espera «Continuar» (eso es solo del QR anterior), y el portal muestra el
  fotocheck y el QR igual. Los textos son neutros (sin enlaces, horas ni certificado) hasta que la organización
  responda cómo se entrega el acceso, qué certificados y asistencia corresponden a los virtuales y si se exige
  constancia.
- **Tipos sin estudiantes UNDC** (spec 013): el interruptor `tipo.excluyeEstudiantesUndc` («No admitir estudiantes UNDC» en el editor de tipos, insignia «Sin estudiantes UNDC» en la lista) se enciende en los tipos virtuales. Bloquea solo a estudiantes UNDC (verificados con SIVIRENO o con correo de código `@undc.edu.pe`), no a docentes, administrativos ni externos, y solo frena inscripciones nuevas (las ya hechas se rechazan o cancelan a mano; las cortesías no aplican la regla). Es independiente de «Disponible para» y de «Modalidad». Ausente = `false`. **Backend 020 primero**: el anterior descarta la clave sin error y el editor lo advierte (`backendSinExcluyeEstudiantes`, `excluyeEstudiantesNoGuardado`).
- **Delegaciones con convenio** (spec 014; backend 023): pestaña Delegaciones de Eventos (`DelegacionesPanel` con
  `DelegacionAlta`, `DelegacionDetalle` y `FilasIntegrantes` en `app/components/delegaciones/`; lógica pura en
  `app/utils/delegaciones.ts`). **El servidor decide el tipo y el precio**: el panel solo muestra un estimado
  (`estimarGrupo`, con los precios de los tipos `delegacion_general`, `delegacion_grupal` y `delegacion_virtual` de
  la categoría `DELEGACIONES`) y nunca envía precios. Presencial: S/ 60 con menos de 10 integrantes y S/ 50 desde 10;
  virtual: S/ 30 sin escalas, y solo se ofrece si existe el tipo `delegacion_virtual`. Los vouchers son varios
  (multipart `pagos` + `vouchers`); el staff los verifica o rechaza y el saldo solo informa. El delegado, con su link
  (`/delegaciones?delegacion=<código>` de la landing; su origen es `ORIGEN_LANDING_CONFIGURADO`, porque panel y landing viven en dominios distintos), solo agrega; quitar integrantes, eliminar vouchers y aprobar al
  grupo son del panel. Un DNI de 7 dígitos (Excel pierde el cero) se completa a 8 (`normalizarDni`). **Backend 023
  primero.** **Tarifa administrable** (spec 015; backend 024, sin migración): la tarjeta de la pestaña lee
  `GET events/:id/delegations/tarifa` y «Editar tarifa» (`TarifaDelegacionesForm`) la guarda con `PUT` enviando solo lo
  que cambió (`cuerpoTarifa`): precios y mínimo presenciales, precio virtual y si la modalidad virtual se ofrece. Rige
  para delegaciones nuevas; «aplicar a las existentes» solo alcanza a las que no tienen integrantes ni vouchers. En
  `DelegacionDetalle`, «Tarifa de esta delegación» edita modalidad (solo sin integrantes), mínimo y precios de esa
  delegación con `PUT delegations/:id` (en virtual el precio es único) y marca el convenio (`esTarifaDeConvenio`). El
  panel sigue sin enviar montos por inscripción. Con un backend sin la ruta (`esNoDisponible`) la tarjeta se arma con los
  tipos y no hay «Editar tarifa». **Backend 024 primero.**
- **Reportes de seguimiento por asesor** (spec 016; backend 025): `/reportes` (`reportes.ver`) cruza el padrón de la facultad con las
  inscripciones **en cada consulta**; el panel solo muestra y descarga (`useApi().descargar`, en blob, con el nombre que envía el
  servidor: el de cada docente). Lógica pura en `app/utils/reportes.ts` (nombres con sufijo `Reporte` donde chocarían con
  `utils/filtros.ts`, porque Nuxt auto-importa `app/utils`) y componentes en `app/components/reportes/`. **Pagó = inscripción aprobada**;
  en revisión (voucher sin validar) y rechazado/cancelado no cuentan; «No pagaron» = todo lo que no es «Pagó». Asesor, ciclo, sección y
  turno **delimitan** el grupo (indicadores, tablas y descargas); situación y búsqueda solo afectan al listado. El reporte de un docente
  es siempre el suyo completo, sin importar los filtros. Sin `pagos.ver` llegan `monto`, `fechaPago` y `recaudado` en `null` (`conPago`
  `false`): sin esas columnas. Excel y PDF: `reportes.exportar`; cargar el padrón (siempre «Revisar archivo» antes de confirmar, que
  **reemplaza** el padrón): `reportes.gestionar`, solo Owner y Administrador. **Backend 025 primero.**
- **Enlace público por docente** (spec 017; backend 026): `/seguimiento` es la **única página sin sesión** del panel (`definePageMeta({ layout: 'blank', publica: true })`;
  el middleware global no pide ni carga la sesión). El enlace es `<origen del panel>/seguimiento#<token>`: **el token va tras el `#`** (no se envía a ningún
  servidor ni a `Referer`), la página lo manda por `POST /api/publico/seguimiento` (y `/export`) al BFF (`server/api/publico`, `server/utils/enlace-publico.ts`) y este
  lo reenvía al backend en `X-Link-Token` con la IP real (`ipCliente`). **Nunca pongas el token en una URL, un log, un `console` ni un `useHead` que lo
  repita.** La vista del docente muestra solo nombre, código, ciclo, sección, turno, celular y situación (el backend no envía DNI, correo ni montos) y filtra
  en el navegador (`app/utils/seguimientoDocente.ts`). Crear, copiar, renovar y desactivar enlaces es `reportes.gestionar`
  (`components/reportes/EnlacesDocentes.vue`, dentro del diálogo `EnlacesPublicos`; helpers en `app/utils/enlacesDocentes.ts`). Los menús usan `AppMenu` (API `popover`: no los recortan las tablas ni los
  diálogos). Las tablas con desplazamiento llevan `relative overflow-x-auto`: sin `relative` los `sr-only` ensanchan la página. **Backend 026 primero.**
- **Enlace público por ciclo** (spec 018; backend 027): `/seguimiento/ciclo#<token>` es un *alias* de `/seguimiento` (`definePageMeta({ alias })`: misma página, `tipoDeSeguimiento(route.path)`
  decide la vista); el enlace del docente no cambia. El BFF recibe `tipo` (`asesor` por defecto o `ciclo`, `tipoDeCuerpo`) y reenvía a `public/advisor` o `public/cycle` (`RUTA_BACKEND`); un token de
  docente no abre un ciclo ni al revés. La vista del ciclo muestra tarjetas de sección con su docente y **no trae celular, DNI, correo ni montos**: no agregues una columna de celular (la lista llega a más gente
  que el docente). `seguimientoDocente.ts` filtra ambas vistas. Se gestiona en el diálogo `EnlacesPublicos` (pestañas Docentes y Ciclos, `EnlacesDocentes` y `EnlacesCiclos`) y en la pestaña «Por ciclo» de Reportes
  (`reportes.gestionar`). Las pestañas de ese diálogo son propias: `AppTabs` pone ids `tab-<id>` que chocarían con los de Reportes. **Backend 027 primero.**
- Ponencias especializadas (spec 012; **no** son los papers de `/ponencias`): sus tres pantallas están en
  `app/pages/ponencias-especializadas/` y su lógica pura en `app/utils/ponenciasEspecializadas.ts`. El programa se
  edita solo con `especializadas.gestionar`; inscribir y corregir, con `especializadas.inscribir`; la puerta
  y anular asistencia, con `especializadas.asistencia`. En la puerta un DNI sin nombres abre los campos de
  nombres (`NAMES_REQUIRED`) y conserva el documento; el aviso ámbar cuenta cuando se inscribe en el acto, se
  libera el cupo de otra ponencia del mismo horario o llega fuera de horario. El menú marca un solo ítem
  activo (`itemActivo`: la ruta más específica) porque `/ponencias` es prefijo de `/ponencias-especializadas`.
- Foto del perfil: recodificada con canvas (recorte cuadrado centrado, JPEG de 600 × 600 px, mínimo
  200 px) y con la casilla de consentimiento obligatoria; el multipart lleva solo `file` y
  `consentimiento=true`.
- Archivos del portal (credencial PDF, certificados): con `PortalBotonDescarga` / `usePortal().descargar`
  (`$fetch` en blob), nunca con un `<a href>` directo al BFF: así un error (`503 PDF_BUSY`, sesión
  vencida, `409 NOT_APPROVED`) se muestra con su mensaje en lugar del JSON del backend.
- **Compatibilidad**: este panel (spec 009) se despliega **antes** que el backend 014; producción
  tiene el 013. Lo nuevo degrada: sin `accesoCodigo.disponible` no se ofrece el código; una sección
  del portal que recibe 404 de ruta o 405 muestra «pronto disponible» (`esNoDisponible`, no los 404
  de negocio); el escáner sigue marcando con el QR anterior (`{ participanteId, metodo: 'QR' }`).
- Secretos (API keys, tokens) son de solo escritura: se muestran enmascarados; el token de acceso
  de un evento se muestra una única vez y no se guarda en el navegador.
- Rechazar exige motivo; aprobar genera la credencial y el correo (si el correo falla, se ofrece
  reenviar).

## Seguridad

- El JWT nunca llega a JavaScript del navegador (cookie httpOnly); no usar localStorage para sesiones.
  El único dato personal que el portal guarda en el dispositivo es la copia sin conexión del último
  fotocheck (`ciisic-portal:fotocheck`, sin el JWT), que se borra al cerrarse la sesión o cambiar de
  persona (`app/plugins/fotocheck-guardado.client.ts`).
- El login con Google exige el `nonce` emitido por este servidor (cookie httpOnly de un solo uso).
- No agregar variables `NUXT_PUBLIC_*` con configuración del backend: se lee del backend.
- Los límites por IP del backend dependen de la IP que reenvía el BFF: en producción
  `NUXT_BACKEND_BASE_URL` es la URL interna de Docker y nunca se reenvía la primera entrada de
  `X-Forwarded-For` (la puede inventar el cliente).

## Ecosistema y comunicación entre sistemas

Contratos: `backend-ciisic/docs/arquitectura-ecosistema.md`. Este panel es el consumidor del
**contrato 4** (API administrativa) y del **contrato 5** (Google, código por correo y portal). **No
expone API** propia: su BFF solo reenvía a backend-ciisic.

| Sistema | Repositorio | Relación |
|---|---|---|
| API del congreso | `gians96/backend-ciisic` | Proveedor único (vía BFF) |
| Landing del evento | `gians96/ciisic-undc-web` | Usa el token de acceso que se genera aquí (Eventos → Acceso); su `/login` y "Mis inscripciones" llegan aquí |
| API_UNDC / SIGENET | otros repos | La API key de API_UNDC se crea en SIGENET y se registra aquí (Sistema) |
| deportes-fi | otros repos | El token por evento se genera en deportes-fi y se registra aquí (Eventos → Integraciones) |

Puertos locales: landing 3000 · panel 3001 · backend-ciisic 3010 · API_UNDC 3020 · deportes-fi 3030.

**Protocolo de cambio de contrato**: el cambio empieza en backend-ciisic (spec + `contracts/` +
`docs/arquitectura-ecosistema.md`); el panel se adapta en su rama; prueba integrada local.

**Trabajo con agentes (varias sesiones en paralelo)**:
- Un agente por repositorio a la vez. Al empezar: `git status` y `git log --oneline -10`; si hay
  cambios sin comitear que no son tuyos, detente y coordina (ya ocurrió: dos sesiones editando
  este repo a la vez).
- No modifiques el backend ni la landing desde aquí.
- Git: ramas `feat/*` (roles y permisos: `feat/roles-permisos`; portal y escáner:
  `feat/portal-escaner`); `git add <rutas explícitas>`;
  commits convencionales en español; sin push, merge ni despliegues sin confirmación humana.
- Al terminar, reporta commits, pruebas y pendientes.

## SDD con Spec Kit

Constitución: [`.specify/memory/constitution.md`](.specify/memory/constitution.md). Specs 001–018
en `specs/` (base, inscripciones, eventos y tipos, consultas DNI, resumen/Semana Sistémica,
correo y tokens de acceso, sistema/Google/portal, roles y permisos, portal del participante y
escáner, «Disponible para» de los tipos, eliminar inscripciones solo el Owner, modalidad virtual de
asistencia, tipos que no admiten estudiantes UNDC, delegaciones con convenio, tarifa de delegaciones administrable, reportes de seguimiento por asesor, enlace público por docente, enlace público por ciclo). Flujo: spec → plan → tasks; marcar tasks. Contratos: roles y permisos en
`backend-ciisic/specs/013-roles-permisos/contracts/`; código por correo, portal, fotocheck,
asistencia por QR, alta de participantes y cortesías en
`backend-ciisic/specs/014-portal-fotocheck-asistencia/contracts/`; modalidad virtual en
`backend-ciisic/specs/018-modalidad-virtual/contracts/`; tipos que no admiten estudiantes UNDC en
`backend-ciisic/specs/020-virtual-sin-estudiantes-undc/contracts/`; delegaciones con convenio en
`backend-ciisic/specs/023-delegaciones-convenio/contracts/` y su tarifa en `backend-ciisic/specs/024-tarifa-delegaciones/contracts/`; reportes por asesor en `backend-ciisic/specs/025-reportes-asesores/contracts/`, los enlaces de los docentes en `backend-ciisic/specs/026-enlaces-docentes/contracts/` y los de los ciclos en `backend-ciisic/specs/027-enlaces-ciclo/contracts/`.

## Antes de dar por terminado

1. `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde.
2. Probar en el navegador contra el backend local la pantalla afectada, con el perfil que
   corresponda y con una cuenta de cada rol que la use (Owner, Administrador, Tesorero, Comisión).
   Mientras producción no tenga el backend 014, probar también lo nuevo contra el 013.
3. Mensajes para códigos de error nuevos en `app/utils/errores.ts`.
4. Documentación de `docs/` al día.
