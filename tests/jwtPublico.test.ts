import { describe, expect, it } from 'vitest'
import { audienciasJwt, esCredencialGoogle, esSesionDeParticipante, payloadJwt } from '../server/utils/jwt-publico'
import { esRutaReenviable } from '../server/utils/proxy'

function jwt(payload: unknown): string {
  const parte = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString('base64url')
  return `${parte({ alg: 'HS256', typ: 'JWT' })}.${parte(payload)}.firma-no-verificada`
}

describe('JWT sin verificar (solo para enrutar)', () => {
  it('lee el payload y la audiencia', () => {
    const token = jwt({ aud: 'ciisic-participante', iss: 'backend-ciisic', participante: { id: 7, nombres: 'Ñandú' } })
    expect(payloadJwt(token)).toMatchObject({ iss: 'backend-ciisic', participante: { id: 7, nombres: 'Ñandú' } })
    expect(audienciasJwt(token)).toEqual(['ciisic-participante'])
    expect(audienciasJwt(jwt({ aud: ['ciisic-admin', 3] }))).toEqual(['ciisic-admin'])
  })

  it('distingue la sesión de inscrito', () => {
    expect(esSesionDeParticipante(jwt({ aud: 'ciisic-participante' }))).toBe(true)
    expect(esSesionDeParticipante(jwt({ aud: ['ciisic-participante'] }))).toBe(true)
    expect(esSesionDeParticipante(jwt({ aud: 'ciisic-admin' }))).toBe(false)
    // Sesiones anteriores a los perfiles (sin aud): no son de inscrito; decide el backend
    expect(esSesionDeParticipante(jwt({ user: { id: 1 } }))).toBe(false)
  })

  it('tolera tokens mal formados', () => {
    for (const token of [undefined, null, '', 'abc', 'a.b', 'a.b.c.d', 'a.%%%.c', `x.${Buffer.from('[1,2]').toString('base64url')}.y`]) {
      expect(payloadJwt(token), String(token)).toBeNull()
      expect(esSesionDeParticipante(token)).toBe(false)
    }
  })
})

describe('credencial de Google', () => {
  it('acepta un JWT de tres segmentos de hasta 4096 caracteres', () => {
    expect(esCredencialGoogle(jwt({ aud: 'cliente', nonce: 'n' }))).toBe(true)
    // 'aa.bb.' + 4090 = 4096 caracteres
    expect(esCredencialGoogle(`aa.bb.${'c'.repeat(4090)}`)).toBe(true)
    expect(esCredencialGoogle(`aa.bb.${'c'.repeat(4091)}`)).toBe(false)
  })

  it('rechaza otros valores', () => {
    for (const valor of [undefined, 123, '', 'a.b', 'a.b.', 'a..c', 'a.b.c.d', 'a.b.c d', 'a.b.c\n', { credential: 'a.b.c' }]) {
      expect(esCredencialGoogle(valor), JSON.stringify(valor)).toBe(false)
    }
  })
})

describe('rutas que el BFF reenvía', () => {
  it('acepta rutas relativas seguras', () => {
    expect(esRutaReenviable('inscriptions')).toBe(true)
    expect(esRutaReenviable('inscriptions/12/credential')).toBe(true)
    expect(esRutaReenviable('settings/undc-api/test')).toBe(true)
    expect(esRutaReenviable('papers/abc.pdf')).toBe(true)
  })

  it('rechaza recorridos, vacíos y caracteres extraños', () => {
    for (const ruta of ['', '..', '../admin', 'me/../admin', './x', 'a/./b', 'a?b', 'a%2e%2e/b', 'a\\b', 'a b']) {
      expect(esRutaReenviable(ruta), ruta).toBe(false)
    }
  })
})
