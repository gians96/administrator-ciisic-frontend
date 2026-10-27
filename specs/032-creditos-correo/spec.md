# Feature Specification: Créditos de las credenciales de correo (panel)

**Created**: 2026-10-26 · **Status**: Implementado en el panel (pendiente de desplegar después del backend 042)

**Input**: en `/correo` había que pulsar «Probar» credencial por credencial para saber cuántos envíos le quedaban a cada una, y una con **0 envíos** seguía figurando «Activa» y «Último estado: OK».
El usuario quiere ver quién tiene créditos y que el sistema no pase por las que no los tienen.

> Contrato: `backend-ciisic/specs/042-creditos-correo/`. El panel solo muestra: **quién envía y quién se salta lo decide el backend**; `credencialEnUso` replica su regla para mostrarla.

## Decisiones

- **Insignia de envíos** en cada credencial de Brevo: «295 envíos» (verde; ámbar con 20 o menos), «Sin créditos» (rojo) o «Créditos sin revisar». Gmail no informa créditos y no lleva insignia.
- **«Envía ahora»**: en la primera credencial activa, por prioridad, que no esté sin créditos (`credencialEnUso`). Con la predeterminada agotada, la marca pasa a la siguiente.
- **Avisos**: alerta roja si **ninguna** activa tiene envíos (una de Gmail activa cuenta como con envíos); franja informativa si hay credenciales por delante de la que envía («Sin envíos disponibles: «ANGEL», «Gianmarcos». Los correos salen por «LORENA»…»).
- **«Revisar créditos»** (`POST email-credentials/check`): pregunta a Brevo por todas las activas y actualiza la lista, con el resumen en el aviso. Al abrir la pantalla se hace sola y en silencio si alguna revisión de una credencial de Brevo
  activa falta o tiene más de 5 min. Con un backend anterior (sin `creditosDisponibles`) no hay botón ni insignias.
- **«Último estado»** sigue siendo el de la última prueba o envío; los créditos se ven aparte y por eso «OK» con 0 envíos ya no confunde.
- **Confirmación del envío**: «Enviar prueba» dice que el proveedor confirmó que aceptó el correo y muestra su `messageId`. No dice que llegó al buzón (rebotes y spam).
- **Guía de Gmail**: el texto de la guía ahora usa lo que Google muestra («Seguridad e inicio de sesión» → «Cómo inicias sesión en Google» → «Verificación en dos pasos» → «Activar la verificación en dos pasos») y avisa de comprobar la cuenta del avatar
  cuando hay varias abiertas.

## Fuera de alcance

- Estado de entrega de cada correo (entregado, rebotó, spam) y un historial de envíos por credencial.
- Contar los envíos de Gmail contra su límite diario.
