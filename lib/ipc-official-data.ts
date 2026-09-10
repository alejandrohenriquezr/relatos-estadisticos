import * as XLSX from "xlsx";

type Cell = string | number | null;

const MONTHS = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const rows = (buffer: ArrayBuffer) => {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Cell[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
};

const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
const nullableNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function parseIpcOfficialFiles(files: {
  ipc: ArrayBuffer;
  analytics: ArrayBuffer;
}) {
  const series = rows(files.ipc)
    .slice(4)
    .filter(
      (row) =>
        Number.isInteger(row[0]) &&
        Number.isInteger(row[1]) &&
        row[3] === null &&
        row[4] === null &&
        row[5] === null &&
        row[6] === null,
    )
    .map((row) => ({
      year: number(row[0]),
      month: number(row[1]),
      division: nullableNumber(row[2]) ?? 0,
      label: String(row[7] ?? "").trim(),
      weight: nullableNumber(row[8]),
      index: number(row[9]),
      monthly: number(row[10]),
      accumulated: number(row[11]),
      annual: number(row[12]),
      monthlyIncidence: nullableNumber(row[13]),
    }));

  const analytics = rows(files.analytics)
    .slice(4)
    .filter((row) => Number.isInteger(row[0]) && Number.isInteger(row[1]))
    .map((row) => ({
      year: number(row[0]),
      month: number(row[1]),
      label: String(row[2] ?? "").trim(),
      index: number(row[3]),
      monthly: number(row[4]),
      accumulated: number(row[5]),
    }));

  const latest = series.reduce<{ year: number; month: number } | null>(
    (current, item) =>
      !current ||
      item.year > current.year ||
      (item.year === current.year && item.month > current.month)
        ? { year: item.year, month: item.month }
        : current,
    null,
  );
  if (!latest)
    throw new Error("La fuente IPC no contiene observaciones válidas");

  return {
    data: {
      base: "2023=100",
      updated: `${MONTHS[latest.month]} de ${latest.year}`,
      series,
    },
    analytics: { base: "2023=100", series: analytics },
  };
}
