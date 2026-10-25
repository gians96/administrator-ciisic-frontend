# Feature Specification: Delegaciones con planes y tarifa propios (panel)

**Created**: 2026-10-22 · **Status**: Implementado en el panel · **Contrato**: `backend-ciisic/specs/029-delegaciones-planes/contracts/api-delegaciones-planes.md`

**Input**: hasta ahora la pestaña Delegaciones de Eventos editaba una **tarifa global** (spec 015: S/ 60, S/ 50 desde 10 y S/ 30 virtual). Cada
convenio necesita su propio precio, con planes Con kit, Sin kit y Virtual, y los permisos deben repartir el trabajo: Owner y Administrador
configuran, la Comisión inscribe y el Tesorero valida pagos. Reemplaza las specs [014](../014-delegaciones-convenio/spec.md) y [015](../015-tarifa-delegaciones/spec.md)
en lo que tocan a la tarifa, la modalidad y la pestaña.

## Decisiones

- **Página propia `/delegaciones`** (`delegaciones.ver`, ítem «Delegaciones» del menú) en lugar de una pestaña de Eventos (que exige `eventos.configurar` y el Tesorero no
  podía abrir). «Categorías y tipos» ya no muestra las delegaciones; solo trae un acceso a la página.
- **Sin tarifa global**: desaparecen la tarjeta de tarifa, «Editar tarifa» (`TarifaDelegacionesForm`) y `tarifaDeTipos`/`tarifaDeAdmin`/`cuerpoTarifa`. Cada delegación tiene sus planes.
- **Planes** (`PlanesEditor`): por cada uno, activo, precio por persona y precio promocional opcional; el mínimo de integrantes es de la delegación. Un plan activo necesita precio
  mayor que cero; el promocional no supera al precio. Se envían solo los cambios (`cambiosDePlanes`).
- **Integrantes con plan** (`FilasIntegrantes`): con un solo plan activo no se pide; con varios, cada fila lleva su selector y la lista pegada se asigna a un plan elegido. En el detalle
  se cambia el plan de un integrante con un selector (`PATCH …/inscriptions/:id`).
- **Links** (`DelegacionDetalle` → «Links y correo institucional»): dominio del correo, interruptor del link individual y regenerar cada link. El link individual se copia desde la tarjeta o el detalle
  (`/delegaciones?unirme=<código>` de la landing).
- **Cada botón sigue al permiso de su acción**: crear y datos del grupo, integrantes, plan y vouchers = `delegaciones.inscribir`; planes, links y dominio = `delegaciones.gestionar`;
  verificar/rechazar/borrar vouchers (no verificados) y aprobar al grupo = `inscripciones.validar` (borrar también con `delegaciones.gestionar`); ver el archivo del voucher = `pagos.ver`, en un visor sobre el detalle. Sin `pagos.ver` los importes llegan en `null` y no se muestran los
  totales ni los vouchers. Una Comisión que crea una delegación no ve los planes: nacen apagados hasta que un Owner o Administrador los configure.

## Despliegue

**Backend 029 primero** (su migración convierte las delegaciones y borra la categoría `DELEGACIONES`); luego este panel y la landing. Entre el backend y el panel la pestaña antigua se ve rota unos minutos.
