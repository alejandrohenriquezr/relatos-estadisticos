# INE | Relatos Estadísticos

Repositorio del sitio **Relatos Estadísticos**, una aplicación web para difundir resultados de operaciones estadísticas del Instituto Nacional de Estadísticas de Chile mediante relatos, visualizaciones, publicaciones, documentación, bases de datos y recursos asociados.

El proyecto integra páginas temáticas, rutas API, caché de fuentes oficiales, un CMS de configuración por operación y endpoints SDMX. También incorpora el análisis de **Demografía de empresas**, basado en las estadísticas experimentales del RUE.

Sitio documentado: `https://relatos-estadisticos.alhen1970.chatgpt.site`.

## Tecnologías

- React 19 y TypeScript para la interfaz.
- Vinext/Vite para construir la aplicación compatible con el runtime de Sites/Cloudflare Workers.
- Cloudflare D1 y Drizzle para persistencia y migraciones.
- XLSX y transformadores específicos para leer planillas estadísticas.
- Python para extractores y validaciones reproducibles de algunos productos.
- GitHub Actions para controles de integridad, lint, pruebas, construcción y revisión de secretos.

La versión mínima de Node.js declarada por el proyecto es `22.13.0`.

## Estructura del repositorio

```text
app/                     páginas, componentes y rutas API
lib/                     transformadores, modelos y utilidades de datos
db/                      acceso y esquema de persistencia
drizzle/                 migraciones de base de datos
docs/                    documentación técnica, metadatos y contratos SDMX
public/                   activos públicos y snapshots estadísticos iniciales
public/datos_OE/          insumos de Demografía de empresas
public/sdmx/              estructuras, salidas y documentación SDMX
scripts/                  extractores, regeneradores y validadores
worker/                   punto de entrada del Worker y soporte del runtime
tests/                    pruebas automatizadas
.github/workflows/        CI y procedimientos reproducibles de recuperación/actualización
.openai/hosting.json      bindings y configuración del proyecto Sites
```

## Instalación local

Clonar el repositorio e instalar exactamente las dependencias registradas en `package-lock.json`:

```bash
git clone https://github.com/alejandrohenriquezr/relatos-estadisticos.git
cd relatos-estadisticos
npm ci
```

Comandos principales:

```bash
npm run dev                  # servidor de desarrollo
npm run build                # construcción del artefacto desplegable
npm test                     # construcción y pruebas de regresión
npm run lint                 # análisis estático bloqueante
npm run validate:artifact    # validación de un artefacto ya construido
python3 scripts/check-repository-integrity.py
```

El control de integridad revisa que los archivos de texto versionados sean UTF-8, que los JSON sean válidos, que los HTML tengan una estructura reconocible y que XLSX/PDF tengan firmas de archivo coherentes.

## Datos y actualización

Las cifras publicadas proceden de fuentes oficiales del INE o de archivos estadísticos incluidos expresamente para una operación. La aplicación combina cuatro mecanismos:

1. snapshots versionados en `public/` para disponer de una revisión inicial reproducible;
2. caché compartida D1 para reutilizar la última revisión validada;
3. verificación de la fuente oficial mediante hash y, cuando corresponde, ETag, `Last-Modified` o tamaño;
4. memoria de navegación del cliente para evitar solicitudes repetidas durante una sesión.

Si una fuente cambia, el transformador asociado descarga y valida la nueva revisión antes de sustituir la caché. Si la fuente no está disponible, se conserva la última revisión válida.

Para **Comercio, Turismo y Supermercados**, la interfaz consulta primero la API/D1 y, si esa dependencia no está disponible, carga automáticamente los snapshots:

```text
public/commerce-data.json
public/tourism-data.json
public/supermarkets-data.json
```

Este comportamiento permite que una clonación siga mostrando los datos agregados versionados aun sin una copia de la D1 productiva. La persistencia compartida y el CMS sí requieren el binding D1 correspondiente.

La trazabilidad de fuentes y transformaciones se documenta en [`DATA_SOURCES.md`](DATA_SOURCES.md). Los criterios de gobierno están en [`DATA_GOVERNANCE.md`](DATA_GOVERNANCE.md) y el mapa de metadatos editoriales/técnicos en [`docs/METADATA.md`](docs/METADATA.md).

### Regeneradores reproducibles

Entre los scripts y workflows versionados se incluyen:

- `scripts/extract-enusc.py`: genera el snapshot ENUSC a partir del tabulado regional oficial.
- `public/sdmx/transformar_ene_sdmx.py`: transforma `indicadores_principales.xlsx` de la ENE a SDMX-CSV y valida la salida.
- `scripts/build-business-demography-snapshot.mjs`: reconstruye el snapshot SDMX de Demografía de empresas desde su HTML fuente.
- `scripts/check-repository-integrity.py`: detecta archivos dañados o recodificados antes del build.
- `.github/workflows/regenerate-services-fallbacks.yml`: regenera y valida los snapshots de Comercio, Turismo y Supermercados.
- `.github/workflows/repair-assets.yml`: reproduce la recuperación de artefactos derivados documentada durante la sincronización de septiembre de 2026.

## Mercado laboral

La ENE utiliza una copia versionada y una ruta de actualización. El período inicial de la interfaz se deriva del último registro presente en `public/ene-data.json`; no se fija manualmente un trimestre 2026 en el código. La transformación SDMX validada llega al período `2026-07`.

Informalidad laboral aplica el mismo principio de snapshot reproducible y actualización desde la fuente oficial correspondiente.

## Servicios

Los snapshots de Servicios fueron contrastados con las fuentes oficiales y llegan a julio de 2026 en la revisión documentada el 10 de septiembre de 2026. Los detalles, URLs y controles específicos están en [`DATA_SOURCES.md`](DATA_SOURCES.md).

La continuidad sin D1 se prueba mediante `tests/client-static-fallback.test.ts`, que forma parte de `npm test`.

## Estadísticas Vitales

La serie anual configurada es `series-vitales-1992-2025(p).xlsx`, correspondiente a las cifras provisionales 2025 difundidas por el INE en mayo de 2026. Los boletines coyunturales de 2026 contienen datos mensuales posteriores, pero corresponden a un producto de distinta frecuencia y no sustituyen la serie anual usada por estos relatos.

## Demografía de empresas

El análisis integrado permite consultar resultados por territorio, actividad económica y tamaño de empresa. Los cuadros estadísticos se almacenan bajo:

```text
public/datos_OE/cuadros_estadisticos/
```

La estructura SDMX propuesta y sus dimensiones están documentadas en [`docs/sdmx/DEMOGRAFIA_EMPRESAS.md`](docs/sdmx/DEMOGRAFIA_EMPRESAS.md). El proyecto fuente independiente utilizado para recuperar el HTML integrado está en `alejandrohenriquezr/demografia-de-empresas`.

## CMS

La ruta `/admin` administra la configuración de secciones por operación y requiere una sesión de ChatGPT autenticada. La persistencia se realiza en D1 y la configuración pública de lectura se expone mediante `GET /api/operation-config`.

Las secciones contempladas por el modelo son **Análisis**, **Publicaciones**, **Documentación**, **Bases de datos** y **Centro de recursos**. El análisis queda activo por omisión. Cuando una operación tiene dos o más secciones habilitadas, `app/OperationSections.tsx` genera el menú de pestañas; la configuración se consulta nuevamente al abrir la operación, de modo que un cambio guardado en el CMS se refleja en la interfaz sin modificar el código.

El editor de `/admin/operations/[operation]` recupera la revisión persistida en D1 antes de mostrar los controles. El endpoint de escritura `PUT /api/admin/operations` exige identidad autenticada y registra el correo del usuario en `updated_by`. Una configuración guardada ya no se limita, por tanto, a mostrar un mensaje de éxito: la lectura editorial y la vista pública comparten el mismo registro persistido.

Las secciones distintas de Análisis reúnen recursos que ya están enlazados por la operación —por ejemplo boletines, metodología, microdatos, Excel o recursos SDMX/API—. Si una categoría está habilitada pero la revisión versionada no contiene un recurso clasificable, la interfaz remite a la fuente oficial del INE en vez de inventar contenido.

Una clonación sin D1 puede construir y mostrar los contenidos y valores por omisión, pero no reproduce por sí sola el estado persistido del CMS productivo. Las regresiones de integración se encuentran en `tests/cms-operation-sections.test.mjs`.

## API SDMX

El catálogo descubrible se obtiene con:

```text
GET /api/sdmx/catalog
```

Cada elemento del catálogo entrega su `data_endpoint`, `metadata_endpoint` y documentación. Por ejemplo, para Demografía de empresas:

```text
GET /api/sdmx/metadata?dataset=DEMOGRAFIA_EMPRESAS
GET /api/sdmx/documentation?dataset=DEMOGRAFIA_EMPRESAS
GET /api/sdmx/data/INE.GOB.CL,DF_DEMOGRAFIA_EMPRESAS,1.0/all
```

Ejemplos contra el sitio publicado:

```bash
curl 'https://relatos-estadisticos.alhen1970.chatgpt.site/api/sdmx/catalog'
curl 'https://relatos-estadisticos.alhen1970.chatgpt.site/api/sdmx/metadata?dataset=DEMOGRAFIA_EMPRESAS'
curl 'https://relatos-estadisticos.alhen1970.chatgpt.site/api/sdmx/data/INE.GOB.CL,DF_DEMOGRAFIA_EMPRESAS,1.0/all' -o demografia_empresas.csv
```

La convención común y las estructuras documentadas están en [`docs/sdmx/README.md`](docs/sdmx/README.md).

## Base de datos

La aplicación usa el binding lógico D1 `DB`. El repositorio contiene esquema, acceso y migraciones, pero no una copia de la base productiva. El contenido de caché estadística se puede reconstruir desde las fuentes y snapshots versionados.

Los cambios de esquema deben registrarse mediante migraciones y probarse antes del despliegue.

## Validación continua

`.github/workflows/ci.yml` ejecuta como controles de aceptación:

1. integridad del repositorio;
2. instalación reproducible con `npm ci`;
3. `npm run lint` como paso bloqueante ante errores;
4. `npm test`, que incluye build, render SSR, regresiones de caché, fallback estático, CMS y MCP/SDMX;
5. conservación temporal del artefacto de construcción;
6. revisión de secretos con Gitleaks.

No deben incorporarse credenciales, archivos `.env` ni datos personales al repositorio.

## Despliegue y recuperación

La configuración del proyecto Sites está en `.openai/hosting.json`. El despliegue requiere conservar el binding D1 `DB` cuando se necesiten persistencia/caché compartida/CMS y validar previamente el artefacto construido.

El procedimiento de clonación, despliegue, recuperación y reversión está en [`DEPLOYMENT.md`](DEPLOYMENT.md). La arquitectura está descrita en [`ARCHITECTURE.md`](ARCHITECTURE.md), los metadatos en [`docs/METADATA.md`](docs/METADATA.md) y las reglas de contribución en [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Documentación técnica

- [`ARCHITECTURE.md`](ARCHITECTURE.md): componentes y flujo de datos.
- [`DATA_SOURCES.md`](DATA_SOURCES.md): fuentes, verificaciones y transformaciones.
- [`DATA_GOVERNANCE.md`](DATA_GOVERNANCE.md): roles y controles de datos.
- [`DEPLOYMENT.md`](DEPLOYMENT.md): clonación, despliegue, recuperación y reversión.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): flujo de cambios y criterios de aceptación.
- [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md): observaciones técnicas pendientes y estado del lint.
- [`docs/METADATA.md`](docs/METADATA.md): metadatos globales, editoriales, de procedencia y SDMX.
- [`docs/sdmx/`](docs/sdmx/): contratos y documentación SDMX.

## Estado de sincronización

El estado técnico de la última sincronización validada, sus fuentes, conteos, commits y controles se registra en [`SYNC_STATUS.md`](SYNC_STATUS.md). Ese archivo distingue explícitamente entre validación del repositorio y verificación del despliegue productivo.
