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
- **Delegaciones con planes propios** (spec 021; backend 029; reemplazan las specs 014 y 015): página `/delegaciones` (`delegaciones.ver`; ya no es una pestaña de Eventos) con
  `DelegacionesPanel`, `DelegacionAlta`, `DelegacionDetalle`, `PlanesEditor` y `FilasIntegrantes` en `app/components/delegaciones/`; lógica pura en `app/utils/delegaciones.ts`. **Cada delegación tiene
  sus planes** Con kit, Sin kit y Virtual (activo, precio por persona y promocional opcional desde el mínimo de la delegación) y **cada integrante elige el suyo**; **el servidor decide el precio**: el
  panel solo manda el `plan` y muestra un estimado (`estimarGrupo`, solo con `pagos.ver`). Ya no hay tarifa global ni categoría `DELEGACIONES`. Los vouchers son varios (multipart `pagos` + `vouchers`) y son
  **del grupo**; el saldo solo informa. El delegado, con su link (`/delegaciones?delegacion=<código>` de la landing; su origen es `ORIGEN_LANDING_CONFIGURADO`), agrega integrantes y vouchers; con el **link
  individual** (`?unirme=<código>`, que se enciende, apaga y regenera en «Links y correo institucional») cada integrante se inscribe solo, con el prefijo del correo del **dominio** de la delegación
  (`dominioCorreo`, sin Google). **Cada botón sigue al permiso de su acción** (`auth.puede`): crear, datos, integrantes, cambio de plan y subir vouchers = `delegaciones.inscribir` (Comisión
  elegible); planes, precios, dominio y links = `delegaciones.gestionar` (solo Owner y Administrador); verificar, rechazar o **borrar** vouchers y aprobar al grupo = `inscripciones.validar`
  (Tesorero; borrar también lo hace `delegaciones.gestionar`, y un voucher verificado no se borra: primero vuelve a «Pendiente», `puedeEliminarVoucher`); ver el archivo del voucher = `pagos.ver`:
  «Ver» abre `VisorVoucher` sobre el detalle (no otra pestaña; el archivo se lee con `useApi().leerArchivo` en blob, `tipoDeVoucher`, y Anterior/Siguiente recorre los vouchers). El detalle es
  responsive: vouchers e integrantes son tablas desde `md` y tarjetas debajo, y `AccionesVoucher` es el grupo de botones de cada voucher. **Backend 029 + el cambio de borrar voucher primero** (sin él el Tesorero recibe `403`). Sin `pagos.ver` los importes llegan en `null` (sin totales ni vouchers); una Comisión que crea una delegación no fija precios: sus planes nacen apagados
  hasta que un Owner o Administrador los configure. El staff puede inscribir con cualquier correo aunque haya dominio (solo se le avisa). Un DNI de 7 dígitos (Excel pierde el cero) se completa a 8
  (`normalizarDni`). **Backend 029 primero** (su migración convierte las delegaciones existentes).
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
- **Docentes, DNI y página común** (spec 019; backend 028): `/docentes` es un *alias* de `/seguimiento` con un tercer modo (`tipoDeSeguimiento` → `'documento'`): el docente escribe su DNI y ve la misma vista que con su enlace.
  **El DNI vive solo en memoria** (nunca en la URL, `localStorage`, un `console` ni un `useHead`) y viaja por `POST` en el **cuerpo** hasta el backend (`credencialDeCuerpo` / `peticionAlBackend` en `server/utils/enlace-publico.ts`: el token va en `X-Link-Token`, el DNI en el cuerpo).
  Un DNI inválido o desconocido es el mismo aviso; el tope de intentos fallidos es del backend. El filtro de **ciclo y sección** (`seguimientoDocente.ts`) sirve a `/seguimiento` y `/docentes`. En Reportes → Por asesor, `AsesorEditar.vue` agrega, edita (nombre, DNI,
  ciclos y secciones) y elimina docentes (`reportes.gestionar`: el DNI es dato personal y el resumen de `reportes.ver` no lo trae; sale de `GET …/advisory/advisors`). `PadronImportar` pregunta si se **conservan** (por defecto) o se reemplazan los docentes al recargar el padrón.
  Los nombres de `app/utils/docentes.ts` llevan «Docente» (`dniDelDocente`) porque `utils/delegaciones.ts` ya tiene `normalizarDni`. Al enviar un formulario con `api()`, **usa `.value` de los `computed`** en el cuerpo (un ref no se serializa: llega como «No se pudo conectar»). **Backend 028 primero.**
- **Alumnos en varias secciones** (spec 024; backend 033): la sección va ligada al curso, así que cada alumno puede traer `secciones` (opcional: un backend anterior no la envía). En Reportes sale como «También: II-B, IV-B» (`otrasSecciones`, `app/utils/reportes.ts`); en las vistas públicas `secciones` son etiquetas **dentro del alcance de quien mira** (nunca las de otro docente) y el filtro de ciclo y sección de `seguimientoDocente.ts` se cumple en cualquiera de ellas (`seccionesDelAlumnoDocente`). Totales, tablas y descargas las calcula el backend (un alumno cuenta una vez en el total y en cada ciclo y sección en que cursa): el panel no recalcula. **Backend 033 primero.**
- **Seguimiento por curso y docente** (spec 025; backend 034): con SIVIRENO cada alumno trae `cursos` (curso · sección · docente) y el resumen trae `porCurso` y `opciones.cursos`; todo es opcional (un backend anterior o un padrón del Excel no los trae y las pantallas siguen por sección: `hayCursos`). En Reportes la pestaña **«Por curso»** (la primera) lista los cursos con su docente y quién pagó (`buscarCursos`, búsqueda en el navegador), «Alumnos» abre ese curso en el listado (`cursoId`) y «Descargar» baja el reporte del curso; la pestaña de alumnos es el **«Listado completo»** (cursos y docentes de cada alumno; el Excel general trae la hoja «Listado completo» con una fila por alumno y curso). En las vistas públicas las tarjetas **por curso** filtran la lista (`cursoId` de `filtrarAlumnosDocente`) y cada alumno muestra solo sus cursos dentro del alcance de quien mira. Un docente de SIVIRENO (`desdeSivireno`) solo edita nombre y DNI en `AsesorEditar`. Totales y descargas los calcula el backend: el panel no recalcula. **Backend 034 primero.**
- Ponencias especializadas (spec 012; **no** son los papers de `/ponencias`): sus tres pantallas están en
  `app/pages/ponencias-especializadas/` y su lógica pura en `app/utils/ponenciasEspecializadas.ts`. El programa se
  edita solo con `especializadas.gestionar`; inscribir y corregir, con `especializadas.inscribir`; la puerta
  y anular asistencia, con `especializadas.asistencia`. En la puerta un DNI sin nombres abre los campos de
  nombres (`NAMES_REQUIRED`) y conserva el documento; el aviso ámbar cuenta cuando se inscribe en el acto, se
  libera el cupo de otra ponencia del mismo horario o llega fuera de horario. El menú marca un solo ítem
  activo (`itemActivo`: la ruta más específica) porque `/ponencias` es prefijo de `/ponencias-especializadas`.
- **Ponencias solo para congresistas** (spec 020; backend 030): con el **acceso libre** del evento apagado (por defecto) solo se
  inscribe quien tiene su inscripción al congreso aprobada; el interruptor «Acceso libre (gratuito)» está en el Programa
  (`AccesoPonenciasCard`, `useAccesoPonencias`, `GET|PUT events/:id/specialized-talks/access`; solo `especializadas.gestionar`,
  con confirmación) y una franja ámbar (`AvisoAccesoLibre`) avisa en las demás pantallas mientras esté encendido. El **cupo es el
  aforo presencial**: `presenciales()` (con `inscritosPresenciales`; un backend anterior no lo envía y todos cuentan) y los virtuales
  se suman aparte («18 / 20 · +7 virtuales»). Inscripciones muestra la columna «Congreso» (`etiquetaValidacion`: modo y tipo,
  «Sin validar», «pago no vigente») y los filtros `validacion` y `modo` (distinto de la `modalidad` de la ponencia). El alta manual y
  la puerta se rechazan con `CONGRESS_REGISTRATION_NOT_FOUND`, `CONGRESS_PAYMENT_PENDING` o `CONGRESS_REGISTRATION_REJECTED`; un virtual
  se marca con aviso ámbar y no consume aforo. El panel no decide quién puede inscribirse: lo hace el backend. **Backend 030 primero.**
- **Resumen por persona de las ponencias** (spec 022; backend 031): `/ponencias-especializadas/resumen` (`especializadas.ver`) lista **una fila por persona** con su situación
  actual en el congreso (`SituacionCongreso`: pago aprobado, en revisión, rechazado o no inscrito), `puede`, `validada` y `avisadoEn`; los totales (`meta.resumen`) son de todo el evento y no cambian con los
  filtros. **El panel no decide quién puede**: solo deja elegir a quien `puede === false` (`esSeleccionable`) y el backend lo vuelve a comprobar, omite a quien ya tiene el pago aprobado o ya asistió y
  lo informa. Cancelar y avisar o solo avisar (`especializadas.inscribir`) comparten `ResumenComunicado`: el texto es editable (`comunicadoPropuesto`; `{nombre}` lo reemplaza el servidor), se puede
  copiar para quien no tiene correo, y se exige marcar la confirmación; hasta `MAXIMO_POR_ENVIO` (100) personas por envío. La cancelación se guarda aunque un correo falle (`resumenDeResultado`). Con el
  acceso libre encendido todas pueden y no hay casillas. Las inscripciones canceladas por esto muestran el motivo `SIN_CONGRESO`. Un backend anterior responde 404 y la pantalla dice que aún no está
  disponible. Los nombres de `SITUACIONES_CONGRESO` llevan sufijo porque `utils/reportes.ts` ya exporta `SITUACIONES`. **Backend 031 primero.**
- **Temas con varios ponentes** (spec 023; backend 032): un tema que dictan varias personas a la misma hora y en el mismo ambiente sigue siendo **una** ponencia: el formulario
  (`PonenciaForm`) tiene el ponente principal y, debajo, «Agregar ponente» (hasta `MAXIMO_COPONENTES` = 3, cada uno con nombre, perfil, foto y «externo»); el Programa lista a todos
  (`ponentesDeLaPonencia`). `cuerpoPonencia` **siempre** envía `coponentes`: el arreglo reemplaza al guardado y `[]` lo vacía (un backend anterior descarta la clave sin error y el
  panel solo ve al principal). Los errores de cada coponente llevan su posición (`coponentes[1].nombre`), como los del backend. **Backend 032 primero.**
- **Cambiar el tipo de una inscripción** (spec 026; backend 035): «Cambiar tipo» en la tarjeta «Inscripción» del detalle (`CambiarTipoDialogo`; lógica pura en `app/utils/cambioTipo.ts`) solo con
  `inscripciones.cambiar_tipo` (**solo el Owner**, `PERMISOS_SOLO_OWNER`) y **no** en integrantes de una delegación (`puedeCambiarTipo`: su plan se cambia en Delegaciones). Se elige categoría y tipo
  (también los inactivos, marcados) y un motivo opcional. **Corrige la clasificación, no el pago**: el monto pagado no cambia y el diálogo avisa si no coincide con el precio del tipo elegido, cómo queda
  el descuento (`descuentoTrasCambio`, igual que el backend), si cambia la modalidad de asistencia (las ponencias especializadas pendientes de la persona pasan al modo nuevo; a presencial puede fallar
  por cupo: `TALK_FULL_ON_TYPE_CHANGE`) y que la credencial PDF se actualiza sola pero **no se envía ningún correo**. El historial (`cambiosTipo`) viene solo en `GET inscriptions/:id` y en la respuesta del
  cambio: al cambiar el estado se conserva el que ya se tenía. El servidor decide y vuelve a comprobar todo. **Backend 035 primero.**
- **Enlace público del aforo** (spec 027; backend 036): la tarjeta `EnlaceAforoCard` del Programa (`/ponencias-especializadas`) crea, copia, renueva y desactiva el enlace
  `<landing>/aforo-ponencias#<token>` (`urlEnlaceAforo`, con `origenLanding`; el token va tras el `#`), con el que la landing muestra el aforo, los inscritos presenciales, los cupos libres y la
  asistencia de cada tema y la lista de sus inscritos (solo nombre, modo y asistencia; sin DNI ni contacto). Es una credencial y es **solo del Owner** (`especializadas.enlace_aforo`, en `PERMISOS_SOLO_OWNER`): la tarjeta solo se monta con
  `auth.puede('especializadas.enlace_aforo')`. Uno por evento (`GET|POST|DELETE events/:id/specialized-talks/occupancy-link`, `{ regenerar }` para renovar). **Backend 036 primero.**
- **Entrega del kit y asistencia solo presencial** (spec 028; backend 037): el kit es de la **inscripción** (uno por persona en todo el congreso, no uno por actividad); el tipo dice si lo incluye
  (`tipo.incluyeKit`, dentro del objeto del tipo como `modalidad`; los planes de delegación, solo `CON_KIT`) y **el panel nunca lo deduce del texto de la etiqueta** (`app/utils/kit.ts`: `estadoKit` =
  `ENTREGADO` | `PENDIENTE` | `SIN_KIT` | `NO_APLICA`). Entregar y deshacer (`PUT|DELETE inscriptions/:id/kit`) son de quien marca asistencia (`asistencia.marcar`, sin permiso nuevo) y se ven en tres lugares: el
  **escáner** (insignia CON KIT / SIN KIT / KIT ENTREGADO; con el kit pendiente el resultado **no se cierra solo** —`esperaContinuar`: cámara pausada y lecturas en espera— hasta «Entregar kit» o «Continuar sin entregar»),
  la **pantalla Asistencia** (botón junto al resultado, columna «Tipo y kit», acciones en la tabla y «Kits: X entregados · Y pendientes de Z» del evento) y el **detalle de la inscripción**. «Ya registrada» (409) trae a la persona y su
  kit en `datos` del error (`aErrorApi`: el cuerpo del backend llega tal cual y su `data` son esos datos; el cuerpo anidado de `createError` del BFF no los tiene), así un kit pendiente se entrega al volver a escanear.
  **Deshacer** no pide que el tipo siga incluyendo kit. En el editor de tipos «Incluye kit» queda apagado y desactivado si el tipo es virtual (`backendSinKit`, `kitNoGuardado`, `avisoKitIncoherente`, `avisoCambioKit`).
  **Los virtuales no marcan asistencia**: el backend responde `403 VIRTUAL_REGISTRATION` y el escáner lo muestra en rojo («Inscripción virtual»); el aviso ámbar anterior queda solo como respaldo con un backend que aún no bloquea.
  Todo es tolerante: sin `kit` (backend anterior) las pantallas se ven como antes. **Backend 037 primero.**
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

Constitución: [`.specify/memory/constitution.md`](.specify/memory/constitution.md). Specs 001–028
en `specs/` (base, inscripciones, eventos y tipos, consultas DNI, resumen/Semana Sistémica,
correo y tokens de acceso, sistema/Google/portal, roles y permisos, portal del participante y
escáner, «Disponible para» de los tipos, eliminar inscripciones solo el Owner, modalidad virtual de
asistencia, tipos que no admiten estudiantes UNDC, delegaciones con convenio, tarifa de delegaciones administrable (reemplazada por la 021, delegaciones con planes propios), reportes de seguimiento por asesor, enlace público por docente, enlace público por ciclo, docentes con DNI y página común, ponencias especializadas solo para congresistas con pago aprobado, resumen por persona de las ponencias con cancelación y comunicado, temas de ponencias con varios ponentes, alumnos en varias secciones, seguimiento por curso y docente de SIVIRENO, cambiar el tipo de una inscripción solo el Owner, enlace público del aforo de las ponencias solo el Owner, entrega del kit y asistencia solo presencial). Flujo: spec → plan → tasks; marcar tasks. Contratos: roles y permisos en
`backend-ciisic/specs/013-roles-permisos/contracts/`; código por correo, portal, fotocheck,
asistencia por QR, alta de participantes y cortesías en
`backend-ciisic/specs/014-portal-fotocheck-asistencia/contracts/`; modalidad virtual en
`backend-ciisic/specs/018-modalidad-virtual/contracts/`; tipos que no admiten estudiantes UNDC en
`backend-ciisic/specs/020-virtual-sin-estudiantes-undc/contracts/`; delegaciones con convenio en
`backend-ciisic/specs/023-delegaciones-convenio/contracts/` y, con planes y tarifa propios, en `backend-ciisic/specs/029-delegaciones-planes/contracts/`; reportes por asesor en `backend-ciisic/specs/025-reportes-asesores/contracts/`, los enlaces de los docentes en `backend-ciisic/specs/026-enlaces-docentes/contracts/` y los de los ciclos en `backend-ciisic/specs/027-enlaces-ciclo/contracts/` y los docentes con DNI en `backend-ciisic/specs/028-docentes-dni/contracts/` y el resumen de ponencias en `backend-ciisic/specs/031-ponencias-resumen-personas/contracts/` y las secciones por curso en `backend-ciisic/specs/033-padron-secciones-jp/contracts/` y los cursos y docentes de SIVIRENO en `backend-ciisic/specs/034-padron-cursos-sivireno/contracts/` y el cambio de tipo de una inscripción en `backend-ciisic/specs/035-cambiar-tipo-inscripcion/contracts/` y la entrega del kit en `backend-ciisic/specs/037-entrega-kit/contracts/`.

## Antes de dar por terminado

1. `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde.
2. Probar en el navegador contra el backend local la pantalla afectada, con el perfil que
   corresponda y con una cuenta de cada rol que la use (Owner, Administrador, Tesorero, Comisión).
   Mientras producción no tenga el backend 014, probar también lo nuevo contra el 013.
3. Mensajes para códigos de error nuevos en `app/utils/errores.ts`.
4. Documentación de `docs/` al día.
