/** Datos visibles de la cuenta en la barra superior (avatar y nombre del menú de usuario). */

function palabras(texto: string | null | undefined): string[] {
  return (texto ?? '').trim().split(/\s+/).filter(Boolean)
}

/** Primera letra del primer nombre y del primer apellido, en mayúsculas; sin datos, «?». */
export function iniciales(nombres: string | null | undefined, apellidos: string | null | undefined): string {
  const letras = [palabras(nombres)[0], palabras(apellidos)[0]]
    .filter((palabra): palabra is string => Boolean(palabra))
    .map((palabra) => palabra.charAt(0).toLocaleUpperCase('es'))
    .join('')
  return letras || '?'
}

/** Primer nombre y primer apellido («Gianmarcos Arias»). */
export function nombreCorto(nombres: string | null | undefined, apellidos: string | null | undefined): string {
  return [palabras(nombres)[0], palabras(apellidos)[0]].filter(Boolean).join(' ')
}
