# Feature Specification: Entrega del kit en la puerta y asistencia solo presencial (panel)

**Created**: 2026-10-25 · **Status**: Implementado en el panel (falta desplegar) · **Contrato**: `backend-ciisic/specs/037-entrega-kit/contracts/api-entrega-kit.md`

**Input**: en la puerta se escanea el QR del fotocheck (celular con cámara o lector USB) y la organización necesita **saber si la persona lleva kit**, **marcar que se lo entregó**
con la hora y poder **deshacerlo** (se marcó por error, o no había kit y se entrega otro día). Solo los **presenciales** marcan asistencia: a los virtuales se les manda por correo el
enlace de la transmisión (lo envía la organización por fuera).

> **Numeración**: es la spec **028** del panel. Backend = spec 037. La landing no cambia.

## Decisiones

- **El kit es de la inscripción, no de la actividad**: una persona recibe un kit en todo el congreso. El tipo dice si lo incluye (`tipo.incluyeKit`; los planes de las delegaciones, solo `CON_KIT`) y
  el panel nunca lo deduce del texto de la etiqueta.
- **Escáner (`/escanear`)**: la pantalla completa agrega, bajo el tipo, una insignia grande **CON KIT / SIN KIT / KIT ENTREGADO** (`ROTULO_KIT`). Con el kit **pendiente** el resultado no se cierra
  solo (la cámara se pausa y las lecturas nuevas esperan, como con el QR anterior: `esperaContinuar`): **«Entregar kit»** marca la entrega (`PUT inscriptions/:id/kit`), muestra «Kit entregado» y se cierra a
  los 1,5 s; **«Continuar sin entregar»** lo deja pendiente. «Ya registrada» (409) ahora trae a la persona y su kit (`data` del error), así que un kit pendiente se entrega al volver a escanear. Con el kit
  entregado o sin kit el resultado se cierra como siempre. El aviso del QR anterior no cambia (sigue pidiendo comparar el DNI, y entregar el kit no lo cierra).
- **Pantalla Asistencia (`/asistencia`)**: bajo el formulario, «Lleva kit: entrégalo y márcalo aquí» con el botón **Entregar kit**; en la tabla, la columna **Tipo y kit** («Con kit · pendiente», «Kit
  entregado», hora y quién) y, con `asistencia.marcar`, las acciones **Entregar kit** y **Deshacer entrega** (con confirmación); en el encabezado, **«Kits: X entregados · Y pendientes de Z»** del evento
  (`GET events/:id/kits/summary`, se refresca tras cada marca y entrega; un backend anterior responde 404 y no se muestra).
- **Detalle de la inscripción**: fila «Kit» con el estado, la hora y quién lo entregó, y los mismos botones (cubre a los integrantes de las delegaciones y corregir cualquier día).
- **Tipos (Eventos → Categorías y tipos)**: interruptor **«Incluye kit»** (apagado y desactivado en un tipo virtual), insignia verde «Entrega kit» en la lista, «Revisar kit» ámbar si el código o la etiqueta
  dicen «CON KIT» pero el interruptor está apagado, aviso si el código/etiqueta contradicen al interruptor, confirmación al cambiarlo en un tipo con inscripciones (se lee en vivo) y el aviso de backend anterior.
- **Permisos**: sin permiso nuevo. Entregar y deshacer = `asistencia.marcar`; ver el estado, `asistencia.ver`. Los botones siguen a `auth.puede('asistencia.marcar')`.
- **Virtuales**: el backend rechaza su asistencia (`403 VIRTUAL_REGISTRATION`) y el escáner lo muestra en rojo («Inscripción virtual»; sin fila de asistencia). El aviso ámbar anterior («verifica si corresponde el
  ingreso presencial») se conserva solo como respaldo si el backend aún no bloquea.
- **Tolerante**: con un backend anterior no llega `kit` ni `incluyeKit` y todas las pantallas se ven como antes (`kitDe`, `estadoKit`: `NO_APLICA`).

## Despliegue

Backend 037 primero (su migración es aditiva y rellena `incluye_kit` de los tipos «con kit»); luego el panel. Revisar los tipos con `backend-ciisic/prisma/preflight/verificar-kit.sql` y ajustar el interruptor desde el editor.
Un panel nuevo con el backend anterior no muestra nada de kit y no puede marcar a los virtuales como rechazados.

## Fuera de alcance

- El correo masivo con el enlace de Zoom/Meet a los virtuales.
- El kit en el CSV de asistencia o de inscritos y una vista de kits por delegación.
