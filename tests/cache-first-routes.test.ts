import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

const originalFetch = globalThis.fetch;
const responseJson = async (response: Response) =>
  JSON.parse(await response.text());

function database(firstRow: unknown, allRows: unknown[] = []) {
  return {
    prepare(sql: string) {
      const statement = {
        args: [] as unknown[],
        bind(...args: unknown[]) {
          this.args = args;
          return this;
        },
        async run() {
          return {};
        },
        async first() {
          return sql.startsWith("SELECT") ? firstRow : null;
        },
        async all() {
          return { results: allRows };
        },
      };
      return statement;
    },
  };
}

const supermarketRows = () => [
  {
    part: "meta",
    payload: JSON.stringify({
      kind: "supermarkets",
      base: "2018",
      territories: [],
    }),
  },
  ...Array.from({ length: 17 }, (_, i) => ({
    part: `index:${i}`,
    payload: "[]",
  })),
  ...["sales", "stores", "area"].map((name) => ({
    part: `matrix:${name}`,
    payload: JSON.stringify({ territories: [], seriesByTerritory: {} }),
  })),
];

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  delete (globalThis as typeof globalThis & { __SITES_DB?: unknown })
    .__SITES_DB;
});

test("Supermercados responde desde D1 antes de consultar al INE", async () => {
  let externalCalls = 0;
  globalThis.fetch = async () => {
    externalCalls++;
    throw new Error("No debe consultar la fuente en la fase caché");
  };
  (globalThis as typeof globalThis & { __SITES_DB?: unknown }).__SITES_DB =
    database(
      {
        cache_key: "k",
        etag: "hash",
        checked_at: "now",
        updated_at: "now",
      },
      supermarketRows(),
    );
  const { GET } = await import("../app/api/supermarkets-data/route");
  const response = await GET(
    new NextRequest("http://test/api/supermarkets-data"),
  );
  assert.equal(response.status, 200);
  assert.equal((await responseJson(response)).source.cache, "cached");
  assert.equal(externalCalls, 0);
});

test("Supermercados conserva la última revisión si falla la fuente", async () => {
  let externalCalls = 0;
  globalThis.fetch = async () => {
    externalCalls++;
    throw new Error("Fuente temporalmente no disponible");
  };
  (globalThis as typeof globalThis & { __SITES_DB?: unknown }).__SITES_DB =
    database(
      {
        cache_key: "k",
        etag: "hash",
        checked_at: "2026-09-10T08:00:00.000Z",
        updated_at: "2026-09-10T08:00:00.000Z",
      },
      supermarketRows(),
    );
  const { GET } = await import("../app/api/supermarkets-data/route");
  const response = await GET(
    new NextRequest("http://test/api/supermarkets-data?refresh=1"),
  );
  const payload = await responseJson(response);
  assert.equal(response.status, 200);
  assert.equal(payload.source.cache, "stale");
  assert.equal(response.headers.get("X-Data-Warning"), "stale");
  assert.equal(externalCalls, 1);
});

test("Turismo responde desde D1 antes de consultar al INE", async () => {
  let externalCalls = 0;
  globalThis.fetch = async () => {
    externalCalls++;
    throw new Error("No debe consultar la fuente en la fase caché");
  };
  const sheets = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "16",
    "22",
    "25",
    "28",
    "31",
  ].map((sheet) => ({ sheet, payload_json: "{}" }));
  (globalThis as typeof globalThis & { __SITES_DB?: unknown }).__SITES_DB =
    database({ cache_key: "k", checked_at: "now" }, sheets);
  const { GET } = await import("../app/api/tourism-data/route");
  const response = await GET(new NextRequest("http://test/api/tourism-data"));
  assert.equal(response.status, 200);
  assert.equal((await responseJson(response)).source.cache, "cached");
  assert.equal(externalCalls, 0);
});

test("Comercio responde desde D1 antes de consultar al INE", async () => {
  let externalCalls = 0;
  globalThis.fetch = async () => {
    externalCalls++;
    throw new Error("No debe consultar la fuente en la fase caché");
  };
  (globalThis as typeof globalThis & { __SITES_DB?: unknown }).__SITES_DB =
    database({
      payload_json: JSON.stringify({ kind: "commerce" }),
      source_url: "source",
      source_last_modified: "date",
      checked_at: "now",
    });
  const { GET } = await import("../app/api/economic-data/route");
  const response = await GET(
    new NextRequest("http://test/api/economic-data?kind=commerce"),
  );
  assert.equal(response.status, 200);
  assert.equal((await responseJson(response)).source.cache, "cached");
  assert.equal(externalCalls, 0);
});

test("IPP responde desde D1 antes de consultar al INE", async () => {
  let externalCalls = 0;
  globalThis.fetch = async () => {
    externalCalls++;
    throw new Error("No debe consultar la fuente en la fase caché");
  };
  (globalThis as typeof globalThis & { __SITES_DB?: unknown }).__SITES_DB =
    database({
      payload_json: JSON.stringify({
        data: { updated: "Mayo 2026", industries: [] },
        divisions: [],
      }),
      source_url: "[]",
      source_last_modified: "date",
      source_etag: "old",
      checked_at: "now",
      updated_at: "now",
    });
  const { GET } = await import("../app/api/ipp-data/route");
  const response = await GET(new NextRequest("http://test/api/ipp-data"));
  assert.equal(response.status, 200);
  assert.equal((await responseJson(response)).cache.status, "cached");
  assert.equal(externalCalls, 0);
});

test("IPP comprueba la fuente como máximo una vez por día", async () => {
  let externalCalls = 0;
  globalThis.fetch = async () => {
    externalCalls++;
    throw new Error("No debe repetir la comprobación diaria");
  };
  const now = new Date().toISOString();
  (globalThis as typeof globalThis & { __SITES_DB?: unknown }).__SITES_DB =
    database({
      payload_json: JSON.stringify({
        data: { updated: "Junio de 2026", industries: [] },
        divisions: [],
      }),
      source_url: "[]",
      source_last_modified: "date",
      source_etag: "ipp-cache-first-v2",
      checked_at: now,
      updated_at: now,
    });
  const { GET } = await import("../app/api/ipp-data/route");
  const response = await GET(
    new NextRequest("http://test/api/ipp-data?refresh=1"),
  );
  assert.equal(response.status, 200);
  assert.equal((await responseJson(response)).cache.status, "shared");
  assert.equal(externalCalls, 0);
});
