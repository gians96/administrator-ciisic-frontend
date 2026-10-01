import { describe, expect, it } from 'vitest'
import type { Administrador, PermisoElegible, RolAsignable } from '~/types/api'
import {
  accesoDe,
  alternarPermiso,
  bloqueadoPor,
  chipsPermisos,
  contrasenaObligatoria,
  cuerpoAdmin,
  descripcionRol,
  etiquetaAcceso,
  exponeDatosPersonales,
  formularioDe,
  idsEvento,
  motivoGoogleBloqueado,
  nombrePermiso,
  opcionesEventos,
  permisosIniciales,
  permisosParaGuardar,
  promueveAGlobal,
  puedeEditarCorreo,
  reaccionAlError,
  type FormAdmin,
} from '~/utils/administradores'

const base: FormAdmin = { nombres: ' Ana ', apellidos: 'Ríos ', correo: ' ana@undc.edu.pe ', acceso: 'GOOGLE', contrasena: '', rolCodigo: 'ADMIN', activo: true, eventoIds: [], permisos: [] }
const conContrasena = { tieneContrasena: true }
const soloGoogle = { tieneContrasena: false }

/** `permisosElegibles` de la Comisión tal como los envía `GET /roles`. */
const ELEGIBLES: PermisoElegible[] = [
  { codigo: 'asistencia.marcar', nombre: 'Marcar asistencia', implica: ['asistencia.ver'] },
  { codigo: 'asistencia.ver', nombre: 'Ver la asistencia', implica: [] },
  { codigo: 'asistencia.anular', nombre: 'Anular una asistencia marcada', implica: ['asistencia.ver'] },
  { codigo: 'asistencia.fuera_horario', nombre: 'Marcar asistencia fuera del horario de la actividad', implica: ['asistencia.marcar'] },
  { codigo: 'asistencia.exportar', nombre: 'Exportar la asistencia', implica: ['asistencia.ver'] },
  { codigo: 'resumen.ver', nombre: 'Ver el resumen del evento', implica: [] },
  { codigo: 'inscripciones.ver', nombre: 'Ver inscritos (nombre, documento, correo y celular)', implica: [] },
  { codigo: 'inscripciones.exportar', nombre: 'Exportar inscritos a CSV', implica: ['inscripciones.ver'] },
  { codigo: 'credenciales.reenviar', nombre: 'Reenviar la credencial por correo', implica: ['inscripciones.ver'] },
  { codigo: 'ponencias.ver', nombre: 'Ver y descargar ponencias', implica: [] },
  { codigo: 'mensajes.ver', nombre: 'Ver mensajes de contacto', implica: [] },
]

const COMISION: RolAsignable = { id: 4, codigo: 'COMISION', nombre: 'Comisión tecnológica', alcance: 'EVENTO', permisos: [], permisosElegibles: ELEGIBLES, permisosPorDefecto: ['asistencia.marcar'] }
const TESORERO: RolAsignable = { id: 3, codigo: 'TESORERO', nombre: 'Tesorero', alcance: 'EVENTO', permisos: ['resumen.ver', 'inscripciones.ver'] }
const OWNER: RolAsignable = { id: 1, codigo: 'SUPERADMIN', nombre: 'Owner', alcance: 'GLOBAL', permisos: [] }

/** Cuenta de la Comisión tal como la devuelve `GET /admin`. */
const cuentaComision: Administrador = {
  id: 40,
  nombres: 'Luis',
  apellidos: 'Paz',
  correo: 'luis@undc.edu.pe',
  rolId: 4,
  rolCodigo: 'COMISION',
  rolNombre: 'Comisión tecnológica',
  activo: true,
  tieneContrasena: false,
  googleVinculado: true,
  alcance: 'EVENTO',
  eventos: [{ id: 2, nombreCorto: 'VIII CIISIC 2026' }],
  permisos: ['asistencia.marcar', 'asistencia.ver'],
  creadoEn: '2026-09-30T12:00:00.000Z',
}

const formComision: FormAdmin = { ...base, rolCodigo: 'COMISION', eventoIds: [2], permisos: ['asistencia.marcar'] }
const opcionesComision = { alcanceRol: 'EVENTO' as const, permisosElegibles: ELEGIBLES }

describe('accesoDe / etiquetaAcceso', () => {
  it('una cuenta nueva empieza con «Solo Google»', () => {
    expect(accesoDe()).toBe('GOOGLE')
    expect(accesoDe(null)).toBe('GOOGLE')
  })

  it('lee el acceso de la cuenta', () => {
    expect(accesoDe(soloGoogle)).toBe('GOOGLE')
    expect(accesoDe(conContrasena)).toBe('CONTRASENA')
    expect(etiquetaAcceso(soloGoogle)).toBe('Solo Google')
    expect(etiquetaAcceso(conContrasena)).toBe('Contraseña o Google')
  })

  it('una respuesta sin el campo se trata como con contraseña', () => {
    expect(accesoDe({})).toBe('CONTRASENA')
  })
})

describe('contrasenaObligatoria / promueveAGlobal', () => {
  it('solo cuando se elige contraseña y la cuenta aún no tiene', () => {
    expect(contrasenaObligatoria('CONTRASENA')).toBe(true)
    expect(contrasenaObligatoria('CONTRASENA', soloGoogle)).toBe(true)
    expect(contrasenaObligatoria('CONTRASENA', conContrasena)).toBe(false)
    expect(contrasenaObligatoria('GOOGLE')).toBe(false)
  })

  it('al promover a un rol global la contraseña actual se borra: hay que escribir otra', () => {
    expect(contrasenaObligatoria('CONTRASENA', conContrasena, true)).toBe(true)
    expect(contrasenaObligatoria('GOOGLE', conContrasena, true)).toBe(false)
  })

  it('promover = una cuenta por evento pasa a un rol global', () => {
    expect(promueveAGlobal({ tieneContrasena: true, alcance: 'EVENTO' }, 'GLOBAL')).toBe(true)
    expect(promueveAGlobal({ tieneContrasena: true, alcance: 'EVENTO' }, 'EVENTO')).toBe(false)
    expect(promueveAGlobal({ tieneContrasena: true, alcance: 'GLOBAL' }, 'GLOBAL')).toBe(false)
    expect(promueveAGlobal(null, 'GLOBAL')).toBe(false)
  })
})

describe('cuerpoAdmin: datos y acceso', () => {
  it('alta solo con Google: sin contraseña y con los textos recortados', () => {
    const { body, errores } = cuerpoAdmin(base)
    expect(errores).toEqual({})
    expect(body).toEqual({ nombres: 'Ana', apellidos: 'Ríos', correo: 'ana@undc.edu.pe', rolCodigo: 'ADMIN', activo: true })
  })

  it('exige elegir un rol', () => {
    expect(cuerpoAdmin({ ...base, rolCodigo: '' }).errores.rolCodigo).toBe('Elige un rol.')
  })

  it('«Solo Google» nunca envía la contraseña escrita', () => {
    expect(cuerpoAdmin({ ...base, contrasena: 'una-clave-segura-2026' }).body).not.toHaveProperty('contrasena')
  })

  it('alta con contraseña: obligatoria y de 12 caracteres', () => {
    expect(cuerpoAdmin({ ...base, acceso: 'CONTRASENA' }).errores).toHaveProperty('contrasena')
    expect(cuerpoAdmin({ ...base, acceso: 'CONTRASENA', contrasena: 'corta' }).errores.contrasena).toMatch(/12/)
    const { body, errores } = cuerpoAdmin({ ...base, acceso: 'CONTRASENA', contrasena: 'una-clave-segura-2026' })
    expect(errores).toEqual({})
    expect(body.contrasena).toBe('una-clave-segura-2026')
  })

  it('editar con contraseña y dejarla vacía la conserva', () => {
    const { body, errores } = cuerpoAdmin({ ...base, acceso: 'CONTRASENA' }, conContrasena)
    expect(errores).toEqual({})
    expect(body).not.toHaveProperty('contrasena')
    expect(body).not.toHaveProperty('quitarContrasena')
  })

  it('pasar una cuenta con contraseña a «Solo Google» pide quitarla', () => {
    expect(cuerpoAdmin(base, conContrasena).body.quitarContrasena).toBe(true)
  })

  it('una cuenta que ya es solo Google no envía cambios de contraseña', () => {
    const { body } = cuerpoAdmin(base, soloGoogle)
    expect(body).not.toHaveProperty('quitarContrasena')
    expect(body).not.toHaveProperty('contrasena')
  })

  it('pasar una cuenta solo Google a contraseña exige escribirla', () => {
    expect(cuerpoAdmin({ ...base, acceso: 'CONTRASENA' }, soloGoogle).errores).toHaveProperty('contrasena')
    expect(cuerpoAdmin({ ...base, acceso: 'CONTRASENA', contrasena: 'una-clave-segura-2026' }, soloGoogle).body.contrasena).toBe('una-clave-segura-2026')
  })
})

describe('cuerpoAdmin: rol, eventos y permisos', () => {
  it('el rol va siempre al crear; al editar, solo si cambia', () => {
    expect(cuerpoAdmin(base).body.rolCodigo).toBe('ADMIN')
    const editando = { ...conContrasena, rolCodigo: 'ADMIN' as const, alcance: 'GLOBAL' as const }
    expect(cuerpoAdmin({ ...base, acceso: 'CONTRASENA' }, editando, { alcanceRol: 'GLOBAL' }).body).not.toHaveProperty('rolCodigo')
    expect(cuerpoAdmin({ ...base, acceso: 'CONTRASENA', rolCodigo: 'SUPERADMIN' }, editando, { alcanceRol: 'GLOBAL' }).body.rolCodigo).toBe('SUPERADMIN')
  })

  it('una Comisión nueva envía sus eventos y sus permisos con las dependencias', () => {
    const { body, errores } = cuerpoAdmin({ ...formComision, eventoIds: [5, 2, 2] }, null, opcionesComision)
    expect(errores).toEqual({})
    expect(body).toMatchObject({ rolCodigo: 'COMISION', activo: true, eventoIds: [2, 5], permisos: ['asistencia.ver', 'asistencia.marcar'] })
  })

  it('eventos y permisos son obligatorios para la Comisión', () => {
    const { body, errores } = cuerpoAdmin({ ...formComision, eventoIds: [], permisos: [] }, null, opcionesComision)
    expect(errores).toEqual({ eventoIds: 'Elige al menos un evento.', permisos: 'Elige al menos un permiso.' })
    expect(body).not.toHaveProperty('eventoIds')
    expect(body).not.toHaveProperty('permisos')
  })

  it('el Tesorero envía eventos, nunca permisos', () => {
    const tesorero: FormAdmin = { ...base, rolCodigo: 'TESORERO', eventoIds: [2], permisos: ['asistencia.marcar'] }
    const { body, errores } = cuerpoAdmin(tesorero, null, { alcanceRol: 'EVENTO' })
    expect(errores).toEqual({})
    expect(body.eventoIds).toEqual([2])
    expect(body).not.toHaveProperty('permisos')
    expect(cuerpoAdmin({ ...tesorero, eventoIds: [] }, null, { alcanceRol: 'EVENTO' }).errores).toEqual({ eventoIds: 'Elige al menos un evento.' })
  })

  it('los roles globales no envían eventos ni permisos aunque estén marcados', () => {
    const { body, errores } = cuerpoAdmin({ ...formComision, rolCodigo: 'ADMIN' }, null, { alcanceRol: 'GLOBAL', permisosElegibles: null })
    expect(errores).toEqual({})
    expect(body).not.toHaveProperty('eventoIds')
    expect(body).not.toHaveProperty('permisos')
  })

  it('sin alcance conocido (roles sin cargar) no envía eventos ni permisos', () => {
    expect(cuerpoAdmin(formComision).body).not.toHaveProperty('eventoIds')
  })

  it('los permisos fuera de los elegibles nunca se envían', () => {
    const { body } = cuerpoAdmin({ ...formComision, permisos: ['asistencia.marcar', 'pagos.ver', 'sistema.configurar'] }, null, opcionesComision)
    expect(body.permisos).toEqual(['asistencia.ver', 'asistencia.marcar'])
  })

  it('al editar, quitar todos los eventos o permisos de una cuenta que los tenía es un error', () => {
    const { errores } = cuerpoAdmin({ ...formularioDe(cuentaComision), eventoIds: [], permisos: [] }, cuentaComision, opcionesComision)
    expect(errores).toEqual({ eventoIds: 'Elige al menos un evento.', permisos: 'Elige al menos un permiso.' })
  })

  it('una cuenta que se quedó sin eventos se puede editar (p. ej. desactivar) sin elegirlos', () => {
    const sinEventos = { ...cuentaComision, eventos: [] }
    const { body, errores } = cuerpoAdmin({ ...formularioDe(sinEventos), activo: false }, sinEventos, opcionesComision)
    expect(errores).toEqual({})
    expect(body).not.toHaveProperty('eventoIds')
    expect(body.activo).toBe(false)
  })

  it('pasar a la Comisión exige eventos y permisos si la cuenta no los tenía', () => {
    const admin = { ...cuentaComision, rolCodigo: 'ADMIN' as const, alcance: 'GLOBAL' as const, eventos: [], permisos: [] }
    const { errores } = cuerpoAdmin({ ...formularioDe(admin), rolCodigo: 'COMISION' }, admin, opcionesComision)
    expect(errores).toEqual({ eventoIds: 'Elige al menos un evento.', permisos: 'Elige al menos un permiso.' })
  })

  it('promover un Tesorero a Owner con «Contraseña o Google» exige una contraseña nueva', () => {
    const tesorero = { ...cuentaComision, rolCodigo: 'TESORERO' as const, tieneContrasena: true, permisos: [] }
    const form: FormAdmin = { ...formularioDe(tesorero), rolCodigo: 'SUPERADMIN' }
    expect(cuerpoAdmin(form, tesorero, { alcanceRol: 'GLOBAL' }).errores.contrasena).toMatch(/rol global/)
    const conNueva = cuerpoAdmin({ ...form, contrasena: 'una-clave-segura-2026' }, tesorero, { alcanceRol: 'GLOBAL' })
    expect(conNueva.errores).toEqual({})
    expect(conNueva.body).toMatchObject({ rolCodigo: 'SUPERADMIN', contrasena: 'una-clave-segura-2026' })
    expect(conNueva.body).not.toHaveProperty('eventoIds')
  })
})

describe('cuerpoAdmin: cuenta propia', () => {
  const propia = { ...formularioDe(cuentaComision), activo: false, rolCodigo: 'SUPERADMIN' as const, eventoIds: [9], permisos: ['mensajes.ver' as const] }

  it('no envía rol, estado, eventos ni permisos (y no los valida)', () => {
    const { body, errores } = cuerpoAdmin({ ...propia, eventoIds: [], permisos: [] }, cuentaComision, { ...opcionesComision, propia: true })
    expect(errores).toEqual({})
    for (const campo of ['rolCodigo', 'activo', 'eventoIds', 'permisos']) expect(body).not.toHaveProperty(campo)
  })

  it('sin ser Owner no envía el correo (por defecto, tampoco)', () => {
    expect(cuerpoAdmin(propia, cuentaComision, { ...opcionesComision, propia: true, correoEditable: false }).body).not.toHaveProperty('correo')
    expect(cuerpoAdmin(propia, cuentaComision, { ...opcionesComision, propia: true }).body).not.toHaveProperty('correo')
    expect(cuerpoAdmin(propia, cuentaComision, { ...opcionesComision, propia: true, correoEditable: true }).body.correo).toBe('luis@undc.edu.pe')
  })

  it('solo el Owner (sistema.configurar) cambia su propio correo y su Google', () => {
    const owner = (permiso: string) => permiso === 'sistema.configurar'
    const administrador = () => false
    expect(puedeEditarCorreo(true, owner)).toBe(true)
    expect(puedeEditarCorreo(true, administrador)).toBe(false)
    // Las demás cuentas, siempre (si se pueden gestionar)
    expect(puedeEditarCorreo(false, administrador)).toBe(true)
  })

  describe('«Solo Google» en la propia cuenta', () => {
    const conClave = { ...cuentaComision, tieneContrasena: true, googleVinculado: true }
    const formConClave: FormAdmin = { ...formularioDe(conClave), acceso: 'GOOGLE' }

    it('se puede si Google ya está vinculado y el correo no cambia', () => {
      expect(motivoGoogleBloqueado({ correo: ' LUIS@undc.edu.pe ' }, conClave, true)).toBeNull()
      const { body, errores } = cuerpoAdmin(formConClave, conClave, { propia: true, correoEditable: true })
      expect(errores).toEqual({})
      expect(body.quitarContrasena).toBe(true)
    })

    it('no, sin haber entrado con Google', () => {
      const sinGoogle = { ...conClave, googleVinculado: false }
      expect(motivoGoogleBloqueado(formConClave, sinGoogle, true)).toMatch(/primero entra una vez/)
      const { body, errores } = cuerpoAdmin(formConClave, sinGoogle, { propia: true, correoEditable: true })
      expect(errores.acceso).toMatch(/primero entra una vez/)
      expect(body).not.toHaveProperty('quitarContrasena')
    })

    it('no, si el Owner cambia su correo en la misma petición (SELF_UPDATE_FORBIDDEN)', () => {
      const form = { ...formConClave, correo: 'nuevo@undc.edu.pe' }
      expect(motivoGoogleBloqueado(form, conClave, true)).toMatch(/correo nuevo/)
      const { body, errores } = cuerpoAdmin(form, conClave, { propia: true, correoEditable: true })
      expect(errores.acceso).toMatch(/correo nuevo/)
      expect(body).not.toHaveProperty('quitarContrasena')
    })

    it('no aplica a otras cuentas ni a una propia que ya es «Solo Google»', () => {
      expect(motivoGoogleBloqueado({ correo: 'nuevo@undc.edu.pe' }, conClave, false)).toBeNull()
      expect(motivoGoogleBloqueado({ correo: 'nuevo@undc.edu.pe' }, cuentaComision, true)).toBeNull()
      expect(cuerpoAdmin({ ...formConClave, correo: 'nuevo@undc.edu.pe' }, conClave, opcionesComision).body.quitarContrasena).toBe(true)
    })
  })

  it('el nombre y la contraseña sí se envían', () => {
    const { body } = cuerpoAdmin({ ...propia, nombres: ' Luis A. ', acceso: 'CONTRASENA', contrasena: 'una-clave-segura-2026' }, cuentaComision, { propia: true, correoEditable: false })
    expect(body).toEqual({ nombres: 'Luis A.', apellidos: 'Paz', contrasena: 'una-clave-segura-2026' })
  })
})

describe('formularioDe', () => {
  it('una cuenta nueva empieza vacía, activa y sin rol', () => {
    expect(formularioDe()).toEqual({ nombres: '', apellidos: '', correo: '', acceso: 'GOOGLE', contrasena: '', rolCodigo: '', activo: true, eventoIds: [], permisos: [] })
  })

  it('carga los eventos y permisos de la cuenta', () => {
    expect(formularioDe(cuentaComision)).toMatchObject({ rolCodigo: 'COMISION', acceso: 'GOOGLE', eventoIds: [2], permisos: ['asistencia.marcar', 'asistencia.ver'] })
  })
})

describe('permisos de la Comisión', () => {
  it('marcar un permiso agrega lo que implica (hasta el punto fijo)', () => {
    expect(alternarPermiso([], 'asistencia.fuera_horario', true, ELEGIBLES)).toEqual(['asistencia.ver', 'asistencia.marcar', 'asistencia.fuera_horario'])
    expect(alternarPermiso([], 'inscripciones.exportar', true, ELEGIBLES)).toEqual(['inscripciones.ver', 'inscripciones.exportar'])
  })

  it('marcar «Marcar asistencia» no implica exportarla', () => {
    expect(alternarPermiso([], 'asistencia.marcar', true, ELEGIBLES)).not.toContain('asistencia.exportar')
  })

  it('no se desmarca un permiso que otro marcado exige', () => {
    const marcados = alternarPermiso([], 'asistencia.marcar', true, ELEGIBLES)
    expect(bloqueadoPor('asistencia.ver', marcados, ELEGIBLES)).toEqual(['asistencia.marcar'])
    expect(alternarPermiso(marcados, 'asistencia.ver', false, ELEGIBLES)).toEqual(marcados)
    expect(alternarPermiso(marcados, 'asistencia.marcar', false, ELEGIBLES)).toEqual(['asistencia.ver'])
  })

  it('preselecciona los por defecto, sin los que dejan ver datos personales', () => {
    expect(permisosIniciales(COMISION)).toEqual(['asistencia.ver', 'asistencia.marcar'])
    expect(permisosIniciales({ ...COMISION, permisosPorDefecto: ['asistencia.marcar', 'inscripciones.exportar', 'resumen.ver'] }))
      .toEqual(['resumen.ver', 'asistencia.ver', 'asistencia.marcar'])
    expect(permisosIniciales(TESORERO)).toEqual([])
  })

  it('reconoce los permisos con datos personales de los inscritos', () => {
    expect(exponeDatosPersonales('inscripciones.ver', ELEGIBLES)).toBe(true)
    expect(exponeDatosPersonales('credenciales.reenviar', ELEGIBLES)).toBe(true)
    expect(exponeDatosPersonales('asistencia.marcar', ELEGIBLES)).toBe(false)
  })

  it('permisosParaGuardar se queda dentro de los elegibles', () => {
    expect(permisosParaGuardar(['pagos.ver', 'mensajes.ver', 'desconocido'], ELEGIBLES)).toEqual(['mensajes.ver'])
  })

  it('nombre visible: el de GET /roles, el del catálogo o el código', () => {
    expect(nombrePermiso('asistencia.marcar', ELEGIBLES)).toBe('Marcar asistencia')
    expect(nombrePermiso('pagos.ver')).toBe('Ver montos, pagos y vouchers')
    expect(nombrePermiso('otro.permiso')).toBe('otro.permiso')
  })
})

describe('tabla y opciones', () => {
  it('chips de permisos: los primeros y el resto aparte', () => {
    expect(chipsPermisos(['asistencia.marcar', 'asistencia.ver'])).toEqual({ visibles: ['Marcar asistencia', 'Ver la asistencia'], ocultos: [] })
    const { visibles, ocultos } = chipsPermisos(['asistencia.marcar', 'asistencia.ver', 'resumen.ver', 'mensajes.ver', 'ponencias.ver'])
    expect(visibles).toHaveLength(3)
    expect(ocultos).toEqual(['Ver mensajes de contacto', 'Ver y descargar ponencias'])
  })

  it('opciones de eventos: los de la lista y los asignados que ya no están en ella', () => {
    const eventos = [{ id: 2, nombreCorto: 'VIII CIISIC 2026', estado: 'PUBLICADO' as const }, { id: 3, nombreCorto: 'Semana 2026', estado: 'BORRADOR' as const }]
    expect(opcionesEventos(eventos, [{ id: 2, nombreCorto: 'VIII' }, { id: 1, nombreCorto: 'VII CIISIC 2025' }])).toEqual([
      { id: 2, nombreCorto: 'VIII CIISIC 2026' },
      { id: 3, nombreCorto: 'Semana 2026', detalle: 'borrador' },
      { id: 1, nombreCorto: 'VII CIISIC 2025' },
    ])
  })

  it('idsEvento: válidos, sin repetir y ordenados', () => {
    expect(idsEvento([5, 2, 2, 0, -1, 1.5, 3])).toEqual([2, 3, 5])
  })

  it('descripción del rol según su alcance', () => {
    expect(descripcionRol(OWNER)).toMatch(/todos los eventos/)
    expect(descripcionRol(COMISION)).toMatch(/permisos que marques/)
    expect(descripcionRol(TESORERO)).toMatch(/permisos fijos/)
    expect(descripcionRol(null)).toBeNull()
  })
})

describe('reaccionAlError', () => {
  it('ADMIN_CHANGED y ADMIN_NOT_MANAGEABLE recargan la lista', () => {
    expect(reaccionAlError('ADMIN_CHANGED')).toBe('cuentas')
    expect(reaccionAlError('ADMIN_NOT_MANAGEABLE')).toBe('cuentas')
  })

  it('ROLE_NOT_ASSIGNABLE recarga los roles y EVENT_NOT_FOUND los eventos', () => {
    expect(reaccionAlError('ROLE_NOT_ASSIGNABLE')).toBe('roles')
    expect(reaccionAlError('EVENT_NOT_FOUND')).toBe('eventos')
  })

  it('los demás no recargan nada', () => {
    expect(reaccionAlError('LAST_OWNER')).toBeNull()
    expect(reaccionAlError('SELF_UPDATE_FORBIDDEN')).toBeNull()
  })
})
