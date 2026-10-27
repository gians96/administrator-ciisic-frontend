/**
 * Manual para enviar los correos con Gmail por SMTP (spec 031): qué se hace en la cuenta de Google y qué
 * en el panel. El contenido vive aquí (no en el componente) para probarlo y mantenerlo en un solo lugar.
 */

export const URL_SEGURIDAD_GOOGLE = 'https://myaccount.google.com/security'
export const URL_CONTRASENAS_APLICACION = 'https://myaccount.google.com/apppasswords'

export interface EnlaceGuia { texto: string, url: string }

export interface PasoGuia {
  titulo: string
  /** Qué hacer, en una o dos frases. */
  texto: string
  /** Detalles que ayudan a no equivocarse (se muestran como lista). */
  detalles?: readonly string[]
  /** Enlace externo (se abre en otra pestaña). */
  enlace?: EnlaceGuia
}

export const PASOS_GUIA_GMAIL: readonly PasoGuia[] = [
  {
    titulo: 'Elige la cuenta que enviará los correos',
    texto: 'Usa una cuenta de Gmail o de Google Workspace (por ejemplo, @undc.edu.pe) que sea solo del congreso. Los correos saldrán con esa dirección como remitente.',
    detalles: [
      'Cuenta de Gmail personal: unos 500 correos al día.',
      'Cuenta de Google Workspace: unos 2000 correos al día.',
      'Gmail solo firma con la propia cuenta: el remitente del panel será esa misma dirección.',
    ],
  },
  {
    titulo: 'Activa la verificación en 2 pasos',
    texto: 'Entra con esa cuenta y activa la verificación en 2 pasos. Sin ella, Google no deja crear contraseñas de aplicación.',
    detalles: [
      'Seguridad → «Verificación en 2 pasos» → Empezar, y sigue los pasos con tu celular.',
      'Si ya la tienes activa, pasa al siguiente paso.',
    ],
    enlace: { texto: 'Abrir Seguridad de Google', url: URL_SEGURIDAD_GOOGLE },
  },
  {
    titulo: 'Crea la contraseña de aplicación',
    texto: 'En «Contraseñas de aplicaciones» escribe un nombre (por ejemplo, «Panel CIISIC») y pulsa Crear. Google te muestra 16 letras en 4 grupos.',
    detalles: [
      'Cópiala en ese momento: Google no la vuelve a mostrar (si la pierdes, crea otra).',
      'Si no ves esa opción, busca «Contraseñas de aplicaciones» en el buscador de tu cuenta de Google. En Google Workspace, el administrador debe permitirlas.',
      'No es la contraseña con la que entras a Gmail.',
    ],
    enlace: { texto: 'Abrir Contraseñas de aplicaciones', url: URL_CONTRASENAS_APLICACION },
  },
  {
    titulo: 'Agrégala en el panel',
    texto: 'En esta pantalla pulsa «Agregar credencial» y elige el proveedor Gmail.',
    detalles: [
      'Nombre: algo que reconozcas, por ejemplo «Gmail de respaldo».',
      'Contraseña de aplicación: pégala tal como la muestra Google, con o sin espacios.',
      'Cuenta de Gmail (remitente): la misma cuenta del paso 1.',
      'Nombre del remitente (opcional): lo que verá quien recibe el correo, por ejemplo «CIISIC UNDC».',
    ],
  },
  {
    titulo: 'Prueba la conexión',
    texto: 'Pulsa «Probar»: inicia sesión en Gmail sin enviar nada. Luego «Enviar prueba» a tu propio correo para ver que llega.',
    detalles: [
      'Debe decir que «se conectó con Gmail».',
      'Revisa también la carpeta de spam del correo de prueba.',
    ],
  },
  {
    titulo: 'Define el orden de uso',
    texto: 'Los correos salen por la primera credencial activa. Si falla o se queda sin créditos, salen solos por la siguiente.',
    detalles: [
      'Para que Gmail sea el respaldo de Brevo, déjala debajo de Brevo (flechas arriba y abajo).',
      'Para que Gmail sea la principal, usa «Marcar como predeterminada».',
    ],
  },
]

export interface ProblemaGuia { problema: string, solucion: string }

export const PROBLEMAS_GUIA_GMAIL: readonly ProblemaGuia[] = [
  {
    problema: '«Gmail rechazó el usuario o la contraseña de aplicación»',
    solucion: 'Revisa que la cuenta del remitente sea exactamente la que creó la contraseña, que la verificación en 2 pasos siga activa y que pegaste la contraseña de aplicación (16 letras), no la de la cuenta. Si cambiaste la contraseña de la cuenta de Google, Google revoca las de aplicación: crea otra y edita la credencial.',
  },
  {
    problema: 'No aparece «Contraseñas de aplicaciones»',
    solucion: 'Falta la verificación en 2 pasos, la cuenta usa la Protección avanzada de Google o el administrador de Google Workspace no permite las contraseñas de aplicación (pídele que las habilite).',
  },
  {
    problema: '«Gmail alcanzó su límite de envíos»',
    solucion: 'Se restablece solo al cabo de unas horas. Mientras tanto, los correos salen por la siguiente credencial activa; por eso conviene tener otra de respaldo.',
  },
  {
    problema: 'El correo llega a spam',
    solucion: 'Pide que lo marquen como «No es spam» y, en envíos masivos, mándalos por tandas pequeñas. Si usas una cuenta de Workspace, su dominio ya tiene reputación propia.',
  },
  {
    problema: 'Quiero dejar de usar Gmail',
    solucion: 'Desactiva o elimina la credencial aquí y revoca la contraseña en «Contraseñas de aplicaciones» de tu cuenta de Google.',
  },
]

export const NOTA_SEGURIDAD_GMAIL = 'La contraseña se guarda cifrada y el panel solo muestra sus últimos 4 caracteres. No la compartas por chat ni por correo.'

/** `2 de 6 pasos` para la barra de avance de la guía. */
export function textoAvanceGuia(hechos: number, total: number = PASOS_GUIA_GMAIL.length): string {
  return `${Math.min(Math.max(hechos, 0), total)} de ${total} pasos`
}
