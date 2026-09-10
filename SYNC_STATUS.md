# Estado de sincronización

Fecha de revisión: 2026-09-10.

Este archivo registra controles observables del repositorio y distingue entre **código/artefacto validados en GitHub** y **revisión efectivamente publicada por ChatGPT Sites**. Un `git push`, una CI satisfactoria o la generación de un ZIP no equivalen por sí solos a desplegar una versión de Sites.

## Resumen de cierre

La revisión dejó resueltos los problemas detectados de integridad, construcción SSR, actualización de ENE, continuidad de Servicios, configuración editorial del CMS, metadatos, migraciones D1, empaquetado del artefacto y documentación de clonación/despliegue.

El repositorio se considera técnicamente aceptable sólo cuando el HEAD vigente de `main` tiene una ejecución satisfactoria de `.github/workflows/ci.yml`. Ese workflow bloquea la aceptación ante errores de integridad, correspondencia esquema/migraciones, lint, build/pruebas o revisión de secretos.

La publicación productiva se reporta separadamente hasta que una versión guardada en Sites, asociada al commit validado, sea desplegada y comprobada sobre el dominio.

## Proyecto ChatGPT Sites

`.openai/hosting.json` enlaza el repositorio con:

```text
project_id: appgprj_6aa02079e2948191bd3f3ed0921f79c0
D1 binding: DB
```

La URL documentada del sitio es:

```text
https://relatos-estadisticos.alhen1970.chatgpt.site
```

El procedimiento exacto de guardar versión, revisar, desplegar y ejecutar smoke tests está en `DEPLOYMENT.md`.

## Reparación de integridad

Durante la revisión de la sincronización del 8 de septiembre se detectaron cinco archivos dañados por transferencia:

- `public/demografia-empresas/index.html`;
- `public/enusc-data.json`;
- `public/sdmx/ENE_IND_PRINCIPALES_completo_SDMX-CSV_2.0.csv`;
- `public/sdmx/demografia-empresas-observations.json`;
- `public/worker/vendor/xlsx.full.min.js`.

La reparación reproducible fue ejecutada por `.github/workflows/repair-assets.yml` y guardada inicialmente en el commit `90ff825` (`Repara artefactos de datos sincronizados [assets-repaired]`). Los controles posteriores vuelven a ejecutar `scripts/check-repository-integrity.py` y el build completo.

## Encuesta Nacional de Empleo

Fuente:

`https://www.ine.gob.cl/docs/default-source/ocupacion-y-desocupacion/cuadros-estadisticos/series-vigentes/indicadores_principales.xlsx`

Transformador: `public/sdmx/transformar_ene_sdmx.py`.

Resultado validado el 10 de septiembre de 2026:

- observaciones SDMX: 48.659;
- series: 247;
- períodos: 197;
- primer período: `2010-03`;
- último período: `2026-07`;
- cobertura territorial: total país y 16 regiones;
- sexo: total, hombres y mujeres.

La interfaz ya no inyecta manualmente `Mar - May 2026`. El período inicial se deriva del último registro de `public/ene-data.json`.

## ENUSC

Fuente:

`https://www.ine.gob.cl/docs/default-source/seguridad-ciudadana/cuadros-estadisticos/2025/tabulados-regionales---enusc-2025.xlsx`

Transformador: `scripts/extract-enusc.py`.

Resultado de la regeneración del 10 de septiembre de 2026:

- variables: 286;
- tabulados: 286;
- snapshot JSON generado y validado.

## Servicios

Comercio, Turismo y Supermercados disponen de snapshots versionados:

- `public/commerce-data.json`;
- `public/tourism-data.json`;
- `public/supermarkets-data.json`.

La interfaz consulta primero las rutas API/D1 y utiliza esos archivos como respaldo cuando la dependencia compartida no está disponible. La regeneración reproducible se conserva en `.github/workflows/regenerate-services-fallbacks.yml` y `tests/client-static-fallback.test.ts` cubre la continuidad sin D1.

## Estadísticas vitales

La ruta `app/api/vital-data/route.ts` persiste correctamente el hash calculado de la fuente. La fuente anual configurada es `series-vitales-1992-2025(p).xlsx`, correspondiente a las cifras provisionales 2025 difundidas por el INE en mayo de 2026.

Los boletines mensuales 2026 son un producto coyuntural de distinta frecuencia y no sustituyen esa serie histórica anual. Por ello Nacimientos, Fecundidad, Defunciones, Mortalidad, Matrimonios y AUC ya no se consideran pendientes por la sola existencia de publicaciones mensuales posteriores.

## Demografía de empresas

Fuente de recuperación del HTML integrado:

`https://github.com/alejandrohenriquezr/demografia-de-empresas`

En la reparación inicial, `main` y `migracion-python` apuntaban al commit `54fbcaf92b79938e194f3dc19735f40eaf7b00a5`.

Regenerador: `scripts/build-business-demography-snapshot.mjs`.

Resultado documentado:

- observaciones normalizadas: 3.370;
- HTML con estructura validada;
- snapshot JSON válido;
- cuadros estadísticos disponibles en `public/datos_OE/cuadros_estadisticos/`.

## CMS y secciones por operación

El CMS ya no opera sólo como formulario de persistencia:

- `/admin` y las páginas de edición requieren usuario autenticado;
- el editor recupera primero la configuración persistida en D1 y usa defaults sólo como respaldo;
- `PUT /api/admin/operations` exige identidad autenticada y guarda `updated_by` con el usuario;
- `GET /api/operation-config` expone la configuración pública;
- `app/OperationSections.tsx` consulta esa configuración al abrir cada operación;
- con dos o más secciones habilitadas se muestra el menú de pestañas;
- **Análisis** permanece visible por omisión;
- Publicaciones, Documentación, Bases de datos y Centro de recursos reutilizan recursos reales ya enlazados por la operación.

La integración sobre `app/page.tsx` fue aplicada y validada; el mecanismo temporal de parche fue retirado. Las regresiones permanentes están en `tests/cms-operation-sections.test.mjs`.

## Migración D1 del CMS

Durante el cierre prepublicación se detectó una inconsistencia que la CI anterior no cubría: `db/schema.ts` declaraba `statistical_operation_config`, pero la migración inicial sólo creaba `economic_source_cache`.

Se corrigió mediante Drizzle, no escribiendo metadatos manualmente. El workflow temporal de generación validó primero integridad, lint y pruebas y produjo el commit:

```text
dd0cb315977cdedf45ee2489dbe87dc5be8ce77f
Genera migración D1 para configuración CMS [cms-migration-generated]
```

La migración resultante es:

```text
drizzle/0001_dizzy_meggan.sql
```

Crea `statistical_operation_config` con las columnas `operation`, `label`, `analysis`, `publications`, `documentation`, `databases`, `resources`, `updated_at` y `updated_by`.

El workflow temporal fue retirado después de consolidar la migración. Como protección permanente, `scripts/check-repository-integrity.py` compara ahora las tablas `sqliteTable(...)` declaradas en `db/schema.ts` con los `CREATE TABLE` presentes en `drizzle/*.sql` y falla si falta una migración.

## Artefacto de Sites

También se detectó que el primer ZIP de CI omitía `.openai/hosting.json` y `.openai/drizzle/` porque `actions/upload-artifact` no estaba incluyendo archivos ocultos. El build era válido, pero el ZIP conservado por Actions no representaba el paquete completo.

La CI fue corregida con `include-hidden-files: true` y `scripts/validate-artifact.sh` exige ahora:

- `dist/server/index.js`;
- `dist/.openai/hosting.json`;
- todas las migraciones SQL de `drizzle/*.sql` bajo `dist/.openai/drizzle/`.

La ejecución #103 (`34497218638`) sobre el commit:

```text
3a506382dcfef331e1dbe00fbfe37cd25d79ba9c
```

terminó satisfactoriamente. El artefacto `sitio-compilado` asociado fue inspeccionado directamente y contiene:

```text
server/index.js
.openai/hosting.json
.openai/drizzle/0000_mean_hedge_knight.sql
.openai/drizzle/0001_dizzy_meggan.sql
.openai/drizzle/meta/0000_snapshot.json
.openai/drizzle/meta/0001_snapshot.json
.openai/drizzle/meta/_journal.json
```

Además se comprobó dentro del ZIP que `.openai/drizzle/0001_dizzy_meggan.sql` crea `statistical_operation_config`.

Los commits de documentación posteriores deben superar nuevamente la CI completa; el candidato final de publicación siempre es el HEAD actual de `main`, no el SHA histórico anterior.

## Navegación

La hoja de estilos vigente oculta la cabecera superior histórica y transforma la navegación en un panel lateral izquierdo. El menú se comparte con las operaciones integradas, incluida Demografía de empresas bajo **Estadísticas Experimentales**.

## Metadatos y documentación

La documentación de clonación y operación se distribuye entre:

- `README.md`;
- `ARCHITECTURE.md`;
- `DATA_SOURCES.md`;
- `DATA_GOVERNANCE.md`;
- `DEPLOYMENT.md`;
- `CONTRIBUTING.md`;
- `TECHNICAL_DEBT.md`;
- `docs/METADATA.md`;
- `docs/sdmx/`.

El layout raíz declara `lang="es-CL"`. `docs/METADATA.md` describe metadatos globales, editoriales, de procedencia y SDMX.

## CI

`.github/workflows/ci.yml` ejecuta como controles de aceptación:

1. integridad y portabilidad, incluida cobertura de migraciones D1;
2. instalación reproducible;
3. `npm run lint` como control bloqueante;
4. `npm test`, incluyendo build/SSR y regresiones de caché, fallback estático, CMS y MCP/SDMX;
5. validación del Worker, manifest de Sites y migraciones empaquetadas;
6. conservación completa de `dist/`, incluidos archivos ocultos;
7. revisión de secretos con Gitleaks.

Las cancelaciones de ejecuciones antiguas provocadas por la política de concurrencia no se interpretan como fallos. Para el cierre se comprueba siempre la ejecución correspondiente al SHA actual de `main`.

## Estado de publicación

La documentación oficial de ChatGPT Sites separa **guardar una versión** de **desplegar esa versión**. El repositorio está enlazado a un proyecto Sites concreto, pero la publicación no se deduce del estado de GitHub.

La revisión productiva debe validar sobre el dominio publicado:

- página principal y navegación lateral;
- una operación por cada grupo temático;
- Comercio, Turismo y Supermercados;
- Demografía de empresas;
- `/api/operation-config`;
- `/api/sdmx/catalog` y al menos un `data_endpoint`;
- acceso autenticado a `/admin`;
- persistencia D1 y efecto visible de una modificación CMS controlada.

Hasta registrar una versión de Sites asociada al HEAD validado, desplegarla y ejecutar esos smoke tests, el estado debe expresarse como **repositorio y artefacto listos para publicación; despliegue productivo pendiente de verificación en Sites**.
