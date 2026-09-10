import { NextRequest, NextResponse } from "next/server";
import { parseIppOfficialFiles } from "../../../lib/ipp-official-data";

const sources = {
  industries:
    "https://www.ine.gob.cl/docs/default-source/indice-de-precios-de-productor/cuadros-estadisticos/base-anual-2019-100/industrias-xlsx.xlsx",
  mining:
    "https://www.ine.gob.cl/docs/default-source/indice-de-precios-de-productor/cuadros-estadisticos/base-anual-2019-100/miner%C3%ADa-xlsx.xlsx",
  ipdega:
    "https://www.ine.gob.cl/docs/default-source/indice-de-precios-de-productor/cuadros-estadisticos/base-anual-2019-100/ipdega-xlsx",
  manufacturing:
    "https://www.ine.gob.cl/docs/default-source/indice-de-precios-de-productor/cuadros-estadisticos/base-anual-2019-100/industria-manufacturera-xlsx.xlsx",
} as const;

type SourceKey = keyof typeof sources;
type CacheRow = Record<string, string>;

const headers = {
  "Cache-Control": "no-store",
  "Server-Timing": "data;desc=shared-cache",
};

const monthLabel = (value: string) => {
  const [month, year] = value.split("-").map(Number);
  if (!month || !year) return value;
  const label = new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label[0].toUpperCase() + label.slice(1);
};

// Compara días calendario de Chile para no consultar varias veces la misma
// fuente oficial dentro de una jornada, aunque el Worker opere internamente en UTC.
const chileDay = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Santiago",
  }).format(date);
};

const cachedResponse = (
  cached: CacheRow,
  status: "cached" | "shared" | "stale",
  checkedAt = cached.checked_at,
) =>
  NextResponse.json(
    {
      ...JSON.parse(cached.payload_json),
      sources: JSON.parse(cached.source_url),
      cache: {
        status,
        checkedAt,
        updatedAt: cached.updated_at,
      },
    },
    {
      headers: {
        ...headers,
        ...(status === "stale" ? { "X-Data-Warning": "stale" } : {}),
      },
    },
  );

async function downloadSource(key: SourceKey, refreshToken: string) {
  const url = new URL(sources[key]);
  // Sitefinity usa URLs estables. El parámetro evita reutilizar una respuesta
  // intermedia antigua cuando el archivo fue reemplazado conservando su nombre.
  url.searchParams.set("_ine_refresh", refreshToken);
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "cache-control": "no-cache",
      pragma: "no-cache",
      "user-agent": "INE-Relatos/1.0",
    },
  });
  if (!response.ok) throw new Error(`No fue posible descargar ${key}`);
  return {
    key,
    url: sources[key],
    lastModified: response.headers.get("last-modified"),
    etag: response.headers.get("etag"),
    size: response.headers.get("content-length"),
    buffer: await response.arrayBuffer(),
  };
}

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
    .bind("ipp")
    .first<CacheRow>();
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  // Primera fase: nunca se consulta ine.gob.cl. La respuesta almacenada se
  // entrega inmediatamente y la interfaz inicia luego la segunda fase.
  if (cached && !refresh) return cachedResponse(cached, "cached");

  const now = new Date();
  const nowIso = now.toISOString();

  // La segunda fase puede ser solicitada varias veces por clientes distintos.
  // Si la fuente ya fue comprobada durante el mismo día en Chile, se reutiliza
  // la caché compartida y se evita una nueva descarga desde ine.gob.cl.
  if (cached && chileDay(cached.checked_at) === chileDay(now))
    return cachedResponse(cached, "shared");

  try {
    const downloads = await Promise.all(
      (Object.keys(sources) as SourceKey[]).map((key) =>
        downloadSource(key, String(now.getTime())),
      ),
    );
    const sourceHash = await crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(downloads.flatMap(({ buffer }) => Array.from(new Uint8Array(buffer)))),
    );
    const hash = Array.from(new Uint8Array(sourceHash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    if (cached?.source_etag === hash)
      return cachedResponse(cached, "shared", nowIso);
    const payload = parseIppOfficialFiles(
      Object.fromEntries(
        downloads.map(({ key, buffer }) => [key, buffer]),
      ) as Record<SourceKey, ArrayBuffer>,
    );
    payload.data.updated = monthLabel(payload.data.updated);

    const latest = payload.data.industries.at(-1);
    if (!latest)
      throw new Error("La planilla oficial no contiene períodos válidos");

    const metadata = downloads.map(
      ({ key, url, lastModified, etag, size }) => ({
        key,
        url,
        lastModified,
        etag,
        size,
      }),
    );
    const signature = JSON.stringify(
      metadata.map(({ key, lastModified, etag, size }) => ({
        key,
        lastModified,
        etag,
        size,
      })),
    );

    await db
      .prepare(
        "INSERT INTO economic_source_cache (kind,source_url,source_last_modified,source_etag,source_size,payload_json,checked_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(kind) DO UPDATE SET source_url=excluded.source_url,source_last_modified=excluded.source_last_modified,source_etag=excluded.source_etag,source_size=excluded.source_size,payload_json=excluded.payload_json,checked_at=excluded.checked_at,updated_at=excluded.updated_at",
      )
      .bind(
        "ipp",
        JSON.stringify(metadata),
        signature,
        hash,
        String(
          downloads.reduce((total, item) => total + Number(item.size || 0), 0),
        ),
        JSON.stringify(payload),
        nowIso,
        nowIso,
      )
      .run();

    return NextResponse.json(
      {
        ...payload,
        sources: metadata,
        cache: { status: "updated", checkedAt: nowIso, updatedAt: nowIso },
      },
      { headers },
    );
  } catch (error) {
    if (cached) return cachedResponse(cached, "stale");
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error de datos del IPP",
      },
      { status: 503 },
    );
  }
}
