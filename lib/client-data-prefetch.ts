export type PrefetchKey = "commerce" | "tourism" | "supermarkets";

const endpoints: Record<PrefetchKey, string> = {
  commerce: "/api/economic-data?kind=commerce",
  tourism: "/api/tourism-data",
  supermarkets: "/api/supermarkets-data",
};

const staticSnapshots: Record<PrefetchKey, string> = {
  commerce: "/commerce-data.json",
  tourism: "/tourism-data.json",
  supermarkets: "/supermarkets-data.json",
};

const officialSources: Record<PrefetchKey, string> = {
  commerce:
    "https://www.ine.gob.cl/docs/default-source/actividad-mensual-del-comercio/cuadros-estadisticos/base-promedio-año-2018-100/series-empalmadas-históricas.xlsx",
  tourism:
    "https://www.ine.gob.cl/docs/default-source/actividad-del-turismo/cuadros-estadisticos-dos/serie-histórica-metodología-2017/series-mensuales-de-julio-2016-a-la-fecha.xlsx",
  supermarkets:
    "https://www.ine.gob.cl/docs/default-source/ventas-de-supermercados/cuadros-estadisticos/base-promedio-a%C3%B1o-2018-100/series-mensuales-desde-enero-de-2018-a-la-fecha.xls",
};

const values = new Map<PrefetchKey, unknown>(),
  pending = new Map<PrefetchKey, Promise<unknown>>();

async function request(url: string) {
  const response = await fetch(url, { cache: "no-store" }),
    payload = await response.json();
  if (!response.ok)
    throw new Error(payload.error ?? "No fue posible cargar los datos");
  return payload;
}

async function requestStaticSnapshot(key: PrefetchKey) {
  const response = await fetch(staticSnapshots[key], { cache: "no-store" });
  if (!response.ok)
    throw new Error(`No fue posible cargar el snapshot estático de ${key}`);
  const payload = await response.json();
  return {
    ...payload,
    source: {
      ...(payload.source ?? {}),
      url: payload.source?.url ?? officialSources[key],
      cache: "static",
      checkedAt: payload.source?.checkedAt ?? null,
    },
  };
}

export function peekDataset<T = unknown>(key: PrefetchKey): T | undefined {
  return values.get(key) as T | undefined;
}

export function primeDataset<T = unknown>(key: PrefetchKey): Promise<T> {
  const existing = values.get(key);
  if (existing) return Promise.resolve(existing as T);

  const running = pending.get(key);
  if (running) return running as Promise<T>;

  // D1/API es la primera opción. Una clonación local o una caída de la caché
  // compartida recurre al último snapshot oficial versionado en public/.
  const promise = request(endpoints[key])
    .catch(() => requestStaticSnapshot(key))
    .then((payload) => {
      values.set(key, payload);
      pending.delete(key);
      return payload;
    })
    .catch((error) => {
      pending.delete(key);
      throw error;
    });

  pending.set(key, promise);
  return promise as Promise<T>;
}

export async function refreshDataset<T = unknown>(
  key: PrefetchKey,
): Promise<T | undefined> {
  const separator = endpoints[key].includes("?") ? "&" : "?";
  try {
    const payload = await request(`${endpoints[key]}${separator}refresh=1`);
    if (payload.source?.cache === "updated") {
      values.set(key, payload);
      return payload as T;
    }
  } catch {
    // Si la API/D1 no está disponible se conserva el snapshot ya cargado.
  }
  return undefined;
}
