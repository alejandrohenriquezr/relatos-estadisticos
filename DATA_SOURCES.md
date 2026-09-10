# Fuentes y transformaciones

## Principio

Toda cifra debe poder relacionarse con:

- producto estadístico;
- URL oficial;
- archivo y hoja;
- rango o variables utilizadas;
- unidad de medida;
- fórmula aplicada;
- fecha de verificación;
- versión del transformador.

## Familias de fuentes

| Familia | Productos | Implementación |
|---|---|---|
| Mercado laboral | ENE e informalidad | `app/api/ene-data`, `app/api/informality-data`, `lib/*ene*`, `lib/*informality*` |
| Precios | IPC e IPP | `app/api/ipc-*`, `app/api/ipp-data`, `lib/ipc-*`, `lib/ipp-*` |
| Demografía | Estadísticas vitales | `app/api/vital-data`, `lib/vital-statistics-data.ts` |
| Condiciones de vida | ENUSC y policías | `app/api/enusc-data`, `app/api/police-data`, `lib/enusc-*`, `lib/police-*` |
| Actividad económica | Industria, energía, permisos y comercio | `app/api/economic-data`, `lib/economic-data.ts` |
| Servicios | Turismo y supermercados | `app/api/tourism-data`, `app/api/supermarkets-data`, `lib/tourism-data.ts`, `lib/supermarkets-data.ts` |

Las URLs específicas se mantienen junto a cada transformador para que la documentación y el código ejecutable puedan contrastarse.

## Fuentes verificadas el 10 de septiembre de 2026

### Encuesta Nacional de Empleo

Fuente de indicadores principales:

`https://www.ine.gob.cl/docs/default-source/ocupacion-y-desocupacion/cuadros-estadisticos/series-vigentes/indicadores_principales.xlsx`

El snapshot y la salida SDMX alcanzan el período `2026-07`. La interfaz deriva el período inicial desde el último registro disponible de `public/ene-data.json`; no existe un trimestre 2026 fijado manualmente como supuesto de actualización.

### Índice de Actividad del Comercio

Fuente:

`https://www.ine.gob.cl/docs/default-source/actividad-mensual-del-comercio/cuadros-estadisticos/base-promedio-año-2018-100/series-empalmadas-históricas.xlsx`

Snapshot: `public/commerce-data.json`.

Último registro validado: julio de 2026. Índice general `120,9074608`; variación mensual `-4,5823%`; variación en doce meses `-0,2224%`; variación acumulada `3,2933%`.

### Encuesta Mensual de Alojamiento Turístico

Fuente:

`https://www.ine.gob.cl/docs/default-source/actividad-del-turismo/cuadros-estadisticos-dos/serie-histórica-metodología-2017/series-mensuales-de-julio-2016-a-la-fecha.xlsx`

Snapshot: `public/tourism-data.json`.

Último registro nacional validado: julio de 2026, con `1.695.480,007` pernoctaciones; variación mensual `18,7783%`; variación en doce meses `-7,2820%`; variación acumulada `-3,8804%`.

El libro oficial contiene cabeceras mensuales vacías en posiciones intermedias de la serie —entre ellas julio de 2025 y junio de 2026— aunque conserva sus valores. `lib/tourism-data.ts` reconstruye sólo huecos mensuales inequívocos situados entre períodos válidos; no extrapola fechas fuera de esa condición.

### Índice de Ventas de Supermercados

Fuente:

`https://www.ine.gob.cl/docs/default-source/ventas-de-supermercados/cuadros-estadisticos/base-promedio-a%C3%B1o-2018-100/series-mensuales-desde-enero-de-2018-a-la-fecha.xls`

Snapshot: `public/supermarkets-data.json`.

Último registro validado: julio de 2026. La serie a precios constantes presenta una variación en doce meses de `2,0580%` —indicador comparable con el `2,1%` difundido—, mientras la serie a precios corrientes registra `4,2444%`. Ambas se conservan como series distintas.

### Estadísticas Vitales

Fuente anual configurada:

`https://www.ine.gob.cl/docs/default-source/nacimientos-matrimonios-y-defunciones/cuadros-estadisticos/series-hist%C3%B3ricas/series-vitales-1992-2025(p).xlsx?sfvrsn=bfbe614_4`

La fuente anual llega a `2025(p)` y corresponde a las cifras provisionales 2025 difundidas por el INE en mayo de 2026. Los boletines coyunturales de 2026 contienen datos mensuales más recientes, pero constituyen un producto de distinta frecuencia y no sustituyen la serie anual usada por estos relatos.

## Fallbacks de Servicios

`lib/client-data-prefetch.ts` aplica para Comercio, Turismo y Supermercados el siguiente orden:

1. consultar la API de la aplicación, que usa D1 cuando está disponible;
2. si la API/D1 no responde, cargar el snapshot correspondiente desde `public/`;
3. conservar en memoria la revisión cargada durante la navegación;
4. intentar actualizaciones posteriores mediante la API sin descartar el snapshot si esa verificación falla.

La regresión está cubierta por `tests/client-static-fallback.test.ts` y forma parte de `npm test`.

## Indicadores derivados

Según el producto, el sistema calcula:

- variación mensual;
- variación en doce meses;
- variación acumulada;
- incidencias;
- tasas y proporciones;
- índices desestacionalizados;
- tendencia-ciclo;
- agregaciones territoriales o de productos.

## Archivos iniciales

Los archivos de `public/` son conjuntos agregados publicados y preparados para la primera carga o continuidad degradada. Deben actualizarse mediante los transformadores correspondientes, validarse contra la fuente oficial y revisarse antes de cada commit.

## Regla de actualización

Una fuente se reprocesa cuando cambia la firma utilizada por su transformador. Si la fuente no responde, se sirve la última revisión válida disponible —D1 o snapshot, según el producto— y no se sustituye una revisión validada por una descarga incompleta.
