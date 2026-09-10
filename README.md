# INE | Relatos Estadísticos

Repositorio del sitio **Relatos Estadísticos**, una aplicación web para difundir resultados de operaciones estadísticas del Instituto Nacional de Estadísticas de Chile mediante relatos, visualizaciones, publicaciones, documentación, bases de datos y recursos asociados.

El proyecto integra páginas temáticas, rutas API, caché de fuentes oficiales, un CMS de configuración por operación y endpoints SDMX. También incorpora el análisis de **Demografía de empresas**, basado en las estadísticas experimentales del RUE.

## Tecnologías

- React 19 y TypeScript para la interfaz.
- Vinext/Vite para construir la aplicación compatible con el runtime de Sites/Cloudflare Workers.
- Cloudflare D1 y Drizzle para persistencia y migraciones.
- XLSX y transformadores específicos para leer planillas estadísticas.
- Python para extractores y validaciones reproducibles de algunos productos.
- GitHub Actions para controles de integridad, pruebas, construcción y revisión de secretos.

La versión mínima de Node.js declarada por el proyecto es `22.13.0`.

## Estructura del repositorio

```text
app/                     páginas, componentes y rutas API
lib/                     transformadores, modelos y utilidades de datos
db/                      acceso y esquema de persistencia
drizzle/                 migraciones de base de datos
docs/                    documentación técnica y contratos SDMX
public/                   activos públicos y snapshots estadísticos iniciales
public/datos_OE/          insumos de Demografía de empresas
public/sdmx/              estructuras, salidas y documentación SDMX
scripts/                  extractores, regeneradores y validadores
worker/                   punto de entrada del Worker y soporte del runtime
tests/                    pruebas automatizadas
.github/workflows/        controles de calidad y reparación reproducible
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
npm run lint                 # análisis estático
npm run validate:artifact    # validación de un artefacto ya construido
python3 scripts/check-repository-integrity.py
```

El control de integridad revisa que los archivos de texto versionados sean UTF-8, que los JSON sean válidos, que los HTML tengan una estructura reconocible y que XLSX/PDF tengan firmas de archivo coherentes.

## Datos y actualización

Las cifras publicadas proceden de fuentes oficiales del INE o de archivos estadísticos incluidos expresamente para una operación. La aplicación combina tres mecanismos:

1. snapshots versionados en `public/` para disponer de una revisión inicial reproducible;
2. caché compartida D1 para reutilizar la última revisión validada;
3. verificación de la fuente oficial mediante hash y, cuando corresponde, ETag, `Last-Modified` o tamaño.

Si una fuente cambia, el transformador asociado descarga y valida la nueva revisión antes de sustituir la caché. Si la fuente no está disponible, las rutas preparadas para ello conservan la última revisión válida.

La trazabilidad de fuentes y transformaciones se documenta en [`DATA_SOURCES.md`](DATA_SOURCES.md). Los criterios de gobierno están en [`DATA_GOVERNANCE.md`](DATA_GOVERNANCE.md).

### Regeneradores reproducibles

Entre los scripts versionados se incluyen:

- `scripts/extract-enusc.py`: genera el snapshot ENUSC a partir del tabulado regional oficial.
- `public/sdmx/transformar_ene_sdmx.py`: transforma `indicadores_principales.xlsx` de la ENE a SDMX-CSV y valida la salida.
- `scripts/build-business-demography-snapshot.mjs`: reconstruye el snapshot SDMX de Demografía de empresas desde su HTML fuente.
- `scripts/check-repository-integrity.py`: detecta archivos dañados o recodificados antes del build.

El workflow `.github/workflows/repair-assets.yml` documenta y automatiza la recuperación de los artefactos que dependen de esas fuentes.

## Demografía de empresas

El análisis integrado permite consultar resultados por territorio, actividad económica y tamaño de empresa. Los cuadros estadísticos se almacenan bajo:

```text
public/datos_OE/cuadros_estadisticos/
```

La estructura SDMX propuesta y sus dimensiones están documentadas en [`docs/sdmx/DEMOGRAFIA_EMPRESAS.md`](docs/sdmx/DEMOGRAFIA_EMPRESAS.md). El proyecto fuente independiente utilizado para recuperar el HTML integrado está en `alejandrohenriquezr/demografia-de-empresas`.

## CMS

La ruta `/admin` administra la configuración de secciones por operación. La persistencia se realiza en D1 y la configuración pública se expone mediante `GET /api/operation-config`.

Las secciones contempladas por el modelo incluyen análisis de resultados, publicaciones, documentación, bases de datos y centro de recursos. La lógica exacta de tablas y migraciones está en `db/` y `drizzle/`.

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

La aplicación usa el binding lógico D1 `DB`. El repositorio contiene esquema, acceso y migraciones, pero no una copia de la base productiva. El contenido de caché se puede reconstruir desde las fuentes y snapshots versionados.

Los cambios de esquema deben registrarse mediante migraciones y probarse antes del despliegue.

## Validación continua

`.github/workflows/ci.yml` ejecuta:

1. control de integridad del repositorio;
2. instalación reproducible con `npm ci`;
3. lint, actualmente informativo mientras se resuelve la deuda técnica documentada;
4. `npm test`, que bloquea el flujo si las pruebas o la construcción fallan;
5. conservación temporal del artefacto de construcción;
6. revisión de secretos con Gitleaks.

No deben incorporarse credenciales, archivos `.env` ni datos personales al repositorio.

## Despliegue y recuperación

La configuración del proyecto Sites está en `.openai/hosting.json`. El despliegue requiere conservar el binding D1 `DB` y validar previamente el artefacto construido.

El procedimiento de clonación, despliegue, recuperación y reversión está en [`DEPLOYMENT.md`](DEPLOYMENT.md). La arquitectura está descrita en [`ARCHITECTURE.md`](ARCHITECTURE.md) y las reglas de contribución en [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Documentación técnica

- [`ARCHITECTURE.md`](ARCHITECTURE.md): componentes y flujo de datos.
- [`DATA_SOURCES.md`](DATA_SOURCES.md): fuentes y transformaciones.
- [`DATA_GOVERNANCE.md`](DATA_GOVERNANCE.md): roles y controles de datos.
- [`DEPLOYMENT.md`](DEPLOYMENT.md): despliegue y recuperación.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): flujo de cambios y criterios de aceptación.
- [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md): observaciones técnicas pendientes.
- [`docs/sdmx/`](docs/sdmx/): contratos y documentación SDMX.

## Estado de sincronización

El estado técnico de la última sincronización validada, sus fuentes, conteos y controles se registra en `SYNC_STATUS.md` para que una clonación pueda distinguir entre archivos simplemente versionados y artefactos efectivamente reconstruidos y comprobados.
