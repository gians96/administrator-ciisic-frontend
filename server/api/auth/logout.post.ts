export default defineEventHandler((event) => {
  assertSameOrigin(event)
  // Una petición aún en curso con este JWT no lo renueva ni vuelve a guardar la cookie
  olvidarSesion(tokenDeSesion(event))
  cerrarSesion(event)
  return { success: true }
})
