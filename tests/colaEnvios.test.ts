import { describe, expect, it, vi } from 'vitest'
import { crearColaEnvios, MAXIMO_EN_COLA } from '~/utils/colaEnvios'

/** Envío que termina a mano (petición en curso). */
function manual() {
  const pendientes = new Map<string, (resultado: string) => void>()
  const procesados: string[] = []
  const procesar = vi.fn((envio: string) => {
    procesados.push(envio)
    return new Promise<string>((resolver) => { pendientes.set(envio, resolver) })
  })
  return {
    procesar,
    procesados,
    terminar: async (envio: string, resultado = `ok:${envio}`) => {
      pendientes.get(envio)?.(resultado)
      // Deja correr las continuaciones (la cola pasa al siguiente)
      await new Promise((r) => setTimeout(r, 0))
    },
  }
}

describe('escáner: cola de envíos', () => {
  it('lector USB en ráfaga: A se envía, llegan B y C, y se registran todas en orden (antes C pisaba a B)', async () => {
    const { procesar, procesados, terminar } = manual()
    const cola = crearColaEnvios(procesar)
    const a = cola.agregar('A')
    const b = cola.agregar('B')
    const c = cola.agregar('C')
    expect(procesados).toEqual(['A'])
    expect(cola.enEspera()).toBe(2)
    expect(cola.ocupada()).toBe(true)

    await terminar('A')
    expect(procesados).toEqual(['A', 'B'])
    await terminar('B')
    await terminar('C')
    expect(procesados).toEqual(['A', 'B', 'C'])
    expect(await a).toBe('ok:A')
    expect(await b).toBe('ok:B')
    expect(await c).toBe('ok:C')
    expect(cola.ocupada()).toBe(false)
  })

  it('una sola a la vez', async () => {
    const { procesar, terminar } = manual()
    const cola = crearColaEnvios(procesar)
    cola.agregar('A')
    cola.agregar('B')
    expect(procesar).toHaveBeenCalledTimes(1)
    await terminar('A')
    expect(procesar).toHaveBeenCalledTimes(2)
  })

  it('con la cola llena no agrega y lo dice (la página la registra como «no procesada»)', () => {
    const { procesar } = manual()
    const cola = crearColaEnvios(procesar, 2)
    expect(cola.agregar('A')).not.toBeNull()
    expect(cola.agregar('B')).not.toBeNull()
    expect(cola.agregar('C')).not.toBeNull()
    // A en curso, B y C esperando: D ya no cabe
    expect(cola.agregar('D')).toBeNull()
    expect(cola.enEspera()).toBe(2)
    expect(MAXIMO_EN_COLA).toBeGreaterThanOrEqual(5)
  })

  it('detenida (aviso del QR anterior) termina la que está en curso y espera a «Continuar»', async () => {
    const { procesar, procesados, terminar } = manual()
    const cola = crearColaEnvios(procesar)
    cola.agregar('A')
    cola.agregar('B')
    cola.detener()
    expect(cola.detenida()).toBe(true)
    await terminar('A')
    expect(procesados).toEqual(['A'])
    // Lo que llega mientras tanto también espera
    cola.agregar('C')
    expect(procesados).toEqual(['A'])
    cola.reanudar()
    expect(procesados).toEqual(['A', 'B'])
    await terminar('B')
    expect(procesados).toEqual(['A', 'B', 'C'])
  })

  it('reanudar sin haber detenido no hace nada raro', async () => {
    const { procesar, procesados } = manual()
    const cola = crearColaEnvios(procesar)
    cola.reanudar()
    cola.agregar('A')
    cola.reanudar()
    expect(procesados).toEqual(['A'])
  })

  it('vaciar (sesión cerrada) descarta lo que esperaba y sus promesas dan undefined', async () => {
    const { procesar, procesados, terminar } = manual()
    const cola = crearColaEnvios(procesar)
    cola.agregar('A')
    const b = cola.agregar('B')
    expect(cola.vaciar()).toEqual(['B'])
    expect(await b).toBeUndefined()
    await terminar('A')
    expect(procesados).toEqual(['A'])
    expect(cola.ocupada()).toBe(false)
  })

  it('si procesar falla, la cola sigue con la siguiente', async () => {
    const procesar = vi.fn(async (envio: string) => {
      if (envio === 'A') throw new Error('falló')
      return envio
    })
    const cola = crearColaEnvios(procesar)
    const a = cola.agregar('A')
    const b = cola.agregar('B')
    expect(await a).toBeUndefined()
    expect(await b).toBe('B')
  })
})
