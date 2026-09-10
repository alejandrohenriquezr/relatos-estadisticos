# Despliegue y recuperación

## Sitio productivo

- Proyecto Sites: identificado por `.openai/hosting.json`.
- Binding lógico D1: `DB`.
- Repositorio fuente: `https://github.com/alejandrohenriquezr/relatos-estadisticos`.
- URL documentada del sitio: `https://relatos-estadisticos.alhen1970.chatgpt.site`.
- `main` debe representar una revisión que haya superado los controles automatizados antes de utilizarse como fuente de publicación.

La base D1 productiva no se versiona. El repositorio conserva el esquema, las migraciones, los snapshots iniciales y los procedimientos necesarios para reconstruir la caché desde las fuentes estadísticas.

## Requisitos de clonación

- Git.
- Node.js `>=22.13.0`.
- npm compatible con el `package-lock.json`.
- Python 3 para los extractores auxiliares; `openpyxl` se requiere para los scripts que leen libros Excel mediante Python.
- En Linux, los scripts del ciclo de Sites usan `flock`, `curl` y GNU `timeout`.

```bash
git clone https://github.com/alejandrohenriquezr/relatos-estadisticos.git
cd relatos-estadisticos
npm ci
```

## Validaciones previas

Ejecutar, como mínimo:

```bash
python3 scripts/check-repository-integrity.py
npm run lint
npm test
```

`npm run lint` es un control bloqueante tanto localmente como en GitHub Actions: una revisión con errores de ESLint no debe publicarse. `npm test` construye la aplicación y ejecuta las regresiones de render SSR, rutas de caché, fallback estático de Servicios y contratos MCP/SDMX.

El proceso de construcción debe producir, según la configuración vigente:

- `dist/server/index.js`;
- `dist/.openai/hosting.json`;
- migraciones en `dist/.openai/drizzle/`, cuando correspondan.

La validación explícita de un artefacto ya construido se ejecuta con:

```bash
npm run validate:artifact
```

## Continuidad sin la D1 productiva

Una clonación no requiere copiar la base D1 productiva para construir el sitio. Los datos agregados necesarios para el arranque se versionan bajo `public/`.

Para Comercio, Turismo y Supermercados, `lib/client-data-prefetch.ts` consulta primero la API y usa automáticamente estos snapshots si D1/API no está disponible:

```text
public/commerce-data.json
public/tourism-data.json
public/supermarkets-data.json
```

D1 sigue siendo necesaria para reproducir la persistencia compartida, la caché operacional y las funciones CMS que dependen de ella. El fallback estadístico no pretende sustituir esas capacidades de persistencia.

## Restauración de datos derivados

Si un snapshot o activo derivado resulta dañado, no debe repararse editando manualmente sus bytes. Debe reconstruirse desde su fuente.

El workflow `.github/workflows/repair-assets.yml` documenta la recuperación reproducible de los activos que en septiembre de 2026 presentaron corrupción de transferencia. En particular:

- ENUSC se regenera desde el tabulado regional oficial mediante `scripts/extract-enusc.py`.
- ENE SDMX se regenera desde `indicadores_principales.xlsx` mediante `public/sdmx/transformar_ene_sdmx.py`.
- Demografía de empresas recupera su HTML desde el repositorio fuente y reconstruye su snapshot mediante `scripts/build-business-demography-snapshot.mjs`.
- `xlsx.full.min.js` se restaura desde la dependencia `xlsx` instalada con npm.

Los snapshots de Servicios se pueden regenerar y validar mediante `.github/workflows/regenerate-services-fallbacks.yml`.

Después de una recuperación debe ejecutarse nuevamente `scripts/check-repository-integrity.py`, `npm run lint` y `npm test`.

## Publicación en Sites

1. Partir de un commit de `main` cuyo CI completo haya finalizado correctamente.
2. Verificar `.openai/hosting.json` y el binding D1 `DB` del proyecto.
3. Mantener las migraciones requeridas por la revisión.
4. Publicar mediante el flujo autorizado de Sites.
5. Comprobar la página principal y la navegación a las operaciones estadísticas.
6. Verificar `/admin` cuando corresponda y confirmar lectura/escritura de configuración si se está validando el CMS.
7. Verificar `/api/sdmx/catalog` y al menos un `data_endpoint` devuelto por ese catálogo.
8. Comprobar que los snapshots públicos de Servicios respondan, de modo que exista continuidad si D1 no está disponible.

Una ejecución correcta de GitHub Actions valida el repositorio y su construcción, pero no sustituye la comprobación del despliegue que esté sirviendo Sites. La revisión productiva debe contrastarse explícitamente con el commit de `main` que se pretendía publicar.

## Recuperación desde GitHub

1. Clonar el repositorio.
2. Instalar la versión compatible de Node.js.
3. Ejecutar `npm ci`.
4. Ejecutar integridad, lint y pruebas.
5. Verificar `.openai/hosting.json`.
6. Configurar o comprobar el binding D1 `DB` en el ambiente de Sites cuando se requiera persistencia compartida/CMS.
7. Aplicar las migraciones requeridas.
8. Publicar la revisión validada.
9. Comprobar páginas, snapshots y API.

## Reversión

Ante una falla de una nueva publicación:

1. identificar el último commit que haya sido validado y publicado correctamente;
2. restaurar ese estado mediante una nueva revisión o el procedimiento autorizado de reversión;
3. volver a ejecutar integridad, lint y pruebas;
4. publicar;
5. comprobar páginas y API;
6. registrar causa y corrección.

No debe asumirse que revertir sólo el código restaura el contenido de D1. Si la falla involucró cambios de esquema o datos persistidos, la recuperación de base de datos debe evaluarse por separado.
