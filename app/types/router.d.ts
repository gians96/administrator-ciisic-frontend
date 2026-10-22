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
     * Página sin sesión (enlace público de un docente, spec 017): el middleware no pide ni carga la sesión.
     * Su acceso lo da un token en el `#` de la URL, que el navegador no envía a ningún servidor.
     */
    publica?: boolean
  }
}

export {}
