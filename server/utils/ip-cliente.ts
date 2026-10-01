import { isIP } from 'node:net'
import type { H3Event } from 'h3'

/**
 * IP real del navegador para los límites del backend (contraseña, Google y código por correo).
 *
 * En producción el panel corre detrás de Traefik, que **agrega** al final de `X-Forwarded-For` la IP
 * desde la que se conectó el cliente. Las entradas anteriores las escribe quien hace la petición (se
 * pueden inventar para esquivar los límites por IP), así que se toma la **última** y nunca la primera.
 * Sin el encabezado (desarrollo, sin proxy) se usa la IP de la conexión.
 *
 * Supone **un solo proxy** delante del panel (Traefik de Dokploy). Si se pone otro delante (CDN,
 * balanceador), la última entrada sería la de ese proxy y todos los visitantes compartirían los topes
 * por IP: hay que revisar esto antes (ver «IP real del visitante» en docs/configuracion-y-despliegue.md).
 *
 * Las IPv4 escritas como IPv6 (`::ffff:190.12.34.56`, como las entrega Node en un socket de doble pila)
 * se reenvían como IPv4: el backend agrupa las IPv6 por /56 y todas ellas caerían en el mismo tope.
 */

/** IP válida (v4 o v6), con las IPv4 mapeadas a IPv6 (`::ffff:a.b.c.d`) como IPv4; si no, `null`. */
export function ipValida(ip: string | null | undefined): string | null {
  const valor = typeof ip === 'string' ? ip.trim() : ''
  if (!valor || !isIP(valor)) return null
  const mapeada = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(valor)?.[1]
  return mapeada && isIP(mapeada) === 4 ? mapeada : valor
}

/** Última entrada de `X-Forwarded-For` si es una IP válida (`ipValida`); si no, `null`. */
export function ultimaIpReenviada(encabezado: string | readonly string[] | null | undefined): string | null {
  const texto = typeof encabezado === 'string' ? encabezado : Array.isArray(encabezado) ? encabezado.join(',') : ''
  return ipValida(texto.split(',').map((entrada) => entrada.trim()).filter(Boolean).at(-1))
}

/** IP del cliente: la que agregó el proxy de confianza o, sin proxy, la de la conexión. */
export function ipCliente(event: H3Event): string | null {
  return ultimaIpReenviada(getRequestHeader(event, 'x-forwarded-for')) ?? ipValida(getRequestIP(event))
}
