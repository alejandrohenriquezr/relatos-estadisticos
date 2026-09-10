import assert from "node:assert/strict";
import test from "node:test";
import {
  primeDataset,
  refreshDataset,
  type PrefetchKey,
} from "../lib/client-data-prefetch";

const originalFetch = globalThis.fetch;

test.after(() => {
  globalThis.fetch = originalFetch;
});

test("Servicios usa snapshots públicos si D1/API no está disponible", async () => {
  const staticPaths: Record<PrefetchKey, string> = {
    commerce: "/commerce-data.json",
    tourism: "/tourism-data.json",
    supermarkets: "/supermarkets-data.json",
  };
  const calls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    const key = (Object.keys(staticPaths) as PrefetchKey[]).find(
      (candidate) => staticPaths[candidate] === url,
    );
    if (key)
      return Response.json({ kind: key, payload: "snapshot" }, { status: 200 });
    return Response.json(
      { error: "La caché compartida aún no está disponible" },
      { status: 503 },
    );
  };

  for (const key of Object.keys(staticPaths) as PrefetchKey[]) {
    const payload = await primeDataset<{
      kind: string;
      source: { cache: string; url: string };
    }>(key);
    assert.equal(payload.kind, key);
    assert.equal(payload.source.cache, "static");
    assert.match(payload.source.url, /^https:\/\/www\.ine\.gob\.cl\//);
    assert.ok(calls.includes(staticPaths[key]));
  }
});

test("Una falla de actualización conserva el snapshot ya cargado", async () => {
  globalThis.fetch = async () => {
    throw new Error("D1 no disponible");
  };
  assert.equal(await refreshDataset("commerce"), undefined);
});
