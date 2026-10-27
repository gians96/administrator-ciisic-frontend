# Feature Specification: Correo con respaldo entre credenciales y Gmail por SMTP (panel)

**Created**: 2026-10-26 · **Status**: Implementado en el panel (pendiente de desplegar después del backend 041)

**Input**: Brevo gratis da 300 envíos al día y el congreso se quedó sin poder enviar. En `/correo` el Owner quiere varias credenciales **por prioridad**
(si una se agota, se usa la siguiente) y poder agregar **Gmail por SMTP** con una contraseña de aplicación.

> Contrato: `backend-ciisic/specs/041-correo-respaldo-gmail/`. El panel solo muestra y configura: **el orden y el respaldo los decide el backend**.

## Decisiones

- **Proveedor al crear** (Brevo o Gmail); no cambia al editar. Con Gmail el formulario pide «Contraseña de aplicación de Google» y «Cuenta de Gmail (remitente)», con la ayuda para crearla
  (`myaccount.google.com/apppasswords`, requiere la verificación en 2 pasos).
- **Orden**: la lista sigue el de envío (predeterminada primero y luego `prioridad`). Flechas ↑↓ en las de respaldo; mueven un lugar y mandan el orden completo (`PUT email-credentials/order`). La predeterminada
  no se mueve (para cambiarla se marca otra). Insignias: proveedor y «Prioridad N» (la posición).
- **Aviso de respaldo**: con una sola credencial activa, una franja ámbar explica el límite (Brevo 300 al día, Gmail ~500 al día / 2000 en Workspace) y pide agregar otra.
- **Contraseña de Gmail**: se acepta con espacios y en cualquier caja; se valida en el navegador (16 letras) y se envía normalizada. Cambiar la cuenta de Gmail exige pegar su contraseña.
- **Probar** (Gmail: inicia sesión sin enviar; muestra la cuenta) y **Enviar prueba** (solo esa credencial, sin respaldo) con textos según el proveedor.
- **Compatibilidad**: contra un backend anterior no hay `prioridad` → sin flechas ni insignia de prioridad y Gmail **no se ofrece** (descartaría `proveedor`); si la lista está vacía se ofrece y, si la respuesta del
  alta no trae `GMAIL_SMTP`, se borra la credencial creada y se avisa. **Orden de despliegue: backend 041 primero.**

## Fuera de alcance

- Arrastrar y soltar para ordenar (hay flechas), cuotas por día o reparto de carga, otros proveedores SMTP.
