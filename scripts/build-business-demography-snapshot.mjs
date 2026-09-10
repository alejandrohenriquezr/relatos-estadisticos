#!/usr/bin/env node
/**
 * Reconstruye una instantánea SDMX mínima y trazable de Demografía de empresas
 * a partir del HTML reproducible del proyecto fuente. No evalúa el JavaScript
 * de la página: extrae solamente objetos JSON asignados a constantes conocidas.
 */
import fs from "node:fs";
import path from "node:path";

const sourcePath = process.argv[2] ?? "public/demografia-empresas/index.html";
const outputPath = process.argv[3] ?? "public/sdmx/demografia-empresas-observations.json";
const html = fs.readFileSync(sourcePath, "utf8");

function extractJsonAssignment(name) {
  const marker = `const ${name} =`;
  const startMarker = html.indexOf(marker);
  if (startMarker < 0) throw new Error(`No se encontró ${name} en ${sourcePath}`);
  let start = startMarker + marker.length;
  while (/\s/.test(html[start] ?? "")) start += 1;
  const opener = html[start];
  const closer = opener === "{" ? "}" : opener === "[" ? "]" : null;
  if (!closer) throw new Error(`Asignación no JSON para ${name}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"') {
      quote = char;
      continue;
    }
    if (char === opener) depth += 1;
    else if (char === closer) {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(start, index + 1));
    }
  }
  throw new Error(`Asignación incompleta para ${name}`);
}

const observations = [];
const add = (record) => {
  const value = Number(record.obs_value);
  if (!Number.isFinite(value)) return;
  observations.push({
    ref_area: String(record.ref_area ?? "CL"),
    indicator: String(record.indicator),
    time_period: String(record.time_period ?? "2025"),
    obs_value: value,
    ...(record.activity ? {activity: String(record.activity)} : {}),
    ...(record.size_sales ? {size_sales: String(record.size_sales)} : {}),
    ...(record.size_workers ? {size_workers: String(record.size_workers)} : {}),
    ...(record.label ? {label: String(record.label)} : {}),
    ...(record.level ? {level: String(record.level)} : {}),
    ...(record.breakdown ? {breakdown: String(record.breakdown)} : {}),
  });
};

// Empresas activas por territorio.
const geo = extractJsonAssignment("geoData");
for (const [level, series] of Object.entries(geo)) {
  const codes = series.codes ?? [];
  const labels = series.x ?? [];
  const values = series.y ?? [];
  values.forEach((value, index) => {
    const code = codes[index];
    if (code == null || labels[index] == null) return;
    add({
      ref_area: level === "region" ? `CL-${code}` : `CL-${level.toUpperCase()}-${code}`,
      indicator: "EMPRESAS_ACTIVAS",
      time_period: "2025",
      obs_value: value,
      label: labels[index],
      level,
    });
  });
}

// Empresas activas por nivel CIIU.
const ciiu = extractJsonAssignment("ciiuData");
for (const [level, series] of Object.entries(ciiu)) {
  const codes = series.codes ?? [];
  const labels = series.labels ?? series.glosa ?? series.x ?? [];
  const values = series.y ?? [];
  values.forEach((value, index) => {
    const code = codes[index] ?? series.x?.[index];
    if (code == null) return;
    add({
      ref_area: "CL",
      activity: code,
      indicator: "EMPRESAS_ACTIVAS",
      time_period: "2025",
      obs_value: value,
      label: labels[index] ?? code,
      level: `CIIU_${level}`,
    });
  });
}

// Tamaño por trabajadores dependientes y por ventas.
for (const [constantName, dimension] of [["tamanoData", "workers"], ["ventasData", "sales"]]) {
  const data = extractJsonAssignment(constantName);
  const series = data.tamano ?? data;
  const codes = series.codes ?? [];
  const labels = series.x ?? [];
  const values = series.y ?? [];
  values.forEach((value, index) => add({
    ref_area: "CL",
    indicator: "EMPRESAS_ACTIVAS",
    time_period: "2025",
    obs_value: value,
    label: labels[index] ?? codes[index],
    ...(dimension === "workers" ? {size_workers: codes[index]} : {size_sales: codes[index]}),
    breakdown: dimension === "workers" ? "TAMANO_TRABAJADORES" : "ESTRATO_VENTAS",
  }));
}

// Recorre hojas analíticas anidadas que contienen un vector temporal y series.
function addTemporalLeaves(node, family, trail = []) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const periods = Array.isArray(node.anios) ? node.anios : null;
  if (periods) {
    for (const [key, values] of Object.entries(node)) {
      if (key === "anios" || !Array.isArray(values)) continue;
      values.forEach((value, index) => add({
        ref_area: "CL",
        indicator: `${family}_${key}`.toUpperCase(),
        time_period: periods[index],
        obs_value: value,
        label: trail.join(" / ") || "Total país",
        breakdown: trail.join("|") || "TOTAL",
      }));
    }
    return;
  }
  for (const [key, child] of Object.entries(node)) addTemporalLeaves(child, family, [...trail, key]);
}

addTemporalLeaves(extractJsonAssignment("tasasData"), "DEMOGRAFIA");
addTemporalLeaves(extractJsonAssignment("supervData"), "SUPERVIVENCIA");
addTemporalLeaves(extractJsonAssignment("altoCrecData"), "ALTO_CRECIMIENTO");

// Elimina duplicados exactos para mantener una salida estable entre ejecuciones.
const seen = new Set();
const unique = observations.filter((record) => {
  const key = JSON.stringify(record);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

if (unique.length < 100) throw new Error(`Snapshot empresarial demasiado pequeño: ${unique.length} observaciones`);
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify(unique, null, 2) + "\n", "utf8");
console.log(JSON.stringify({source: sourcePath, output: outputPath, observations: unique.length}));
