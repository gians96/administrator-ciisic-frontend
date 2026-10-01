# Configuración y despliegue

## Variables de entorno

| Variable | Uso |
|---|---|
| `NUXT_BACKEND_BASE_URL` | URL de backend-ciisic **sin** `/api/v1`, alcanzable por el servidor Nitro. En producción conviene la URL interna de Docker, para que el backend vea las IP reales en los límites de login |

Nada más: el client ID de Google, la URL del panel y la vida de la sesión vienen del backend.

## Configuración desde el propio panel (Owner y Administrador del sistema)

1. **Sistema** (solo Owner, `sistema.configurar`): API_UNDC (URL + API key creada en SIGENET →
   Clientes API, **Probar**), client ID de Google, URL del panel (la usa la landing) y el
   interruptor de la landing anterior.
2. **Correo**: credencial de Brevo (**Probar** y **Enviar prueba**).
3. **Consultas DNI**: tokens de Decolecta/apiperu.
4. **Eventos → Acceso**: token de la landing del evento (se muestra una vez).
5. **Eventos → Integraciones**: URL y token de deportes-fi.

## Google Cloud

El client ID (tipo Aplicación web) debe tener como **orígenes JavaScript autorizados** el dominio
del panel y el de cada landing (en desarrollo `http://localhost:3001` y `http://localhost:3000`).
No hace falta URI de redirección ni secreto. Pantalla de consentimiento en estado *In production*.

## Despliegue (Dokploy)

1. App nueva con el `Dockerfile` del repo, **detrás de HTTPS** (la cookie es `Secure`), p. ej.
   `admin-ciisic.episundc.pe`.
2. Variable `NUXT_BACKEND_BASE_URL`.
3. Verificar: `/login` responde 200 (healthcheck de la imagen), inicio de sesión con contraseña y
   con Google, cookie httpOnly (el JWT no aparece en el almacenamiento del navegador), que cada
   rol (Owner, Administrador del sistema, Tesorero, Comisión) solo ve las pantallas de sus permisos
   (un Administrador no abre Sistema), descarga de voucher y portal de un inscrito.
4. Agregar el dominio del panel a los orígenes autorizados del client ID de Google y guardar la
   URL del panel en Sistema.
