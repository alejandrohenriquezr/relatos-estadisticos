# Despliegue y recuperación

## Sitio productivo

- Proyecto Sites: identificado por `.openai/hosting.json`.
- Project ID: `appgprj_6aa02079e2948191bd3f3ed0921f79c0`.
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

`npm run lint` es un control bloqueante tanto localmente como en GitHub Actions. `npm test` construye la aplicación y ejecuta las regresiones de render SSR, rutas de caché, fallback estático de Servicios, CMS y contratos MCP/SDMX.

El control de integridad también verifica que cada tabla declarada mediante `sqliteTable(...)` en `db/schema.ts` disponga de un `CREATE TABLE` correspondiente en `drizzle/*.sql`. De este modo, una modificación del esquema D1 no puede considerarse publicable si su migración no fue versionada.

El proceso de construcción debe producir:

- `dist/server/index.js`;
- `dist/.openai/hosting.json`;
- las migraciones en `dist/.openai/drizzle/`.

La validación explícita de un artefacto ya construido se ejecuta con:

```bash
npm run validate:artifact
```

`validate:artifact` exige el Worker, el manifest de Sites y todas las migraciones SQL presentes en el repositorio. La CI conserva `dist/` con `include-hidden-files: true`, porque `.openai/hosting.json` y `.openai/drizzle/` forman parte del artefacto necesario para reproducir el proyecto.

## Esquema D1 del CMS

El CMS utiliza la tabla `statistical_operation_config`. Su definición fuente está en `db/schema.ts` y su migración se conserva en:

```text
drizzle/0001_dizzy_meggan.sql
```

Antes de publicar una revisión que cambie el CMS deben revisarse conjuntamente:

```text
db/schema.ts
drizzle/*.sql
app/api/operation-config/
app/api/admin/operations/
app/admin/operations/
```

Una CI verde sin migraciones coherentes no es suficiente; por eso esa correspondencia se valida de forma bloqueante.

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

## Publicación en ChatGPT Sites

La publicación de Sites tiene dos etapas y no debe confundirse con un `git push`:

1. **Guardar versión**: construir y guardar en Sites un candidato asociado al commit Git que se desea publicar.
2. **Desplegar versión**: publicar explícitamente esa versión guardada y obtener/confirmar la URL productiva.

La documentación oficial del producto está en `https://learn.chatgpt.com/docs/sites`.

### 1. Seleccionar el candidato

Partir del HEAD de `main` y registrar el SHA exacto:

```bash
git checkout main
git pull --ff-only
git rev-parse HEAD
```

Comprobar que la ejecución de `.github/workflows/ci.yml` para ese mismo SHA terminó correctamente y que produjo `sitio-compilado`.

### 2. Revisar el proyecto Sites y D1

Comprobar `.openai/hosting.json`:

```json
{
  "d1": "DB",
  "project_id": "appgprj_6aa02079e2948191bd3f3ed0921f79c0",
  "r2": null
}
```

Revisar que el candidato incluya `drizzle/0000_mean_hedge_knight.sql`, `drizzle/0001_dizzy_meggan.sql` y sus equivalentes empaquetados bajo `dist/.openai/drizzle/`.

### 3. Guardar una versión en Sites

Desde ChatGPT Sites, abrir el proyecto enlazado por `.openai/hosting.json` y **guardar una versión** del commit candidato. No desplegar todavía si se desea revisar primero la versión guardada.

La versión guardada debe poder relacionarse con el commit Git seleccionado. Si el SHA observado en Sites no coincide con el candidato validado, no continuar al despliegue.

### 4. Desplegar la versión guardada

Una vez revisada, **desplegar esa versión concreta**. Registrar:

- SHA Git publicado;
- versión de Sites seleccionada;
- URL de producción informada por Sites;
- fecha/hora de publicación;
- resultado de los smoke tests posteriores.

Un push a `main`, una CI verde o la existencia de un ZIP de build no constituyen por sí solos una publicación.

## Smoke tests posteriores al despliegue

La revisión productiva debe validarse contra el dominio publicado, como mínimo con estos controles:

1. La página principal responde y muestra el menú lateral.
2. Se puede navegar a una operación de cada grupo temático.
3. Comercio, Turismo y Supermercados cargan correctamente.
4. Demografía de empresas abre su análisis integrado.
5. `GET /api/sdmx/catalog` responde y al menos un `data_endpoint` del catálogo entrega datos.
6. `GET /api/operation-config?operation=births` responde con configuración válida.
7. `/admin` exige identidad autenticada para edición.
8. Una modificación controlada desde `/admin` se persiste, vuelve a leerse y se refleja en la operación pública correspondiente.
9. Tras la prueba CMS, se restituye la configuración editorial original si la modificación era sólo de validación.

Cuando se valide el CMS, la prueba debe confirmar tanto la persistencia en D1 como su traducción visible en la interfaz; recibir únicamente un mensaje de “configuración guardada” no es suficiente.

## Recuperación desde GitHub

1. Clonar el repositorio.
2. Instalar la versión compatible de Node.js.
3. Ejecutar `npm ci`.
4. Ejecutar integridad, lint y pruebas.
5. Verificar `.openai/hosting.json`.
6. Confirmar que `db/schema.ts` y `drizzle/*.sql` están sincronizados.
7. Configurar o comprobar el binding D1 `DB` en Sites.
8. Guardar una versión de Sites asociada al commit validado.
9. Revisar el candidato guardado.
10. Desplegar esa versión.
11. Ejecutar los smoke tests de páginas, CMS y API.

## Reversión

Ante una falla de una nueva publicación:

1. identificar el último commit y la última versión de Sites que hayan sido validados y publicados correctamente;
2. seleccionar o reconstruir ese estado;
3. comprobar la compatibilidad del esquema D1 y sus migraciones;
4. ejecutar integridad, lint y pruebas;
5. guardar/revisar la versión de recuperación;
6. desplegarla;
7. repetir los smoke tests;
8. registrar causa y corrección.

No debe asumirse que revertir sólo el código restaura el contenido de D1. Si la falla involucró cambios de esquema o datos persistidos, la recuperación de base de datos debe evaluarse por separado.
