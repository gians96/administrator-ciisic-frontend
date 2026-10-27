# Tasks: Créditos de las credenciales de correo (panel)

- [x] T001 Tipos (`creditosDisponibles`, `creditosVerificadosEn`, `messageId`) y utilidades (`estadoCreditos`, `textoCreditos`, `haceCuanto`, `credencialEnUso`, `avisoCreditos`, `necesitaRevisarCreditos`, `resumenCreditos`) con pruebas
- [x] T002 `/correo`: insignias de envíos y «Envía ahora», avisos, «Revisar créditos» y revisión automática al abrir, `messageId` en «Enviar prueba»
- [x] T003 Texto de la guía de Gmail igual al de Google (verificación en dos pasos)
- [x] T004 Docs (`docs/`, AGENTS.md)
- [x] T005 Probado en el navegador contra el backend local con cuatro credenciales (295, 0, 300 y 299 envíos): insignias, «Envía ahora», aviso con la predeterminada agotada y revisión automática con la revisión vencida
- [ ] T006 Producción: desplegar después del backend 042; **Revisar créditos** y comprobar que «Envía ahora» está en la credencial correcta
