# Tasks: Envíos masivos a los inscritos presenciales (panel)

- [x] T001 `urlLanding` en Sistema (tipos, formulario, validación, PUT parcial y tarjeta «URL del panel y de la landing») con pruebas
- [x] T002 `app/utils/enviosMasivos.ts` (rutas, filtros, selección, tandas, resultado, mensaje de ponencias) con pruebas (`tests/enviosMasivos.test.ts`)
- [x] T003 `components/envios/PanelEnvio.vue`: estadísticas, filtros en la URL, tabla con marca de envío, «Elegir a todos los sin enviar», confirmación, avance, «Detener» y resultado
- [x] T004 Pantalla `/credenciales` («Credencial 3D», `inscripciones.ver` / `credenciales.reenviar`)
- [x] T005 Pantalla `/ponencias-especializadas/enviar-enlace` (editor, vista previa, «Enviarme una prueba») y tarjeta en el Programa
- [x] T006 Menú (`MENU`), `tests/permisos.test.ts` y mensajes de error nuevos
- [x] T007 Probado en el navegador contra el backend local con un Brevo simulado: 18 de 19 enviados con una falla simulada (queda «Sin enviar»), el segundo envío omite a los ya enviados y solo reenvía al pendiente, la prueba no marca a nadie, el correo de la credencial llega con el enlace de cada persona
- [ ] T008 Producción: desplegar después del backend (038 y 039), poner la URL de la landing en Sistema y revisar los créditos de Brevo (Correo → Probar) antes del envío grande
