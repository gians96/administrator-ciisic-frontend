# Tasks: Entrega del kit en la puerta y asistencia solo presencial (panel)

- [x] T001 Tipos (`KitEstado`, `incluyeKit`, `kit` del detalle) y mensajes de error (`VIRTUAL_REGISTRATION`, `KIT_*`); `aErrorApi` lleva los `datos` del error sin confundirlos con el cuerpo anidado del BFF
- [x] T002 `app/utils/kit.ts`: estado, rótulos, hora de la entrega, resumen y ayudas del editor de tipos (funciones puras)
- [x] T003 `app/utils/asistencia.ts`: persona con kit, resultado que espera la entrega, «ya registrada» con datos, rechazo de virtuales y `resultadoConKitEntregado`
- [x] T004 Escáner: insignia CON KIT / SIN KIT, «Entregar kit» y «Continuar sin entregar» en `PantallaResultado` y la entrega en `escanear.vue`
- [x] T005 Pantalla Asistencia: botón junto al resultado, columna «Tipo y kit», entregar y deshacer en la tabla y el resumen de kits del evento
- [x] T006 Tipos: interruptor «Incluye kit», insignias y avisos; detalle de la inscripción con la fila «Kit» y sus botones
- [x] T007 Pruebas (`tests/kit.test.ts`, `tests/asistenciaKit.test.ts`, `tests/tiposInscripcion.test.ts`), AGENTS.md y `docs/overview.md`
- [x] T008 Probado contra el backend local con un Owner de prueba: escanear con y sin kit, «Entregar kit» (escáner en móvil y pantalla Asistencia), hora y quién en la tabla, «Deshacer entrega» con confirmación, «ya registrada» con su kit, virtual rechazado en rojo, resumen de kits, editor de tipos y detalle de la inscripción
- [ ] T009 Producción: desplegar después del backend 037
