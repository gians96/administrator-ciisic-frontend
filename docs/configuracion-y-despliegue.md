# Configuración y despliegue

## Variables de entorno

| Variable | Uso |
|---|---|
| `NUXT_BACKEND_BASE_URL` | URL de backend-ciisic **sin** `/api/v1`, alcanzable por el servidor Nitro. En producción, **la URL interna de Docker** (obligatoria desde la spec 014 del backend; ver «IP real» abajo) |

Nada más: el client ID de Google, la URL del panel, la vida de la sesión y si se ofrece el acceso
con código por correo vienen del backend.

### IP real del visitante

El backend limita por IP el login con contraseña, Google y el código por correo (p. ej. 200
solicitudes de código por hora y 50 códigos incorrectos por hora desde una misma IP). Para que
cuente la IP de cada visitante:

- El BFF (`server/utils/ip-cliente.ts`) reenvía en `x-forwarded-for` la **última** entrada de
  `X-Forwarded-For`, la que agrega Traefik con la IP real; nunca la primera, que la escribe el
  cliente. Sin el encabezado (desarrollo) usa la IP de la conexión. Una IPv4 escrita como IPv6
  (`::ffff:190.12.34.56`) se reenvía como IPv4 (el backend agrupa las IPv6 por /56).
- Supone **un solo proxy** (Traefik) delante del panel. Si se agrega un CDN o un balanceador delante
  de Traefik, la última entrada sería la de ese proxy y todos los visitantes compartirían el tope:
  antes de hacerlo hay que cambiar `ip-cliente.ts` para tomar la entrada que corresponda.
- El panel debe llamar al backend por la **URL interna** (red de Dokploy): por la URL pública,
  Traefik agregaría la IP del panel al final y todos los visitantes compartirían el mismo tope; el
  día del evento la puerta quedaría bloqueada.
- Comprobación: en el backend, `req.ip` de un ingreso por el panel debe ser la IP pública del
  visitante, no la del contenedor del panel ni la de Traefik.

## Configuración desde el propio panel (Owner y Administrador del sistema)

1. **Sistema** (solo Owner, `sistema.configurar`): API_UNDC (URL + API key creada en SIGENET →
   Clientes API, **Probar**), client ID de Google, URL del panel (la usa la landing) y el
   interruptor de la landing anterior.
2. **Correo**: credencial de Brevo (**Probar** y **Enviar prueba**). Con el backend 014, el código
   de acceso al portal sale de la credencial **predeterminada activa**: sin ella (o si su último
   envío falló hace menos de 15 min) el login no ofrece el código.
3. **Consultas DNI**: tokens de Decolecta/apiperu.
4. **Eventos → Acceso**: token de la landing del evento (se muestra una vez).
5. **Eventos → Integraciones**: URL y token de deportes-fi.

## Google Cloud

El client ID (tipo Aplicación web) debe tener como **orígenes JavaScript autorizados** el dominio
del panel y el de cada landing (en desarrollo `http://localhost:3001` y `http://localhost:3000`).
No hace falta URI de redirección ni secreto. Pantalla de consentimiento en estado *In production*.

## Despliegue (Dokploy)

1. App nueva con el `Dockerfile` del repo, **detrás de HTTPS** (la cookie es `Secure` y la cámara
   del escáner solo funciona con HTTPS), p. ej. `admin-ciisic.episundc.pe`.
2. Variable `NUXT_BACKEND_BASE_URL` con la URL interna del backend.
3. Verificar: `/login` responde 200 (healthcheck de la imagen), inicio de sesión con contraseña y
   con Google, cookie httpOnly (el JWT no aparece en el almacenamiento del navegador), que cada
   rol (Owner, Administrador del sistema, Tesorero, Comisión) solo ve las pantallas de sus permisos
   (un Administrador no abre Sistema), descarga de voucher y portal de un inscrito.
4. Agregar el dominio del panel a los orígenes autorizados del client ID de Google y guardar la
   URL del panel en Sistema.

## Orden de despliegue con el backend 014 (portal, fotocheck y escáner)

El panel con la spec 009 se despliega **antes** que el backend con la spec 014 (o a la vez), nunca
después: las credenciales que emite el backend 014 llevan un QR nuevo (código de 10 caracteres) que
el escáner del panel anterior no lee. El panel 009 funciona con el backend 013 de producción:

| Con el backend 013 | Con el backend 014 |
|---|---|
| Login sin la opción del código | «Entrar con un código a mi correo» (si hay credencial de correo activa) |
| Fotocheck, asistencia, certificados y perfil: «pronto disponible» | Secciones activas (certificados, con la spec 015) |
| «Mi portal de participante» avisa que aún no está disponible | Paso al portal (Google directo; contraseña, con código) |
| El escáner marca con el QR anterior y el DNI | QR nuevo (verde), QR anterior en ámbar hasta el fin del evento, foto de la persona |
| Alta de participantes y cortesías: «pronto disponible» | Activas |

Pasos:

1. Cambiar `NUXT_BACKEND_BASE_URL` a la URL interna y redeplegar el panel 009; verificar contra el
   backend 013 (tabla, columna izquierda).
2. Desplegar el backend 014 según `backend-ciisic/docs/operacion.md` (respaldo, migración al
   arrancar, verificación y pregeneración de credenciales).
3. Verificar con el 014: pedir un código y entrar al portal; ver el fotocheck en un celular;
   escanearlo con una cuenta de la Comisión (verde) y escanear una credencial anterior (ámbar);
   subir una foto y verla en el escáner; «Mi portal de participante» desde una cuenta de staff
   inscrita.
4. Si hubiera que volver el backend a la 013, el panel 009 sigue funcionando (columna izquierda);
   no se vuelve el panel a una versión anterior mientras el backend tenga la 014.
