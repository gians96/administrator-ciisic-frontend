# Feature Specification: Temas de ponencias especializadas con varios ponentes

**Created**: 2026-10-22 · **Status**: Implementado en la rama `feat/ponencias-coponentes` (sin desplegar)

**Input**: la organización tiene temas que dictan varias personas a la misma hora y en el mismo ambiente. El backend (spec 032) los modela como **una** ponencia con un ponente
principal y hasta tres `coponentes`; el panel debe poder verlos y editarlos.

> **Numeración**: es la spec **023** del panel. Backend = spec 032 · Landing = spec 011.

## Decisiones

- **Formulario** (`PonenciaForm`): el ponente principal no cambia; debajo, «Agregar ponente» suma otro (nombre, perfil, foto y «Ponente externo») hasta `MAXIMO_COPONENTES` (3), y cada uno se
  puede quitar. Sirve igual para crear y editar.
- **Programa**: la columna «Tema y ponentes» lista al principal y a los coponentes, cada uno con su insignia «Externo».
- **Cuerpo**: `cuerpoPonencia` envía siempre `coponentes` (recortados y con `null` en lo que falte). El arreglo reemplaza al guardado y `[]` deja el tema con un solo ponente.
- **Validación**: nombre de 2 a 200 caracteres y foto (ruta del sitio o URL https) por cada coponente, con la clave del backend (`coponentes[1].nombre`); más de 3 es un error.
- **Compatibilidad**: `coponentes` es opcional en el tipo (un backend anterior no lo envía y lo descarta sin error al guardar).

## Despliegue

Backend 032 primero.
