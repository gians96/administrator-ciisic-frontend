export default defineEventHandler((event) => {
  assertSameOrigin(event)
  cerrarSesion(event)
  return { success: true }
})
