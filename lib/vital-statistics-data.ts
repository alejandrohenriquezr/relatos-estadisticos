import * as XLSX from "xlsx";

type Cell = string | number | null;
type Row = Cell[];

export const VITAL_STATISTICS_SOURCE_URL =
  "https://www.ine.gob.cl/docs/default-source/nacimientos-matrimonios-y-defunciones/cuadros-estadisticos/series-hist%C3%B3ricas/series-vitales-1992-2025(p).xlsx?sfvrsn=bfbe614_4";
const SOURCE = "series-vitales-1992-2025(p).xlsx";
const AGE_LABELS = [
  "Menores de 15",
  "15-19",
  "20-24",
  "25-29",
  "30-34",
  "35-39",
  "40-44",
  "45-49",
  "50-54",
  "55-59",
  "60-64",
  "65-69",
  "70 y más",
];
const AGE_MIDPOINTS = [14, 17, 22, 27, 32, 37, 42, 47, 52, 57, 62, 67, 72];

const numeric = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const year = (value: unknown) => {
  const match = String(value ?? "").match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
};
const provisional = (value: unknown) => /\(p\)/i.test(String(value ?? ""));
const ratio = (value: number | null, base: number) =>
  value === null ? null : (value / base) * 1000;

function sheets(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const read = (name: string) =>
    XLSX.utils
      .sheet_to_json<Row>(workbook.Sheets[name], {
        header: 1,
        raw: true,
        defval: null,
      })
      .slice(1)
      .filter((row) => year(row[0]) !== null);
  return {
    births: read("Nacimientos"),
    fertility: read("Fecundidad"),
    deaths: read("Defunciones"),
    mortality: read("Mortalidad"),
    marriages: read("Matrimonios"),
    auc: read("AUC"),
  };
}

function ageProfile(row: Row, start: number) {
  const raw = row.slice(start, start + AGE_LABELS.length);
  if (!raw.some((value) => numeric(value) !== null)) return null;
  const groups = AGE_LABELS.map((label, index) => ({
    label,
    value: numeric(raw[index]) ?? 0,
  }));
  const total = groups.reduce((sum, item) => sum + item.value, 0);
  const modalGroup = [...groups].sort((a, b) => b.value - a.value)[0].label;
  const approxMean = groups.reduce(
    (sum, item, index) => sum + item.value * AGE_MIDPOINTS[index],
    0,
  ) / total;
  return { groups, modalGroup, approxMean };
}

export function parseVitalStatistics(buffer: ArrayBuffer) {
  const input = sheets(buffer);
  const birthsSeries = input.births.map((row) => ({
    year: year(row[0])!,
    provisional: provisional(row[0]),
    observed: numeric(row[1]) ?? 0,
    men: numeric(row[3]) ?? 0,
    women: numeric(row[4]) ?? 0,
    masculinity: numeric(row[6]) ?? 0,
    ages: [
      "menores de 15 años",
      "15 a 19 años",
      "20 a 24 años",
      "25 a 29 años",
      "30 a 34 años",
      "35 a 39 años",
      "40 a 44 años",
      "45 a 49 años",
      "50 años y más",
    ].map((label, index) => ({ label, value: numeric(row[index + 7]) ?? 0 })),
  }));
  const birthsByYear = new Map(birthsSeries.map((item) => [item.year, item]));

  const fertilitySeries = input.fertility.map((row) => ({
    year: year(row[0])!,
    provisional: provisional(row[0]),
    population: numeric(row[1]) ?? 0,
    correctedBirths: numeric(row[2]) ?? 0,
    birthRate: numeric(row[3]) ?? 0,
    women1549: numeric(row[4]) ?? 0,
    generalRate: numeric(row[5]) ?? 0,
    specificRates: [
      "15 a 19",
      "20 a 24",
      "25 a 29",
      "30 a 34",
      "35 a 39",
      "40 a 44",
      "45 a 49",
    ].map((label, index) => ({ label, value: numeric(row[index + 20]) ?? 0 })),
    tgf: numeric(row[27]) ?? 0,
    tbr: numeric(row[28]) ?? 0,
    meanFertilityAge: numeric(row[29]) ?? 0,
    meanMotherAge: numeric(row[30]) ?? 0,
    medianMotherAge: numeric(row[31]) ?? 0,
  }));

  const deathsSeries = input.deaths.map((row) => {
    const currentYear = year(row[0])!;
    const birth = birthsByYear.get(currentYear)!;
    const neonatal = numeric(row[6]);
    const infant = numeric(row[7]);
    const age1to4 = numeric(row[8]);
    const fetal = numeric(row[9]);
    const youngBirths = birth.ages[0].value + birth.ages[1].value;
    return {
      year: currentYear,
      provisional: provisional(row[0]),
      total: numeric(row[1]) ?? 0,
      men: numeric(row[2]) ?? 0,
      women: numeric(row[3]) ?? 0,
      masculinity: numeric(row[5]) ?? 0,
      neonatal,
      infant,
      age1to4,
      fetal,
      observedBirths: birth.observed,
      youngMotherShare: (youngBirths / birth.observed) * 100,
      neonatalPerThousandBirths: ratio(neonatal, birth.observed),
      infantPerThousandBirths: ratio(infant, birth.observed),
      age1to4PerThousandBirths: ratio(age1to4, birth.observed),
      fetalPerThousandBirths: ratio(fetal, birth.observed),
    };
  });

  const mortalitySeries = input.mortality.map((row) => ({
    year: year(row[0])!,
    provisional: provisional(row[0]),
    crude: numeric(row[1]) ?? 0,
    infant: numeric(row[2]) ?? 0,
    neonatal: numeric(row[3]),
    fetal: numeric(row[4]),
    under5: numeric(row[5]) ?? 0,
    lifeBoth: numeric(row[6]) ?? 0,
    lifeMen: numeric(row[7]) ?? 0,
    lifeWomen: numeric(row[8]) ?? 0,
  }));

  const marriages = input.marriages.map((row) => ({
    year: year(row[0])!,
    provisional: provisional(row[0]),
    total: numeric(row[1]) ?? 0,
    rate: numeric(row[2]) ?? 0,
    menAge: ageProfile(row, 3),
    womenAge: ageProfile(row, 16),
  }));
  const auc = input.auc.map((row) => ({
    year: year(row[0])!,
    provisional: provisional(row[0]),
    total: numeric(row[1]) ?? 0,
    rate: numeric(row[2]) ?? 0,
    differentSex: numeric(row[3]) ?? 0,
    sameSex: numeric(row[6]) ?? 0,
    sameSexMen: numeric(row[7]) ?? 0,
    sameSexWomen: numeric(row[8]) ?? 0,
  }));

  return {
    births: { source: SOURCE, series: birthsSeries },
    fertility: { source: SOURCE, series: fertilitySeries },
    deaths: { source: SOURCE, series: deathsSeries },
    mortality: { source: SOURCE, series: mortalitySeries },
    unions: { source: SOURCE, marriages, auc },
  };
}
