# Feature Specification: Modalidad virtual de asistencia

**Feature Branch**: `feat/modalidad-virtual` · **Created**: 2026-10-19 · **Status**: Implementado en el panel; falta la prueba integrada contra el backend con la spec 018

**Input**: la organización del CIISIC pidió una modalidad **virtual** de asistencia: S/ 30 para estudiantes
y S/ 50 para profesionales (el mismo precio para la comunidad UNDC y para externos). Hasta hoy todo es
presencial (con kit o sin kit). Contrato: `backend-ciisic/specs/018-modalidad-virtual/contracts/api-modalidad.md`
(el cambio empieza en el backend; el panel se adapta aquí). La landing (`ciisic-undc-web`) tiene su propia spec.

## Diseño (decidido)

1. **Un atributo nuevo del _tipo_ de inscripción**: «modalidad de asistencia», `PRESENCIAL` (por defecto,
   todo lo existente) o `VIRTUAL`. En código es `ModalidadAsistencia`; en la API y en la BD la clave es
   `modalidad`, **siempre dentro del objeto del tipo** (`tipo.modalidad`, `tipoInscripcion.modalidad`),
   nunca en la raíz de una inscripción.
2. **Los tipos virtuales viven dentro de las categorías existentes** `ESTUDIANTES` y `PUBLICO_GENERAL`
   (no hay categoría nueva): así se reutilizan el ciclo, la verificación SIVIRENO, la marca «validar» del
   revisor y las dos páginas de la landing. Con `precio == precioInstitucional` y `disponiblePara = TODOS`
   el monto es el mismo con cualquier correo (descuento 0). `pricing.ts` y el significado de
   `disponiblePara` no cambian.
3. **Todo es aditivo y tolerante**: `modalidad` ausente, `null` o desconocida se lee `PRESENCIAL` (también
   el tipo `null` de una cortesía). «Backend nuevo + panel viejo» y «panel nuevo + backend viejo» siguen
   funcionando sin errores y, contra un backend sin la spec 018, las pantallas se ven como hoy; la única
   excepción es el editor de tipos, que **avisa** que la modalidad no se puede guardar (ver «Orden de despliegue»).
4. Sin variables de entorno nuevas; el BFF (`server/`) es un proxy transparente y no cambia.

## Terminología: no confundir

| Término | Qué es | Dónde vive |
|---|---|---|
| **Modalidad de asistencia** (esta spec) | Presencial o virtual; atributo del **tipo** de inscripción | `ModalidadAsistencia`, `tipo.modalidad`, `tipoInscripcion.modalidad`, filtro `?modalidad=` |
| **Modalidad de pago** | Banco, billetera o cortesía; atributo del **pago** | `modalidadPago`, `pago.modalidad`, columna «Modalidad» del CSV |
| **Fotocheck virtual** | La credencial digital del portal (QR) de cualquier inscripción aprobada | `PortalTarjetaFotocheck`, `/mi-fotocheck` |
| **Modalidad 01/02/03** | Tarjetas de `/planes` de la landing (categorías de precio) | Solo la landing |

## User Scenarios & Testing

### User Story 1 - Configurar un tipo presencial o virtual (Priority: P1)

**Acceptance Scenarios**:

1. **Given** el formulario de un tipo (Eventos → Categorías y tipos, o Tipos de inscripción), **Then** hay
   un selector «Modalidad» (Presencial / Virtual) con su ayuda; un tipo nuevo nace Presencial.
2. **Given** creo un tipo **nuevo** y elijo «Virtual» con el Precio UNDC en su valor de fábrica (0 o vacío),
   **Then** se precarga con el precio regular (tarifa única); si ya escribí otro valor, no se toca, y si
   vuelvo a «Presencial» sin haberlo cambiado a mano, se restaura el valor anterior. **Given** edito un
   tipo **existente**, **Then** elegir «Virtual» o «Presencial» no toca ningún precio (un Precio UNDC de 0
   es un dato real: «gratis para la comunidad UNDC»). Mientras los precios sean distintos aparece «Igualar
   al precio regular» y la ayuda del campo avisa que con 0 la comunidad UNDC se inscribe gratis.
   **Given** guardo un virtual con el precio UNDC distinto del regular (p. ej. elegí «Virtual» antes de
   escribir 30 y quedó en 0), **Then** se pide confirmación («Tarifa única … ¿Guardar así?»); no bloquea.
3. **Given** un tipo virtual en la tabla, **Then** lleva la insignia «Virtual» (la etiqueta que solo dice
   «VIRTUAL» no se repite).
4. **Given** edito un tipo que el backend aún no devuelve con modalidad, **Then** el formulario parte de
   Presencial y todo sigue funcionando.
5. **Given** una cuenta sin `pagos.ver`, **Then** puede cambiar la modalidad (no es un precio) y no se
   envían precios (ni se pide la confirmación de tarifa única).
6. **Given** un backend anterior a la spec 018 (hay tipos y ninguno trae `modalidad`) y elijo «Virtual»,
   **Then** el selector muestra una advertencia («el servidor aún no admite la modalidad virtual … Despliega
   primero el backend»). **Given** guardo un tipo «Virtual» y la respuesta del backend no lo devuelve como
   virtual, **Then** en lugar de «Tipo de inscripción guardado.» se avisa que se guardó como PRESENCIAL.

### User Story 2 - Distinguir a los inscritos virtuales (Priority: P1)

**Acceptance Scenarios**:

1. **Given** el listado de inscripciones, **Then** la columna Tipo muestra «Virtual» en las virtuales y, si
   existe algún tipo virtual, el filtro «Modalidad» (Presencial y virtual / Solo presencial / Solo virtual) se
   combina con los demás filtros; «Exportar CSV» hereda el filtro y el backend agrega su columna «Modalidad de
   asistencia». Sin ningún tipo virtual el filtro no se ofrece (siempre devolvería lo mismo o nada).
2. **Given** el detalle de una inscripción, **Then** muestra «Modalidad de asistencia» y, si es virtual, la
   insignia «Virtual». La verificación de estudiante y la marca «validar» siguen siendo las de la categoría.
3. **Given** el Resumen con `totales.porModalidad` y un evento que ya tiene un tipo virtual (o inscripciones
   virtuales), **Then** un bloque compacto compara Presencial y Virtual (inscripciones, aprobadas y, con
   `pagos.ver`, monto); sin ese dato, o sin tipos ni inscripciones virtuales, no se muestra nada (el backend
   envía siempre las dos filas y «Virtual: 0» sería ruido). La tabla «Por tipo» marca los tipos virtuales.

### User Story 3 - El escáner avisa, no bloquea (Priority: P1)

**Acceptance Scenarios**:

1. **Given** una marca cuyo `inscripcion.tipoInscripcion.modalidad` es `VIRTUAL`, **Then** el resultado es
   ámbar: «Asistencia registrada» con «Inscripción virtual: verifica si corresponde el ingreso presencial.»
   La asistencia ya quedó registrada, no se deshace y el aviso se cierra solo (no espera «Continuar»; eso
   es solo del QR anterior). La cámara no se pausa.
2. **Given** el QR anterior de una inscripción virtual, **Then** sigue esperando «Continuar» y el aviso
   virtual se suma a su mensaje.
3. **Given** la pantalla Asistencia (`/asistencia`: lector USB o documento, el mismo `POST /activities/:id/attendances`),
   **Then** la marca de un virtual sale en ámbar y su mensaje suma el mismo aviso (`tonoDeMarca` y `textoMarca`);
   nada se bloquea.

### User Story 4 - El inscrito virtual lee un texto neutro (Priority: P2)

**Acceptance Scenarios**:

1. **Given** «Mis inscripciones» con una inscripción virtual, **Then** muestra la insignia «Virtual» y, en
   lugar de la sede, «Modalidad virtual»; si está aprobada, el texto de estado es «Tu inscripción virtual
   está aprobada. La organización te compartirá las indicaciones para conectarte a la transmisión del
   congreso.» La credencial PDF y «Ver fotocheck» siguen disponibles.
2. **Given** el fotocheck de una inscripción virtual, **Then** se muestra completo (con su QR) con la
   insignia «Virtual» y una nota con ese mismo texto neutro. No se oculta nada: es una decisión de negocio
   pendiente.

### Edge Cases

- Backend anterior a la spec 018 (sin `modalidad`): todo se lee Presencial; el filtro «Modalidad» no se
  ofrece (el backend anterior ignoraría `?modalidad=` sin avisar y el listado parecería filtrado sin
  estarlo) salvo que la URL ya lo traiga; el detalle no muestra la fila; el Resumen no muestra el bloque.
- Backend con la spec 018 pero **sin tipos virtuales creados**: el Resumen no muestra el bloque y el
  listado no ofrece el filtro «Modalidad»; aparecen cuando existe el primer tipo virtual (o inscripciones
  virtuales). El detalle de una inscripción sí muestra la fila «Modalidad de asistencia» (Presencial).
- Una modalidad desconocida (`HIBRIDA`, `null`…) se trata como Presencial en pantalla y viaja como
  `PRESENCIAL` al guardar un tipo (el backend responde 422 con `fields.modalidad` a otro valor).
- «Mi asistencia» no cambia: `GET /me/attendances` no trae la modalidad (ver «Pendientes»).
- Un tipo nuevo nace activo y la landing lo ofrece apenas se guarda: crear los virtuales con «Activo»
  apagado hasta que el backend con la spec 018 esté desplegado.

## Orden de despliegue

Cada repositorio se despliega solo con su push a `main`. Para crear los tipos virtuales **el backend con la
spec 018 se despliega primero**: el backend anterior valida con `stripUnknown`, descarta la clave
`modalidad` sin error y guarda el tipo presencial (conserva la etiqueta «VIRTUAL», así que la fila parece
correcta). Y el script `configurar-virtual.sql` solo inserta, nunca actualiza, así que no corregiría ese tipo.
Por eso el editor advierte bajo el selector (`backendSinModalidad`) y, tras guardar, avisa si la respuesta no
trae el tipo como virtual (`modalidadVirtualNoGuardada`). Con «panel nuevo + backend anterior» lo demás se
ve como antes.

## Requirements

- **FR-001**: `app/types/api.ts`: `ModalidadAsistencia`; `modalidad?` opcional en `TipoInscripcion`,
  `InscripcionFila.tipoInscripcion`, `InscripcionDetalle.tipoInscripcion` y `ResumenEvento.porTipo`;
  `ResumenModalidad` y `totales.porModalidad?`.
- **FR-002**: `app/utils/modalidad.ts` (tolerancia: `modalidadDe`, `esVirtual`, `etiquetaModalidad`,
  `etiquetaDeInsignia`, `backendConModalidad`, textos neutros) y `app/components/ui/AppBadgeVirtual.vue`.
- **FR-003**: `app/utils/tiposInscripcion.ts`: `OPCIONES_MODALIDAD`, `FormularioTipo.modalidad`,
  `formularioDeTipo`, `cuerpoTipo` (envía `modalidad`, también sin `pagos.ver`), tarifa única
  (`precioUndcAlElegirVirtual`, `precioUndcAlCambiarModalidad`, `sePuedeIgualarPrecioUndc`, `avisoTarifaUnica`)
  y ayudas; `CategoriasTipos.vue` (advertencia y aviso de un backend sin la spec 018).
- **FR-004**: `app/utils/filtros.ts` (`modalidad` en el filtro, la URL y `aParametros`) y
  `app/pages/inscripciones/index.vue` (insignia, filtro, `limpiar()`, rejilla); `InscripcionDetalle.vue`.
- **FR-005**: `app/utils/resumen.ts` (`filasPorModalidad`, `filasModalidadVisibles`) y `app/pages/index.vue` (bloque y tabla).
- **FR-006**: `app/utils/asistencia.ts` (`resultadoDeMarca` con el aviso virtual, sin `esperaContinuar`; `tonoDeMarca`
  y `textoMarca` para `/asistencia`).
- **FR-007**: `app/utils/misInscripciones.ts` (`explicacionEstado`, `lugarDelEvento`), `mis-inscripciones.vue`,
  `PortalTarjetaFotocheck.vue`, `mi-fotocheck.vue`.
- **FR-008**: pruebas Vitest de toda la lógica nueva (utils puras); `docs/` y `AGENTS.md` al día.

## Datos de producción (los crea el dueño del proyecto, no el código)

Con el script SQL idempotente del backend (`prisma/preflight/configurar-virtual.sql`) o desde este panel
(Tipos de inscripción → «Tipo» en la categoría). En el evento `ciisic-viii-2026`:

| Categoría | Código | Nombre | Etiqueta | Precio | Precio UNDC | Disponible para | Modalidad |
|---|---|---|---|---|---|---|---|
| `ESTUDIANTES` | `estudiantes_virtual` | ESTUDIANTES | VIRTUAL | 30.00 | 30.00 | Todos | Virtual |
| `PUBLICO_GENERAL` | `general_virtual` | PROFESIONALES Y PUBLICO EN GENERAL | VIRTUAL | 50.00 | 50.00 | Todos | Virtual |

Características: `heroicons:computer-desktop` «Participación virtual en las ponencias transmitidas» y
`heroicons:x-mark` «No incluye kit ni ingreso presencial». La descripción no promete certificado ni horas.

## Preguntas de negocio abiertas

La organización aún no responde: cómo se entrega el acceso a la transmisión, qué certificados y asistencia
corresponden a los virtuales, y si se exige constancia de estudiante. Por eso los textos son neutros (sin
enlaces, horas ni certificado) y nada se bloquea: el escáner solo avisa y el fotocheck se muestra.

## Success Criteria

- **SC-001**: Crear «ESTUDIANTES · VIRTUAL» a S/ 30 / S/ 30 toma un formulario, sin SQL.
- **SC-002**: El staff distingue un inscrito virtual en el listado, el detalle, el Resumen y el escáner.
- **SC-003**: Contra un backend sin la spec 018 las pantallas se ven como antes; el editor de tipos avisa (no
  calla) que la modalidad virtual no se guardaría. Con la 018 y sin tipos virtuales, el Resumen y el listado
  tampoco muestran el bloque ni el filtro de modalidad.
- **SC-004**: `lint`, `typecheck`, `test` y `build` en verde.
