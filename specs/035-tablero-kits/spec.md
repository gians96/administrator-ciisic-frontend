# Feature Specification: Tablero de kits (panel)

**Created**: 2026-11-02 · **Status**: Implementado en el panel (falta desplegar) · **Contrato**: `backend-ciisic/specs/045-tablero-kits/contracts/api-tablero-kits.md`

**Input**: la organización quiere saber de un vistazo **qué se entrega con el kit**, **a quién le falta recibirlo** y **a quién ya se le entregó**, desde Inscripciones y en un tablero. La spec 028 dejó el registro de la entrega (escáner,
Asistencia y detalle) y dejó fuera «el kit en el CSV de inscritos y una vista de kits por delegación»: esta spec lo completa.

> **Numeración**: es la spec **035** del panel. Backend = spec 045. La landing no cambia. **Sin permiso nuevo.**

## Decisiones

- **Tablero de lectura sobre lo que ya existe**: `/kits` («Entrega de kits», justo después de Asistencia en el menú, `asistencia.ver`) lee `GET events/:id/kits/dashboard` (solo cifras) y la lista de Inscripciones filtrada por `?kit=`. **El panel no
  recalcula nada**: valida la forma de lo que llega (`tableroKitsDe`) y sus números son los de la insignia «Kits:» de Asistencia.
- **Cinco indicadores que son botones**: A entregar · Entregados · Pendientes · Pago por aprobar · A revisar. Cada uno elige la **vista** de la lista (`consultaDeVista`: `CON_KIT` + aprobadas, `ENTREGADO`, `PENDIENTE`, `POR_APROBAR`, `REVISAR`). La vista inicial
  es «Pendientes». «A revisar» son kits entregados que hoy no corresponden (inscripción cancelada o tipo cambiado a sin kit); «Entregados» los incluye y la nota de la lista lo dice.
- **Qué incluye el kit**: tarjeta con mochila, tomatodo, fotocheck con QR y cordón y certificado de 100 horas (`CONTENIDO_KIT`, espejo de `ciisic-undc-web/app/data/kit-items.ts`: si cambia, se actualiza en los dos sitios).
- **Ritmo y responsables**: entregas por hora de Lima (selector de día si hay más de uno), avance y «hoy»; tabla por **tipo y delegación** (tocar un tipo filtra la lista; los planes de una delegación llevan su insignia) y «Quién entrega».
- **La lista de personas** pide `inscripciones.ver`: sin él solo se ven las cifras y la pantalla lo explica. Muestra el estado del kit con **cuándo y quién** y deja entregar o deshacer con `asistencia.marcar` por la misma ruta de la spec 037
  (`useEntregaKit`: confirmación al deshacer y relectura si otra cuenta ya lo cambió). Abrir una fila muestra el detalle de la inscripción. El «Exportar CSV» baja la lista elegida (p. ej. solo pendientes).
- **Inscripciones**: filtro «Kit» (solo si el evento tiene tipos con kit; en la URL y en el CSV) e insignia «Kit entregado» / «Kit pendiente» / «Kit a revisar» bajo el tipo. Asistencia: la insignia «Kits: …» abre el tablero.
- **Se actualiza solo** cada 30 s con la pestaña a la vista y se recarga tras cada entrega (en la puerta varias cuentas entregan a la vez).
- **Tolerante**: sin la ruta del tablero (backend anterior) la pantalla dice que aún no está disponible; si se filtra por kit y las filas no traen `kit`, el backend ignoró el filtro y se avisa en lugar de mostrar una lista sin filtrar.

## Despliegue

Backend 045 primero (no hay migración); luego el panel. Un panel nuevo con el backend anterior solo muestra «el tablero aún no está disponible» y avisa en Inscripciones si se filtra por kit.

## Fuera de alcance

- Entregar el kit **sin marcar asistencia** (un mostrador de kits solo por QR): se sigue entregando desde el escáner, Asistencia, el detalle y ahora la lista del tablero.
- Entrega por ítem y un permiso propio para el kit.
