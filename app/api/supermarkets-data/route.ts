import { NextRequest, NextResponse } from "next/server";
import { parseSupermarketsWorkbook } from "../../../lib/supermarkets-data";
import { sha256 } from "../../../lib/source-hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sourceUrl =
  "https://www.ine.gob.cl/docs/default-source/ventas-de-supermercados/cuadros-estadisticos/base-promedio-a%C3%B1o-2018-100/series-mensuales-desde-enero-de-2018-a-la-fecha.xls";

const responseHeaders = { "Cache-Control": "no-store" };

type Meta = {
  etag: string;
  last_modified: string | null;
  size: string | null;
  cache_key: string;
  checked_at: string;
  updated_at: string;
};

type StoredPart = { part: string; payload: string };

/**
 * Reconstruye la respuesta desde las partes guardadas en D1.
 * El payload se fragmenta porque las matrices regionales completas pueden
 * superar el tamaño conveniente de una única celda SQLite/D1.
 */
async function load(db: D1Database, key: string) {
  const result = await db
    .prepare(
      "SELECT part,payload FROM supermarkets_payload_v1 WHERE cache_key=? ORDER BY part",
    )
    .bind(key)
    .all<StoredPart>();

  // meta + 17 índices territoriales + 3 matrices = 21 partes como mínimo.
  if (result.results.length < 21) return null;

  const rows = Object.fromEntries(
    result.results.map((row) => [row.part, JSON.parse(row.payload)]),
  );
  const meta = rows.meta as {
    kind: string;
    base: string;
    territories: string[];
  };
  const indexByTerritory = Object.fromEntries(
    Object.entries(rows)
      .filter(([part]) => part.startsWith("index:"))
      .map(([part, value]) => [part.slice(6), value]),
  );
  const matrices = Object.fromEntries(
    Object.entries(rows)
      .filter(([part]) => part.startsWith("matrix:"))
      .map(([part, value]) => [part.slice(7), value]),
  );

  return { ...meta, indexByTerritory, matrices };
}

function withSource(
  payload: Record<string, unknown>,
  status: "cached" | "shared" | "updated" | "stale",
  checkedAt: string,
) {
  return {
    ...payload,
    source: { url: sourceUrl, cache: status, checkedAt },
  };
}

export async function GET(request: NextRequest) {
  const db = (globalThis as typeof globalThis & { __SITES_DB?: D1Database })
    .__SITES_DB;
  if (!db)
    return NextResponse.json(
      { error: "La caché compartida no está disponible" },
      { status: 503, headers: responseHeaders },
    );

  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS supermarkets_meta_v1 (id TEXT PRIMARY KEY, etag TEXT, last_modified TEXT, size TEXT, cache_key TEXT, checked_at TEXT, updated_at TEXT)",
    )
    .run();
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS supermarkets_payload_v1 (cache_key TEXT, part TEXT, payload TEXT, PRIMARY KEY(cache_key,part))",
    )
    .run();

  const cached = await db
    .prepare("SELECT * FROM supermarkets_meta_v1 WHERE id='supermarkets'")
    .first<Meta>();
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  // Primera fase: sirve D1 sin consultar al INE.
  if (cached && !refresh) {
    const payload = await load(db, cached.cache_key);
    if (payload)
      return NextResponse.json(
        withSource(payload, "cached", cached.checked_at),
        {
          headers: {
            ...responseHeaders,
            "Server-Timing": "data;desc=shared-cache",
          },
        },
      );
  }

  try {
    const now = new Date().toISOString();
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: { "user-agent": "INE-Relatos/1.0" },
    });
    if (!response.ok) throw new Error(`Fuente INE: ${response.status}`);

    const bytes = await response.arrayBuffer();
    const hash = await sha256(bytes);

    if (cached && cached.etag === hash) {
      const payload = await load(db, cached.cache_key);
      if (payload) {
        await db
          .prepare(
            "UPDATE supermarkets_meta_v1 SET checked_at=? WHERE id='supermarkets'",
          )
          .bind(now)
          .run();
        return NextResponse.json(withSource(payload, "shared", now), {
          headers: responseHeaders,
        });
      }
    }

    const payload = parseSupermarketsWorkbook(bytes);
    const key = now.replace(/\D/g, "");
    const parts: Record<string, unknown> = {
      meta: {
        kind: payload.kind,
        base: payload.base,
        territories: payload.territories,
      },
    };
    for (const [name, value] of Object.entries(payload.indexByTerritory))
      parts[`index:${name}`] = value;
    for (const [name, value] of Object.entries(payload.matrices))
      parts[`matrix:${name}`] = value;

    // La metadata se cambia sólo después de escribir todas las partes nuevas.
    for (const [part, value] of Object.entries(parts))
      await db
        .prepare(
          "INSERT INTO supermarkets_payload_v1(cache_key,part,payload) VALUES(?,?,?)",
        )
        .bind(key, part, JSON.stringify(value))
        .run();

    await db
      .prepare(
        "INSERT INTO supermarkets_meta_v1 VALUES('supermarkets',?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET etag=excluded.etag,last_modified=excluded.last_modified,size=excluded.size,cache_key=excluded.cache_key,checked_at=excluded.checked_at,updated_at=excluded.updated_at",
      )
      .bind(hash, null, String(bytes.byteLength), key, now, now)
      .run();
    await db
      .prepare("DELETE FROM supermarkets_payload_v1 WHERE cache_key<>?")
      .bind(key)
      .run();

    return NextResponse.json(
      withSource(payload as unknown as Record<string, unknown>, "updated", now),
      { headers: responseHeaders },
    );
  } catch (error) {
    // Una caída o cambio incompatible de la fuente no debe borrar la última
    // revisión válida disponible para el sitio.
    if (cached) {
      const payload = await load(db, cached.cache_key);
      if (payload)
        return NextResponse.json(
          withSource(payload, "stale", cached.checked_at),
          {
            headers: {
              ...responseHeaders,
              "X-Data-Warning": "stale",
            },
          },
        );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible cargar las series",
      },
      { status: 503, headers: responseHeaders },
    );
  }
}
