import { NextRequest, NextResponse } from "next/server";
import { parseEconomicWorkbook, type EconomicKind } from "../../../lib/economic-data";

const config: Record<EconomicKind, { root: string; prefix: string }> = {
  energy: {
    root: "https://www.ine.gob.cl/docs/default-source/produccion-de-electricidad-gas-y-agua/cuadros-estadisticos/base-promedio-2018-100/",
    prefix: "series-empalmadas-y-mensuales-a-",
  },
  industry: {
    root: "https://www.ine.gob.cl/docs/default-source/indice-de-produccion-industrial/cuadros-estadisticos/base-promedio-2018-100/",
    prefix: "series-empalmadas-y-mensuales-a-",
  },
  permits: {
    root: "https://www.ine.gob.cl/docs/default-source/permisos-de-edificacion/cuadros-estadisticos/series-mensuales/",
    prefix: "series-históricas-a-",
  },
  commerce: {
    root: "https://www.ine.gob.cl/docs/default-source/actividad-mensual-del-comercio/cuadros-estadisticos/base-promedio-año-2018-100/",
    prefix: "series-empalmadas-históricas.xlsx",
  },
};
const names = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const candidates = (kind: EconomicKind) => {
  // Comercio mantiene una URL estable; ETag, fecha, tamaño y hash detectan
  // actualizaciones aunque Sitefinity conserve el nombre del archivo.
  if (kind === "commerce") return [`${config[kind].root}${config[kind].prefix}`];

  // Los productos coyunturales han usado históricamente .xls. También se
  // prueba .xlsx para que un cambio de formato de publicación no deje la ruta
  // permanentemente en modo stale si el contenido continúa siendo compatible.
  const now = new Date();
  const result: string[] = [];
  for (let offset = 0; offset < 18; offset++) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
    );
    const base = `${config[kind].root}${config[kind].prefix}${names[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
    result.push(`${base}.xls`, `${base}.xlsx`);
  }
  return result;
};

async function discover(kind: EconomicKind) {
  for (const url of candidates(kind)) {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "user-agent": "INE-Relatos/1.0" },
    });
    if (response.ok)
      return {
        url,
        lastModified: response.headers.get("last-modified"),
        etag: response.headers.get("etag"),
        size: response.headers.get("content-length"),
      };
  }
  throw new Error("No se encontró una planilla oficial reciente");
}

async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") as EconomicKind;
  if (!config[kind])
    return NextResponse.json({ error: "Tema inválido" }, { status: 400 });

  const db = (globalThis as typeof globalThis & { __SITES_DB?: D1Database })
    .__SITES_DB;
  if (!db)
    return NextResponse.json(
      { error: "La caché compartida aún no está disponible" },
      { status: 503 },
    );

  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS economic_source_cache (kind TEXT PRIMARY KEY, source_url TEXT NOT NULL, source_last_modified TEXT, source_etag TEXT, source_size TEXT, payload_json TEXT NOT NULL, checked_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    )
    .run();
  try {
    await db
      .prepare("ALTER TABLE economic_source_cache ADD COLUMN source_hash TEXT")
      .run();
  } catch {}

  const cached = await db
    .prepare("SELECT * FROM economic_source_cache WHERE kind = ?")
    .bind(kind)
    .first<Record<string, string>>();
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (cached && !refresh)
    return NextResponse.json(
      {
        ...JSON.parse(cached.payload_json),
        source: {
          url: cached.source_url,
          lastModified: cached.source_last_modified,
          checkedAt: cached.checked_at,
          cache: "cached",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Server-Timing": "data;desc=shared-cache",
        },
      },
    );

  try {
    const source = await discover(kind);
    const file = await fetch(source.url, {
      headers: { "user-agent": "INE-Relatos/1.0" },
    });
    if (!file.ok) throw new Error("No fue posible descargar la planilla");

    const bytes = await file.arrayBuffer();
    const hash = await sha256(bytes);
    const unchanged = Boolean(
      cached && cached.source_url === source.url && cached.source_hash === hash,
    );
    const now = new Date().toISOString();

    if (unchanged) {
      await db
        .prepare("UPDATE economic_source_cache SET checked_at = ? WHERE kind = ?")
        .bind(now, kind)
        .run();
      return NextResponse.json(
        {
          ...JSON.parse(cached.payload_json),
          source: {
            url: source.url,
            lastModified: source.lastModified,
            checkedAt: now,
            cache: "shared",
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const payload = parseEconomicWorkbook(bytes, kind);
    await db
      .prepare(
        "INSERT INTO economic_source_cache (kind,source_url,source_last_modified,source_etag,source_size,source_hash,payload_json,checked_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(kind) DO UPDATE SET source_url=excluded.source_url,source_last_modified=excluded.source_last_modified,source_etag=excluded.source_etag,source_size=excluded.source_size,source_hash=excluded.source_hash,payload_json=excluded.payload_json,checked_at=excluded.checked_at,updated_at=excluded.updated_at",
      )
      .bind(
        kind,
        source.url,
        source.lastModified,
        source.etag,
        source.size,
        hash,
        JSON.stringify(payload),
        now,
        now,
      )
      .run();

    return NextResponse.json(
      {
        ...payload,
        source: {
          url: source.url,
          lastModified: source.lastModified,
          checkedAt: now,
          cache: "updated",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (cached)
      return NextResponse.json(
        {
          ...JSON.parse(cached.payload_json),
          source: {
            url: cached.source_url,
            lastModified: cached.source_last_modified,
            checkedAt: cached.checked_at,
            cache: "stale",
          },
        },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Data-Warning": "stale",
          },
        },
      );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error de datos" },
      { status: 503 },
    );
  }
}
