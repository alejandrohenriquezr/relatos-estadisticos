# Deuda técnica registrada

## Estado del análisis estático

El saneamiento realizado el 10 de septiembre de 2026 eliminó los errores que impedían convertir ESLint en control de aceptación. El workflow `.github/workflows/ci.yml` ejecuta ahora `npm run lint` como paso **bloqueante**: cualquier error hace fallar la revisión.

Las correcciones incluyeron:

- eliminación de actualizaciones sincrónicas de estado dentro de efectos donde no correspondían;
- refactorización del hook de animación para no leer ni escribir referencias React durante el renderizado;
- tipado explícito en transformaciones SDMX;
- exclusión del bundle XLSX vendorizado del análisis de código propio;
- corrección del acceso a colecciones ENE opcionales durante SSR;
- navegación interna mediante `Link`.

## Observaciones no bloqueantes

Pueden permanecer advertencias de ESLint que no alteran la corrección del build, principalmente relacionadas con optimización de imágenes, dependencias de efectos y variables heredadas del cliente integrado de Demografía de empresas. Estas advertencias deben reducirse cuando se intervengan esos componentes, pero no deben ocultarse mediante `continue-on-error` ni reglas globales que silencien errores.

## Criterio de aceptación vigente

Una revisión desplegable debe superar, como mínimo:

1. `python3 scripts/check-repository-integrity.py`;
2. `npm run lint` sin errores;
3. `npm test`, que incluye build, render SSR, rutas de caché, fallback estático y contratos MCP/SDMX;
4. revisión de secretos en GitHub Actions.

Las futuras correcciones deben mantener estos controles como bloqueantes y agregar pruebas de regresión cuando cambien rutas de datos, caché, navegación o comportamiento de los relatos.
