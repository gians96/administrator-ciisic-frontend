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

- **Guía de Gmail** (panel lateral derecho, `GuiaGmailSmtp`; contenido en `app/utils/guiaGmail.ts`): seis pasos con lista para marcar y avance (elegir la cuenta, activar la verificación en 2 pasos, crear la contraseña
  de aplicación, agregarla en el panel, probar, definir el orden), enlaces a `myaccount.google.com` (seguridad y contraseñas de aplicaciones) y «Problemas frecuentes» (contraseña rechazada, falta la opción en
  Workspace, límite diario, spam, dejar de usar Gmail). Se abre con **«Guía de Gmail»** en la cabecera de Correo, con «Ver la guía paso a paso» de la ayuda, con «Ver la guía de Gmail» junto al último error de una
  credencial de Gmail y con «¿Cómo creo la contraseña de aplicación?» del formulario. Su botón «Agregar credencial de Gmail» abre el alta con Gmail elegido y **no aparece cuando se abrió sobre el formulario**
  (lo reiniciaría). Las marcas de avance no se guardan. Sin ejemplos de contraseñas.

## Fuera de alcance

- Arrastrar y soltar para ordenar (hay flechas), cuotas por día o reparto de carga, otros proveedores SMTP.
