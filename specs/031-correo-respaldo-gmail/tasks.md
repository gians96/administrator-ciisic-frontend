# Tasks: Correo con respaldo entre credenciales y Gmail por SMTP (panel)

- [x] T001 Tipos (`ProveedorCorreo`, `prioridad`) y mensajes de los códigos nuevos (`INVALID_ORDER`, `DEFAULT_CREDENTIAL_INACTIVE`)
- [x] T002 `app/utils/credencialesCorreo.ts`: proveedor, contraseña de aplicación (normalizar y validar), orden (`ordenarCredencialesCorreo`, `hayPrioridades`, `ordenTrasMover`) y `avisoSinRespaldo`, con pruebas
- [x] T003 `/correo`: proveedor al crear, textos por proveedor, insignias, flechas de prioridad, aviso de respaldo, protección contra un backend anterior
- [x] T004 Docs (`docs/`, README, AGENTS.md)
- [x] T005 Probado en el navegador contra el backend local: alta de Brevo y de Gmail (validación en español, contraseña con espacios), orden con flechas persistido, «Probar» con una key inválida
- [x] T006 Guía de Gmail en un panel lateral derecho (`GuiaGmailSmtp`, `app/utils/guiaGmail.ts` con `tests/guiaGmail.test.ts`) y sus accesos desde Correo; probada en el navegador (abrir, marcar pasos, problemas frecuentes, «Agregar credencial de Gmail», apilada sobre el formulario y Esc)
- [ ] T007 Producción: desplegar después del backend 041; agregar la credencial de Gmail, **Probar**, **Enviar prueba** y dejarla de respaldo de Brevo
