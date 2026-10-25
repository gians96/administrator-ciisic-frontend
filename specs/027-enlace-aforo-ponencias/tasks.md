# Tasks: Enlace público del aforo de las ponencias especializadas (panel)

- [x] T001 Permiso `especializadas.enlace_aforo` en `types/api.ts`, `ETIQUETAS_PERMISO` y `PERMISOS_SOLO_OWNER`
- [x] T002 `urlEnlaceAforo` y `mensajeEnlaceAforo` en `app/utils/ponenciasEspecializadas.ts` y el tipo `EnlaceAforo`
- [x] T003 `EnlaceAforoCard` (crear, copiar, renovar y desactivar) en el Programa, solo con el permiso
- [x] T004 Pruebas (permisos: 41 en el catálogo y el Administrador sin el enlace; URL y mensaje) y docs (`overview.md`, AGENTS.md)
- [x] T005 Probado contra el backend local con el Owner: la tarjeta aparece, crea el enlace (`localhost:3000/aforo-ponencias#…` en desarrollo) y la landing lo abre. Renovar, desactivar y el `403` del Administrador
  quedan cubiertos por las pruebas del backend (`tests/specialized-talk/enlace-aforo.test.ts`) y la tarjeta solo se monta con el permiso
- [ ] T006 Producción: desplegar después del backend 036
