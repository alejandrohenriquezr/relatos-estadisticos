# Metadatos del sitio y de las operaciones

Este documento describe dónde se definen y cómo se exponen los metadatos de **Relatos Estadísticos**. No duplica los diccionarios SDMX: identifica las capas de metadatos necesarias para reproducir, mantener y auditar el sitio.

## 1. Metadatos globales de la aplicación

`app/layout.tsx` define los metadatos HTML comunes:

- título: `INE | Relatos Estadísticos`;
- descripción del sitio;
- idioma del documento: `es-CL`;
- favicon: `/favicon.svg`;
- política de robots actualmente configurada como `noindex`, `nofollow` y `nocache`;
- marca técnica `codex-preview=development` usada por la prueba de render.

La política `noindex` es deliberada en la revisión actual. Si el proyecto pasa a un dominio institucional público indexable, debe revisarse junto con `app/robots.ts` y las pruebas automatizadas antes de cambiarla.

## 2. Identificadores de operaciones estadísticas

El catálogo editorial estable se encuentra en `lib/operation-config.ts`. Cada operación tiene:

- `operation`: identificador interno estable;
- `label`: nombre visible;
- `analysis`: disponibilidad de Análisis de resultados;
- `publications`: disponibilidad de Publicaciones;
- `documentation`: disponibilidad de Documentación;
- `databases`: disponibilidad de Bases de datos;
- `resources`: disponibilidad de Centro de recursos.

Los identificadores vigentes son:

```text
ene
informality
ipc
ipp
births
fertility
deaths
mortality
unions
enusc
police
permits
energy
industry
commerce
tourism
supermarkets
businessDemography
```

El mismo identificador debe usarse de forma consistente en el CMS, la navegación y cualquier configuración persistida en D1.

## 3. Persistencia de configuración editorial

La tabla D1 `statistical_operation_config` conserva, por operación:

```text
operation
label
analysis
publications
documentation
databases
resources
updated_at
updated_by
```

La lectura pública está expuesta por:

```text
GET /api/operation-config
```

Si D1 no está disponible, esa ruta devuelve el catálogo por omisión de `lib/operation-config.ts` y marca la respuesta con `X-Config-Source: defaults`.

La edición se realiza desde `/admin` y sus páginas por operación. El área administrativa exige identidad ChatGPT mediante `app/chatgpt-auth.ts`. Las operaciones de escritura deben mantenerse restringidas al contexto administrativo autorizado; no se debe usar la ruta de escritura como API pública de configuración.

## 4. Metadatos de fuentes estadísticas

`DATA_SOURCES.md` es el inventario humano de procedencia y verificación. Los transformadores y rutas de datos conservan además los metadatos ejecutables más próximos a cada fuente, por ejemplo:

- URL oficial;
- hash de la fuente;
- fecha de comprobación o actualización;
- período de referencia;
- estado de caché;
- unidad o base del índice;
- cobertura territorial o temática.

Los snapshots versionados bajo `public/` son revisiones derivadas, no fuentes primarias. Deben poder vincularse al archivo oficial y al transformador que los generó.

## 5. Metadatos SDMX

El punto de entrada descubrible es:

```text
GET /api/sdmx/catalog
```

Para un conjunto de datos, la descripción técnica se obtiene con:

```text
GET /api/sdmx/metadata?dataset=<DATASET>
GET /api/sdmx/documentation?dataset=<DATASET>
```

La respuesta de metadatos puede incluir, según el producto:

- `agency`;
- `dataset`;
- `dataflow`;
- `structure`;
- `version`;
- `frequency`;
- `reference_area`;
- `base_period`;
- `coverage`;
- `format`;
- `dimensions`;
- filtros disponibles;
- `data_endpoint`;
- documentación y estructuras asociadas.

El catálogo común de operaciones SDMX se mantiene en `lib/operation-sdmx.ts`. IPC e IPP incorporan metadatos específicos en `app/api/sdmx/metadata/route.ts`.

La documentación detallada de dimensiones y convenciones está en `docs/sdmx/README.md` y, para Demografía de empresas, en `docs/sdmx/DEMOGRAFIA_EMPRESAS.md`.

## 6. Metadatos mínimos al incorporar una nueva operación

Una nueva operación no debe considerarse integrada hasta definir, como mínimo:

1. identificador interno estable y etiqueta visible;
2. página oficial de referencia;
3. fuente estadística concreta y frecuencia;
4. transformador o mecanismo de lectura;
5. unidad, cobertura y período de referencia;
6. política de caché/fallback;
7. secciones editoriales disponibles;
8. identificadores y dimensiones SDMX, cuando corresponda;
9. pruebas de regresión y criterios de vigencia;
10. actualización de `DATA_SOURCES.md`, del catálogo y de esta documentación si se introduce un tipo nuevo de metadato.

## 7. Separación de responsabilidades

- **HTML/SEO y accesibilidad:** `app/layout.tsx`, `app/robots.ts`.
- **Catálogo editorial:** `lib/operation-config.ts` y D1.
- **Procedencia estadística:** `DATA_SOURCES.md` y transformadores de `lib/`/`scripts/`.
- **Metadatos de intercambio:** rutas `/api/sdmx/*`, `lib/operation-sdmx.ts` y `docs/sdmx/`.
- **Estado de una sincronización concreta:** `SYNC_STATUS.md`.

Esta separación evita mezclar configuración editorial, procedencia estadística y estructura de intercambio, pero permite rastrear una operación desde la navegación hasta su fuente y su representación SDMX.
