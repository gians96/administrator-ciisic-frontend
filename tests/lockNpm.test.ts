import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * La imagen Docker instala con `npm ci` (Bun no arranca en el servidor de Dokploy: CPU sin SSE4.2) a partir
 * de package-lock.json, que se genera desde bun.lock con `bun run lock:npm`. Estas pruebas avisan si alguien
 * cambia dependencias con bun y olvida regenerarlo (la imagen instalaría otra cosa o `npm ci` fallaría).
 */
const RAIZ = fileURLToPath(new URL('..', import.meta.url))
interface Dependencias { dependencies?: Record<string, string>, devDependencies?: Record<string, string> }
const leer = <T>(archivo: string) => JSON.parse(readFileSync(`${RAIZ}${archivo}`, 'utf8')) as T

describe('package-lock.json para la imagen Docker', () => {
  it('corresponde exactamente a bun.lock (si falla: bun run lock:npm)', () => {
    expect(() => execFileSync(process.execPath, ['scripts/bun-lock-a-npm.mjs', '--check'], { cwd: RAIZ, stdio: 'pipe' })).not.toThrow()
  })

  it('declara las mismas dependencias directas que package.json', () => {
    const paquete = leer<Dependencias>('package.json')
    const raiz = leer<{ packages: Record<string, Dependencias> }>('package-lock.json').packages['']
    expect(raiz.dependencies).toEqual(paquete.dependencies)
    expect(raiz.devDependencies).toEqual(paquete.devDependencies)
  })

  it('el Dockerfile instala con npm ci y no usa Bun', () => {
    const dockerfile = readFileSync(`${RAIZ}Dockerfile`, 'utf8')
    expect(dockerfile).toMatch(/COPY package\.json package-lock\.json/)
    expect(dockerfile).toMatch(/RUN npm ci /)
    expect(dockerfile.split('\n').filter((linea) => !linea.trim().startsWith('#')).join('\n')).not.toMatch(/bun/i)
  })
})
