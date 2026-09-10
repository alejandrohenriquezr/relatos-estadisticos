import { NextRequest, NextResponse } from "next/server";
import { parsePoliceWorkbook, POLICE_SOURCE } from "../../../lib/police-official-data";
import { combinedSha256 } from "../../../lib/source-hash";

const KIND = "police";
const responseHeaders = { "Cache-Control": "no-store" };

/**
 * Verifica metadatos de la fuente oficial antes de descargarla. La API usa un
 * único libro anual porque desde 2025 el INE publica en ese archivo las 42
 * hojas de Carabineros y PDI.
 */
async function inspect(url: string) {
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
    headers: { "user-agent": "INE-Relatos/1.0" },
  });
  if (!response.ok)
    throw new Error("No fue posible verificar la planilla policial oficial");
  return {
    url,
    lastModified: response.headers.get("last-modified"),
    etag: response.headers.get("etag"),
    size: response.headers.get("content-length"),
  };
}

export async function GET(request: NextRequest) {
  const db = (globalThis as typeof globalThis & { __SITES_DB?: D1Database })
    .__SITES_DB;
  if (!db)
    return NextResponse.json(
      { error: "La caché compartida aún no está disponible" },
      { status: 503, headers: responseHeaders },
    );

  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS economic_source_cache (kind TEXT PRIMARY KEY, source_url TEXT NOT NULL, source_last_modified TEXT, source_etag TEXT, source_size TEXT, payload_json TEXT NOT NULL, checked_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    )
    .run();

  const cached = await db
    .prepare("SELECT * FROM economic_source_cache WHERE kind = ?")
    .bind(KIND)
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
      { headers: responseHeaders },
    );

  try {
    const source = await inspect(POLICE_SOURCE);
    const response = await fetch(source.url, {
      headers: { "user-agent": "INE-Relatos/1.0" },
    });
    if (!response.ok)
      throw new Error("No fue posible descargar la planilla policial oficial");

    const file = await response.arrayBuffer();
    const signature = await combinedSha256([file]);
    const now = new Date().toISOString();

    if (cached?.source_last_modified === signature) {
      await db
        .prepare(
          "UPDATE economic_source_cache SET checked_at = ? WHERE kind = ?",
        )
        .bind(now, KIND)
        .run();
      return NextResponse.json(
        {
          ...JSON.parse(cached.payload_json),
          cache: {
            status: "shared",
            checkedAt: now,
            updatedAt: cached.updated_at,
          },
        },
        { headers: responseHeaders },
      );
    }

    const payload = parsePoliceWorkbook(file);
    await db
      .prepare(
        "INSERT INTO economic_source_cache (kind,source_url,source_last_modified,source_etag,source_size,payload_json,checked_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(kind) DO UPDATE SET source_url=excluded.source_url,source_last_modified=excluded.source_last_modified,source_etag=excluded.source_etag,source_size=excluded.source_size,payload_json=excluded.payload_json,checked_at=excluded.checked_at,updated_at=excluded.updated_at",
      )
      .bind(
        KIND,
        POLICE_SOURCE,
        signature,
        source.etag,
        source.size,
        JSON.stringify(payload),
        now,
        now,
      )
      .run();

    return NextResponse.json(
      {
        ...payload,
        cache: { status: "updated", checkedAt: now, updatedAt: now },
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    if (cached)
      return NextResponse.json(JSON.parse(cached.payload_json), {
        headers: { ...responseHeaders, "X-Data-Warning": "stale" },
      });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error de datos" },
      { status: 503, headers: responseHeaders },
    );
  }
}
