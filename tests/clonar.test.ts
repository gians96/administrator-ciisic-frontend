import { describe, expect, it } from 'vitest'
import { isProxy, reactive, ref } from 'vue'
import { clonarLista } from '~/utils/clonar'

describe('clonarLista', () => {
  it('clona listas reactivas sin lanzar DataCloneError', () => {
    const original = reactive([{ a: 1 }])
    // Es el error que se quiere evitar: structuredClone no acepta proxies de Vue
    expect(() => structuredClone(original)).toThrow()

    const copia = clonarLista(original)
    expect(copia).toEqual([{ a: 1 }])
    expect(isProxy(copia)).toBe(false)
    expect(isProxy(copia[0])).toBe(false)
    // Son objetos planos: ahora sí se pueden clonar o serializar
    expect(() => structuredClone(copia)).not.toThrow()
  })

  it('devuelve objetos independientes del original', () => {
    const original = reactive([{ codigo: 'bcp', numeroCuenta: '123' }])
    const copia = clonarLista(original)
    copia[0]!.codigo = 'bbva'
    copia.push({ codigo: 'yape', numeroCuenta: '999' })
    expect(original).toEqual([{ codigo: 'bcp', numeroCuenta: '123' }])

    original[0]!.numeroCuenta = '456'
    expect(copia[0]!.numeroCuenta).toBe('123')
  })

  it('acepta listas dentro de refs, listas planas, null y undefined', () => {
    const datos = ref({ bancos: [{ codigo: 'bcp' }] })
    expect(clonarLista(datos.value.bancos)).toEqual([{ codigo: 'bcp' }])
    const plana = [{ icon: 'heroicons:gift', text: 'Kit' }]
    expect(clonarLista(plana)[0]).not.toBe(plana[0])
    expect(clonarLista(null)).toEqual([])
    expect(clonarLista(undefined)).toEqual([])
  })
})
