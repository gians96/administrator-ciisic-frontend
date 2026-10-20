# Feature Specification: Tipos que no admiten estudiantes UNDC

**Feature Branch**: `feat/virtual-sin-estudiantes-undc` · **Created**: 2026-10-20 · **Status**: Implementado en el panel; falta la prueba integrada contra el backend con la spec 020

**Input**: la organización pidió que los **estudiantes de la UNDC no puedan inscribirse en la modalidad
virtual** y poder gestionarlo. Contrato: `backend-ciisic/specs/020-virtual-sin-estudiantes-undc/contracts/api-excluye-estudiantes.md`
(el cambio empieza en el backend; el panel se adapta aquí). La landing (`ciisic-undc-web`) tiene su propia spec.

## Diseño (decidido)

1. **Un interruptor por tipo de inscripción**: `excluyeEstudiantesUndc` (booleano). Apagado por defecto: todo
   lo existente se ve y se comporta igual. Se enciende en los tipos virtuales (`estudiantes_virtual` y
   `general_virtual`). Es independiente de «Disponible para» (spec 010: comunidad UNDC completa) y de
   «Modalidad» (spec 012): bloquea solo a estudiantes UNDC y deja pasar a docentes, administrativos y externos.
2. **Dónde se gestiona**: Eventos → Tipos de inscripción → editar el tipo → «No admitir estudiantes UNDC»
   (`AppSwitch`, debajo de «Modalidad»). La lista de tipos marca con la insignia «Sin estudiantes UNDC» los
   que lo tienen encendido.
3. **Es estudiante UNDC** quien tiene una verificación de SIVIRENO positiva o un correo `<código>@undc.edu.pe`
   (código de 8 a 12 dígitos). Un estudiante con correo no institucional no se detecta (limitación de la
   spec 016 del backend); el revisor lo ve en Inscripciones.
4. **Solo frena inscripciones nuevas.** Las ya hechas no cambian: se revisan en Inscripciones (filtro
   «Modalidad» = Virtual y categoría Estudiantes) y se rechazan o cancelan a mano. Las cortesías no aplican la regla.
5. **Todo es aditivo y tolerante**: el campo ausente se lee `false`. Contra un backend sin la spec 020 el
   panel se ve igual, pero el editor **avisa** que la opción no tendría efecto (el backend anterior descarta
   la clave sin error): `backendSinExcluyeEstudiantes` bajo el interruptor y `excluyeEstudiantesNoGuardado`
   tras guardar. **Orden de despliegue: el backend 020 primero.**
6. Sin variables de entorno nuevas; el BFF (`server/`) es un proxy transparente y no cambia.

## Requirements

- **FR-001**: `TipoInscripcion.excluyeEstudiantesUndc?: boolean` en `app/types/api.ts`.
- **FR-002**: `FormularioTipo.excluyeEstudiantesUndc`, `formularioDeTipo` (parte de `false` si falta) y `cuerpoTipo`
  (viaja siempre, también sin `pagos.ver`: no es un precio) en `app/utils/tiposInscripcion.ts`.
- **FR-003**: `CategoriasTipos.vue`: interruptor con su descripción, advertencia contra un backend anterior,
  insignia en la lista y aviso tras guardar si el backend no lo guardó.
- **FR-004**: pruebas en `tests/tiposInscripcion.test.ts`.
