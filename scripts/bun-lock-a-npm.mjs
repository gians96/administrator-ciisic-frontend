#!/usr/bin/env node
/**
 * Convierte `bun.lock` en `package-lock.json` (npm, lockfileVersion 3) **sin cambiar ninguna versión**:
 * el árbol del lock de npm es el mismo que bun instaló (mismas versiones, mismos anidados e
 * integridades). Existe porque la imagen Docker instala con `npm ci` (Bun no arranca en el servidor de
 * Dokploy: su CPU no tiene SSE4.2), mientras que el equipo sigue trabajando con bun.
 *
 *   node scripts/bun-lock-a-npm.mjs           escribe package-lock.json
 *   node scripts/bun-lock-a-npm.mjs --check   falla (código 1) si package-lock.json no corresponde a bun.lock
 *
 * Tras cambiar dependencias: `bun install` (actualiza bun.lock) y luego `bun run lock:npm`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// semver llega con las dependencias del proyecto (bun install)
const semver = createRequire(import.meta.url)('semver')

/** bun.lock es JSONC: admite comas finales. */
function leerBunLock(texto) {
  return JSON.parse(texto.replace(/,(\s*[}\]])/g, '$1'))
}

/** Clave de bun (`a`, `@s/a`, `a/b`, `@s/a/@t/b`) → nombres de paquete anidados. */
function nombresDeClave(clave) {
  const partes = clave.split('/')
  const nombres = []
  for (let i = 0; i < partes.length; i++) {
    if (partes[i].startsWith('@')) {
      nombres.push(`${partes[i]}/${partes[i + 1]}`)
      i++
    } else {
      nombres.push(partes[i])
    }
  }
  return nombres
}

const rutaDeNombres = (nombres) => `node_modules/${nombres.join('/node_modules/')}`
const comoLista = (valor) => (valor === undefined ? undefined : Array.isArray(valor) ? valor : [valor])

function libcDe(nombre, os) {
  if (!os?.includes('linux')) return undefined
  if (/-musl(-|$)/.test(nombre)) return ['musl']
  if (/-gnu(eabihf)?(-|$)/.test(nombre)) return ['glibc']
  return undefined
}

function sinAlcance(nombre) {
  return nombre.includes('/') ? nombre.split('/')[1] : nombre
}

/**
 * @param {string} textoBunLock contenido de bun.lock
 * Devuelve el lock y los `peerDependencies` que se omitieron (ver el paso 3).
 *
 * @param {{ name: string, version?: string, dependencies?: Record<string,string>, devDependencies?: Record<string,string>, scripts?: Record<string,string> }} paquete package.json
 */
export function convertir(textoBunLock, paquete) {
  const bun = leerBunLock(textoBunLock)
  const raiz = bun.workspaces['']
  const paquetes = {}

  // 1) Un nodo por entrada de bun.lock, en la ruta que bun le dio
  for (const [clave, entrada] of Object.entries(bun.packages)) {
    const [id, , meta = {}, integridad] = entrada
    const arroba = id.lastIndexOf('@')
    const nombreId = id.slice(0, arroba)
    const version = id.slice(arroba + 1)
    const nombres = nombresDeClave(clave)
    const nombre = nombres[nombres.length - 1]
    const ruta = rutaDeNombres(nombres)
    const os = comoLista(meta.os)
    const cpu = comoLista(meta.cpu)
    const nodo = { version }
    if (nombreId !== nombre) nodo.name = nombreId
    if (meta.bundled) {
      nodo.inBundle = true
    } else {
      nodo.resolved = `https://registry.npmjs.org/${nombreId}/-/${sinAlcance(nombreId)}-${version}.tgz`
      nodo.integrity = integridad
    }
    if (os) nodo.os = os
    if (cpu) nodo.cpu = cpu
    const libc = libcDe(nombreId, os)
    if (libc) nodo.libc = libc
    if (meta.bin) nodo.bin = typeof meta.bin === 'string' ? { [sinAlcance(nombreId)]: meta.bin } : meta.bin
    if (meta.dependencies) nodo.dependencies = meta.dependencies
    if (meta.optionalDependencies) nodo.optionalDependencies = meta.optionalDependencies
    if (meta.peerDependencies) nodo.peerDependencies = meta.peerDependencies
    if (meta.optionalPeers?.length) {
      nodo.peerDependenciesMeta = Object.fromEntries(meta.optionalPeers.map((p) => [p, { optional: true }]))
    }
    paquetes[ruta] = nodo
  }

  // Un paquete incluido dentro de otro (bundled) se declara en el padre
  for (const ruta of Object.keys(paquetes)) {
    if (!paquetes[ruta].inBundle) continue
    const i = ruta.lastIndexOf('/node_modules/')
    const padre = ruta.slice(0, i)
    const nombre = ruta.slice(i + '/node_modules/'.length)
    const nodoPadre = paquetes[padre]
    if (nodoPadre) nodoPadre.bundleDependencies = [...(nodoPadre.bundleDependencies ?? []), nombre].sort()
  }

  // 2) Resolución de dependencias como Node: la copia más cercana subiendo por node_modules
  function resolver(desde, nombre) {
    let base = desde
    for (;;) {
      const candidata = base ? `${base}/node_modules/${nombre}` : `node_modules/${nombre}`
      if (paquetes[candidata]) return candidata
      if (!base) return null
      const i = base.lastIndexOf('/node_modules/')
      base = i === -1 ? '' : base.slice(0, i)
    }
  }

  // 3) Bun tolera pares (peerDependencies) instalados fuera de su rango; `npm ci` no (los daría por un lock
  // desactualizado e intentaría cambiar versiones). Solo se omite esa declaración en el lock: el árbol
  // instalado sigue siendo exactamente el de bun.
  const peersOmitidos = []
  for (const [ruta, nodo] of Object.entries(paquetes)) {
    for (const [nombre, rango] of Object.entries(nodo.peerDependencies ?? {})) {
      const destino = resolver(ruta, nombre)
      if (!destino || semver.satisfies(paquetes[destino].version, rango, { includePrerelease: true })) continue
      peersOmitidos.push(`${ruta.replaceAll('node_modules/', '')} -> ${nombre} ${rango} (instalado ${paquetes[destino].version})`)
      delete nodo.peerDependencies[nombre]
      if (nodo.peerDependenciesMeta) delete nodo.peerDependenciesMeta[nombre]
    }
    if (nodo.peerDependencies && !Object.keys(nodo.peerDependencies).length) delete nodo.peerDependencies
    if (nodo.peerDependenciesMeta && !Object.keys(nodo.peerDependenciesMeta).length) delete nodo.peerDependenciesMeta
  }

  const raicesProd = Object.keys(raiz.dependencies ?? {})
  const raicesDev = Object.keys(raiz.devDependencies ?? {})

  /** Nodos alcanzables desde las raíces; con `conOpcionales` también por optionalDependencies y peers opcionales instalados. */
  function alcanzables(nombresRaiz, conOpcionales) {
    const vistos = new Set()
    const pila = []
    const visitar = (desde, nombre) => {
      const ruta = resolver(desde, nombre)
      if (ruta && !vistos.has(ruta)) {
        vistos.add(ruta)
        pila.push(ruta)
      }
    }
    for (const nombre of nombresRaiz) visitar('', nombre)
    while (pila.length) {
      const ruta = pila.pop()
      const nodo = paquetes[ruta]
      for (const nombre of Object.keys(nodo.dependencies ?? {})) visitar(ruta, nombre)
      for (const nombre of Object.keys(nodo.peerDependencies ?? {})) {
        if (conOpcionales || !nodo.peerDependenciesMeta?.[nombre]?.optional) visitar(ruta, nombre)
      }
      if (conOpcionales) for (const nombre of Object.keys(nodo.optionalDependencies ?? {})) visitar(ruta, nombre)
    }
    return vistos
  }

  // 4) Banderas (npm las usa para omitir lo que no corresponde a la plataforma o a --omit=dev):
  //    dev = todos los caminos nacen en devDependencies; optional = todos pasan por una dependencia opcional;
  //    devOptional = ni dev ni optional por sí solos, pero ningún camino de producción lo exige.
  const requeridos = alcanzables([...raicesProd, ...raicesDev], false)
  const deProduccion = alcanzables(raicesProd, true)
  const deProduccionRequerido = alcanzables(raicesProd, false)
  for (const [ruta, nodo] of Object.entries(paquetes)) {
    const dev = !deProduccion.has(ruta)
    const optional = !requeridos.has(ruta)
    if (dev) nodo.dev = true
    if (optional) nodo.optional = true
    if (!dev && !optional && !deProduccionRequerido.has(ruta)) nodo.devOptional = true
  }

  const nodoRaiz = { name: paquete.name }
  if (paquete.version) nodoRaiz.version = paquete.version
  if (['preinstall', 'install', 'postinstall'].some((s) => paquete.scripts?.[s])) nodoRaiz.hasInstallScript = true
  if (raiz.dependencies) nodoRaiz.dependencies = raiz.dependencies
  if (raiz.devDependencies) nodoRaiz.devDependencies = raiz.devDependencies

  const ordenadas = Object.keys(paquetes).sort((a, b) => a.localeCompare(b, 'en'))
  const resultado = {
    name: paquete.name,
    ...(paquete.version ? { version: paquete.version } : {}),
    lockfileVersion: 3,
    requires: true,
    packages: { '': nodoRaiz, ...Object.fromEntries(ordenadas.map((ruta) => [ruta, paquetes[ruta]])) },
  }
  return { lock: resultado, peersOmitidos }
}

export const aTexto = (lock) => `${JSON.stringify(lock, null, 2)}\n`

function principal() {
  const carpeta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const { lock: objeto, peersOmitidos } = convertir(
    fs.readFileSync(path.join(carpeta, 'bun.lock'), 'utf8'),
    JSON.parse(fs.readFileSync(path.join(carpeta, 'package.json'), 'utf8')),
  )
  const lock = aTexto(objeto)
  const destino = path.join(carpeta, 'package-lock.json')
  if (process.argv.includes('--check')) {
    const actual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : ''
    if (actual !== lock) {
      console.error('package-lock.json no corresponde a bun.lock. Ejecuta: bun run lock:npm')
      process.exit(1)
    }
    console.log('package-lock.json está al día con bun.lock')
    return
  }
  fs.writeFileSync(destino, lock)
  console.log(`package-lock.json escrito (${Object.keys(objeto.packages).length - 1} paquetes)`)
  for (const peer of peersOmitidos) console.log(`  par omitido (bun lo instala fuera de rango): ${peer}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal()
