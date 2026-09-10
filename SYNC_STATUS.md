# Estado de sincronización

Fecha de revisión: 2026-09-10.

Este archivo registra controles observables del repositorio. No sustituye el historial de GitHub Actions ni implica que el despliegue productivo esté sirviendo automáticamente el último commit de `main`.

## Reparación de integridad

Durante la revisión de la sincronización del 8 de septiembre se detectaron cinco archivos dañados por transferencia:

- `public/demografia-empresas/index.html`;
- `public/enusc-data.json`;
- `public/sdmx/ENE_IND_PRINCIPALES_completo_SDMX-CSV_2.0.csv`;
- `public/sdmx/demografia-empresas-observations.json`;
- `public/worker/vendor/xlsx.full.min.js`.

La reparación reproducible fue ejecutada por `.github/workflows/repair-assets.yml` y guardada en el commit `90ff825` (`Repara artefactos de datos sincronizados [assets-repaired]`).

Después de la regeneración, `python3 scripts/check-repository-integrity.py` revisó 196 archivos versionados y finalizó con `Integridad básica: OK`.

## Resultados de regeneración

### Encuesta Nacional de Empleo

Fuente:

`https://www.ine.gob.cl/docs/default-source/ocupacion-y-desocupacion/cuadros-estadisticos/series-vigentes/indicadores_principales.xlsx`

Transformador: `public/sdmx/transformar_ene_sdmx.py`.

Resultado del 10 de septiembre de 2026:

- validación: válida, sin errores;
- observaciones: 48.659;
- series: 247;
- períodos: 197;
- primer período: 2010-03;
- último período: 2026-07;
- coberturas territoriales: total país y 16 regiones;
- códigos de sexo: total, hombres y mujeres.

### ENUSC

Fuente:

`https://www.ine.gob.cl/docs/default-source/seguridad-ciudadana/cuadros-estadisticos/2025/tabulados-regionales---enusc-2025.xlsx`

Transformador: `scripts/extract-enusc.py`.

Resultado del 10 de septiembre de 2026:

- variables: 286;
- tabulados: 286;
- snapshot JSON generado correctamente.

### Demografía de empresas

Fuente de recuperación del HTML integrado:

`https://github.com/alejandrohenriquezr/demografia-de-empresas`

En el momento de la reparación, `main` y `migracion-python` apuntaban al commit `54fbcaf92b79938e194f3dc19735f40eaf7b00a5`.

Regenerador: `scripts/build-business-demography-snapshot.mjs`.

Resultado:

- observaciones normalizadas: 3.370;
- HTML validado con estructura reconocible;
- snapshot JSON válido.

Los Excel estadísticos asociados siguen almacenados en `public/datos_OE/cuadros_estadisticos/`.

## Estadísticas vitales

Se corrigió `app/api/vital-data/route.ts` para persistir el hash calculado de la fuente, en lugar de una variable inexistente. La fuente histórica configurada en esa ruta debe revisarse separadamente frente a la publicación anual más reciente antes de declarar que Nacimientos y las demás estadísticas vitales están actualizadas al último año disponible.

Por tanto, al 10 de septiembre de 2026, la integridad técnica de la ruta está corregida, pero la vigencia anual de la fuente de estadísticas vitales permanece como control de contenido pendiente.

## CI

El workflow `.github/workflows/ci.yml` es el control de aceptación del repositorio. Ejecuta:

- integridad de archivos;
- instalación reproducible;
- lint informativo;
- `npm test` como control bloqueante;
- generación/conservación del artefacto cuando corresponde;
- revisión de secretos.

Los commits de documentación y limpieza posteriores a `90ff825` deben superar nuevamente este workflow. El resultado vigente debe comprobarse en GitHub Actions para el SHA actual de `main`.

## Despliegue

El repositorio documenta la configuración Sites en `.openai/hosting.json`, pero una ejecución correcta de CI no demuestra por sí sola que el dominio publicado esté sirviendo el mismo SHA. La comprobación del sitio productivo debe realizarse sobre las páginas y endpoints desplegados después de publicar la revisión validada.
