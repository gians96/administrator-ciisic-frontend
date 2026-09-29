# Implementation Plan: Eventos y tipos

| Archivo | Rol |
|---|---|
| `app/pages/eventos/index.vue`, `nuevo.vue`, `[id].vue` | Listado, alta y detalle con pestañas (`?tab=`) |
| `app/components/eventos/EventoForm.vue` | Datos generales, fechas, contacto, copia de configuración |
| `app/components/eventos/DatosPagoForm.vue` | Bancos y billeteras (JSON `datosPago`) |
| `app/components/eventos/CategoriasTipos.vue` | Categorías y tipos (también en `/tipos-inscripcion`) |
| `app/components/eventos/ActividadesPanel.vue` | Actividades |
| `app/components/eventos/IntegracionesPanel.vue` | Integraciones deportes-fi y prueba de conexión |

`datetime-local` se convierte a ISO usando la zona del navegador (Lima para el equipo).
