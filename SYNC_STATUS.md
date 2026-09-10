# Estado de sincronización

Fecha de revisión: 2026-09-10.

Este archivo registra controles observables del repositorio y distingue entre **código validado en GitHub** y **revisión efectivamente publicada por Sites**. Una ejecución correcta de GitHub Actions no demuestra, por sí sola, que el dominio productivo esté sirviendo el mismo SHA.

## Resumen de cierre

La revisión del repositorio dejó resueltos los problemas de integridad, construcción SSR, actualización de ENE, continuidad de Servicios, configuración editorial del CMS, metadatos y documentación de clonación/despliegue.

El repositorio debe considerarse técnicamente aceptado únicamente cuando el commit actual de `main` tenga una ejecución satisfactoria de `.github/workflows/ci.yml`. Ese workflow es bloqueante para integridad, lint, build/pruebas y revisión de secretos.

## Reparación de integridad

Durante la revisión de la sincronización del 8 de septiembre se detectaron cinco archivos dañados por transferencia:

- `public/demografia-empresas/index.html`;
- `public/enusc-data.json`;
- `public/sdmx/ENE_IND_PRINCIPALES_completo_SDMX-CSV_2.0.csv`;
- `public/sdmx/demografia-empresas-observations.json`;
- `public/worker/vendor/xlsx.full.min.js`.

La reparación reproducible fue ejecutada por `.github/workflows/repair-assets.yml` y guardada inicialmente en el commit `90ff825` (`Repara artefactos de datos sincronizados [assets-repaired]`). Los controles posteriores volvieron a ejecutar `scripts/check-repository-integrity.py` y el build completo.

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

La interfaz ya no inyecta manualmente `Mar - May 2026`. El período inicial se deriva del último registro del snapshot versionado `public/ene-data.json`, evitando una segunda fuente de verdad en `app/page.tsx`.

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

La interfaz consulta primero las rutas API/D1 y utiliza esos archivos como respaldo cuando la dependencia compartida no está disponible. La regeneración reproducible se conserva en `.github/workflows/regenerate-services-fallbacks.yml`.

La regresión `tests/client-static-fallback.test.ts` comprueba el comportamiento sin D1. Las fuentes oficiales, períodos observados y detalles de trazabilidad están documentados en `DATA_SOURCES.md`.

## Estadísticas vitales

La ruta `app/api/vital-data/route.ts` persiste correctamente el hash calculado de la fuente.

La fuente anual configurada es:

`series-vitales-1992-2025(p).xlsx`

Su vigencia fue contrastada el 10 de septiembre de 2026 con la publicación anual del INE: corresponde a las cifras provisionales 2025 difundidas en mayo de 2026. Los boletines mensuales 2026 constituyen un producto coyuntural de distinta frecuencia y no sustituyen esa serie histórica anual.

Por tanto, el control de contenido anual de Nacimientos, Fecundidad, Defunciones, Mortalidad, Matrimonios y AUC ya no queda marcado como pendiente por el solo hecho de existir publicaciones mensuales 2026.

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
- el editor de una operación recupera primero la configuración persistida en D1 y usa defaults sólo como respaldo;
- `PUT /api/admin/operations` exige identidad autenticada y guarda `updated_by` con el correo del usuario;
- `GET /api/operation-config` continúa siendo la ruta pública de lectura de la configuración editorial;
- `app/OperationSections.tsx` consulta esa configuración al abrir cada operación;
- si hay dos o más secciones habilitadas se muestra el menú de pestañas;
- **Análisis** permanece visible por omisión;
- Publicaciones, Documentación, Bases de datos y Centro de recursos reutilizan recursos ya enlazados por la operación y nunca inventan archivos inexistentes.

La integración sobre `app/page.tsx` fue aplicada y validada por una corrida temporal de GitHub Actions que terminó correctamente y produjo el commit `702605b8198638a0703da7a9fe4bc7a0392acb7f`. El workflow y el script usados sólo para esa modificación fueron retirados después de consolidar el cambio.

Las regresiones permanentes se encuentran en `tests/cms-operation-sections.test.mjs`.

## Navegación

El JSX conserva elementos históricos `topbar`/`topics`, pero la hoja de estilos vigente oculta la cabecera superior y transforma la navegación en un panel lateral izquierdo. El menú lateral se comparte con las operaciones integradas, incluida Demografía de empresas bajo **Estadísticas Experimentales**.

No se reescribió esa estructura durante el cierre porque el comportamiento visual final ya corresponde al patrón lateral solicitado.

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

1. integridad de archivos;
2. instalación reproducible;
3. `npm run lint` como control bloqueante;
4. `npm test`, incluyendo build/SSR y regresiones de caché, fallback estático, CMS y MCP/SDMX;
5. validación/conservación del artefacto cuando corresponde;
6. revisión de secretos con Gitleaks.

Las cancelaciones de ejecuciones antiguas provocadas por la política de concurrencia no se interpretan como fallos. Para el cierre se debe comprobar la ejecución correspondiente al SHA actual de `main`.

## Despliegue productivo

La configuración del proyecto Sites se conserva en `.openai/hosting.json`, con binding lógico D1 `DB`.

El repositorio no contiene una copia de la D1 productiva. Una clonación puede reconstruir el código, snapshots y cachés derivadas, pero el estado editorial persistido del CMS requiere una D1 compatible.

La validación final del despliegue debe comprobar, sobre el dominio publicado:

- página principal y navegación lateral;
- una operación por cada grupo temático;
- Comercio, Turismo y Supermercados;
- Demografía de empresas;
- `/api/operation-config`;
- `/api/sdmx/catalog` y al menos un `data_endpoint`;
- acceso autenticado a `/admin` y persistencia visible de una modificación CMS.

Hasta que el dominio publicado se contraste contra el SHA final, el estado de GitHub y el estado de publicación deben reportarse por separado.
