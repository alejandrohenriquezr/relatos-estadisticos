# Arquitectura

## Componentes

1. **Interfaz:** componentes React y estilos globales en `app/`.
2. **Rutas de datos:** endpoints bajo `app/api/`.
3. **Transformadores:** módulos de dominio en `lib/`.
4. **Persistencia:** D1, esquema Drizzle y migraciones en `db/` y `drizzle/`.
5. **Arranque resiliente:** archivos JSON/XLSX versionados en `public/`.
6. **Runtime:** adaptador Worker en `worker/`.
7. **Control de calidad:** integridad, ESLint, pruebas, build y revisión de secretos mediante GitHub Actions.

## Flujo de una consulta

1. La página solicita el producto estadístico.
2. Cuando existe caché D1, la API busca primero una revisión válida y puede responderla sin volver a descargar la fuente.
3. La interfaz presenta los datos y, en los productos preparados para ello, solicita una verificación de actualización.
4. La API consulta la fuente oficial y compara su firma mediante hash y/o metadatos disponibles.
5. Si la firma cambió, descarga, transforma y valida la nueva revisión.
6. La nueva revisión válida se guarda en D1 y la interfaz puede actualizarse.
7. Si la fuente externa falla pero D1 conserva una revisión válida, se entrega esa revisión como estado degradado.
8. Para Comercio, Turismo y Supermercados, si la API/D1 no está disponible, `lib/client-data-prefetch.ts` carga el snapshot versionado correspondiente desde `public/` y mantiene operativa la navegación.

## Capas de continuidad

El orden práctico de continuidad es:

```text
Fuente oficial INE
       ↓ verificación / transformación
Caché compartida D1
       ↓ respuesta preferente
API de la aplicación
       ↓
Memoria de navegación del cliente
       ↓ si API/D1 no está disponible
Snapshot público versionado
```

- **Snapshots públicos:** permiten clonar, construir y consultar una revisión conocida sin depender de la base productiva. En Servicios se usan explícitamente como fallback de ejecución.
- **Memoria del cliente:** evita repetir solicitudes durante la navegación de una sesión.
- **D1 compartida:** reutiliza la misma revisión entre visitantes e instancias y almacena metadatos de control.
- **Fuente oficial:** es la referencia estadística y determina cuándo corresponde regenerar una revisión.

D1 actúa como caché operacional y persistencia de configuración; no reemplaza a la fuente estadística oficial ni es necesario incluir una copia de la base productiva en el repositorio.

## Criterios de diseño

- Último período disponible por omisión, derivado de la serie versionada o de la respuesta actualizada; no de valores hardcodeados.
- Texto analítico vinculado a las cifras visibles.
- Selectores territoriales, temáticos y temporales.
- Leyendas que activan u ocultan series.
- Transiciones suaves y descarga de gráficos.
- Diseño adaptable y navegación consistente.
- Recuperación degradada explícita cuando una dependencia de datos no está disponible.

## Controles de aceptación

El flujo de CI es bloqueante para:

- integridad básica de archivos y formatos;
- errores de ESLint;
- construcción del artefacto;
- render SSR;
- pruebas de rutas de caché y fallbacks;
- contratos MCP/SDMX;
- revisión de secretos.

El artefacto de construcción se conserva temporalmente en GitHub Actions para diagnóstico, pero una compilación válida no demuestra por sí sola que el sitio productivo esté sirviendo el mismo commit.

## Límites actuales

- Las fuentes son planillas y documentos cuya estructura puede cambiar.
- Los transformadores son específicos por producto y deben validarse ante cambios de formato.
- Las publicaciones mensuales y anuales de una misma operación pueden responder a productos distintos; la aplicación debe documentar qué frecuencia usa cada relato.
- La incorporación de un producto requiere validación metodológica, técnica y editorial.
