export const LABOR_DATAFLOW = "INE.GOB.CL,DF_ENE_MERCADO_LABORAL,2.0/all";
export const LABOR_STRUCTURE_ID = "INE.GOB.CL:DSD_ENE_MERCADO_LABORAL(2.0)";

export const LABOR_COLUMNS = [
  "STRUCTURE",
  "STRUCTURE_ID",
  "ACTION",
  "FREQ",
  "DATASET",
  "REF_AREA",
  "SEX",
  "BREAKDOWN",
  "CATEGORY",
  "INDICATOR",
  "TIME_PERIOD",
  "OBS_VALUE",
  "UNIT_MEASURE",
  "UNIT_MULT",
  "EST_QUALITY",
  "REF_PERIOD_START",
  "REF_PERIOD_END",
  "TIME_PERIOD_LABEL",
  "SOURCE",
] as const;

export type LaborRow = Record<(typeof LABOR_COLUMNS)[number], string>;
// El payload normalizado reúne estructuras heterogéneas de varias operaciones.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const monthByName: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

const indicatorUnits: Record<string, [string, string]> = {
  pet: ["PERSONS", "3"],
  labor: ["PERSONS", "3"],
  employed: ["PERSONS", "3"],
  unemployed: ["PERSONS", "3"],
  ceased: ["PERSONS", "3"],
  firstJob: ["PERSONS", "3"],
  inactive: ["PERSONS", "3"],
  initiators: ["PERSONS", "3"],
  potential: ["PERSONS", "3"],
  habitual: ["PERSONS", "3"],
  unemploymentRate: ["PERCENT", "0"],
  employmentRate: ["PERCENT", "0"],
  participation: ["PERCENT", "0"],
};

const safeCode = (value: unknown) =>
  String(value ?? "TOTAL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 90) || "TOTAL";

const quality = (value: unknown) => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return normalized === "A" || normalized === "B" ? normalized : "F";
};

const quarterDates = (year: number, label: string) => {
  const names = label.toLowerCase().match(/[a-záéíóúñ]+/g) ?? [];
  const startMonth = monthByName[names[0]?.slice(0, 3)] ?? 1;
  const endMonth = monthByName[names.at(-1)?.slice(0, 3)] ?? startMonth;
  const endYear = endMonth < startMonth ? year + 1 : year;
  const lastDay = new Date(Date.UTC(endYear, endMonth, 0))
    .toISOString()
    .slice(0, 10);
  return {
    period: `${endYear}-${String(endMonth).padStart(2, "0")}`,
    start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    end: lastDay,
  };
};

const observation = (
  base: Pick<
    LaborRow,
    | "DATASET"
    | "SEX"
    | "BREAKDOWN"
    | "CATEGORY"
    | "INDICATOR"
    | "UNIT_MEASURE"
    | "UNIT_MULT"
    | "EST_QUALITY"
  >,
  point: AnyRecord,
  value: unknown,
): LaborRow | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const dates = quarterDates(Number(point.year), String(point.quarter));
  return {
    STRUCTURE: "dataflow",
    STRUCTURE_ID: LABOR_STRUCTURE_ID,
    ACTION: "I",
    FREQ: "M3",
    ...base,
    REF_AREA: "CL",
    TIME_PERIOD: dates.period,
    OBS_VALUE: String(value),
    REF_PERIOD_START: dates.start,
    REF_PERIOD_END: dates.end,
    TIME_PERIOD_LABEL: `${point.quarter} ${point.year}`,
    SOURCE: "Instituto Nacional de Estadísticas de Chile · ENE",
  };
};

const pushBreakdown = (
  rows: LaborRow[],
  series: AnyRecord[] | undefined,
  dataset: string,
  breakdown: string,
) => {
  for (const point of series ?? []) {
    for (const item of point.items ?? []) {
      for (const status of ["formal", "informal"] as const) {
        const row = observation(
          {
            DATASET: dataset,
            SEX: "T",
            BREAKDOWN: breakdown,
            CATEGORY: safeCode(item.label),
            INDICATOR: status.toUpperCase(),
            UNIT_MEASURE: "PERSONS",
            UNIT_MULT: "3",
            EST_QUALITY: quality(item[`${status}Quality`]),
          },
          point,
          item[status],
        );
        if (row) rows.push(row);
      }
    }
  }
};

export function buildLaborRows(ene: AnyRecord, informality: AnyRecord) {
  const rows: LaborRow[] = [];
  const detailed = ene.indicatorSeries ?? {};
  const simplified = ene.series ?? {};
  for (const [sexLabel, points] of Object.entries(
    Object.keys(detailed).length ? detailed : simplified,
  )) {
    const sex =
      sexLabel === "Hombres" ? "M" : sexLabel === "Mujeres" ? "F" : "T";
    for (const point of points as AnyRecord[]) {
      const values = point.values ?? point;
      for (const [indicator, raw] of Object.entries(values)) {
        if (!indicatorUnits[indicator]) continue;
        const detail =
          typeof raw === "object" && raw ? (raw as AnyRecord) : { value: raw };
        const [unit, multiplier] = indicatorUnits[indicator];
        const row = observation(
          {
            DATASET: "ENE",
            SEX: sex,
            BREAKDOWN: "INDICATOR_MAIN",
            CATEGORY: "TOTAL",
            INDICATOR: safeCode(indicator),
            UNIT_MEASURE: unit,
            UNIT_MULT: multiplier,
            EST_QUALITY: quality(detail.note),
          },
          point,
          detail.value,
        );
        if (row) rows.push(row);
      }
    }
  }
  for (const point of ene.seasonal ?? []) {
    const row = observation(
      {
        DATASET: "ENE",
        SEX: "T",
        BREAKDOWN: "SEASONAL",
        CATEGORY: "TOTAL",
        INDICATOR: "UNEMPLOYMENT_RATE_SEASONALLY_ADJUSTED",
        UNIT_MEASURE: "PERCENT",
        UNIT_MULT: "0",
        EST_QUALITY: "F",
      },
      point,
      point.value,
    );
    if (row) rows.push(row);
  }
  for (const [name, series, breakdown] of [
    ["sector", ene.sectorContributions, "ECONOMIC_ACTIVITY"],
    ["category", ene.categoryContributions, "OCCUPATIONAL_CATEGORY"],
  ] as const) {
    for (const point of series ?? [])
      for (const item of point.items ?? []) {
        for (const metric of ["change", "incidence"] as const) {
          const row = observation(
            {
              DATASET: "ENE",
              SEX: "T",
              BREAKDOWN: breakdown,
              CATEGORY: safeCode(item.label),
              INDICATOR: `${name.toUpperCase()}_${metric.toUpperCase()}`,
              UNIT_MEASURE: "PERCENT",
              UNIT_MULT: "0",
              EST_QUALITY: "F",
            },
            point,
            item[metric],
          );
          if (row) rows.push(row);
        }
      }
  }
  for (const point of ene.absentEmployment ?? []) {
    for (const [indicator, unit, mult] of [
      ["total", "PERSONS", "3"],
      ["present", "PERSONS", "3"],
      ["absent", "PERSONS", "3"],
      ["share", "PERCENT", "0"],
      ["change", "PERCENT", "0"],
      ["changePeople", "PERSONS", "0"],
      ["presentChange", "PERCENT", "0"],
    ]) {
      const row = observation(
        {
          DATASET: "ENE",
          SEX: "T",
          BREAKDOWN: "EMPLOYMENT_PRESENCE",
          CATEGORY: "TOTAL",
          INDICATOR: safeCode(indicator),
          UNIT_MEASURE: unit,
          UNIT_MULT: mult,
          EST_QUALITY: quality(point.quality),
        },
        point,
        point[indicator],
      );
      if (row) rows.push(row);
    }
  }
  for (const [snapshot, breakdown] of [
    [ene.branches, "ECONOMIC_ACTIVITY_SNAPSHOT"],
    [ene.categories, "OCCUPATIONAL_CATEGORY_SNAPSHOT"],
  ] as const) {
    if (!snapshot?.items?.length) continue;
    const point = snapshot.year
      ? snapshot
      : {
          ...snapshot,
          year: Number(String(snapshot.period).match(/\d{4}/)?.[0]),
          quarter: String(snapshot.period).replace(/\s+\d{4}.*/, ""),
        };
    for (const item of point.items) {
      const row = observation(
        {
          DATASET: "ENE",
          SEX: "T",
          BREAKDOWN: breakdown,
          CATEGORY: safeCode(item.label),
          INDICATOR: "EMPLOYED",
          UNIT_MEASURE: "PERSONS",
          UNIT_MULT: "3",
          EST_QUALITY: quality(item.quality),
        },
        point,
        item.value,
      );
      if (row) rows.push(row);
    }
  }

  for (const point of informality.rates ?? []) {
    for (const [indicator, sex, unit, mult] of [
      ["formal", "T", "PERSONS", "3"],
      ["informal", "T", "PERSONS", "3"],
      ["menFormal", "M", "PERSONS", "3"],
      ["menInformal", "M", "PERSONS", "3"],
      ["womenFormal", "F", "PERSONS", "3"],
      ["womenInformal", "F", "PERSONS", "3"],
      ["rate", "T", "PERCENT", "0"],
      ["menRate", "M", "PERCENT", "0"],
      ["womenRate", "F", "PERCENT", "0"],
    ]) {
      const row = observation(
        {
          DATASET: "INFORMALITY",
          SEX: sex,
          BREAKDOWN: "INDICATOR_MAIN",
          CATEGORY: "TOTAL",
          INDICATOR: safeCode(indicator),
          UNIT_MEASURE: unit,
          UNIT_MULT: mult,
          EST_QUALITY: quality(point[`${indicator}Quality`]),
        },
        point,
        point[indicator],
      );
      if (row) rows.push(row);
    }
  }
  pushBreakdown(rows, informality.branches, "INFORMALITY", "ECONOMIC_ACTIVITY");
  pushBreakdown(
    rows,
    informality.categories,
    "INFORMALITY",
    "OCCUPATIONAL_CATEGORY",
  );
  pushBreakdown(rows, informality.groups, "INFORMALITY", "OCCUPATION_GROUP");
  if (informality.hours?.items)
    for (const item of informality.hours.items) {
      for (const [indicator, unit, mult] of [
        ["rate", "PERCENT", "0"],
        ["informal", "PERSONS", "3"],
        ["share", "PERCENT", "0"],
        ["annual", "PERCENT", "0"],
      ]) {
        const row = observation(
          {
            DATASET: "INFORMALITY",
            SEX: "T",
            BREAKDOWN: "USUAL_HOURS",
            CATEGORY: safeCode(item.label),
            INDICATOR: safeCode(indicator),
            UNIT_MEASURE: unit,
            UNIT_MULT: mult,
            EST_QUALITY: quality(item.note),
          },
          informality.hours,
          item[indicator],
        );
        if (row) rows.push(row);
      }
    }

  return rows.sort(
    (a, b) =>
      a.TIME_PERIOD.localeCompare(b.TIME_PERIOD) ||
      a.DATASET.localeCompare(b.DATASET) ||
      a.INDICATOR.localeCompare(b.INDICATOR),
  );
}

export function filterLaborRows(rows: LaborRow[], params: URLSearchParams) {
  let filtered = rows;
  const filters: [keyof LaborRow, string][] = [
    ["DATASET", "dataset"],
    ["REF_AREA", "ref_area"],
    ["SEX", "sex"],
    ["BREAKDOWN", "breakdown"],
    ["CATEGORY", "category"],
    ["INDICATOR", "indicator"],
  ];
  for (const [field, parameter] of filters) {
    const requested = params.get(parameter)?.split(",").map(safeCode);
    if (requested?.length)
      filtered = filtered.filter((row) => requested.includes(row[field]));
  }
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

export function laborRowsToCsv(rows: LaborRow[]) {
  return [
    LABOR_COLUMNS.join(","),
    ...rows.map((row) =>
      LABOR_COLUMNS.map((column) => csv(row[column])).join(","),
    ),
  ].join("\r\n");
}

export function laborSummary(rows: LaborRow[]) {
  const seriesKey = (row: LaborRow) =>
    [
      row.DATASET,
      row.REF_AREA,
      row.SEX,
      row.BREAKDOWN,
      row.CATEGORY,
      row.INDICATOR,
    ].join(".");
  const periods = [...new Set(rows.map((row) => row.TIME_PERIOD))].sort();
  return {
    dataflow: "INE.GOB.CL:DF_ENE_MERCADO_LABORAL(2.0)",
    observations: rows.length,
    series: new Set(rows.map(seriesKey)).size,
    periods: periods.length,
    from: periods[0] ?? null,
    to: periods.at(-1) ?? null,
    datasets: [...new Set(rows.map((row) => row.DATASET))],
  };
}
