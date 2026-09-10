import * as XLSX from "xlsx";

/**
 * Libro anual oficial que reúne los 42 cuadros de Carabineros y PDI.
 * La URL fue obtenida desde el widget de descargas de la página de
 * Estadísticas Policiales del INE y verificada como XLSX el 10-09-2026.
 */
export const POLICE_SOURCE =
  "https://www.ine.gob.cl/docs/default-source/estadisticas-policiales-y-judiciales/cuadro-estad%C3%ADstico/estadisticas-policiales/2025/estad%C3%ADsticas-policiales_penal_2025.xlsx?sfvrsn=9579c5aa_4";

const clean = (input: unknown) =>
  String(input ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\/\d+$/, "")
    .trim()
    .toLocaleUpperCase("es-CL");

const numeric = (input: unknown) =>
  typeof input === "number" && Number.isFinite(input) ? input : null;

type PoliceObservation = {
  year: number;
  total: number | null;
  regions: Record<string, number | null>;
};

/**
 * Lee uno de los cuadros históricos anuales del libro 2025.
 * Las hojas 1, 7, 17, 23, 28 y 37 comparten la misma estructura:
 * fila 4 = cabeceras y filas siguientes = serie anual. La hoja 1 es especial
 * porque contiene denuncias y detenciones en flagrancia en el mismo cuadro.
 */
function annualSeries(
  workbook: XLSX.WorkBook,
  sheetName: string,
  complaintsOnly = false,
): PoliceObservation[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`No existe la hoja policial ${sheetName}`);

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const header = rows[3] ?? [];
  const regions = header.slice(3).map(clean);

  return rows.slice(4).flatMap((row) => {
    const label = row[0];
    if (complaintsOnly && !String(label ?? "").trim().startsWith("Denuncias "))
      return [];

    const yearMatch = String(label ?? "").match(/20\d{2}/);
    const year = yearMatch ? Number(yearMatch[0]) : Number.NaN;
    if (!Number.isInteger(year) || year < 2016) return [];

    const regional: Record<string, number | null> = {};
    regions.forEach((region, index) => {
      if (!region || region === "VARIACIÓN" || region.startsWith("VARIACIÓN/"))
        return;
      regional[region] = numeric(row[index + 3]);
    });

    return [{ year, total: numeric(row[1]), regions: regional }];
  });
}

/**
 * Transforma el libro anual conjunto. Se mantienen separadas ambas
 * instituciones porque el propio INE documenta diferencias metodológicas en
 * la definición temporal y territorial de sus registros.
 */
export function parsePoliceWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array" });

  const institutions = {
    carabineros: {
      label: "Carabineros de Chile",
      series: {
        denuncias: annualSeries(workbook, "1", true),
        detenidos: annualSeries(workbook, "7"),
        victimas: annualSeries(workbook, "17"),
      },
    },
    pdi: {
      label: "Policía de Investigaciones de Chile",
      series: {
        denuncias: annualSeries(workbook, "23"),
        detenidos: annualSeries(workbook, "28"),
        victimas: annualSeries(workbook, "37"),
      },
    },
  };

  const years = Object.values(institutions).flatMap((institution) =>
    Object.values(institution.series).flatMap((series) =>
      series.map((item) => item.year),
    ),
  );
  const updated = Math.max(...years);
  if (!Number.isFinite(updated))
    throw new Error("El libro policial no contiene una serie anual válida");

  return { updated, institutions };
}
