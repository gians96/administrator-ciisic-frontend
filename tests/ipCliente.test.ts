import type { H3Event } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ipCliente, ipValida, ultimaIpReenviada } from '../server/utils/ip-cliente'

describe('BFF: IP real del cliente', () => {
  it('toma la última entrada de X-Forwarded-For (la que agrega Traefik), nunca la primera', () => {
    // El cliente inventa «1.1.1.1»; Traefik agrega la IP real al final
    expect(ultimaIpReenviada('1.1.1.1, 190.12.34.56')).toBe('190.12.34.56')
    expect(ultimaIpReenviada('190.12.34.56')).toBe('190.12.34.56')
    expect(ultimaIpReenviada(' 10.0.0.1 ,  2001:db8::1 ')).toBe('2001:db8::1')
    // Varios encabezados X-Forwarded-For
    expect(ultimaIpReenviada(['1.1.1.1', '200.1.2.3'])).toBe('200.1.2.3')
  })

  it('sin encabezado o con una última entrada que no es una IP, null', () => {
    expect(ultimaIpReenviada(undefined)).toBeNull()
    expect(ultimaIpReenviada(null)).toBeNull()
    expect(ultimaIpReenviada('')).toBeNull()
    expect(ultimaIpReenviada(' , ')).toBeNull()
    expect(ultimaIpReenviada('1.1.1.1, desconocido')).toBeNull()
    expect(ultimaIpReenviada('1.1.1.1, 300.1.1.1')).toBeNull()
    expect(ultimaIpReenviada('1.1.1.1, 1.2.3.4:5678')).toBeNull()
  })

  it('valida la IP de la conexión', () => {
    expect(ipValida('127.0.0.1')).toBe('127.0.0.1')
    expect(ipValida('2001:db8::1')).toBe('2001:db8::1')
    expect(ipValida('')).toBeNull()
    expect(ipValida(undefined)).toBeNull()
    expect(ipValida('localhost')).toBeNull()
  })

  it('una IPv4 escrita como IPv6 (::ffff:a.b.c.d) se reenvía como IPv4 (el backend agrupa las IPv6 por /56)', () => {
    expect(ipValida('::ffff:172.18.0.5')).toBe('172.18.0.5')
    expect(ipValida('::FFFF:190.12.34.56')).toBe('190.12.34.56')
    expect(ultimaIpReenviada('1.1.1.1, ::ffff:190.12.34.56')).toBe('190.12.34.56')
    // Otras IPv6 quedan igual
    expect(ipValida('::ffff:abcd:1')).toBe('::ffff:abcd:1')
    expect(ipValida('::1')).toBe('::1')
  })

  describe('ipCliente', () => {
    afterEach(() => vi.unstubAllGlobals())
    const evento = {} as H3Event

    function preparar(xff: string | undefined, conexion: string | undefined) {
      vi.stubGlobal('getRequestHeader', (_: H3Event, nombre: string) => (nombre === 'x-forwarded-for' ? xff : undefined))
      vi.stubGlobal('getRequestIP', () => conexion)
    }

    it('prefiere la IP que agregó el proxy y si no, la de la conexión', () => {
      preparar('8.8.8.8, 190.12.34.56', '172.18.0.2')
      expect(ipCliente(evento)).toBe('190.12.34.56')
      preparar(undefined, '172.18.0.2')
      expect(ipCliente(evento)).toBe('172.18.0.2')
      preparar('basura', '172.18.0.2')
      expect(ipCliente(evento)).toBe('172.18.0.2')
      preparar(undefined, '::ffff:172.18.0.2')
      expect(ipCliente(evento)).toBe('172.18.0.2')
      preparar(undefined, undefined)
      expect(ipCliente(evento)).toBeNull()
    })
  })
})
