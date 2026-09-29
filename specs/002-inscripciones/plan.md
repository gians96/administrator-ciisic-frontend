# Implementation Plan: Inscripciones y asistencia

| Archivo | Rol |
|---|---|
| `app/pages/inscripciones/index.vue` | Filtros sincronizados con la URL, tabla, exportación |
| `app/components/inscripciones/InscripcionDetalle.vue` | Drawer con voucher y acciones de estado |
| `app/utils/filtros.ts` | Lectura/serialización de filtros (probado) |
| `app/pages/asistencia.vue` | Registro por QR/DNI, lista y exportación de matriz |

Endpoints: `GET events/:id/inscriptions`, `GET …/export`, `GET inscriptions/:id`,
`PATCH inscriptions/:id/status`, `POST …/resend-credential`, `GET …/voucher`,
`GET …/credential`, `GET events/:id/activities`, `GET|POST activities/:id/attendances`,
`DELETE attendances/:id`, `GET events/:id/attendances/export`.

El voucher y la credencial se abren por el BFF (misma cookie), por lo que no se exponen
URLs públicas de archivos.
