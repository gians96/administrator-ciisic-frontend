# Feature Specification: «Disponible para» en los tipos de inscripción

**Feature Branch**: `feat/disponibilidad-tipos` · **Created**: 2026-10-02 · **Status**: Implementado

**Input**: en el VIII CIISIC la comunidad UNDC (profesionales y docentes) solo tiene el plan con kit a
S/ 120; el plan sin kit es para externos. Dejar vacío o en 0 el «Precio UNDC» no lo ocultaba: el panel
enviaba 0 (inscripción gratis) y no había forma de decir a quién se ofrece un tipo. Contrato:
`backend-ciisic/specs/016-disponibilidad-tipos/contracts/api-tipos.md`.

## User Scenarios & Testing

### User Story 1 - Elegir a quién se ofrece un tipo (Priority: P1)

**Acceptance Scenarios**:

1. **Given** el formulario de un tipo (Eventos → Categorías y tipos, o Tipos de inscripción), **Then** hay
   un selector «Disponible para»: «Todos (comunidad UNDC y externos)», «Solo comunidad UNDC» y «Solo
   externos (no se muestra a la comunidad UNDC)», con la ayuda de quién es «comunidad UNDC» en esa
   categoría (estudiante verificado o correo del dominio).
2. **Given** «Solo externos», **Then** el Precio UNDC se deshabilita («No aplica») y se guarda igual al
   regular; en la tabla el tipo lleva la insignia «Solo externos» y la columna Precio UNDC dice «No aplica».
3. **Given** «Solo comunidad UNDC», **Then** la tabla muestra la insignia «Solo UNDC».
4. **Given** dejo vacío el precio regular o el Precio UNDC (con «Todos» o «Solo comunidad UNDC»),
   **Then** veo un error en el campo y no se envía nada (antes se guardaba 0).
5. **Given** una cuenta sin `pagos.ver` (precios ocultos), **Then** puede cambiar la disponibilidad y no
   se envían precios.

### Edge Cases

- Backend anterior a la spec 016 (sin el campo): el tipo se trata como «Todos»; el backend ignora el
  campo enviado (`stripUnknown`).
- 0 sigue siendo un Precio UNDC válido: la ayuda del campo avisa «0 = gratis para la comunidad UNDC».

## Requirements

- **FR-001**: `TipoInscripcion.disponiblePara?` (`TODOS` | `INSTITUCIONAL` | `EXTERNOS`) en `app/types/api.ts`.
- **FR-002**: `app/utils/tiposInscripcion.ts`: `OPCIONES_DISPONIBILIDAD`, `ayudaDisponibilidad` y
  `cuerpoTipo` (validación de precios vacíos, «solo externos» con el precio UNDC igual al regular,
  precios ocultos), con pruebas.
- **FR-003**: `CategoriasTipos.vue`: selector, campo Precio UNDC deshabilitado con «Solo externos»,
  insignias y celda «No aplica».

## Success Criteria

- **SC-001**: Configurar «PROFESIONALES Y PUBLICO EN GENERAL SIN KIT» como «Solo externos» toma un
  cambio en el formulario.
- **SC-002**: `lint`, `typecheck`, `test` y `build` en verde.
