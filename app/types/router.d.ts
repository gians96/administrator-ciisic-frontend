declare module '#app' {
  interface PageMeta {
    /** Solo visible para el rol SUPERADMIN. */
    soloSuperAdmin?: boolean
    /**
     * Perfil de sesión que puede abrir la página (por defecto `admin`). Un inscrito solo entra a las
     * páginas `participante`; un administrador que abre una de ellas vuelve al inicio.
     */
    perfil?: 'admin' | 'participante'
  }
}

export {}
