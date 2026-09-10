export const IPC_DATAFLOW = "INE.GOB.CL,DF_IPC,1.0/all";
export const IPP_DATAFLOW = "INE.GOB.CL,DF_IPP,1.0/all";

export const PRICE_COLUMNS = [
  "STRUCTURE",
  "STRUCTURE_ID",
  "ACTION",
  "FREQ",
  "DATASET",
  "REF_AREA",
  "BREAKDOWN",
  "CATEGORY",
  "INDICATOR",
  "TIME_PERIOD",
  "OBS_VALUE",
  "UNIT_MEASURE",
  "UNIT_MULT",
  "BASE_PERIOD",
  "EST_QUALITY",
  "SOURCE",
] as const;

export type PriceRow = Record<(typeof PRICE_COLUMNS)[number], string>;
// El payload normalizado reúne estructuras heterogéneas de varias operaciones.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const structures = {
  IPC: "INE.GOB.CL:DSD_IPC(1.0)",
  IPP: "INE.GOB.CL:DSD_IPP(1.0)",
} as const;

const safeCode = (value: unknown) =>
  String(value ?? "TOTAL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 90) || "TOTAL";

const unitFor = (indicator: string) =>
  indicator === "INDEX" || indicator === "WEIGHT"
    ? ["INDEX", "0"]
    : ["PERCENT", "0"];

const observation = (
  dataset: "IPC" | "IPP",
  breakdown: string,
  category: string,
  indicator: string,
  point: AnyRecord,
  value: unknown,
  basePeriod: string,
): PriceRow | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const [unit, multiplier] = unitFor(indicator);
  return {
    STRUCTURE: "dataflow",
    STRUCTURE_ID: structures[dataset],
    ACTION: "I",
    FREQ: "M",
    DATASET: dataset,
    REF_AREA: "CL",
    BREAKDOWN: breakdown,
    CATEGORY: safeCode(category),
    INDICATOR: indicator,
    TIME_PERIOD: `${point.year}-${String(point.month).padStart(2, "0")}`,
    OBS_VALUE: String(value),
    UNIT_MEASURE: unit,
    UNIT_MULT: multiplier,
    BASE_PERIOD: basePeriod,
    EST_QUALITY: "F",
    SOURCE: `Instituto Nacional de Estadísticas de Chile · ${dataset}`,
  };
};

const pushPoint = (
  rows: PriceRow[],
  dataset: "IPC" | "IPP",
  breakdown: string,
  category: string,
  point: AnyRecord,
  basePeriod: string,
  indicators: readonly string[],
) => {
  for (const indicator of indicators) {
    const value =
      point[
        indicator === "INDEX"
          ? "index"
          : indicator === "MONTHLY_CHANGE"
            ? "monthly"
            : indicator === "ACCUMULATED_CHANGE"
              ? "accumulated"
              : indicator === "ANNUAL_CHANGE"
                ? "annual"
                : indicator === "MONTHLY_INCIDENCE"
                  ? "monthlyIncidence"
                  : "weight"
      ];
    const row = observation(
      dataset,
      breakdown,
      category,
      indicator,
      point,
      value,
      basePeriod,
    );
    if (row) rows.push(row);
  }
};

export function buildIpcRows(payload: AnyRecord) {
  const data = payload.data?.series ? payload.data : payload;
  const analytics = payload.analytics?.series
    ? payload.analytics
    : { series: [] };
  const rows: PriceRow[] = [];

  // Series general y por divisiones CCIF presentes en la página del IPC.
  for (const point of data.series ?? []) {
    const breakdown = Number(point.division) === 0 ? "TOTAL" : "DIVISION";
    const category =
      breakdown === "TOTAL"
        ? "IPC_GENERAL"
        : `DIV_${point.division}_${point.label}`;
    pushPoint(
      rows,
      "IPC",
      breakdown,
      category,
      point,
      data.base || "2023=100",
      [
        "INDEX",
        "MONTHLY_CHANGE",
        "ACCUMULATED_CHANGE",
        "ANNUAL_CHANGE",
        "MONTHLY_INCIDENCE",
        "WEIGHT",
      ],
    );
  }

  // Los índices analíticos se incorporan como un desglose independiente.
  for (const point of analytics.series ?? []) {
    pushPoint(
      rows,
      "IPC",
      "ANALYTICAL",
      point.label,
      point,
      analytics.base || data.base || "2023=100",
      ["INDEX", "MONTHLY_CHANGE", "ACCUMULATED_CHANGE"],
    );
  }
  return sortRows(rows);
}

export function buildIppRows(payload: AnyRecord) {
  const data = payload.data?.industries ? payload.data : payload;
  const divisions = payload.divisions ?? payload.manufacturingDivisions ?? [];
  const rows: PriceRow[] = [];
  const base = data.base || "2019=100";
  const metrics = [
    "INDEX",
    "MONTHLY_CHANGE",
    "ACCUMULATED_CHANGE",
    "ANNUAL_CHANGE",
  ] as const;
  const series: [string, string, AnyRecord[]][] = [
    ["TOTAL", "IPP_INDUSTRIES", data.industries ?? []],
    ["ANALYTICAL", "IPP_INDUSTRIES_WITHOUT_COPPER", data.noCopper ?? []],
    ["SECTOR", "MANUFACTURING", data.manufacturing?.series ?? []],
    ["SECTOR", "MINING", data.mining?.series ?? []],
    ["SECTOR", "ELECTRICITY_GAS_WATER", data.ipdega?.series ?? []],
  ];
  for (const [breakdown, category, points] of series)
    for (const point of points)
      pushPoint(rows, "IPP", breakdown, category, point, base, metrics);

  // Las divisiones manufactureras permiten reproducir la comparación múltiple.
  for (const point of divisions)
    pushPoint(
      rows,
      "IPP",
      "MANUFACTURING_DIVISION",
      `DIV_${point.division}_${point.label}`,
      point,
      base,
      metrics,
    );

  // Se conservan los impulsores de clases y productos mostrados en el relato.
  for (const [sector, detail] of [
    ["MANUFACTURING", data.manufacturing],
    ["MINING", data.mining],
    ["ELECTRICITY_GAS_WATER", data.ipdega],
  ] as const) {
    for (const [period, summary] of Object.entries(detail?.summaries ?? {}) as [
      string,
      AnyRecord,
    ][]) {
      const [year, month] = period.split("-").map(Number);
      const point = { year, month };
      for (const [kind, items] of [
        ["CLASS_UP", summary.topClasses],
        ["CLASS_DOWN", summary.bottomClasses],
        ["PRODUCT_UP", summary.topProducts],
        ["PRODUCT_DOWN", summary.bottomProducts],
      ] as const) {
        for (const item of items ?? []) {
          for (const [indicator, value] of [
            ["MONTHLY_CHANGE", item.monthly],
            ["MONTHLY_INCIDENCE", item.incidence],
          ] as const) {
            const row = observation(
              "IPP",
              `DRIVER_${kind}`,
              `${sector}_${item.label}`,
              indicator,
              point,
              value,
              base,
            );
            if (row) rows.push(row);
          }
        }
      }
    }
  }
  return sortRows(rows);
}

const sortRows = (rows: PriceRow[]) =>
  rows.sort(
    (a, b) =>
      a.TIME_PERIOD.localeCompare(b.TIME_PERIOD) ||
      a.BREAKDOWN.localeCompare(b.BREAKDOWN) ||
      a.CATEGORY.localeCompare(b.CATEGORY) ||
      a.INDICATOR.localeCompare(b.INDICATOR),
  );

export function filterPriceRows(rows: PriceRow[], params: URLSearchParams) {
  let filtered = rows;
  for (const [field, parameter] of [
    ["DATASET", "dataset"],
    ["REF_AREA", "ref_area"],
    ["BREAKDOWN", "breakdown"],
    ["CATEGORY", "category"],
    ["INDICATOR", "indicator"],
  ] as [keyof PriceRow, string][]) {
    const requested = params.get(parameter)?.split(",").map(safeCode);
    if (requested?.length)
      filtered = filtered.filter((row) => requested.includes(row[field]));
  }
  const start = params.get("start_period");
  const end = params.get("end_period");
  if (start) filtered = filtered.filter((row) => row.TIME_PERIOD >= start);
  if (end) filtered = filtered.filter((row) => row.TIME_PERIOD <= end);
  const last = Number(params.get("last_n_periods"));
  if (Number.isInteger(last) && last > 0) {
    const periods = [...new Set(filtered.map((row) => row.TIME_PERIOD))]
      .sort()
      .slice(-last);
    filtered = filtered.filter((row) => periods.includes(row.TIME_PERIOD));
  }
  return filtered;
}

const csv = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function priceRowsToCsv(rows: PriceRow[]) {
  return [
    PRICE_COLUMNS.join(","),
    ...rows.map((row) =>
      PRICE_COLUMNS.map((column) => csv(row[column])).join(","),
    ),
  ].join("\r\n");
}

export function priceSummary(rows: PriceRow[], dataflow: string) {
  const periods = [...new Set(rows.map((row) => row.TIME_PERIOD))].sort();
  const series = new Set(
    rows.map((row) =>
      [
        row.DATASET,
        row.REF_AREA,
        row.BREAKDOWN,
        row.CATEGORY,
        row.INDICATOR,
      ].join("."),
    ),
  );
  return {
    dataflow: `INE.GOB.CL:${dataflow === IPC_DATAFLOW ? "DF_IPC" : "DF_IPP"}(1.0)`,
    observations: rows.length,
    series: series.size,
    periods: periods.length,
    from: periods[0] ?? null,
    to: periods.at(-1) ?? null,
    frequency: "monthly",
  };
}
