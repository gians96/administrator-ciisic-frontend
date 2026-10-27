# Tasks: Acceso virtual (panel)

- [x] T001 `app/utils/enviosMasivos.ts`: canal `virtual` (ruta `virtual-access`), `TEXTOS_CANAL` por canal, `resumenDeEnvio` con el canal y el mensaje del acceso (propuesta, validación del enlace, cuerpo) con pruebas (`tests/enviosMasivos.test.ts`)
- [x] T002 `components/envios/PanelEnvio.vue` toma de `TEXTOS_CANAL` la etiqueta de los totales, el vacío y el resumen
- [x] T003 Pantalla `/acceso-virtual` (`inscripciones.ver` / `credenciales.reenviar`): enlace, asunto y mensaje, vista previa, «Enviarme una prueba» y recuerdo del último enlace por evento
- [x] T004 Menú (`MENU`) y `tests/permisos.test.ts`
- [x] T005 `bun run lint`, `typecheck`, `test` y `build` en verde
- [ ] T006 Probado en el navegador contra el backend local con un virtual aprobado
- [ ] T007 Producción: desplegar después del backend 043, comprobar los créditos de Brevo (Correo → Revisar créditos), enviarse una prueba y enviar por tandas
