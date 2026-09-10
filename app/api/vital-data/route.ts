import { NextRequest, NextResponse } from "next/server";
import { parseVitalStatistics } from "../../../lib/vital-statistics-data";
import { sha256 } from "../../../lib/source-hash";

const source =
  "https://www.ine.gob.cl/docs/default-source/nacimientos-matrimonios-y-defunciones/cuadros-estadisticos/series-hist%C3%B3ricas/series-vitales-1992-2024(p).xlsx";

export async function GET(request: NextRequest) {
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
  const cached = await db
    .prepare("SELECT * FROM economic_source_cache WHERE kind = ?")
    .bind("vital-statistics")
    .first<Record<string, string>>();
  if (cached && request.nextUrl.searchParams.get("refresh") !== "1")
    return NextResponse.json(
      {
        ...JSON.parse(cached.payload_json),
        cache: {
          status: "cached",
          checkedAt: cached.checked_at,
          updatedAt: cached.updated_at,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  try {
    const now = new Date().toISOString();
    const download = await fetch(source, {
      redirect: "follow",
      headers: { "user-agent": "INE-Relatos/1.0" },
    });
    if (!download.ok) throw new Error("No fue posible descargar la fuente");
    const bytes = await download.arrayBuffer();
    const hash = await sha256(bytes);
    const metadata = { url: source, hash };
    if (cached?.source_last_modified === hash) {
      await db
        .prepare(
          "UPDATE economic_source_cache SET checked_at = ? WHERE kind = ?",
        )
        .bind(now, "vital-statistics")
        .run();
      return NextResponse.json(
        {
          ...JSON.parse(cached.payload_json),
          source: metadata,
          cache: {
            status: "shared",
            checkedAt: now,
            updatedAt: cached.updated_at,
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const payload = parseVitalStatistics(bytes);
    await db
      .prepare(
        "INSERT INTO economic_source_cache (kind,source_url,source_last_modified,source_etag,source_size,payload_json,checked_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(kind) DO UPDATE SET source_url=excluded.source_url,source_last_modified=excluded.source_last_modified,source_etag=excluded.source_etag,source_size=excluded.source_size,payload_json=excluded.payload_json,checked_at=excluded.checked_at,updated_at=excluded.updated_at",
      )
      .bind(
        "vital-statistics",
        source,
        hash,
        null,
        String(bytes.byteLength),
        JSON.stringify(payload),
        now,
        now,
      )
      .run();
    return NextResponse.json(
      {
        ...payload,
        source: metadata,
        cache: { status: "updated", checkedAt: now, updatedAt: now },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (cached)
      return NextResponse.json(
        {
          ...JSON.parse(cached.payload_json),
          source: cached.source_url,
          cache: {
            status: "stale",
            checkedAt: cached.checked_at,
            updatedAt: cached.updated_at,
          },
        },
        {
          headers: { "Cache-Control": "no-store", "X-Data-Warning": "stale" },
        },
      );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error de datos de estadísticas vitales",
      },
      { status: 503 },
    );
  }
}
