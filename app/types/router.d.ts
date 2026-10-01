import type { Permiso } from '~/types/api'

declare module '#app' {
  interface PageMeta {
    /**
     * Permiso (o alguno de la lista) que exige la página al staff. Sin él, el middleware lleva a la
     * página de inicio de la cuenta (`inicioPara`). El menú usa los mismos permisos.
     */
    permiso?: Permiso | Permiso[]
    /**
     * Perfil de sesión que puede abrir la página (por defecto `admin`). Un inscrito solo entra a las
     * páginas `participante`; el staff que abre una de ellas vuelve a su inicio.
     */
    perfil?: 'admin' | 'participante'
    /**
     * Página pública (la verificación de certificados, `/verificar`): no exige sesión ni la lee; la abre
     * cualquiera, con o sin sesión (staff o inscrito).
     */
    publica?: boolean
  }
}

export {}
