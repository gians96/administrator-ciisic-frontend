# Tasks: Reparto de los envíos masivos entre credenciales (panel)

- [x] T001 `app/utils/credencialesCorreo.ts`: `repartoPrevisto` y `textoReparto` con pruebas (320 con ANGEL en 295, un tramo, tres tramos, no alcanza, singular, credencial del evento primero, Gmail sin cupo conocido, sin credenciales)
- [x] T002 `app/utils/enviosMasivos.ts`: `porCredencial` y `agotado` en `ResultadoEnvio`, `sumarResultados`, cortes `agotado` y `sin-salida` en `enviarPorTandas`, líneas del resumen y punto doble, con pruebas
- [x] T003 `PanelEnvio.vue`: revisión de créditos al abrir la confirmación y línea del reparto (solo con `correo.configurar`); `EMAIL_CREDITS_EXHAUSTED` en `errores.ts`
- [x] T004 Docs (AGENTS.md)
- [x] T005 Probado en el navegador contra el backend local con cuatro credenciales de ejemplo: «todos por ANGEL», «1 por ANGEL y 1 por LORENA» (salta a Gianmarcos), alerta ámbar si no alcanza y el `409` al enviar sin envíos
- [ ] T006 Producción: desplegar después del backend 044; abrir una confirmación de envío y comprobar la línea del reparto; tras un envío, el resumen «Salieron por…»
