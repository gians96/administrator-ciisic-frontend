# Visión general

El panel trabaja sobre el **evento seleccionado** (selector en la cabecera; por defecto el evento
principal). Las cuentas por evento solo ven sus eventos en el selector y el panel recuerda, por
cuenta y navegador, el último que eligieron. Perfiles y pantallas:

## Administración (staff)

Cada cuenta de staff tiene un rol, y el panel muestra pantallas y botones según sus **permisos**
(los envía el backend en la sesión; spec 008, contrato en backend-ciisic spec 013).

| Rol | Alcance | Qué hace |
|---|---|---|
| **Owner** | Todos los eventos | Todo. Único que configura Sistema, que elimina inscripciones (rechazadas o canceladas), que cambia el tipo de una inscripción y que gestiona Owners y Administradores |
| **Administrador del sistema** | Todos los eventos | Todo menos Sistema, eliminar inscripciones y cambiar su tipo. Gestiona Tesoreros y Comisión |
| **Tesorero** | Sus eventos | Resumen e inscripciones con montos y vouchers, validar pagos (sin cancelar ni eliminar), exportar, reenviar credenciales; ver asistencia, ponencias y mensajes |
| **Comisión tecnológica** | Sus eventos | Los permisos elegidos para su cuenta (por defecto, marcar asistencia); nunca pagos, validación ni configuración |

### Pantallas y permisos

| Pantalla | Qué permite | Permiso de la página | Acciones con permiso propio |
|---|---|---|---|
| Resumen (`/`) | KPIs del evento, inscripciones por día/estado/tipo, bloque Presencial / Virtual (inscripciones, aprobadas y monto; spec 012; solo cuando el evento ya tiene tipos o inscripciones virtuales), recaudado, tarjeta "Semana Sistémica" (congreso + deportes) | `resumen.ver` | Montos: `pagos.ver` |
| Inscripciones | Filtros (estado, categoría, **modalidad de asistencia** —solo si existe algún tipo virtual—, tipo, UNDC y búsqueda), insignia «Virtual» en la columna Tipo, detalle con modalidad de asistencia, verificación UNDC y de correo (Google); el Owner puede corregir el **tipo y la categoría** de una inscripción desde el detalle («Cambiar tipo», spec 026: conserva lo pagado y deja un historial en el propio detalle); el CSV hereda los filtros (spec 012) | `inscripciones.ver` | Montos, pago y voucher: `pagos.ver` · aprobar/rechazar/en revisión: `inscripciones.validar` · cancelar: `inscripciones.cancelar` · eliminar (solo rechazadas o canceladas; solo el Owner): `inscripciones.eliminar` · cambiar el tipo y la categoría (solo el Owner; no en integrantes de una delegación): `inscripciones.cambiar_tipo` · CSV: `inscripciones.exportar` · reenviar credencial: `credenciales.reenviar` |
| Asistencia | Registro por actividad (hora de Lima), método (QR, QR anterior, documento, manual) y quién registró; marca con el QR (código del fotocheck o QR anterior, con aviso ámbar) o el documento; la marca de una inscripción virtual sale en ámbar con «Inscripción virtual: verifica si corresponde el ingreso presencial» (no bloquea) | `asistencia.ver` | Marcar: `asistencia.marcar` · fuera de horario: `asistencia.fuera_horario` · anular: `asistencia.anular` · exportar: `asistencia.exportar` · documento completo: `inscripciones.ver` |
| Reportes (`/reportes`; spec 016) | Seguimiento de los estudiantes de la facultad por **asesor** (docente), calculado al consultar con las inscripciones del evento: indicadores (alumnos, pagaron, en revisión, rechazados, sin inscripción, avance y recaudado), filtros por asesor, ciclo, sección y turno (en la URL), pestañas «Por sección», «Por ciclo» y «Por asesor» (con Excel y PDF de cada ciclo y de cada docente, el botón «Enlace» y, con `reportes.gestionar`, el **DNI** de cada docente y los botones «Editar» y «Agregar docente» para cambiar su nombre, su DNI y sus ciclos y secciones) y «Alumnos» (situación, búsqueda y paginación). **Pagó = inscripción aprobada**; «En revisión» es un voucher sin validar. «Cargar padrón» sube el Excel de la facultad: se revisa y se confirma | `reportes.ver` | Excel y PDF: `reportes.exportar`; cargar el padrón: `reportes.gestionar` (global); montos y recaudado: `pagos.ver` |
| Enlace del docente (`/seguimiento#<token>`; spec 017, **pública, sin sesión**) | Cada docente ve cómo van los pagos de **sus** estudiantes: porcentaje que pagó, filtro por sección y situación con contadores, búsqueda por nombre o código, celular con enlace a WhatsApp y descarga en Excel o PDF. Solo nombre, código, ciclo, sección, turno, celular y situación: nunca DNI, correo ni montos. Se refresca sola cada minuto. El token va tras el `#` de la URL (no se envía a ningún servidor) y la página es `noindex` | Ninguno (la protege su token) | Crear, copiar, renovar y desactivar los enlaces (Reportes → «Padrón y enlaces»): `reportes.gestionar` |
| Enlace del ciclo (`/seguimiento/ciclo#<token>`; spec 018, **pública, sin sesión**) | Quien lo recibe ve cómo van los pagos de **todos los estudiantes de un ciclo**: avance del ciclo y de cada sección con su docente (pulsar una sección filtra la lista), filtro por situación con contadores, búsqueda por nombre o código y descarga en Excel o PDF. Solo nombre, código, ciclo, sección, turno y situación: **sin celular**, DNI, correo ni montos. Se refresca sola cada minuto. El token va tras el `#` y la página es `noindex` | Ninguno (la protege su token) | Crear, copiar, renovar y desactivar los enlaces (Reportes → «Padrón y enlaces → Enlaces públicos» o el botón «Enlace» de «Por ciclo»): `reportes.gestionar` |
| Página única de los docentes (`/docentes`; spec 019, **pública, sin sesión**) | Una sola dirección para todos los docentes: cada uno **escribe su DNI** y ve el avance de sus estudiantes con el filtro de **sus ciclos y secciones**, quién pagó y quién no, búsqueda y descarga en Excel o PDF (celular con enlace a WhatsApp; sin DNI de estudiantes, correo ni montos). El DNI solo vive en memoria; sin DNI registrado el docente no entra por aquí (su enlace personal sigue valiendo) | Ninguno (la protege el DNI del docente y un tope de intentos fallidos) | Registrar el DNI y repartir la dirección (Reportes → «Padrón y enlaces → Enlaces públicos»): `reportes.gestionar` |
| Escanear asistencia (`/escanear`) | Escáner para la puerta a pantalla completa (sin menú lateral): cámara, lector USB o DNI sobre una actividad del evento seleccionado; resultado verde, ámbar («QR antiguo: verifica el DNI», «Ya estaba registrada» o «Inscripción virtual: verifica si corresponde el ingreso presencial», este último sin bloquear: la asistencia queda registrada) o rojo, con nombre, documento, tipo y foto; últimas 10 lecturas. Se abre también desde «Abrir escáner» en Asistencia | `asistencia.marcar` | Fuera de horario: `asistencia.fuera_horario` |
| Ponencias | Consulta y descarga de los trabajos del Call for Papers (no son las especializadas) | `ponencias.ver` | — |
| Ponencias especializadas · Programa | Ponencias por día con ambiente, horario, duración, modalidad, precio, cupo `presenciales/cupo` (+ virtuales, que no ocupan aforo), ponente y si está publicada; enlaces a sus inscritos y a la puerta; tarjeta «Acceso a la inscripción» con el interruptor de acceso libre (encendido: solo el DNI; apagado: solo congresistas con el pago aprobado); tarjeta «Enlace público del aforo» (spec 027) para crear, copiar, renovar y desactivar el enlace de la página `/aforo-ponencias` de la landing (aforo, inscritos presenciales, cupos libres, asistencia y lista de inscritos por tema con nombre, modo y asistencia; sin DNI, correo ni celular) | `especializadas.ver` o `especializadas.gestionar` | Crear, editar, publicar/despublicar, eliminar y cambiar el acceso libre: `especializadas.gestionar` · enlace público del aforo (solo el Owner): `especializadas.enlace_aforo` |
| Ponencias especializadas · Inscripciones | Lista con filtros (día, ponencia, estado, asistencia, procedencia, modalidad, origen, validación con el congreso, modo de asistencia y búsqueda por documento, nombres, correo o celular) sincronizados con la URL; columna «Congreso» (presencial o virtual, o «Sin validar») y origen, procedencia y asistencia por fila | `especializadas.ver` | Inscribir manualmente, cancelar, reactivar y corregir datos: `especializadas.inscribir` · anular asistencia: `especializadas.asistencia` |
| Ponencias especializadas · Resumen (`/ponencias-especializadas/resumen`) | Una fila por persona (no por ponencia): su situación en el congreso (pago aprobado, en revisión, rechazado o no inscrito), si puede asistir, si se validó y si ya recibió el comunicado; totales del evento, botones por situación, filtros sincronizados con la URL y descarga en Excel; elegir a quienes no pueden y **cancelarles la inscripción** con un correo editable (o solo avisarles) | `especializadas.ver` | Cancelar y avisar: `especializadas.inscribir`; con el acceso libre encendido no hay a quién cancelar |
| Ponencias especializadas · Asistencia en puerta (`/ponencias-especializadas/asistencia`) | Una ponencia (la del día) y el campo del DNI: inscrito → se marca; no inscrito → debe ser congresista con el pago aprobado (con el acceso libre apagado), se inscribe en el acto si hay cupo presencial (el virtual no ocupa aforo) y se marca; avisa si libera el cupo de otra ponencia del mismo horario; resultado verde, ámbar o rojo y últimas 12 lecturas | `especializadas.asistencia` | — |
| Mensajes | Consulta | `mensajes.ver` | Eliminar: `mensajes.eliminar` |
| Delegaciones (`/delegaciones`; spec 021, backend 029) | Grupos con **planes y precios propios** (Con kit, Sin kit y Virtual; cada integrante elige el suyo), sus links (delegado e individual), dominio del correo, integrantes, vouchers y aprobación del grupo; totales y saldo | `delegaciones.ver` | Crear, datos, integrantes, cambiar de plan y subir vouchers: `delegaciones.inscribir` · planes, precios, dominio y links: `delegaciones.gestionar` (global) · verificar/rechazar/borrar vouchers (los verificados no se borran) y aprobar: `inscripciones.validar` (borrar también con `delegaciones.gestionar`) · ver el voucher (en un visor sobre el detalle) y los importes: `pagos.ver` |
| Eventos (lista, nuevo y detalle) | General (datos, remitente), Datos de pago (cuentas y billeteras con su QR: arrastrar y soltar), Categorías y tipos, Actividades, Integraciones (deportes-fi), **Acceso** (tokens de la landing) | `eventos.configurar` | Eliminar: `eventos.eliminar` · credencial de correo: `correo.configurar` |
| Tipos de inscripción | Planes del evento: precio, precio UNDC, **Disponible para** (todos, solo comunidad UNDC o solo externos; spec 010) y **Modalidad** (presencial o virtual; los virtuales viven en las mismas categorías, con tarifa única que se confirma si los precios difieren; el backend con la spec 018 se despliega antes, o el tipo se guarda presencial y el panel lo avisa; spec 012) y el interruptor **No admitir estudiantes UNDC** (estudiante verificado o con correo de código @undc.edu.pe; docentes, administrativos y externos sí; solo frena inscripciones nuevas; backend con la spec 020 primero; spec 013) | `eventos.configurar` | — |
| Consultas DNI | Pool de tokens (Decolecta/apiperu), uso, bitácora, consulta manual | `consultas_dni.gestionar` | — |
| Participantes | Consulta y edición (el celular puede quedar vacío); desvincular Google; «Nuevo participante» sin inscripción (ponentes, organizadores, inscripción en persona; con DNI, nombres de RENIEC) | `participantes.gestionar` | «Inscripción de cortesía» (aprobada, sin pago, credencial opcional): `inscripciones.cortesia` |
| Correo | Credenciales de Brevo, prueba de cuenta, correo de prueba | `correo.configurar` | — |
| Equipo y administradores | Alta con acceso «Solo Google» o «Contraseña o Google», rol, eventos (Tesorero y Comisión) y permisos (Comisión), activar/desactivar, desvincular Google | `administradores.gestionar` | El Owner gestiona todas las cuentas; el Administrador, solo Tesoreros, Comisión y la suya |
| Sistema | API_UNDC (probar conexión), client ID de Google, URL del panel, landing anterior | `sistema.configurar` | — |
| Sin acceso (`/sin-acceso`) | Cuenta sin ninguna sección, o cuenta por evento sin eventos asignados: «Volver a intentar» y «Cerrar sesión» | — | — |

### Qué ve cada rol

| Pantalla | Owner | Administrador del sistema | Tesorero | Comisión tecnológica |
|---|---|---|---|---|
| Resumen | Sí | Sí | Sí, con montos | Con `resumen.ver`, sin montos |
| Inscripciones | Todo (eliminar solo rechazadas o canceladas; cambiar el tipo) | Todo menos eliminar y cambiar el tipo | Con pagos y validación; sin cancelar ni eliminar | Con `inscripciones.ver`, sin pagos ni validación; CSV y reenviar si se los dieron |
| Asistencia | Todo | Todo | Ver y exportar (no marca) | Según sus permisos (marcar incluye ver) |
| Reportes | Sí (y carga del padrón) | Sí (y carga del padrón) | Ver y descargar, con montos | Ver y descargar, si se los dieron; sin montos |
| Escanear asistencia | Sí | Sí | — | Si marca asistencia |
| Ponencias · Mensajes | Sí (y eliminar mensajes) | Sí (y eliminar mensajes) | Ver | Ver, si se los dieron |
| Ponencias especializadas (programa, inscripciones, resumen, puerta) | Todo | Todo | — | Ver, inscribir y asistencia en puerta, si se los dieron; el programa solo se edita con `especializadas.gestionar` (Owner y Administrador) |
| Eventos · Tipos · Consultas DNI · Participantes (con alta y cortesías) · Correo | Sí | Sí | — | — |
| Equipo y administradores | Todas las cuentas | Tesoreros, Comisión y la suya | — | — |
| Sistema | Sí | — | — | — |
| Eventos del selector | Todos | Todos | Los suyos | Los suyos |
| Página de inicio | Resumen | Resumen | Resumen | El escáner si solo marca asistencia (los permisos por defecto); Asistencia si marca y tiene otros permisos; la puerta si solo toma asistencia a ponencias especializadas; si no, la primera de su menú |

Una pantalla sin permiso no aparece en el menú y, abierta por URL, lleva a la página de inicio de
la cuenta. Sin `pagos.ver` el backend envía los montos en `null` y el panel muestra «—». El
backend es la autoridad: rechaza con 403 lo que la cuenta no puede hacer aunque la pantalla lo
ofrezca (el avance de los botones por permiso está en
[`specs/008-roles-permisos/tasks.md`](../specs/008-roles-permisos/tasks.md); el del escáner, el
alta de participantes y las cortesías, en
[`specs/009-portal-escaner/tasks.md`](../specs/009-portal-escaner/tasks.md)).

## Portal del inscrito

El inscrito no ve el menú ni ninguna pantalla de administración: solo las secciones del portal
(pestañas en la computadora, barra inferior en el celular). Todas declaran
`perfil: 'participante'` (spec 009; contrato en backend-ciisic spec 014).

| Sección | Qué muestra |
|---|---|
| Inscripciones (`/mis-inscripciones`) | Por evento: tipo (con la insignia «Virtual» si lo es), monto y descuento, pago, estado, motivo de rechazo y fecha de revisión; credencial PDF y «Ver fotocheck» cuando está aprobada. Una inscripción virtual muestra «Modalidad virtual» en lugar de la sede y, aprobada, un texto neutro sobre las indicaciones de conexión |
| Fotocheck (`/mi-fotocheck`) | Fotocheck virtual de una inscripción aprobada: QR grande con el código de la credencial, el código en texto, evento, nombre, documento enmascarado (`****1234`), tipo de inscripción (con «Virtual» si lo es; se muestra completo, con su QR) y foto, con un reloj «en vivo»; la pantalla no se apaga mientras está abierto y el último fotocheck se puede ver sin conexión en ese dispositivo (se borra al cerrar sesión) |
| Asistencia (`/mi-asistencia`) | Por evento aprobado, sus actividades y en cuáles asistió («asistidas / actividades») |
| Certificados (`/mis-certificados`) | Llegan con la spec 015 del backend; hasta entonces, estado vacío |
| Perfil (`/mi-perfil`) | Nombres, documento y correo (no se editan); celular editable; foto opcional (JPG o PNG, el panel la recorta en un cuadrado de 600 × 600 px) con consentimiento, que sale en el fotocheck, la credencial y el escáner; ver y quitar la foto |

Mientras producción tenga el backend anterior (013), las secciones que el backend aún no tiene
muestran «Esta sección estará disponible pronto.» en lugar de un error.

## Glosario: «modalidad» y «virtual»

Tres cosas distintas usan esas palabras; no se mezclan en pantallas, código ni textos:

| Término | Qué es | Valores |
|---|---|---|
| **Modalidad de asistencia** (spec 012) | Cómo asiste la persona; atributo del **tipo** de inscripción (`tipo.modalidad`, `tipoInscripcion.modalidad`, filtro `?modalidad=`). Ausente, `null` o desconocida = presencial | Presencial · Virtual |
| **Modalidad de pago** | Cómo pagó; atributo del **pago** (`modalidadPago`, `pago.modalidad`, columna «Modalidad» del CSV) | Banco · Billetera · Cortesía |
| **Fotocheck virtual** | La credencial digital con QR del portal; la tiene toda inscripción aprobada, presencial o virtual | — |

Los tipos virtuales (p. ej. «ESTUDIANTES · VIRTUAL», S/ 30, y «PROFESIONALES Y PUBLICO EN GENERAL ·
VIRTUAL», S/ 50, con la misma tarifa para la comunidad UNDC y externos) están dentro de las categorías
Estudiantes y Público general, así que conservan su verificación de estudiante. Cómo se entrega el acceso
a la transmisión, qué certificados y asistencia les corresponden y si se exige constancia de estudiante
sigue abierto: los textos del panel son neutros y nada se bloquea.

## Inicio de sesión

- Staff (Owner, Administrador del sistema, Tesorero, Comisión): correo y contraseña, o
  **Continuar con Google** si el correo de la cuenta Google es el de una cuenta de staff activa
  (cualquier dominio). Las cuentas «Solo Google» no tienen contraseña: únicamente entran con Google.
- La sesión se renueva sola mientras se usa el panel, hasta 12 h desde el ingreso; después, o si
  cambian el correo, la contraseña o el Google de la cuenta, o la desactivan, el login explica el
  motivo. Los cambios de rol, eventos o permisos no cierran la sesión.
- Inscritos: **Continuar con Google** con la cuenta del correo de inscripción, o **Entrar con un
  código a mi correo** (6 dígitos, vence en 10 min; se puede pedir otro al minuto). El código
  siempre abre el portal, nunca el panel. La sesión dura 12 h y no se renueva. La opción del código
  solo aparece si el backend la ofrece (necesita una credencial de correo activa).
- Staff que también está inscrito con su mismo correo: **Mi portal de participante** en el menú de
  su cuenta. Si entró con Google pasa directo; si entró con contraseña, confirma con un código a su
  correo. Para volver al panel ingresa de nuevo.
