import { describe, expect, it } from 'vitest'
import type { AccesoPanel, Permiso } from '~/types/api'
import {
  accesoDeSesion,
  conDependencias,
  dependenciasDe,
  esPermiso,
  etiquetaRol,
  ETIQUETAS_ROL,
  inicioPara,
  menuPara,
  MENU,
  PERMISOS,
  requeridoPor,
  RUTA_ESCANER,
  RUTA_SIN_ACCESO,
  sinEventosAsignados,
  soloMarcaAsistencia,
  tienePermiso,
  tonoRol,
} from '~/utils/permisos'

const PERMISOS_TESORERO: Permiso[] = [
  'resumen.ver', 'inscripciones.ver', 'inscripciones.exportar', 'credenciales.reenviar', 'pagos.ver', 'inscripciones.validar',
  'asistencia.ver', 'asistencia.exportar', 'ponencias.ver', 'mensajes.ver', 'certificados.ver',
]

const acceso = (permisos: Permiso[], alcance: AccesoPanel['alcance'] = 'EVENTO'): AccesoPanel =>
  ({ alcance, permisos, eventoIds: alcance === 'GLOBAL' ? null : [2], perfilParticipante: false })

const OWNER = acceso([...PERMISOS], 'GLOBAL')
const ADMINISTRADOR = acceso(PERMISOS.filter((p) => p !== 'sistema.configurar'), 'GLOBAL')
const TESORERO = acceso(PERMISOS_TESORERO)
const COMISION = acceso(['asistencia.marcar', 'asistencia.ver'])

const rutas = (a: AccesoPanel | null) => menuPara(a).flatMap((seccion) => seccion.items.map((item) => item.to))

describe('permisos: catálogo', () => {
  it('tiene los 29 permisos del backend, sin repetir', () => {
    expect(PERMISOS).toHaveLength(29)
    expect(new Set(PERMISOS).size).toBe(PERMISOS.length)
    expect(esPermiso('pagos.ver')).toBe(true)
    expect(esPermiso('pagos.editar')).toBe(false)
    expect(esPermiso('toString')).toBe(false)
    expect(esPermiso(3)).toBe(false)
  })

  it('cada ítem del menú exige un permiso del catálogo', () => {
    for (const item of MENU.flatMap((seccion) => seccion.items)) expect(esPermiso(item.permiso), item.to).toBe(true)
  })
})

describe('permisos: tienePermiso', () => {
  it('acepta un permiso o una lista (basta uno)', () => {
    expect(tienePermiso(COMISION, 'asistencia.marcar')).toBe(true)
    expect(tienePermiso(COMISION, 'pagos.ver')).toBe(false)
    expect(tienePermiso(COMISION, ['pagos.ver', 'asistencia.ver'])).toBe(true)
    expect(tienePermiso(COMISION, ['pagos.ver', 'mensajes.ver'])).toBe(false)
  })

  it('sin acceso o con la lista vacía, no', () => {
    expect(tienePermiso(null, 'resumen.ver')).toBe(false)
    expect(tienePermiso(undefined, 'resumen.ver')).toBe(false)
    expect(tienePermiso(OWNER, [])).toBe(false)
  })
})

describe('permisos: accesoDeSesion', () => {
  it('usa usuario.acceso normalizado', () => {
    const usuario = {
      rolCodigo: 'COMISION' as const,
      acceso: { alcance: 'EVENTO', permisos: ['asistencia.marcar', 'asistencia.ver', 'permiso.futuro'], eventoIds: [2, 0, -1, 1.5, '3'], perfilParticipante: true },
    }
    expect(accesoDeSesion(usuario as never)).toEqual({ alcance: 'EVENTO', permisos: ['asistencia.marcar', 'asistencia.ver'], eventoIds: [2], perfilParticipante: true })
  })

  it('una cuenta global no tiene lista de eventos', () => {
    const usuario = { rolCodigo: 'ADMIN' as const, acceso: { alcance: 'GLOBAL' as const, permisos: ['eventos.configurar' as const], eventoIds: null, perfilParticipante: false } }
    expect(accesoDeSesion(usuario)).toEqual({ alcance: 'GLOBAL', permisos: ['eventos.configurar'], eventoIds: null, perfilParticipante: false })
  })

  it('el acceso manda sobre el rol (el backend ya aplicó los permisos)', () => {
    const usuario = { rolCodigo: 'SUPERADMIN' as const, acceso: { alcance: 'GLOBAL' as const, permisos: [], eventoIds: null, perfilParticipante: false } }
    expect(accesoDeSesion(usuario).permisos).toEqual([])
  })

  it('sin acceso (sesión anterior a la spec 013) se deduce del rol', () => {
    const owner = accesoDeSesion({ rolCodigo: 'SUPERADMIN' })
    expect(owner.alcance).toBe('GLOBAL')
    expect(owner.eventoIds).toBeNull()
    expect(owner.permisos).toEqual(PERMISOS)

    const administrador = accesoDeSesion({ rolCodigo: 'ADMIN' })
    expect(administrador.permisos).toHaveLength(PERMISOS.length - 1)
    expect(administrador.permisos).not.toContain('sistema.configurar')

    for (const rolCodigo of ['TESORERO', 'COMISION', 'OTRO'] as const) {
      expect(accesoDeSesion({ rolCodigo: rolCodigo as 'TESORERO' }), rolCodigo).toEqual({ alcance: 'EVENTO', permisos: [], eventoIds: [], perfilParticipante: false })
    }
  })

  it('sin usuario, sin permisos', () => {
    expect(accesoDeSesion(null).permisos).toEqual([])
    expect(accesoDeSesion(undefined).alcance).toBe('EVENTO')
  })
})

describe('permisos: menú', () => {
  it('Owner ve todo; Administrador, todo menos Sistema', () => {
    expect(rutas(OWNER)).toEqual(['/', '/inscripciones', '/asistencia', '/escanear', '/ponencias', '/mensajes', '/eventos', '/tipos-inscripcion', '/consultas', '/participantes', '/correo', '/administradores', '/sistema'])
    expect(rutas(ADMINISTRADOR)).not.toContain('/sistema')
    expect(rutas(ADMINISTRADOR)).toContain('/administradores')
  })

  it('Tesorero: solo el Congreso; la sección Configuración se oculta', () => {
    expect(menuPara(TESORERO).map((seccion) => seccion.titulo)).toEqual(['Congreso'])
    expect(rutas(TESORERO)).toEqual(['/', '/inscripciones', '/asistencia', '/ponencias', '/mensajes'])
  })

  it('Comisión: solo lo que se le asignó', () => {
    expect(rutas(COMISION)).toEqual(['/asistencia', '/escanear'])
    expect(rutas(acceso(['asistencia.ver']))).toEqual(['/asistencia'])
    expect(menuPara(acceso([]))).toEqual([])
    expect(menuPara(null)).toEqual([])
  })
})

describe('permisos: página de inicio', () => {
  it('primera página permitida en el orden del menú', () => {
    expect(inicioPara(OWNER)).toBe('/')
    expect(inicioPara(ADMINISTRADOR)).toBe('/')
    expect(inicioPara(TESORERO)).toBe('/')
    expect(inicioPara(acceso(['mensajes.ver']))).toBe('/mensajes')
    expect(inicioPara(acceso(['correo.configurar'], 'GLOBAL'))).toBe('/correo')
  })

  it('la cuenta que solo marca asistencia empieza en el escáner', () => {
    expect(RUTA_ESCANER).toBe('/escanear')
    expect(inicioPara(COMISION)).toBe('/escanear')
    // Marcar fuera de horario también es marcar
    expect(inicioPara(acceso(['asistencia.marcar', 'asistencia.ver', 'asistencia.fuera_horario']))).toBe('/escanear')
    // Aunque fuera global (todos los eventos)
    expect(inicioPara(acceso(['asistencia.marcar', 'asistencia.ver'], 'GLOBAL'))).toBe('/escanear')
    expect(soloMarcaAsistencia(COMISION)).toBe(true)
    expect(soloMarcaAsistencia(acceso(['asistencia.ver']))).toBe(false)
    expect(soloMarcaAsistencia(acceso(['asistencia.ver', 'asistencia.fuera_horario']))).toBe(false)
    expect(soloMarcaAsistencia(null)).toBe(false)
  })

  it('la cuenta por evento que marca y hace algo más empieza en Asistencia', () => {
    expect(inicioPara(acceso(['resumen.ver', 'asistencia.marcar', 'asistencia.ver']))).toBe('/asistencia')
    expect(inicioPara(acceso(['asistencia.marcar', 'asistencia.ver', 'asistencia.anular']))).toBe('/asistencia')
    expect(inicioPara(acceso(['asistencia.marcar', 'asistencia.ver', 'asistencia.exportar']))).toBe('/asistencia')
    expect(soloMarcaAsistencia(acceso(['asistencia.marcar', 'asistencia.ver', 'asistencia.anular']))).toBe(false)
    // Sin marcar, el orden normal
    expect(inicioPara(acceso(['resumen.ver', 'asistencia.ver']))).toBe('/')
    // Global con más permisos: el orden normal
    expect(inicioPara(ADMINISTRADOR)).toBe('/')
  })

  it('una cuenta por evento sin eventos asignados va a /sin-acceso aunque tenga permisos', () => {
    // El backend envía los permisos del rol aunque se haya borrado su único evento
    const tesoreroSinEventos: AccesoPanel = { ...TESORERO, eventoIds: [] }
    const comisionSinEventos: AccesoPanel = { ...COMISION, eventoIds: [] }
    expect(sinEventosAsignados(tesoreroSinEventos)).toBe(true)
    expect(sinEventosAsignados(comisionSinEventos)).toBe(true)
    expect(inicioPara(tesoreroSinEventos)).toBe(RUTA_SIN_ACCESO)
    expect(inicioPara(comisionSinEventos)).toBe(RUTA_SIN_ACCESO)
    expect(menuPara(comisionSinEventos)).toEqual([])
    // Con eventos, o con alcance global (todos los eventos: eventoIds null), no aplica
    expect(sinEventosAsignados(TESORERO)).toBe(false)
    expect(sinEventosAsignados(OWNER)).toBe(false)
    expect(sinEventosAsignados(null)).toBe(false)
  })

  it('sin ninguna sección, /sin-acceso', () => {
    expect(inicioPara(acceso([]))).toBe(RUTA_SIN_ACCESO)
    expect(inicioPara(acceso(['legacy.usar'], 'GLOBAL'))).toBe(RUTA_SIN_ACCESO)
    expect(inicioPara(null)).toBe('/sin-acceso')
  })
})

describe('permisos: dependencias (casillas de la Comisión)', () => {
  it('agrega lo que implica cada permiso, en el orden del catálogo', () => {
    expect(conDependencias(['asistencia.fuera_horario'])).toEqual(['asistencia.ver', 'asistencia.marcar', 'asistencia.fuera_horario'])
    expect(conDependencias(['inscripciones.validar'])).toEqual(['inscripciones.ver', 'pagos.ver', 'inscripciones.validar'])
    expect(conDependencias(['asistencia.marcar'])).not.toContain('asistencia.exportar')
    expect(conDependencias(['mensajes.ver', 'mensajes.ver', 'desconocido'])).toEqual(['mensajes.ver'])
    expect(conDependencias([])).toEqual([])
  })

  it('usa las dependencias de GET /roles', () => {
    const dependencias = dependenciasDe([
      { codigo: 'asistencia.marcar', nombre: 'Marcar asistencia', implica: ['asistencia.ver'] },
      { codigo: 'asistencia.ver', nombre: 'Ver la asistencia', implica: [] },
      { codigo: 'resumen.ver', nombre: 'Ver el resumen', implica: ['ponencias.ver'] },
    ])
    expect(conDependencias(['resumen.ver'], dependencias)).toEqual(['resumen.ver', 'ponencias.ver'])
    expect(conDependencias(['asistencia.fuera_horario'], dependencias)).toEqual(['asistencia.fuera_horario'])
  })

  it('indica qué permisos marcados obligan a mantener otro', () => {
    const marcados: Permiso[] = ['asistencia.ver', 'asistencia.marcar', 'asistencia.fuera_horario', 'resumen.ver']
    expect(requeridoPor('asistencia.ver', marcados)).toEqual(['asistencia.marcar', 'asistencia.fuera_horario'])
    expect(requeridoPor('asistencia.marcar', marcados)).toEqual(['asistencia.fuera_horario'])
    expect(requeridoPor('resumen.ver', marcados)).toEqual([])
  })
})

describe('permisos: etiquetas y tono del rol', () => {
  it('muestra los nombres nuevos', () => {
    expect(ETIQUETAS_ROL.SUPERADMIN).toBe('Owner')
    expect(etiquetaRol('ADMIN', 'Admin')).toBe('Administrador del sistema')
    expect(etiquetaRol('COMISION')).toBe('Comisión tecnológica')
    expect(etiquetaRol('AUDITOR', 'Auditor')).toBe('Auditor')
    expect(etiquetaRol(undefined)).toBe('—')
  })

  it('da un tono a cada rol', () => {
    expect(tonoRol('SUPERADMIN')).toBe('warn')
    expect(tonoRol('TESORERO')).toBe('info')
    expect(tonoRol('desconocido')).toBe('neutral')
    expect(tonoRol(null)).toBe('neutral')
  })
})
