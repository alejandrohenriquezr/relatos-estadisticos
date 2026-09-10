"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import rawData from "../public/ene-data.json";
import indicatorData from "../public/indicator-series.json";
import ipcRawData from "../public/ipc-data.json";
import ipcAnalyticsRawData from "../public/ipc-analytics.json";
import ippRawData from "../public/ipp-data.json";
import ippmanDivisionsRaw from "../public/ippman-divisions.json";
import informalityRawData from "../public/informality-data.json";
import birthsRawData from "../public/births-data.json";
import fertilityRawData from "../public/fertility-data.json";
import deathsRawData from "../public/deaths-data.json";
import mortalityRawData from "../public/mortality-data.json";
import unionsRawData from "../public/unions-data.json";
import enuscInitialRaw from "../public/enusc-initial.json";
import chileRegionsMapRaw from "../public/chile-regions-map.json";
import policeRawData from "../public/police-data.json";
import * as XLSX from "xlsx";
import EconomicPage from "./EconomicPage";
import TourismPage from "./TourismPage";
import SupermarketsPage from "./SupermarketsPage";
import BusinessDemographyPage from "./BusinessDemographyPage";
import SectionHeader, {
  HomeNavLink,
  type SiteDestination,
} from "./SectionHeader";
import { primeDataset, type PrefetchKey } from "../lib/client-data-prefetch";
import { useOperationSections } from "./OperationSections";
import {
  useTemporalWindow,
  type TemporalPreset,
} from "./TemporalChartControls";

type Point = {
  year: number;
  quarter: string;
  pet: number;
  labor: number;
  employed: number;
  unemployed: number;
  ceased?: number;
  firstJob?: number;
  inactive?: number;
  initiators?: number;
  potential?: number;
  habitual?: number;
  participation: number;
  employmentRate: number;
  unemploymentRate: number;
};
type SectorItem = { label: string; change: number; incidence: number | null };
type AbsentEmployment = {
  year: number;
  quarter: string;
  total: number;
  present: number;
  absent: number;
  share: number;
  change: number | null;
  changePeople: number | null;
  presentChange: number | null;
  quality: string | null;
};
type EneData = {
  series: Record<string, Point[]>;
  seasonal: { year: number; quarter: string; value: number }[];
  sectorContributions: { year: number; quarter: string; items: SectorItem[] }[];
  categoryContributions: {
    year: number;
    quarter: string;
    items: SectorItem[];
  }[];
  absentEmployment: AbsentEmployment[];
  metadata: { updated: string };
};
type EneRemoteData = {
  series: Record<string, Point[]>;
  indicatorSeries: Record<string, IndicatorPoint[]>;
  regionalSeries: Record<string, Point[]>;
  sectorContributions: EneData["sectorContributions"];
  absentEmployment: AbsentEmployment[];
  cache?: {
    status: "shared" | "updated" | "stale";
    checkedAt: string;
    updatedAt: string;
  };
};
type IndicatorValue = { value: number | null; note: "a" | "b" | null };
type IndicatorPoint = {
  year: number;
  quarter: string;
  values: Record<string, IndicatorValue>;
};
type IndicatorMeta = { id: string; label: string; unit: "rate" | "level" };
type IndicatorData = {
  indicators: IndicatorMeta[];
  series: Record<string, IndicatorPoint[]>;
};
type PoliceMetric = "denuncias" | "detenidos" | "victimas";
type PolicePoint = {
  year: number;
  total: number;
  regions: Record<string, number | null>;
};
type PoliceInstitution = {
  label: string;
  series: Record<PoliceMetric, PolicePoint[]>;
};
type PoliceData = {
  updated: number;
  institutions: Record<"carabineros" | "pdi", PoliceInstitution>;
};
type IpcPoint = {
  year: number;
  month: number;
  division: number;
  label: string;
  weight: number | null;
  index: number;
  monthly: number;
  accumulated: number;
  annual: number;
  monthlyIncidence: number | null;
};
type IpcData = { base: string; updated: string; series: IpcPoint[] };
type IpcAnalyticPoint = {
  year: number;
  month: number;
  label: string;
  index: number;
  monthly: number;
  accumulated: number;
};
type IpcAnalyticsData = { base: string; series: IpcAnalyticPoint[] };
type IppPoint = {
  year: number;
  month: number;
  label: string;
  index: number;
  monthly: number;
  accumulated: number;
  annual: number;
};
type IppDivisionPoint = IppPoint & { division: number };
type IppDriver = { label: string; monthly: number | null; incidence: number };
type IppSummary = {
  classes: number;
  up: number;
  down: number;
  zero: number;
  topClasses: IppDriver[];
  bottomClasses: IppDriver[];
  topProducts: IppDriver[];
  bottomProducts: IppDriver[];
};
type IppDetail = { series: IppPoint[]; summaries: Record<string, IppSummary> };
type IppData = {
  base: string;
  updated: string;
  industries: IppPoint[];
  noCopper: IppPoint[];
  manufacturing: IppDetail;
  mining: IppDetail;
  ipdega: IppDetail;
};
type InformalityItem = { label: string; formal: number; informal: number };
type InformalityBreakdown = {
  year: number;
  quarter: string;
  items: InformalityItem[];
};
type InformalityRate = {
  year: number;
  quarter: string;
  formal: number;
  informal: number;
  menFormal: number;
  menInformal: number;
  womenFormal: number;
  womenInformal: number;
  rate: number;
  menRate: number;
  womenRate: number;
};
type HoursItem = {
  label: string;
  rate: number;
  informal: number;
  share: number;
  annual: number;
  note?: string;
};
type CategorySeriesItem = {
  label: string;
  formal: number;
  formalQuality: string | null;
  informal: number;
  informalQuality: string | null;
  references: string[];
};
type CategorySeriesPoint = {
  year: number;
  quarter: string;
  items: CategorySeriesItem[];
};
type InformalityData = {
  updated: string;
  rates: InformalityRate[];
  groups: InformalityBreakdown[];
  categories: InformalityBreakdown[];
  branches: InformalityBreakdown[];
  categorySeries: CategorySeriesPoint[];
  categoryFootnotes: Record<string, string>;
  hours: { year: number; quarter: string; items: HoursItem[] };
};
type BirthPoint = {
  year: number;
  provisional: boolean;
  observed: number;
  men: number;
  women: number;
  masculinity: number;
  ages: { label: string; value: number }[];
};
type BirthsData = { source: string; series: BirthPoint[] };
type FertilityPoint = {
  year: number;
  provisional: boolean;
  population: number;
  correctedBirths: number;
  birthRate: number;
  women1549: number;
  generalRate: number;
  specificRates: { label: string; value: number }[];
  tgf: number;
  tbr: number;
  meanFertilityAge: number;
  meanMotherAge: number;
  medianMotherAge: number;
};
type FertilityData = { source: string; series: FertilityPoint[] };
type DeathPoint = {
  year: number;
  provisional: boolean;
  total: number;
  men: number;
  women: number;
  masculinity: number;
  neonatal: number | null;
  infant: number | null;
  age1to4: number | null;
  fetal: number | null;
  observedBirths: number;
  youngMotherShare: number;
  neonatalPerThousandBirths: number | null;
  infantPerThousandBirths: number | null;
  age1to4PerThousandBirths: number | null;
  fetalPerThousandBirths: number | null;
};
type DeathsData = { source: string; series: DeathPoint[] };
type MortalityPoint = {
  year: number;
  provisional: boolean;
  crude: number;
  infant: number;
  neonatal: number | null;
  fetal: number | null;
  under5: number;
  lifeBoth: number;
  lifeMen: number;
  lifeWomen: number;
};
type MortalityData = { source: string; series: MortalityPoint[] };
type AgeProfile = {
  groups: { label: string; value: number }[];
  modalGroup: string;
  approxMean: number;
};
type MarriagePoint = {
  year: number;
  provisional: boolean;
  total: number;
  rate: number;
  menAge: AgeProfile | null;
  womenAge: AgeProfile | null;
};
type AucPoint = {
  year: number;
  provisional: boolean;
  total: number;
  rate: number;
  differentSex: number;
  sameSex: number;
  sameSexMen: number;
  sameSexWomen: number;
};
type UnionsData = {
  source: string;
  marriages: MarriagePoint[];
  auc: AucPoint[];
};
type VitalDataResponse = {
  births: BirthsData;
  fertility: FertilityData;
  deaths: DeathsData;
  mortality: MortalityData;
  unions: UnionsData;
};

function useVitalData() {
  const fallback: VitalDataResponse = {
    births: birthsRawData as BirthsData,
    fertility: fertilityRawData as FertilityData,
    deaths: deathsRawData as DeathsData,
    mortality: mortalityRawData as MortalityData,
    unions: unionsRawData as UnionsData,
  };
  const [data, setData] = useState<VitalDataResponse>(fallback);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/vital-data", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.error || "No fue posible actualizar las series vitales",
          );
        return payload as VitalDataResponse;
      })
      .then((payload) => {
        if (active && payload.births?.series?.length) {
          setData(payload);
          setReady(true);
        }
        void fetch("/api/vital-data?refresh=1", { cache: "no-store" })
          .then((response) => (response.ok ? response.json() : null))
          .then((updated) => {
            if (
              active &&
              updated?.cache?.status === "updated" &&
              updated.births?.series?.length
            )
              setData(updated);
          });
      })
      .catch(() => {
        // La copia incluida permanece visible cuando la fuente oficial no responde.
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return { data, ready };
}
type EnuscEstimate = {
  group: string;
  estimate: number;
  lower: number | null;
  upper: number | null;
  note: string | null;
};
type EnuscRecord = {
  region: string;
  category: string | null;
  estimates: EnuscEstimate[];
};
type EnuscMeta = {
  order: number;
  variable: string;
  title: string;
  type: "Dummy" | "Categórica";
  level: string;
  disaggregation: string;
  weight: "Persona" | "Hogar";
  filter: string;
  sample: number;
  theme: string;
};
type EnuscData = {
  year: number;
  source: string;
  metadata: EnuscMeta[];
  themes: Record<string, number>;
  tabulations: Record<string, EnuscRecord[]>;
  qualityNotes: Record<string, string>;
};
type ChileRegionPath = { code: number; region: string; path: string };

function IneLogo({ inverse = false }: { inverse?: boolean }) {
  // El activo se mantiene como JPG porque corresponde exactamente al archivo institucional entregado.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <a
      className={`ine-logo ${inverse ? "inverse-logo" : ""}`}
      href="https://www.ine.gob.cl"
      target="_blank"
      rel="noreferrer"
      aria-label="Instituto Nacional de Estadísticas de Chile"
    >
      <img
        src="/ine-logo.jpg"
        alt="Logo del Instituto Nacional de Estadísticas de Chile"
      />
    </a>
  );
}

function RelatosHeaderLogo() {
  // La marca se separa en dos destinos: INE abre el portal institucional y
  // Relatos Estadísticos vuelve a la portada del sitio.
  return (
    <div className="relatos-header-logo">
      <IneLogo />
      <Link
        className="relatos-home-link"
        href="/"
        aria-label="Ir al inicio de Relatos Estadísticos"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/logo-relatos-estadisticos-home.png"
          alt="Relatos Estadísticos"
        />
      </Link>
    </div>
  );
}

// Variaciones publicadas en los boletines nacionales para los componentes de la inactividad.
const INACTIVE_COMPONENTS = [
  { year: 2026, quarter: "Ene - Mar", potential: 4.9, habitual: 0.4 },
  { year: 2026, quarter: "Feb - Abr", potential: 2.1, habitual: 0.3 },
  { year: 2026, quarter: "Mar - May", potential: 0.2, habitual: 0.2 },
];

const COLORS: Record<string, string> = {
  Total: "#12326b",
  Mujeres: "#e43d37",
  Hombres: "#0096bd",
};
const SOURCE =
  "https://www.ine.gob.cl/estadisticas-por-tema/mercado-laboral/ocupacion-y-desocupacion";
const GLOBAL_FOOTER_TEXT =
  "Esta es una lectura interactiva de algunas de las estadísticas del Instituto Nacional de Estadísticas. Las cifras oficiales y sus notas de calidad prevalecen sobre esta visualización.";
const MONTH_NAMES: Record<string, string> = {
  Ene: "Enero",
  Feb: "Febrero",
  Mar: "Marzo",
  Abr: "Abril",
  May: "Mayo",
  Jun: "Junio",
  Jul: "Julio",
  Ago: "Agosto",
  Sep: "Septiembre",
  Oct: "Octubre",
  Nov: "Noviembre",
  Dic: "Diciembre",
};

function useChartTween<T>(value: T, key: string, duration = 520) {
  const target = useRef(value);
  const [previous, setPrevious] = useState(value);
  const [progress, setProgress] = useState(1);
  useLayoutEffect(() => {
    target.current = value;
  }, [value]);
  useLayoutEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const linear = Math.min(1, (now - start) / duration);
      setProgress(1 - Math.pow(1 - linear, 3));
      if (linear < 1) frame = requestAnimationFrame(tick);
      else setPrevious(target.current);
    };
    frame = requestAnimationFrame((now) => {
      setProgress(0);
      tick(now);
    });
    return () => cancelAnimationFrame(frame);
  }, [key, duration]);
  return { previous, progress };
}

// Mantiene las abreviaturas como claves internas y presenta siempre los meses completos.
const formatQuarter = (quarter: string) =>
  quarter
    .split("-")
    .map((month) => MONTH_NAMES[month.trim()] || month.trim())
    .join(" - ");
const initialEne = rawData as EneData;
const latest: Record<string, Point> = {
  Total: initialEne.series.Total.at(-1)!,
  Mujeres: initialEne.series.Mujeres.at(-1)!,
  Hombres: initialEne.series.Hombres.at(-1)!,
};

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    people:
      "M4 20v-2c0-2.2 3.6-4 8-4s8 1.8 8 4v2M8 10a4 4 0 1 1 8 0 4 4 0 0 1-8 0",
    brief: "M3 8h18v11H3zM8 8V5h8v3M3 12h18",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 21v-2a7 7 0 0 1 14 0v2",
    download: "M12 3v12m-4-4 4 4 4-4M4 21h16",
    menu: "M4 7h16M4 12h16M4 17h16",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

const chartFileName = (shell: HTMLElement, suffix = "") =>
  `${(shell.querySelector("h2, h3, h4")?.textContent || "grafico-ine")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}${suffix}`;

async function paintSvg(
  svg: SVGSVGElement,
  canvas: HTMLCanvasElement,
  scale = 2,
) {
  const box = svg.viewBox.baseVal,
    width = box.width || svg.clientWidth || 900,
    height = box.height || svg.clientHeight || 390;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const source = [svg, ...Array.from(svg.querySelectorAll("*"))],
    target = [clone, ...Array.from(clone.querySelectorAll("*"))],
    properties = [
      "fill",
      "stroke",
      "stroke-width",
      "stroke-dasharray",
      "stroke-linecap",
      "stroke-linejoin",
      "font-family",
      "font-size",
      "font-weight",
      "opacity",
      "display",
    ];
  source.forEach((node, index) => {
    const style = getComputedStyle(node);
    target[index]?.setAttribute(
      "style",
      properties
        .map((property) => `${property}:${style.getPropertyValue(property)}`)
        .join(";"),
    );
  });
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("No fue posible renderizar el gráfico"));
      image.src = url;
    });
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function saveBlob(blob: Blob, name: string) {
  const anchor = document.createElement("a"),
    url = URL.createObjectURL(blob);
  anchor.href = url;
  anchor.download = name;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function downloadChartPng(shell: HTMLElement) {
  const svg = shell.querySelector<SVGSVGElement>("svg.chart");
  if (!svg) return;
  const chartCanvas = document.createElement("canvas");
  await paintSvg(svg, chartCanvas, 2);

  // La exportación compone una lámina editorial completa: contexto temporal,
  // título, orientación de lectura, gráfico y notas/fuente visibles.
  const heading =
    shell.querySelector<HTMLElement>(
      ".chart-head .eyebrow, .ipp-chart-head .eyebrow, .chart-standard-heading .eyebrow",
    )?.innerText || "Serie histórica";
  const title =
    shell.querySelector<HTMLElement>(
      ".chart-head h2, .chart-head h3, .ipp-chart-head h4, .chart-standard-heading h2",
    )?.innerText ||
    svg.getAttribute("aria-label") ||
    "Gráfico estadístico";
  const subtitle =
    shell.querySelector<HTMLElement>(
      ".chart-subtitle, .chart-standard-heading p",
    )?.innerText || "";
  const notes = Array.from(
    shell.querySelectorAll<HTMLElement>(
      ".chart-notes p, .chart-source, .econ-caption, .chart-foot span, .ipp-chart > p",
    ),
  )
    .filter((element) => element.offsetParent !== null)
    .map((element) => element.innerText.trim())
    .filter((text, index, all) => text && all.indexOf(text) === index);

  const scale = 2;
  const margin = 44 * scale;
  const contentWidth = chartCanvas.width;
  const headerHeight = (subtitle ? 138 : 106) * scale;
  const noteLineHeight = 19 * scale;
  const estimatedNoteLines = Math.max(
    1,
    notes.reduce((total, note) => total + Math.ceil(note.length / 105), 0),
  );
  const notesHeight = notes.length ? (28 + estimatedNoteLines * 19) * scale : 0;
  const canvas = document.createElement("canvas");
  canvas.width = contentWidth + margin * 2;
  canvas.height = headerHeight + chartCanvas.height + notesHeight + margin;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Dibuja textos con salto automático para conservar notas metodológicas
  // extensas dentro del ancho de la imagen descargada.
  const drawWrapped = (
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    lineHeight: number,
  ) => {
    const words = text.split(/\s+/);
    let line = "";
    let y = startY;
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > maxWidth && line) {
        context.fillText(line, x, y);
        line = word;
        y += lineHeight;
      } else line = next;
    });
    if (line) context.fillText(line, x, y);
    return y + lineHeight;
  };

  context.fillStyle = "#607089";
  context.font = `800 ${13 * scale}px Arial, sans-serif`;
  context.fillText(heading.toUpperCase(), margin, 30 * scale);
  context.fillStyle = "#123f87";
  context.font = `800 ${27 * scale}px Arial, sans-serif`;
  drawWrapped(title, margin, 64 * scale, contentWidth, 31 * scale);
  if (subtitle) {
    context.fillStyle = "#4f6078";
    context.font = `500 ${15 * scale}px Arial, sans-serif`;
    drawWrapped(subtitle, margin, 103 * scale, contentWidth, 20 * scale);
  }
  context.drawImage(chartCanvas, margin, headerHeight);
  if (notes.length) {
    context.fillStyle = "#536176";
    context.font = `500 ${13 * scale}px Arial, sans-serif`;
    let noteY = headerHeight + chartCanvas.height + 24 * scale;
    notes.forEach((note) => {
      noteY = drawWrapped(note, margin, noteY, contentWidth, noteLineHeight);
    });
  }
  canvas.toBlob(
    (blob) => blob && saveBlob(blob, `${chartFileName(shell)}.png`),
    "image/png",
  );
}

async function downloadBirthAgeVideo(
  shell: HTMLElement,
  button: HTMLButtonElement,
) {
  const svg = shell.querySelector<SVGSVGElement>("svg.chart"),
    select = shell.querySelector<HTMLSelectElement>("select");
  if (!svg || !select || typeof MediaRecorder === "undefined") return;
  const original = select.value,
    years = Array.from(select.options)
      .map((option) => option.value)
      .filter((year) => +year <= +original)
      .reverse(),
    canvas = document.createElement("canvas");
  await paintSvg(svg, canvas, 1.5);
  const isFertility = shell.classList.contains("fertility-age-chart"),
    idleLabel = isFertility ? "Descargar video MPEG" : "Descargar video",
    stream = canvas.captureStream(30),
    // Para fecundidad se prioriza MPEG-4; WebM queda como respaldo técnico en navegadores sin soporte MP4.
    mimeCandidates = isFertility
      ? [
          "video/mp4;codecs=avc1.42E01E",
          "video/mp4",
          "video/webm;codecs=vp9",
          "video/webm",
        ]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"],
    mime =
      mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) ||
      "video/webm",
    recorder = new MediaRecorder(stream, { mimeType: mime }),
    chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  button.disabled = true;
  button.textContent = "Preparando video…";
  recorder.start();
  for (const year of years) {
    select.value = year;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 190));
    const current = shell.querySelector<SVGSVGElement>("svg.chart");
    if (current) await paintSvg(current, canvas, 1.5);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.stop();
  });
  select.value = original;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  saveBlob(
    new Blob(chunks, { type: mime }),
    `${chartFileName(shell, `-1992-a-${original}`)}.${mime.startsWith("video/mp4") ? "mp4" : "webm"}`,
  );
  button.dataset.exportStatus = "ok";
  button.disabled = false;
  button.textContent = idleLabel;
}

function useChartDownloads() {
  useEffect(() => {
    const enhance = () =>
      document
        .querySelectorAll<HTMLElement>(".chart-shell, .ipp-chart, .econ-chart")
        .forEach((shell) => {
          if (shell.dataset.exports || !shell.querySelector("svg.chart"))
            return;
          shell.dataset.exports = "true";
          const actions = document.createElement("div");
          actions.className = "chart-export-actions";
          const png = document.createElement("button");
          png.type = "button";
          png.innerHTML = "<span aria-hidden='true'>⇩</span> PNG";
          png.title = "Descargar gráfico como imagen PNG";
          png.addEventListener("click", async () => {
            png.disabled = true;
            png.dataset.exportStatus = "working";
            try {
              await downloadChartPng(shell);
              png.dataset.exportStatus = "ok";
            } catch {
              png.dataset.exportStatus = "error";
            } finally {
              png.disabled = false;
            }
          });
          actions.append(png);
          if (
            shell.classList.contains("birth-age-chart") ||
            shell.classList.contains("fertility-age-chart")
          ) {
            const isFertility = shell.classList.contains("fertility-age-chart");
            const video = document.createElement("button");
            video.type = "button";
            video.textContent = isFertility
              ? "Descargar video MPEG"
              : "Descargar video";
            video.title = isFertility
              ? "Descargar evolución de las tasas específicas en video MPEG-4"
              : "Descargar evolución por edad materna en video";
            video.addEventListener(
              "click",
              () =>
                void downloadBirthAgeVideo(shell, video).catch(() => {
                  video.dataset.exportStatus = "error";
                  video.disabled = false;
                  video.textContent = isFertility
                    ? "Descargar video MPEG"
                    : "Descargar video";
                }),
            );
            actions.prepend(video);
          }
          shell.append(actions);
        });
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
}

// Normaliza el encabezado editorial de todos los gráficos sin exigir que cada
// fuente de datos utilice la misma estructura interna.
function useChartStandardHeadings() {
  useEffect(() => {
    let frame = 0;
    const chartSelector = ".chart-shell, .ipp-chart, .econ-chart";

    const text = (element: Element | null) =>
      element?.textContent?.replace(/\s+/g, " ").trim() || "";

    const rangeFromChart = (shell: HTMLElement) => {
      const explicit = text(shell.querySelector(".ipp-time-reading strong"));
      if (explicit) return explicit.replace(/\s+[—–-]\s+/g, "–");

      const axisLabels = Array.from(
        shell.querySelectorAll(
          "svg.chart .x-label, svg.chart .econ-x-label, svg.chart .ipc-x-label, svg.chart .ipp-division-label",
        ),
      )
        .map(text)
        .filter(Boolean);
      if (axisLabels.length) {
        const first = axisLabels[0];
        const last = axisLabels.at(-1)!;
        return first === last ? first : `${first}–${last}`;
      }

      const datedTitles = Array.from(
        shell.querySelectorAll("svg.chart circle title, svg.chart rect title"),
      )
        .map(text)
        .map((value) => value.split(":")[0].split(",").at(-1)?.trim() || "")
        .filter((value) => /\b(19|20)\d{2}\b/.test(value));
      if (datedTitles.length) {
        const first = datedTitles[0];
        const last = datedTitles.at(-1)!;
        return first === last ? first : `${first}–${last}`;
      }
      return "período consultado";
    };

    const enhance = () => {
      frame = 0;
      observer.disconnect();
      document.querySelectorAll<HTMLElement>(chartSelector).forEach((shell) => {
        const svg = shell.querySelector("svg.chart");
        if (!svg) return;
        let standard = shell.querySelector<HTMLElement>(
          ":scope > .chart-standard-heading",
        );
        if (!standard) {
          standard = document.createElement("div");
          standard.className = "chart-standard-heading";
          const kicker = document.createElement("span");
          kicker.className = "eyebrow chart-period-kicker";
          standard.append(kicker);

          const localTitle = shell.querySelector(
            ":scope > .chart-head h2, :scope > .chart-head h3, :scope > .ipp-chart-head h4",
          );
          if (!localTitle) {
            const inferredTitle =
              text(shell.closest("section")?.querySelector("h2, h3")) ||
              svg.getAttribute("aria-label") ||
              "Gráfico estadístico";
            const title = document.createElement("h2");
            title.textContent = inferredTitle;
            standard.append(title);
          }

          const hasGuidance = Boolean(shell.querySelector(".chart-subtitle"));
          const seriesControls = shell.querySelectorAll(
            ".legend button, .series-legend button, .police-legend button, .series-toggles button, .birth-series-controls button",
          ).length;
          const hasMultipleSelect = Boolean(
            shell.querySelector("select[multiple]"),
          );
          if (!hasGuidance && (seriesControls > 1 || hasMultipleSelect)) {
            const guidance = document.createElement("p");
            guidance.textContent =
              "Activa o desactiva las series para comparar su trayectoria.";
            standard.append(guidance);
          }
          shell.prepend(standard);
        }
        const kicker = standard.querySelector<HTMLElement>(
          ".chart-period-kicker",
        );
        if (kicker)
          kicker.textContent = `Serie histórica · ${rangeFromChart(shell)}`;
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["d", "cx", "cy", "value", "aria-pressed"],
      });
    };

    const observer = new MutationObserver(() => {
      if (!frame) frame = window.requestAnimationFrame(enhance);
    });
    enhance();
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document
        .querySelectorAll(".chart-standard-heading")
        .forEach((heading) => heading.remove());
    };
  }, []);
}

// Añade rótulos consistentes al primer y último dato de cada serie SVG.
// Se aplica después de cada actualización para cubrir también los gráficos
// interactivos sin acoplar el formato de sus datos a un componente específico.
function useChartEndpointLabels() {
  useEffect(() => {
    let frame = 0;
    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some(
        (mutation) =>
          !(mutation.target as Element).closest?.(".chart-endpoint-layer"),
      );
      if (!relevant || frame) return;
      frame = window.requestAnimationFrame(enhance);
    });

    const valueFromTitle = (element: SVGGraphicsElement) => {
      const title = element.querySelector("title")?.textContent?.trim() || "";
      const separated = title.split(":").at(-1)?.trim();
      return separated || title;
    };

    const enhance = () => {
      frame = 0;
      observer.disconnect();
      document.querySelectorAll<SVGSVGElement>("svg.chart").forEach((svg) => {
        svg.querySelector(".chart-endpoint-layer")?.remove();
        const candidates = Array.from(
          svg.querySelectorAll<SVGGraphicsElement>("circle, rect"),
        ).filter(
          (element) =>
            Boolean(element.querySelector("title")) &&
            !element.closest(".chart-endpoint-layer") &&
            !element.closest('[opacity="0"]'),
        );
        if (!candidates.length) return;
        const groups = new Map<string, SVGGraphicsElement[]>();
        candidates.forEach((element) => {
          const key = [
            element.closest("[data-series]")?.getAttribute("data-series") || "",
            element.getAttribute("class") || "",
            element.getAttribute("fill") || "",
            element.getAttribute("stroke") || "",
            element.style?.fill || "",
            element.style?.stroke || "",
          ].join("|");
          groups.set(key, [...(groups.get(key) || []), element]);
        });
        const layer = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "g",
        );
        layer.setAttribute("class", "chart-endpoint-layer");
        groups.forEach((elements) => {
          const positioned = elements
            .map((element) => {
              const box = element.getBBox();
              return {
                element,
                x: box.x + box.width / 2,
                y: box.y + box.height / 2,
              };
            })
            .sort((a, b) => a.x - b.x);
          const endpoints =
            positioned.length === 1
              ? positioned
              : [positioned[0], positioned[positioned.length - 1]];
          endpoints.forEach((point, index) => {
            const label = valueFromTitle(point.element);
            if (!label) return;
            const text = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "text",
            );
            text.setAttribute("x", String(point.x));
            text.setAttribute("y", String(Math.max(13, point.y - 10)));
            text.setAttribute("text-anchor", index === 0 ? "start" : "end");
            text.textContent = label;
            layer.append(text);
          });
        });
        if (layer.childNodes.length) svg.append(layer);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["opacity", "d", "cx", "cy", "x", "y"],
      });
    };

    enhance();
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document
        .querySelectorAll(".chart-endpoint-layer")
        .forEach((layer) => layer.remove());
    };
  }, []);
}

function Chart({
  data,
  indicatorId,
  onIndicator,
  active,
  onToggle,
  year,
  quarter,
}: {
  data: IndicatorData;
  indicatorId: string;
  onIndicator: (s: string) => void;
  active: string[];
  onToggle: (s: string) => void;
  year: number;
  quarter: string;
}) {
  // El período seleccionado fija el extremo derecho y los controles permiten
  // ampliar la historia sin perder la lectura narrativa inicial.
  const meta =
    data.indicators.find((item) => item.id === indicatorId) ??
    data.indicators[10];
  const endIndex = data.series.Total.findIndex(
    (q) => q.year === year && q.quarter === quarter,
  );
  const availableTotal = data.series.Total.slice(0, endIndex + 1);
  const temporalPresets: TemporalPreset[] = [
    { value: 25, label: "25 períodos" },
    { value: 60, label: "5 años" },
    { value: 120, label: "10 años" },
    { value: "all", label: "Serie completa" },
  ];
  const temporal = useTemporalWindow(
    availableTotal,
    availableTotal.map(
      (point) => `${formatQuarter(point.quarter)} ${point.year}`,
    ),
    temporalPresets,
    25,
  );
  const visible: Record<string, IndicatorPoint[]> = {};
  Object.keys(data.series).forEach(
    (k) =>
      (visible[k] = data.series[k]
        .slice(0, endIndex + 1)
        .slice(temporal.start, temporal.end + 1)),
  );
  const values = active.flatMap((k) =>
    (visible[k] || [])
      .map((p) => p.values[indicatorId]?.value)
      .filter((v): v is number => v !== null && v !== undefined),
  );
  const rawMin = Math.min(...values),
    rawMax = Math.max(...values),
    span = Math.max(rawMax - rawMin, meta.unit === "rate" ? 1 : 100);
  const min = rawMin - span * 0.14,
    max = rawMax + span * 0.14,
    w = 860,
    h = 360,
    pL = 72,
    pR = 24,
    pT = 26,
    pB = 92;
  const x = (i: number, n: number) =>
    pL + (i * (w - pL - pR)) / Math.max(1, n - 1);
  const y = (v: number) => h - pB - ((v - min) * (h - pT - pB)) / (max - min);
  const ticks = Array.from(
    { length: 5 },
    (_, i) => min + ((max - min) * i) / 4,
  );
  const footnote: Record<string, string> = {
    unemploymentRate:
      "[1] Corresponde al cociente entre la población desocupada y la fuerza de trabajo —suma de ocupados y desocupados— en un trimestre móvil determinado, expresado como porcentaje.",
    employmentRate:
      "[2] Corresponde al cociente entre la población ocupada y la población en edad de trabajar —personas de 15 años o más— en un trimestre móvil determinado, expresado como porcentaje.",
    participation:
      "[3] Corresponde al cociente entre la fuerza de trabajo —suma de ocupados y desocupados— y la población en edad de trabajar —personas de 15 años o más— en un trimestre móvil determinado, expresado como porcentaje.",
  };
  const notes = new Set(
    active.flatMap((k) =>
      (visible[k] || [])
        .map((p) => p.values[indicatorId]?.note)
        .filter(Boolean),
    ),
  );
  const shortLabel = (p: IndicatorPoint) =>
    `${p.quarter.toLowerCase().replace(/\s/g, "")} '${String(p.year).slice(-2)}`;
  const formatValue = (v: number) =>
    meta.unit === "rate"
      ? `${v.toFixed(1).replace(".", ",")}%`
      : `${v.toLocaleString("es-CL", { maximumFractionDigits: 1 })} mil`;
  return (
    <div className="chart-shell">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Serie histórica</span>
          <h2>{meta.label}</h2>
        </div>
        <div className="chart-controls">
          <label>
            Indicador
            <select
              value={indicatorId}
              onChange={(e) => onIndicator(e.target.value)}
            >
              {data.indicators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="legend" aria-label="Series visibles">
            {Object.keys(COLORS).map((k) => (
              <button
                key={k}
                className={active.includes(k) ? "on" : ""}
                onClick={() => onToggle(k)}
              >
                <i style={{ background: COLORS[k] }} />
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>
      <svg
        className="chart chart-motion"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Evolución de ${meta.label} por sexo`}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pL} x2={w - pR} y1={y(v)} y2={y(v)} />
            <text x={pL - 10} y={y(v) + 4} textAnchor="end">
              {meta.unit === "rate"
                ? v.toFixed(1).replace(".", ",")
                : v.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
            </text>
          </g>
        ))}
        {(visible.Total || []).map((q, i) => (
          <text
            className="x-label"
            key={`${q.year}-${q.quarter}`}
            transform={`translate(${x(i, visible.Total.length)},${h - pB + 14}) rotate(-90)`}
            textAnchor="end"
          >
            {shortLabel(q)}
          </text>
        ))}
        {active.map((k) => {
          const points = visible[k] || [];
          const drawable = points.filter(
            (q) => q.values[indicatorId]?.value !== null,
          );
          const d = drawable
            .map(
              (q, i) =>
                `${i ? "L" : "M"}${x(points.indexOf(q), points.length)},${y(q.values[indicatorId].value as number)}`,
            )
            .join(" ");
          return (
            <g key={k}>
              <path className="line" d={d} style={{ stroke: COLORS[k] }} />
              {drawable.map((q) => {
                const i = points.indexOf(q),
                  item = q.values[indicatorId];
                return (
                  <g key={`${q.year}-${q.quarter}`}>
                    <circle
                      cx={x(i, points.length)}
                      cy={y(item.value as number)}
                      r={i === points.length - 1 ? 5 : 3}
                      style={{ fill: COLORS[k] }}
                    >
                      <title>
                        {k}, {formatQuarter(q.quarter)} {q.year}:{" "}
                        {formatValue(item.value as number)}
                        {item.note ? ` (${item.note})` : ""}
                      </title>
                    </circle>
                    {item.note && (
                      <text
                        className="quality-label"
                        x={x(i, points.length) + 5}
                        y={y(item.value as number) - 7}
                      >
                        {item.note}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {temporal.controls}
      <div className="chart-notes">
        {footnote[indicatorId] && <p>{footnote[indicatorId]}</p>}
        {notes.has("a") && (
          <p>
            <b>a:</b> estimación poco fiable (coeficiente de variación mayor a
            15% y menor o igual a 30%. En estimaciones de razón, no cumple el
            umbral de aceptación asociado a su error estándar).
          </p>
        )}
        {notes.has("b") && (
          <p>
            <b>b:</b> estimación no fiable (número de casos muestrales menor a
            60, grados de libertad menores a 9 o coeficiente de variación mayor
            a 30%).
          </p>
        )}
      </div>
      <div className="chart-foot">
        <span>Fuente: INE, Encuesta Nacional de Empleo.</span>
        <button
          onClick={() => downloadIndicatorCsv(visible, indicatorId, meta)}
        >
          ⇩ Descargar serie visible
        </button>
      </div>
    </div>
  );
}

function downloadIndicatorCsv(
  series: Record<string, IndicatorPoint[]>,
  indicatorId: string,
  meta: IndicatorMeta,
) {
  // Exporta el mismo indicador y ventana temporal que el usuario está observando.
  const rows = ["sexo,año,trimestre,indicador,valor,nota"];
  Object.entries(series).forEach(([sex, pts]) =>
    pts.forEach((p) => {
      const item = p.values[indicatorId];
      rows.push(
        `${sex},${p.year},${formatQuarter(p.quarter)},"${meta.label}",${item?.value ?? ""},${item?.note ?? ""}`,
      );
    }),
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([rows.join("\n")], { type: "text/csv" }),
  );
  a.download = `serie_ene_${indicatorId}.csv`;
  a.click();
}

const IPC_SOURCE =
  "https://www.ine.gob.cl/estadisticas-por-tema/precios-e-inflacion/indice-de-precios-al-consumidor";
const IPC_INDICATORS = {
  monthly: "Variación Mensual (%)",
  accumulated: "Variación Acumulada (%)",
  annual: "Variación 12 Meses (%)",
} as const;
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

function PriceHeader({
  onLabor,
  onInformality,
  onIpc,
  onIpp,
  onBirths,
  onFertility = () => {},
  onDeaths = () => {},
  onMortality = () =>
    window.dispatchEvent(
      new CustomEvent("site:navigate", { detail: "mortality" }),
    ),
  onUnions = () =>
    window.dispatchEvent(
      new CustomEvent("site:navigate", { detail: "unions" }),
    ),
  onEnusc = () =>
    window.dispatchEvent(new CustomEvent("site:navigate", { detail: "enusc" })),
  onPolice = () =>
    window.dispatchEvent(
      new CustomEvent("site:navigate", { detail: "police" }),
    ),
  onEnergy = () =>
    window.dispatchEvent(
      new CustomEvent("site:navigate", { detail: "energy" }),
    ),
  onIndustry = () =>
    window.dispatchEvent(
      new CustomEvent("site:navigate", { detail: "industry" }),
    ),
  onPermits = () =>
    window.dispatchEvent(
      new CustomEvent("site:navigate", { detail: "permits" }),
    ),
  onCommerce = () =>
    window.dispatchEvent(
      new CustomEvent("site:navigate", { detail: "commerce" }),
    ),
  onTourism = () =>
    window.dispatchEvent(
      new CustomEvent("site:navigate", { detail: "tourism" }),
    ),
  current,
}: {
  onLabor: () => void;
  onInformality: () => void;
  onIpc: () => void;
  onIpp: () => void;
  onBirths: () => void;
  onFertility?: () => void;
  onDeaths?: () => void;
  onMortality?: () => void;
  onUnions?: () => void;
  onEnusc?: () => void;
  onPolice?: () => void;
  onEnergy?: () => void;
  onIndustry?: () => void;
  onPermits?: () => void;
  onCommerce?: () => void;
  onTourism?: () => void;
  current:
    | "informality"
    | "ipc"
    | "ipp"
    | "births"
    | "fertility"
    | "deaths"
    | "mortality"
    | "unions"
    | "enusc"
    | "police"
    | "energy"
    | "industry"
    | "permits"
    | "commerce"
    | "tourism"
    | "supermarkets";
}) {
  const [open, setOpen] = useState(false);
  const [laborOpen, setLaborOpen] = useState(false);
  const [demographyOpen, setDemographyOpen] = useState(false);
  const [livingOpen, setLivingOpen] = useState(false);
  const [industryOpen, setIndustryOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [experimentalOpen, setExperimentalOpen] = useState(false);
  return (
    <header>
      <div className="topbar">
        <div className="brand">
          <RelatosHeaderLogo />
        </div>
        <nav className="utility">
          <a href="https://www.ine.gob.cl/institucional/">Acerca del INE</a>
        </nav>
      </div>
      <nav className="topics">
        <HomeNavLink />
        <div
          className={`topic-dropdown ${laborOpen ? "open" : ""}`}
          onMouseLeave={() => setLaborOpen(false)}
        >
          <button
            className={current === "informality" ? "active" : ""}
            onClick={() => setLaborOpen((value) => !value)}
          >
            Mercado laboral
          </button>
          <div className="topic-submenu">
            <button onClick={onLabor}>Ocupación y desocupación</button>
            <button
              aria-current={current === "informality" ? "page" : undefined}
              onClick={onInformality}
            >
              Informalidad laboral
            </button>
          </div>
        </div>
        <div
          className={`topic-dropdown ${open ? "open" : ""}`}
          onMouseLeave={() => setOpen(false)}
        >
          <button
            className={current === "ipc" || current === "ipp" ? "active" : ""}
            onClick={() => setOpen((value) => !value)}
          >
            <span>Precios</span>
          </button>
          <div className="topic-submenu">
            <button
              aria-current={current === "ipc" ? "page" : undefined}
              onClick={onIpc}
            >
              Índice de Precios al Consumidor
            </button>
            <button
              aria-current={current === "ipp" ? "page" : undefined}
              onClick={onIpp}
            >
              Índice de Precios al Productor
            </button>
          </div>
        </div>
        <div
          className={`topic-dropdown ${demographyOpen ? "open" : ""}`}
          onMouseLeave={() => setDemographyOpen(false)}
        >
          <button
            className={
              current === "births" ||
              current === "fertility" ||
              current === "deaths" ||
              current === "mortality" ||
              current === "unions"
                ? "active"
                : ""
            }
            onClick={() => setDemographyOpen((value) => !value)}
          >
            Demografía y población
          </button>
          <div className="topic-submenu">
            <button
              aria-current={current === "births" ? "page" : undefined}
              onClick={onBirths}
            >
              Nacimientos
            </button>
            <button
              aria-current={current === "fertility" ? "page" : undefined}
              onClick={onFertility}
            >
              Fecundidad
            </button>
            <button
              aria-current={current === "deaths" ? "page" : undefined}
              onClick={onDeaths}
            >
              Defunciones
            </button>
            <button
              aria-current={current === "mortality" ? "page" : undefined}
              onClick={onMortality}
            >
              Mortalidad
            </button>
            <button
              aria-current={current === "unions" ? "page" : undefined}
              onClick={onUnions}
            >
              Matrimonios y AUC
            </button>
          </div>
        </div>
        <div
          className={`topic-dropdown ${livingOpen ? "open" : ""}`}
          onMouseLeave={() => setLivingOpen(false)}
        >
          <button
            className={
              current === "enusc" || current === "police" ? "active" : ""
            }
            onClick={() => setLivingOpen((value) => !value)}
          >
            Condiciones de vida
          </button>
          <div className="topic-submenu">
            <button
              aria-current={current === "enusc" ? "page" : undefined}
              onClick={onEnusc}
            >
              ENUSC
            </button>
            <button
              aria-current={current === "police" ? "page" : undefined}
              onClick={onPolice}
            >
              Policías
            </button>
          </div>
        </div>
        <div
          className={`topic-dropdown ${industryOpen ? "open" : ""}`}
          onMouseLeave={() => setIndustryOpen(false)}
        >
          <button
            className={
              ["energy", "industry", "permits"].includes(current)
                ? "active"
                : ""
            }
            onClick={() => setIndustryOpen((v) => !v)}
          >
            Industria, Energía y Construcción
          </button>
          <div className="topic-submenu">
            <button onClick={onPermits}>Permisos de Edificación</button>
            <button onClick={onEnergy}>Energía</button>
            <button onClick={onIndustry}>Industria</button>
          </div>
        </div>
        <div
          className={`topic-dropdown ${servicesOpen ? "open" : ""}`}
          onMouseLeave={() => setServicesOpen(false)}
        >
          <button onClick={() => setServicesOpen((value) => !value)}>
            Servicios
          </button>
          <div className="topic-submenu">
            <button
              aria-current={current === "commerce" ? "page" : undefined}
              onClick={onCommerce}
            >
              Comercio
            </button>
            <button
              aria-current={current === "tourism" ? "page" : undefined}
              onClick={onTourism}
            >
              Turismo
            </button>
            <button
              aria-current={current === "supermarkets" ? "page" : undefined}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("site:navigate", { detail: "supermarkets" }),
                )
              }
            >
              Supermercados
            </button>
          </div>
        </div>
        <div className="topics-divider" aria-hidden="true" />
        <div
          className={`topic-dropdown ${experimentalOpen ? "open" : ""}`}
          onMouseLeave={() => setExperimentalOpen(false)}
        >
          <button onClick={() => setExperimentalOpen((value) => !value)}>
            Estadísticas Experimentales
          </button>
          <div className="topic-submenu">
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("site:navigate", {
                    detail: "businessDemography",
                  }),
                )
              }
            >
              Demografía de empresas
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}

function IpcChart({
  data,
  selectedYear,
  selectedMonth,
}: {
  data: IpcData;
  selectedYear: number;
  selectedMonth: number;
}) {
  const [division, setDivision] = useState(0);
  const [indicator, setIndicator] =
    useState<keyof typeof IPC_INDICATORS>("monthly");
  const divisions = useMemo(
    () =>
      Array.from(
        new Map(
          data.series
            .filter((p) => p.year === 2026 && p.month === 6)
            .map((p) => [p.division, p.label]),
        ).entries(),
      ),
    [data],
  );
  // El período seleccionado fija el extremo derecho de la serie histórica.
  const availablePoints = data.series.filter(
    (p) =>
      p.division === division &&
      (p.year < selectedYear ||
        (p.year === selectedYear && p.month <= selectedMonth)),
  );
  const ipcTemporalPresets: TemporalPreset[] = [
    { value: 25, label: "25 períodos" },
    { value: 60, label: "5 años" },
    { value: 120, label: "10 años" },
    { value: "all", label: "Serie completa" },
  ];
  const temporal = useTemporalWindow(
    availablePoints,
    availablePoints.map((point) => `${MONTHS[point.month]} ${point.year}`),
    ipcTemporalPresets,
    25,
  );
  const points = temporal.visible;
  const values = points.map((p) => p[indicator]);
  const rawMin = Math.min(...values),
    rawMax = Math.max(...values),
    span = Math.max(rawMax - rawMin, 1);
  const min = rawMin - span * 0.14,
    max = rawMax + span * 0.14,
    w = 900,
    h = 420,
    pL = 70,
    pR = 24,
    pT = 26,
    pB = 112;
  const x = (i: number) =>
    pL + (i * (w - pL - pR)) / Math.max(1, points.length - 1);
  const y = (v: number) => h - pB - ((v - min) * (h - pT - pB)) / (max - min);
  const ticks = Array.from(
    { length: 5 },
    (_, i) => min + ((max - min) * i) / 4,
  );
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[indicator])}`)
    .join(" ");
  const selected = points.at(-1)!;
  const download = () => {
    // Genera un libro Excel con exactamente los 25 meses y la serie visibles.
    const rows = points.map((p) => ({
      Año: p.year,
      Mes: MONTHS[p.month],
      División: p.label,
      Serie: IPC_INDICATORS[indicator],
      Valor: p[indicator],
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 42 },
      { wch: 28 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Serie visible");
    XLSX.writeFile(
      workbook,
      `ipc_${indicator}_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.xlsx`,
    );
  };
  return (
    <div className="chart-shell ipc-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Serie histórica</span>
          <h2>{IPC_INDICATORS[indicator]}</h2>
        </div>
        <div className="chart-controls ipc-controls">
          <label>
            División
            <select
              value={division}
              onChange={(e) => setDivision(+e.target.value)}
            >
              {divisions.map(([id, label]) => (
                <option key={id} value={id}>
                  {id === 0 ? "IPC General" : `${id}. ${label}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Indicador o serie
            <select
              value={indicator}
              onChange={(e) =>
                setIndicator(e.target.value as keyof typeof IPC_INDICATORS)
              }
            >
              {Object.entries(IPC_INDICATORS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <svg
        className="chart chart-motion"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${IPC_INDICATORS[indicator]} de ${selected.label}`}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pL} x2={w - pR} y1={y(v)} y2={y(v)} />
            <text x={pL - 10} y={y(v) + 4} textAnchor="end">
              {v.toFixed(1).replace(".", ",")}%
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text
            className="x-label ipc-x-label"
            key={`${p.year}-${p.month}`}
            transform={`translate(${x(i)},${h - pB + 14}) rotate(-90)`}
            textAnchor="end"
          >
            {MONTHS[p.month].slice(0, 3).toLowerCase()}{" "}
            {String(p.year).slice(-2)}
          </text>
        ))}
        <path className="line" d={line} style={{ stroke: "#123f87" }} />
        {points.map((p, i) => (
          <circle
            key={`${p.year}-${p.month}`}
            cx={x(i)}
            cy={y(p[indicator])}
            r={i === points.length - 1 ? 5 : 3}
            fill="#123f87"
          >
            <title>
              {MONTHS[p.month]} {p.year}:{" "}
              {p[indicator].toFixed(1).replace(".", ",")}%
            </title>
          </circle>
        ))}
      </svg>
      {temporal.controls}
      <div className="chart-foot">
        <span>
          Fuente: INE, Índice de Precios al Consumidor. Base anual {data.base}.
        </span>
        <button onClick={download}>⇩ Descargar serie visible</button>
      </div>
    </div>
  );
}

type IpcCalculatorResult = {
  variacion_ipc: string;
  cantidad_meses: string;
  periodo_de_calculo: string;
  valorajustado: string;
};
const IPC_CALCULATOR_API = "/api/ipc-calculator";
const calculatorMonthCache = new Map<number, number[]>();

async function calculatorMonths(year: number) {
  // Conserva los meses ya consultados para evitar solicitudes repetidas a la API oficial.
  if (calculatorMonthCache.has(year)) return calculatorMonthCache.get(year)!;
  const response = await fetch(
    `${IPC_CALCULATOR_API}?action=months&year=${year}`,
  );
  if (!response.ok)
    throw new Error("No fue posible obtener los meses disponibles.");
  const months = ((await response.json()) as { nmes: number }[]).map(
    (item) => item.nmes,
  );
  calculatorMonthCache.set(year, months);
  return months;
}

function IpcCalculator() {
  const [years, setYears] = useState<number[]>([]);
  const [startYear, setStartYear] = useState(0),
    [endYear, setEndYear] = useState(0);
  const [startMonth, setStartMonth] = useState(0),
    [endMonth, setEndMonth] = useState(0);
  const [startMonths, setStartMonths] = useState<number[]>([]),
    [endMonths, setEndMonths] = useState<number[]>([]);
  const [amount, setAmount] = useState("100000");
  const [result, setResult] = useState<IpcCalculatorResult | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");

  useEffect(() => {
    // Inicializa el formulario con la variación mensual más reciente disponible.
    let active = true;
    (async () => {
      try {
        const response = await fetch(`${IPC_CALCULATOR_API}?action=years`);
        if (!response.ok) throw new Error();
        const availableYears = (
          (await response.json()) as { agno: number }[]
        ).map((item) => item.agno);
        const latestYear = availableYears[0],
          latestMonths = await calculatorMonths(latestYear),
          latestMonth = latestMonths.at(-1)!;
        const previousYear = latestMonth === 1 ? availableYears[1] : latestYear;
        const previousMonth =
          latestMonth === 1
            ? (await calculatorMonths(previousYear)).at(-1)!
            : latestMonth - 1;
        if (!active) return;
        setYears(availableYears);
        setEndYear(latestYear);
        setEndMonths(latestMonths);
        setEndMonth(latestMonth);
        setStartYear(previousYear);
        setStartMonths(await calculatorMonths(previousYear));
        setStartMonth(previousMonth);
      } catch {
        if (active)
          setError(
            "La calculadora oficial no está respondiendo en este momento.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const changeYear = async (type: "start" | "end", year: number) => {
    try {
      const months = await calculatorMonths(year);
      if (type === "start") {
        setStartYear(year);
        setStartMonths(months);
        if (!months.includes(startMonth)) setStartMonth(months.at(-1)!);
      } else {
        setEndYear(year);
        setEndMonths(months);
        if (!months.includes(endMonth)) setEndMonth(months.at(-1)!);
      }
    } catch {
      setError("No fue posible cargar los meses para el año seleccionado.");
    }
  };

  const calculate = async (
    values = { startYear, startMonth, endYear, endMonth, amount },
  ) => {
    const start = values.startYear * 100 + values.startMonth,
      end = values.endYear * 100 + values.endMonth;
    if (
      !values.startYear ||
      !values.startMonth ||
      !values.endYear ||
      !values.endMonth
    )
      return;
    if (start > end) {
      setError(
        "El período inicial debe ser anterior o igual al período de término.",
      );
      setResult(null);
      return;
    }
    const numericAmount = String(values.amount).replace(/[^0-9]/g, "") || "0";
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        action: "calculate",
        startMonth: String(values.startMonth),
        startYear: String(values.startYear),
        endMonth: String(values.endMonth),
        endYear: String(values.endYear),
        amount: numericAmount,
      });
      const response = await fetch(`${IPC_CALCULATOR_API}?${query}`);
      if (!response.ok) throw new Error();
      const data = (await response.json()) as IpcCalculatorResult[];
      if (!data[0]) throw new Error();
      setResult(data[0]);
    } catch {
      setError("No fue posible realizar el cálculo. Inténtalo nuevamente.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const monthsBack = (distance: number) => {
    const absoluteMonth = endYear * 12 + endMonth - 1 - distance;
    return {
      startYear: Math.floor(absoluteMonth / 12),
      startMonth: (absoluteMonth % 12) + 1,
    };
  };
  const example = (label: string, distance: number) => {
    const start = monthsBack(distance);
    return {
      label,
      description: `${MONTHS[start.startMonth]} ${start.startYear} a ${MONTHS[endMonth]} ${endYear}`,
      ...start,
      endYear,
      endMonth,
    };
  };
  const examples =
    endYear && endMonth
      ? [
          example("Variación mensual", 1),
          example("Tres meses", 3),
          example("Seis meses", 6),
          example("Doce meses", 12),
          {
            label: "Acumulada anual",
            description: `${MONTHS[12]} ${endYear - 1} a ${MONTHS[endMonth]} ${endYear}`,
            startYear: endYear - 1,
            startMonth: 12,
            endYear,
            endMonth,
          },
        ]
      : [];
  const applyExample = async (example: (typeof examples)[number]) => {
    setStartYear(example.startYear);
    setStartMonths(await calculatorMonths(example.startYear));
    setStartMonth(example.startMonth);
    setEndYear(example.endYear);
    setEndMonths(await calculatorMonths(example.endYear));
    setEndMonth(example.endMonth);
    setAmount("100000");
    await calculate({ ...example, amount: "100000" });
  };
  const displayAmount = amount
    ? Number(amount.replace(/[^0-9]/g, "")).toLocaleString("es-CL")
    : "";
  return (
    <section className="ipc-calculator" aria-labelledby="ipc-calculator-title">
      <div className="ipc-calculator-head">
        <div>
          <span className="eyebrow">Herramienta oficial</span>
          <h3 id="ipc-calculator-title">Calculadora del IPC</h3>
          <p>
            Calcula la variación del IPC entre dos períodos y, opcionalmente,
            actualiza un valor expresado en pesos.
          </p>
        </div>
        <span className="api-badge">Datos oficiales INE</span>
      </div>
      <div className="ipc-calculator-body">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            calculate();
          }}
        >
          <fieldset>
            <legend>Período de cálculo</legend>
            <div className="calculator-periods">
              <div>
                <h4>Inicio</h4>
                <label>
                  Mes
                  <select
                    aria-label="Mes inicial"
                    value={startMonth}
                    onChange={(event) => setStartMonth(+event.target.value)}
                    disabled={!startMonths.length}
                  >
                    {startMonths.map((month) => (
                      <option key={month} value={month}>
                        {MONTHS[month]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Año
                  <select
                    aria-label="Año inicial"
                    value={startYear}
                    onChange={(event) =>
                      changeYear("start", +event.target.value)
                    }
                    disabled={!years.length}
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <h4>Término</h4>
                <label>
                  Mes
                  <select
                    aria-label="Mes de término"
                    value={endMonth}
                    onChange={(event) => setEndMonth(+event.target.value)}
                    disabled={!endMonths.length}
                  >
                    {endMonths.map((month) => (
                      <option key={month} value={month}>
                        {MONTHS[month]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Año
                  <select
                    aria-label="Año de término"
                    value={endYear}
                    onChange={(event) => changeYear("end", +event.target.value)}
                    disabled={!years.length}
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </fieldset>
          <label className="calculator-amount">
            Valor que deseas ajustar{" "}
            <span>
              <b>$</b>
              <input
                aria-label="Valor en pesos"
                inputMode="numeric"
                value={displayAmount}
                onChange={(event) =>
                  setAmount(event.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="100.000"
              />
            </span>
            <small>
              Opcional. Si lo dejas en cero, se calculará solamente la
              variación.
            </small>
          </label>
          <button
            className="calculator-submit"
            type="submit"
            disabled={loading || !years.length}
          >
            {loading ? "Calculando…" : "Calcular variación"}
          </button>
          {error && (
            <p className="calculator-error" role="alert">
              {error}
            </p>
          )}
        </form>
        <div className="calculator-result" aria-live="polite">
          <span className="eyebrow">Resultado</span>
          {result ? (
            <>
              <p>{result.periodo_de_calculo}</p>
              <strong>{result.variacion_ipc}</strong>
              <small>Variación del período · {result.cantidad_meses}</small>
              {result.valorajustado !== "0" && (
                <div>
                  <span>Valor reajustado</span>
                  <b>${result.valorajustado}</b>
                </div>
              )}
              <p className="calculator-note">
                El INE calcula internamente con 12 decimales y presenta la
                variación oficial con un decimal.
              </p>
            </>
          ) : (
            <>
              <strong>—</strong>
              <p>Selecciona los períodos y presiona “Calcular variación”.</p>
            </>
          )}
        </div>
      </div>
      <div className="calculator-examples">
        <div>
          <span className="eyebrow">Ejemplos prácticos</span>
          <h4>Prueba un cálculo con $100.000</h4>
        </div>
        {examples.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => applyExample(example)}
          >
            <b>{example.label}</b>
            <span>{example.description}</span>
          </button>
        ))}
      </div>
      <p className="calculator-method">
        <b>Cómo se interpretan los períodos:</b> un cálculo mensual compara el
        mes consultado con el anterior; la variación acumulada utiliza diciembre
        del año previo como inicio; y la variación en doce meses compara el
        mismo mes de dos años consecutivos.{" "}
        <a
          href="https://www.ine.gob.cl/docs/default-source/índice-de-precios-al-consumidor/metodologias/base-anual-2023-100/5---uso-calculadora-ipc.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Ver guía oficial ↗
        </a>
      </p>
    </section>
  );
}

function IpcPage({
  onLabor,
  onInformality,
  onIpp,
  onBirths,
  onFertility,
  onDeaths,
}: {
  onLabor: () => void;
  onInformality: () => void;
  onIpp: () => void;
  onBirths: () => void;
  onFertility: () => void;
  onDeaths: () => void;
}) {
  const fallbackData = ipcRawData as IpcData;
  const fallbackAnalytics = ipcAnalyticsRawData as IpcAnalyticsData;
  const [data, setData] = useState<IpcData>(fallbackData);
  const [analytics, setAnalytics] =
    useState<IpcAnalyticsData>(fallbackAnalytics);
  const [cacheReady, setCacheReady] = useState(false);
  const periods = useMemo(
    () =>
      Array.from(
        new Map(
          data.series
            .filter((p) => p.division === 0)
            .map((p) => [
              `${p.year}-${p.month}`,
              { year: p.year, month: p.month },
            ]),
        ).values(),
      ).sort((a, b) => b.year - a.year || b.month - a.month),
    [data],
  );
  const [period, setPeriod] = useState(
    `${periods[0].year}-${periods[0].month}`,
  );
  const [bulletin, setBulletin] = useState<{
    url: string | null;
    checking: boolean;
  }>({ url: null, checking: true });
  const [selectedYear, selectedMonth] = period.split("-").map(Number);
  const latest = data.series.find(
    (p) =>
      p.year === selectedYear && p.month === selectedMonth && p.division === 0,
  )!;
  const divisions = data.series.filter(
    (p) =>
      p.year === selectedYear && p.month === selectedMonth && p.division > 0,
  );
  const positive = divisions
    .filter((p) => p.monthlyIncidence !== null && p.monthlyIncidence > 0)
    .sort((a, b) => (b.monthlyIncidence || 0) - (a.monthlyIncidence || 0));
  const negative = divisions
    .filter((p) => p.monthlyIncidence !== null && p.monthlyIncidence < 0)
    .sort((a, b) => (a.monthlyIncidence || 0) - (b.monthlyIncidence || 0));
  const fmt = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
  const periodLabel = `${MONTHS[selectedMonth]} ${selectedYear}`;
  const previousMonth =
    selectedMonth === 1
      ? `${MONTHS[12]} ${selectedYear - 1}`
      : `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
  const analyticPoints = analytics.series.filter(
    (p) => p.year === selectedYear && p.month === selectedMonth,
  );
  useEffect(() => {
    let active = true;
    const applyPayload = (payload: {
      data: IpcData;
      analytics: IpcAnalyticsData;
    }) => {
      if (!active || !payload.data?.series?.length) return;
      setData(payload.data);
      setAnalytics(payload.analytics);
      const latestPeriod = payload.data.series
        .filter((point) => point.division === 0)
        .sort((a, b) => b.year - a.year || b.month - a.month)[0];
      if (latestPeriod) setPeriod(`${latestPeriod.year}-${latestPeriod.month}`);
    };
    fetch("/api/ipc-data", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "No fue posible actualizar el IPC");
        }
        return payload as { data: IpcData; analytics: IpcAnalyticsData };
      })
      .then((payload) => {
        applyPayload(payload);
        setCacheReady(true);
        return fetch("/api/ipc-data?refresh=1", { cache: "no-store" });
      })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json();
        return payload.cache?.status === "updated" ? payload : null;
      })
      .then((payload) => {
        if (payload) applyPayload(payload);
      })
      .catch(() => {
        // La copia incluida permanece visible cuando la fuente oficial no responde.
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    // El servidor verifica las variantes del nombre una sola vez y comparte el resultado almacenado entre usuarios.
    let current = true;
    fetch(`/api/ipc-bulletin?year=${selectedYear}&month=${selectedMonth}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((result) => {
        if (current) setBulletin({ url: result.url ?? null, checking: false });
      })
      .catch(() => {
        if (current) setBulletin({ url: null, checking: false });
      });
    return () => {
      current = false;
    };
  }, [selectedYear, selectedMonth]);
  if (!cacheReady)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  return (
    <main>
      <PriceHeader
        onLabor={onLabor}
        onInformality={onInformality}
        onIpc={() => {}}
        onIpp={onIpp}
        onBirths={onBirths}
        onFertility={onFertility}
        onDeaths={onDeaths}
        current="ipc"
      />
      <section className="hero wrap ipc-hero">
        <div>
          <span className="eyebrow">Precios e inflación · IPC</span>
          <h1>
            Índice de Precios
            <br />
            al Consumidor
          </h1>
          <p>
            Una lectura interactiva de la evolución de los precios de la canasta
            de consumo de los hogares.
          </p>
        </div>
        <div className="period-box">
          <label htmlFor="ipc-period">Período consultado</label>
          <select
            id="ipc-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {periods.map((p) => (
              <option
                key={`${p.year}-${p.month}`}
                value={`${p.year}-${p.month}`}
              >
                {MONTHS[p.month]} {p.year}
              </option>
            ))}
          </select>
          <small>
            Última actualización: {data.updated} · Base anual {data.base}
          </small>
        </div>
      </section>
      <section className="wrap kpis ipc-kpis">
        <article className="alert">
          <div>
            <h3>Variación mensual</h3>
            <strong>{fmt(latest.monthly)}</strong>
            <p>Respecto de {previousMonth.toLowerCase()}</p>
          </div>
        </article>
        <article>
          <div>
            <h3>Variación acumulada</h3>
            <strong>{fmt(latest.accumulated)}</strong>
            <p>Desde diciembre de {selectedYear - 1}</p>
          </div>
        </article>
        <article>
          <div>
            <h3>Variación en 12 meses</h3>
            <strong>{fmt(latest.annual)}</strong>
            <p>
              Respecto de {MONTHS[selectedMonth].toLowerCase()} de{" "}
              {selectedYear - 1}
            </p>
          </div>
        </article>
        <article>
          <div>
            <h3>Índice general</h3>
            <strong>{latest.index.toFixed(2).replace(".", ",")}</strong>
            <p>Base anual {data.base}</p>
          </div>
        </article>
      </section>
      <section className="wrap dashboard ipc-dashboard">
        <IpcChart
          data={data}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />
        <aside>
          <span className="eyebrow">En contexto · {periodLabel}</span>
          <h2>Qué muestran los datos</h2>
          <div className="insight">
            <b>IPC general</b>
            <p>
              El IPC registró una variación mensual de {fmt(latest.monthly)},
              acumuló {fmt(latest.accumulated)} en el año y {fmt(latest.annual)}{" "}
              en doce meses.
            </p>
          </div>
          {positive[0] && (
            <div className="insight">
              <b>Principal incidencia positiva</b>
              <p>
                {positive[0].label[0] +
                  positive[0].label.slice(1).toLowerCase()}{" "}
                aumentó {fmt(positive[0].monthly)} e incidió{" "}
                {positive[0].monthlyIncidence?.toFixed(3).replace(".", ",")} pp.
              </p>
            </div>
          )}
          {negative[0] && (
            <div className="insight">
              <b>Principal incidencia negativa</b>
              <p>
                {negative[0].label[0] +
                  negative[0].label.slice(1).toLowerCase()}{" "}
                varió {fmt(negative[0].monthly)} e incidió{" "}
                {negative[0].monthlyIncidence?.toFixed(3).replace(".", ",")} pp.
              </p>
            </div>
          )}
          <a href="#ipc-analisis">Ver análisis completo →</a>
        </aside>
      </section>
      <section id="ipc-analisis" className="analysis wrap">
        <div className="section-title">
          <span className="eyebrow">
            Resultados del período · {periodLabel}
          </span>
          <h2>La inflación, en detalle</h2>
          <p>
            Historia de datos construida a partir del boletín y los cuadros
            oficiales del IPC.
          </p>
        </div>
        <div className="analysis-grid">
          <article>
            <span>01</span>
            <h3>Balance de divisiones</h3>
            <p>
              {positive.length} de las 13 divisiones aportaron incidencias
              positivas y {negative.length} incidencias negativas en la
              variación mensual.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Variación mensual</h3>
            <p>
              El IPC General presentó una variación de {fmt(latest.monthly)}{" "}
              respecto del mes anterior.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Variación acumulada</h3>
            <p>
              Desde diciembre del año anterior, el IPC acumuló una variación de{" "}
              {fmt(latest.accumulated)}.
            </p>
          </article>
          <article>
            <span>04</span>
            <h3>Variación en doce meses</h3>
            <p>
              El cambio del IPC respecto del mismo mes del año anterior alcanzó{" "}
              {fmt(latest.annual)}.
            </p>
          </article>
          <article>
            <span>05</span>
            <h3>Mayor aporte positivo</h3>
            <p>
              {positive[0]
                ? `${positive[0].label} incidió ${positive[0].monthlyIncidence?.toFixed(3).replace(".", ",")} pp.`
                : "No hubo incidencias positivas en este período."}
            </p>
          </article>
          <article>
            <span>06</span>
            <h3>Mayor aporte negativo</h3>
            <p>
              {negative[0]
                ? `${negative[0].label} incidió ${negative[0].monthlyIncidence?.toFixed(3).replace(".", ",")} pp.`
                : "No hubo incidencias negativas en este período."}
            </p>
          </article>
        </div>
      </section>
      <section className="ipc-analytics">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">
              Indicadores analíticos · {periodLabel}
            </span>
            <h2>Composición analítica del IPC</h2>
            <p>
              Variaciones del mes seleccionado para cada agregado analítico
              oficial.
            </p>
          </div>
          {analyticPoints.length ? (
            <div className="analytic-grid">
              {analyticPoints.map((item) => (
                <article key={item.label}>
                  <h3>{item.label}</h3>
                  <div>
                    <span>
                      <small>Variación mensual</small>
                      <strong>{fmt(item.monthly)}</strong>
                    </span>
                    <span>
                      <small>Variación acumulada</small>
                      <strong>{fmt(item.accumulated)}</strong>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="analytic-unavailable">
              No hay indicadores analíticos disponibles para {periodLabel} en el
              archivo cargado.
            </div>
          )}
        </div>
      </section>
      <section className="resources">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Centro de recursos</span>
            <h2>Datos y documentación del IPC</h2>
          </div>
          <div className="resource-grid ipc-resource-grid">
            <article>
              <span>01</span>
              <h3>Cuadros estadísticos</h3>
              <p>Series oficiales del IPC base anual 2023=100.</p>
              <div className="resource-links">
                <a href="/ipc-general.xlsx" download>
                  IPC
                </a>
                <a href="https://www.ine.gob.cl/docs/default-source/%C3%ADndice-de-precios-al-consumidor/cuadros-estadisticos/base-anual-2023_100/series-de-tiempo/analiticos-xls.xlsx">
                  Analíticos
                </a>
                <a href="https://www.ine.gob.cl/docs/default-source/%C3%ADndice-de-precios-al-consumidor/cuadros-estadisticos/base-anual-2023_100/series-de-tiempo/analitico-divisiones-ccif2018-xls.xlsx">
                  Analíticos Divisiones CCIF 2028
                </a>
              </div>
            </article>
            {bulletin.url ? (
              <a href={bulletin.url} target="_blank" rel="noreferrer">
                <span>02</span>
                <h3>Boletín</h3>
                <p>
                  Análisis mensual, divisiones y productos destacados de{" "}
                  {periodLabel}.
                </p>
                <b>Ver publicación ↗</b>
              </a>
            ) : (
              <article className="resource-card bulletin-pending">
                <span>02</span>
                <h3>Boletín</h3>
                <p>
                  {bulletin.checking
                    ? `Comprobando la publicación de ${periodLabel}…`
                    : `No se encontró un boletín válido para ${periodLabel}.`}
                </p>
                <b>
                  {bulletin.checking
                    ? "Verificando enlace"
                    : "Publicación no disponible"}
                </b>
              </article>
            )}
            <a href={IPC_SOURCE} target="_blank" rel="noreferrer">
              <span>03</span>
              <h3>Toda la documentación</h3>
              <p>
                Cuadros estadísticos, boletines, documentos de trabajo,
                infografías, metodologías y bases de datos.
              </p>
              <b>Ver documentación ↗</b>
            </a>
          </div>
          <IpcCalculator />
          <PriceSdmxBox dataset="IPC" />
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href={IPC_SOURCE}>Fuente oficial: ine.gob.cl ↗</a>
        </div>
      </footer>
    </main>
  );
}

type IppMetric = "index" | "monthly" | "accumulated" | "annual";
const IPP_METRICS: Record<IppMetric, string> = {
  index: "Índice",
  monthly: "Variación Mensual (%)",
  accumulated: "Variación Acumulada (%)",
  annual: "Variación Anual (%)",
};

function IppSeriesChart({
  title,
  series,
  year,
  month,
}: {
  title: string;
  series: IppPoint[];
  year: number;
  month: number;
}) {
  const [metric, setMetric] = useState<IppMetric>("annual");
  const [quickRange, setQuickRange] = useState<"25" | "60" | "120" | "all">(
    "25",
  );
  const [customRange, setCustomRange] = useState(false);
  // Cada cambio de indicador recalcula la escala y reinicia una transición breve, sin movimientos decorativos excesivos.
  const end = series.findIndex(
    (point) => point.year === year && point.month === month,
  );
  const available = series.slice(0, end + 1);
  const defaultLength = Math.min(25, available.length);
  const [rangeStart, setRangeStart] = useState(
    Math.max(0, available.length - defaultLength),
  );
  const [rangeEnd, setRangeEnd] = useState(Math.max(0, available.length - 1));
  const selectedLength =
    quickRange === "all" ? available.length : Number(quickRange);
  const quickStart = Math.max(0, available.length - selectedLength);
  const visibleStart = !customRange
    ? quickStart
    : Math.min(rangeStart, Math.max(0, available.length - 1));
  const visibleEnd = !customRange
    ? Math.max(0, available.length - 1)
    : Math.min(rangeEnd, Math.max(0, available.length - 1));
  const points = available.slice(visibleStart, visibleEnd + 1);
  const values = points.map((point) => point[metric]);
  const includeZero = metric !== "index";
  const bounded = includeZero ? [...values, 0] : values;
  const rawMin = Math.min(...bounded),
    rawMax = Math.max(...bounded),
    span = Math.max(rawMax - rawMin, metric === "index" ? 5 : 1);
  const min = rawMin - span * 0.16,
    max = rawMax + span * 0.16,
    w = 660,
    h = 340,
    pL = 62,
    pR = 20,
    pT = 24,
    pB = 96;
  const x = (index: number) =>
    pL + (index * (w - pL - pR)) / Math.max(1, points.length - 1);
  const y = (value: number) =>
    h - pB - ((value - min) * (h - pT - pB)) / (max - min);
  const ticks = Array.from(
    { length: 5 },
    (_, index) => min + ((max - min) * index) / 4,
  );
  const line = points
    .map(
      (point, index) => `${index ? "L" : "M"}${x(index)},${y(point[metric])}`,
    )
    .join(" ");
  const short = (point: IppPoint) =>
    `${MONTHS[point.month].slice(0, 3).toLowerCase()}-${String(point.year).slice(-2)}`;
  const format = (value: number) =>
    `${value.toFixed(metric === "index" ? 2 : 1).replace(".", ",")}${metric === "index" ? "" : "%"}`;
  const periodName = (point: IppPoint | undefined) =>
    point ? `${MONTHS[point.month]} ${point.year}` : "Sin datos";
  const labelStep = Math.max(1, Math.ceil(points.length / 12));
  const selectQuickRange = (value: "25" | "60" | "120" | "all") => {
    setQuickRange(value);
    setCustomRange(false);
  };
  return (
    <div className="ipp-chart">
      <div className="ipp-chart-head">
        <h4>{title}</h4>
        <label>
          Indicador
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as IppMetric)}
          >
            {Object.entries(IPP_METRICS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <svg
        className="chart chart-motion"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${title}: ${IPP_METRICS[metric]}`}
      >
        {ticks.map((value) => (
          <g key={value}>
            <line x1={pL} x2={w - pR} y1={y(value)} y2={y(value)} />
            <text x={pL - 9} y={y(value) + 4} textAnchor="end">
              {format(value)}
            </text>
          </g>
        ))}
        {points.map((point, index) =>
          index % labelStep === 0 || index === points.length - 1 ? (
            <text
              key={`${point.year}-${point.month}`}
              transform={`translate(${x(index)},${h - pB + 14}) rotate(-90)`}
              textAnchor="end"
            >
              {short(point)}
            </text>
          ) : null,
        )}
        <path className="line" d={line} style={{ stroke: "#123f87" }} />
        {points.map((point, index) => (
          <circle
            key={`${point.year}-${point.month}`}
            cx={x(index)}
            cy={y(point[metric])}
            r={index === points.length - 1 ? 4.5 : 3}
            fill="#123f87"
          >
            <title>
              {MONTHS[point.month]} {point.year}: {format(point[metric])}
            </title>
          </circle>
        ))}
      </svg>
      <div className="ipp-time-levels">
        <div className="ipp-time-reading">
          <span>Lectura actual</span>
          <strong>
            {periodName(points[0])} — {periodName(points.at(-1))}
          </strong>
          <small>{points.length} períodos visibles</small>
        </div>
        <div className="ipp-time-quick" aria-label="Rangos históricos rápidos">
          <span>Ampliar período</span>
          <div>
            {[
              ["25", "25 períodos"],
              ["60", "5 años"],
              ["120", "10 años"],
              ["all", "Serie completa"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={!customRange && quickRange === value}
                onClick={() =>
                  selectQuickRange(value as "25" | "60" | "120" | "all")
                }
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={customRange}
              onClick={() => setCustomRange((current) => !current)}
            >
              Elegir fechas
            </button>
          </div>
        </div>
        {customRange && (
          <div className="ipp-time-custom">
            <label>
              Desde
              <select
                value={rangeStart}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setRangeStart(next);
                  if (next > rangeEnd) setRangeEnd(next);
                }}
              >
                {available.map((point, index) => (
                  <option key={`${point.year}-${point.month}`} value={index}>
                    {periodName(point)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hasta
              <select
                value={rangeEnd}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setRangeEnd(next);
                  if (next < rangeStart) setRangeStart(next);
                }}
              >
                {available.map((point, index) => (
                  <option key={`${point.year}-${point.month}`} value={index}>
                    {periodName(point)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
      <p>
        Fuente: INE. Base anual 2019=100. {points.length} períodos visibles.
      </p>
    </div>
  );
}

function IppDivisionChart({
  series,
  year,
  month,
}: {
  series: IppDivisionPoint[];
  year: number;
  month: number;
}) {
  const [metric, setMetric] = useState<IppMetric>("annual");
  const [selectedDivisions, setSelectedDivisions] = useState<number[]>([10]);
  const tween = useChartTween(
    { divisions: selectedDivisions, metric },
    `${metric}|${selectedDivisions.join("-")}`,
  );
  const divisions = useMemo(
    () =>
      Array.from(
        new Map(series.map((point) => [point.division, point.label])).entries(),
      ).sort((a, b) => a[0] - b[0]),
    [series],
  );
  const end = series.findIndex(
    (point) =>
      point.year === year && point.month === month && point.division === 10,
  );
  const allPeriods = series
    .filter((point) => point.division === 10)
    .slice(0, end + 1);
  const divisionTemporal = useTemporalWindow(
    allPeriods,
    allPeriods.map((point) => `${MONTHS[point.month]} ${point.year}`),
    [
      { value: 25, label: "25 períodos" },
      { value: 60, label: "5 años" },
      { value: 120, label: "10 años" },
      { value: "all", label: "Serie completa" },
    ],
    25,
  );
  const periods = divisionTemporal.visible;
  const visibleSeries = selectedDivisions.map((division) => ({
    division,
    label:
      divisions.find((item) => item[0] === division)?.[1] ??
      `División ${division}`,
    points: periods
      .map((period) =>
        series.find(
          (point) =>
            point.division === division &&
            point.year === period.year &&
            point.month === period.month,
        ),
      )
      .filter((point): point is IppDivisionPoint => Boolean(point)),
  }));
  const values = visibleSeries.flatMap((item) =>
    item.points.map((point) => point[metric]),
  );
  const bounded = metric === "index" ? values : [...values, 0];
  const rawMin = Math.min(...bounded),
    rawMax = Math.max(...bounded),
    span = Math.max(rawMax - rawMin, metric === "index" ? 5 : 1);
  const min = rawMin - span * 0.14,
    max = rawMax + span * 0.14,
    w = 660,
    h = 340,
    pL = 62,
    pR = 20,
    pT = 24,
    pB = 96;
  const x = (index: number) =>
    pL + (index * (w - pL - pR)) / Math.max(1, periods.length - 1);
  const y = (value: number) =>
    h - pB - ((value - min) * (h - pT - pB)) / (max - min);
  const ticks = Array.from(
    { length: 5 },
    (_, index) => min + ((max - min) * index) / 4,
  );
  const colors = ["#123f87", "#e63b35", "#0096bd", "#007f73", "#7a4ca0"];
  const format = (value: number) =>
    `${value.toFixed(metric === "index" ? 2 : 1).replace(".", ",")}${metric === "index" ? "" : "%"}`;
  const previousRaw = tween.previous.divisions.flatMap((division) =>
    periods
      .map(
        (period) =>
          series.find(
            (item) =>
              item.division === division &&
              item.year === period.year &&
              item.month === period.month,
          )?.[tween.previous.metric],
      )
      .filter((value): value is number => value !== undefined),
  );
  const previousBounded =
      tween.previous.metric === "index" ? previousRaw : [...previousRaw, 0],
    previousRawMin = Math.min(...previousBounded),
    previousRawMax = Math.max(...previousBounded),
    previousSpan = Math.max(
      previousRawMax - previousRawMin,
      tween.previous.metric === "index" ? 5 : 1,
    ),
    previousMin = previousRawMin - previousSpan * 0.14,
    previousMax = previousRawMax + previousSpan * 0.14;
  const animatedValue = (point: IppDivisionPoint, seriesIndex: number) => {
    const previousDivision = tween.previous.divisions.includes(point.division)
      ? point.division
      : (tween.previous.divisions[seriesIndex] ??
        tween.previous.divisions[0] ??
        point.division);
    const previousPoint = series.find(
      (item) =>
        item.division === previousDivision &&
        item.year === point.year &&
        item.month === point.month,
    );
    const start = previousPoint?.[tween.previous.metric] ?? point[metric];
    const mappedStart =
      min +
      ((start - previousMin) / Math.max(0.0001, previousMax - previousMin)) *
        (max - min);
    return mappedStart + (point[metric] - mappedStart) * tween.progress;
  };
  const selectDivisions = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = Array.from(event.target.selectedOptions).map((option) =>
      Number(option.value),
    );
    // Se conserva al menos una serie y se limita la comparación a cinco divisiones.
    if (next.length && next.length <= 5) setSelectedDivisions(next);
  };
  return (
    <div className="ipp-chart">
      <div className="ipp-chart-head ipp-division-head">
        <h4>Evolución IPPMan: Divisiones</h4>
        <div className="ipp-division-controls">
          <label>
            Indicador
            <select
              value={metric}
              onChange={(event) => setMetric(event.target.value as IppMetric)}
            >
              {Object.entries(IPP_METRICS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Divisiones <small>{selectedDivisions.length}/5 seleccionadas</small>
            <select
              className="ipp-division-select"
              multiple
              size={5}
              value={selectedDivisions.map(String)}
              onChange={selectDivisions}
            >
              {divisions.map(([division, label]) => (
                <option
                  key={division}
                  value={division}
                  disabled={
                    selectedDivisions.length >= 5 &&
                    !selectedDivisions.includes(division)
                  }
                >
                  {division}. {label}
                </option>
              ))}
            </select>
          </label>
          <p>Use Ctrl o Cmd para seleccionar varias divisiones.</p>
        </div>
      </div>
      <div className="series-legend ipp-division-legend">
        {visibleSeries.map((item, index) => (
          <span key={item.division}>
            <i style={{ background: colors[index] }} />
            <b>
              {item.division}. {item.label}
            </b>
          </span>
        ))}
      </div>
      <svg
        className="chart chart-motion"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Evolución por divisiones de IPPMan: ${IPP_METRICS[metric]}`}
      >
        {ticks.map((value) => (
          <g key={value}>
            <line x1={pL} x2={w - pR} y1={y(value)} y2={y(value)} />
            <text x={pL - 9} y={y(value) + 4} textAnchor="end">
              {format(value)}
            </text>
          </g>
        ))}
        {periods.map((point, index) => (
          <text
            key={`${point.year}-${point.month}`}
            transform={`translate(${x(index)},${h - pB + 14}) rotate(-90)`}
            textAnchor="end"
          >
            {MONTHS[point.month].slice(0, 3).toLowerCase()}-
            {String(point.year).slice(-2)}
          </text>
        ))}
        {visibleSeries.map((item, seriesIndex) => {
          const line = item.points
            .map(
              (point, index) =>
                `${index ? "L" : "M"}${x(index)},${y(animatedValue(point, seriesIndex))}`,
            )
            .join(" ");
          return (
            <g key={`division-slot-${seriesIndex}`}>
              <path
                className="line"
                d={line}
                style={{ stroke: colors[seriesIndex] }}
              />
              {item.points.map((point, index) => (
                <circle
                  key={`${point.year}-${point.month}`}
                  cx={x(index)}
                  cy={y(animatedValue(point, seriesIndex))}
                  r={index === item.points.length - 1 ? 4.5 : 3}
                  fill={colors[seriesIndex]}
                >
                  <title>
                    {item.division}. {item.label}, {MONTHS[point.month]}{" "}
                    {point.year}: {format(point[metric])}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      {divisionTemporal.controls}
      <p>
        {periods.length} períodos visibles hasta {MONTHS[month]} {year}.
        Divisiones identificadas mediante la columna Glosa del cuadro oficial.
      </p>
    </div>
  );
}

function IppSectorSection({
  title,
  code,
  detail,
  year,
  month,
  divisions,
}: {
  title: string;
  code: string;
  detail: IppDetail;
  year: number;
  month: number;
  divisions?: IppDivisionPoint[];
}) {
  const point = detail.series.find(
    (item) => item.year === year && item.month === month,
  )!;
  const summary = detail.summaries[`${year}-${month}`];
  const periodLabel = `${MONTHS[month]} ${year}`;
  const variation = (value: number) =>
    `${Math.abs(value).toFixed(1).replace(".", ",")}%`;
  const movement = (value: number) =>
    value > 0
      ? `aumentó ${variation(value)}`
      : value < 0
        ? `disminuyó ${variation(value)}`
        : "no presentó variación";
  const leadingClass = summary?.topClasses[0];
  const leadingProduct = summary?.topProducts[0];
  return (
    <section className="ipp-sector">
      <div className="wrap">
        <div className="section-title">
          <span className="eyebrow">
            Índice de Precios de Productor por sector económico · {periodLabel}
          </span>
          <h2>{title}</h2>
        </div>
        <div className="ipp-sector-layout">
          <div className="ipp-story">
            <p className="lead">
              El {code} <b>{movement(point.monthly)}</b> respecto del mes
              anterior y acumuló{" "}
              <b>{point.accumulated.toFixed(1).replace(".", ",")}%</b> en lo que
              va del año.
            </p>
            {summary && (
              <>
                <p>
                  De las {summary.classes} clases que componen el índice,{" "}
                  <b>{summary.up} fueron al alza</b>, {summary.down} presentaron
                  descensos y {summary.zero} registraron nula variación.
                </p>
                {leadingClass && (
                  <p>
                    La clase con mayor incidencia positiva fue{" "}
                    <b>{leadingClass.label}</b> (
                    {leadingClass.monthly === null
                      ? "cifra no publicable"
                      : `${leadingClass.monthly.toFixed(1).replace(".", ",")}%`}
                    ), con {leadingClass.incidence.toFixed(3).replace(".", ",")}{" "}
                    pp.
                  </p>
                )}
                {leadingProduct && (
                  <p>
                    El producto con mayor influencia positiva fue{" "}
                    <b>{leadingProduct.label}</b> (
                    {leadingProduct.monthly === null
                      ? "cifra no publicable"
                      : `${leadingProduct.monthly.toFixed(1).replace(".", ",")}%`}
                    ), con{" "}
                    {leadingProduct.incidence.toFixed(3).replace(".", ",")} pp.
                  </p>
                )}
              </>
            )}
          </div>
          <div className="ipp-sector-kpis">
            <span>
              <small>Índice</small>
              <strong>{point.index.toFixed(2).replace(".", ",")}</strong>
            </span>
            <span>
              <small>Variación mensual</small>
              <strong>{point.monthly.toFixed(1).replace(".", ",")}%</strong>
            </span>
            <span>
              <small>Variación 12 meses</small>
              <strong>{point.annual.toFixed(1).replace(".", ",")}%</strong>
            </span>
          </div>
        </div>
        <div
          className={`ipp-chart-pair ${divisions ? "" : "ipp-single-chart"}`}
        >
          <IppSeriesChart
            title={`Evolución ${code}`}
            series={detail.series}
            year={year}
            month={month}
          />
          {divisions && (
            <IppDivisionChart series={divisions} year={year} month={month} />
          )}
        </div>
      </div>
    </section>
  );
}

function IppPage({
  onLabor,
  onInformality,
  onIpc,
  onBirths,
  onFertility,
  onDeaths,
}: {
  onLabor: () => void;
  onInformality: () => void;
  onIpc: () => void;
  onBirths: () => void;
  onFertility: () => void;
  onDeaths: () => void;
}) {
  const fallbackData = ippRawData as IppData;
  const fallbackDivisions = ippmanDivisionsRaw as IppDivisionPoint[];
  const [data, setData] = useState<IppData>(fallbackData);
  const [manufacturingDivisions, setManufacturingDivisions] =
    useState<IppDivisionPoint[]>(fallbackDivisions);
  const [cacheReady, setCacheReady] = useState(false);
  const periods = useMemo(
    () =>
      data.industries
        .map((point) => ({ year: point.year, month: point.month }))
        .sort((a, b) => b.year - a.year || b.month - a.month),
    [data],
  );
  const [period, setPeriod] = useState(
    `${periods[0].year}-${periods[0].month}`,
  );
  useEffect(() => {
    let active = true;
    const read = async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "No fue posible actualizar el IPP");
      return payload as {
        data: IppData;
        divisions: IppDivisionPoint[];
      };
    };
    const apply = (payload: {
      data: IppData;
      divisions: IppDivisionPoint[];
    }) => {
      if (!active || !payload.data?.industries?.length) return;
      setData(payload.data);
      if (payload.divisions?.length)
        setManufacturingDivisions(payload.divisions);
      const latest = payload.data.industries.at(-1);
      if (latest) setPeriod(`${latest.year}-${latest.month}`);
    };
    const synchronize = async () => {
      // La copia incorporada se ve desde el primer render. Luego se recupera
      // D1 sin tocar ine.gob.cl y, en una segunda petición, se verifica si la
      // fuente oficial cambió durante el día.
      try {
        apply(await read("/api/ipp-data"));
        setCacheReady(true);
      } catch {
        // Si D1 aún no fue inicializada, la copia incorporada sigue visible.
      }
      try {
        const refreshed = await read("/api/ipp-data?refresh=1");
        if (
          (refreshed as { cache?: { status?: string } }).cache?.status ===
          "updated"
        )
          apply(refreshed);
      } catch {
        // La última copia disponible permanece visible si el INE no responde.
        setCacheReady(true);
      }
    };
    void synchronize();
    return () => {
      active = false;
    };
  }, []);
  if (!cacheReady)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  const [year, month] = period.split("-").map(Number);
  const current = data.industries.find(
    (point) => point.year === year && point.month === month,
  )!;
  const noCopper = data.noCopper.find(
    (point) => point.year === year && point.month === month,
  )!;
  const manufacturing = data.manufacturing.series.find(
    (point) => point.year === year && point.month === month,
  )!;
  const mining = data.mining.series.find(
    (point) => point.year === year && point.month === month,
  )!;
  const ipdega = data.ipdega.series.find(
    (point) => point.year === year && point.month === month,
  )!;
  const sectors = [
    { code: "IPPMan", label: "Industria manufacturera", point: manufacturing },
    { code: "IPPMin", label: "Minería", point: mining },
    { code: "IPDEGA", label: "Electricidad, gas y agua", point: ipdega },
  ];
  const fmt = (value: number, digits = 1) =>
    `${value.toFixed(digits).replace(".", ",")}%`;
  const periodLabel = `${MONTHS[month]} ${year}`;
  const strongest = [...sectors].sort(
    (a, b) => Math.abs(b.point.monthly) - Math.abs(a.point.monthly),
  )[0];
  return (
    <main>
      <PriceHeader
        onLabor={onLabor}
        onInformality={onInformality}
        onIpc={onIpc}
        onIpp={() => {}}
        onBirths={onBirths}
        onFertility={onFertility}
        onDeaths={onDeaths}
        current="ipp"
      />
      <section className="hero wrap ipc-hero ipp-hero">
        <div>
          <span className="eyebrow">Precios e inflación · IPP</span>
          <h1>
            Índice de Precios
            <br />
            de Productor
          </h1>
          <p>
            La evolución de los precios de producción de minería, manufactura y
            distribución de electricidad, gas y agua.
          </p>
        </div>
        <div className="period-box">
          <label htmlFor="ipp-period">Período consultado</label>
          <select
            id="ipp-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            {periods.map((item) => (
              <option
                key={`${item.year}-${item.month}`}
                value={`${item.year}-${item.month}`}
              >
                {MONTHS[item.month]} {item.year}
              </option>
            ))}
          </select>
          <small>
            Última actualización: {data.updated} · Base anual {data.base}
          </small>
        </div>
      </section>
      <section className="wrap ipp-intro">
        <div>
          <span className="eyebrow">Resultado principal · {periodLabel}</span>
          <h2>Índice de Precios de Productor (IPP) de Industrias</h2>
          <p className="lead">
            El IPP de Industrias registró una variación mensual de{" "}
            <b>{fmt(current.monthly)}</b>, acumuló{" "}
            <b>{fmt(current.accumulated)}</b> en el año y alcanzó una variación
            de <b>{fmt(current.annual)}</b> en doce meses.
          </p>
          <p>
            El sector con el cambio mensual de mayor magnitud fue{" "}
            <b>{strongest.label.toLowerCase()}</b>, con{" "}
            {fmt(strongest.point.monthly)}. El índice analítico de industrias
            sin cobre presentó una variación mensual de{" "}
            <b>{fmt(noCopper.monthly)}</b> y acumuló{" "}
            <b>{fmt(noCopper.accumulated)}</b>.
          </p>
        </div>
        <aside className="ipp-summary">
          <span>IPP Industrias</span>
          <strong>{current.index.toFixed(2).replace(".", ",")}</strong>
          <div>
            <small>
              Mensual <b>{fmt(current.monthly)}</b>
            </small>
            <small>
              Acumulada <b>{fmt(current.accumulated)}</b>
            </small>
            <small>
              12 meses <b>{fmt(current.annual)}</b>
            </small>
          </div>
        </aside>
      </section>
      <section className="wrap ipp-sector-comparison">
        <div className="section-title">
          <span className="eyebrow">Sectores del IPP de Industrias</span>
          <h2>Qué explica el resultado mensual</h2>
        </div>
        <div className="ipp-sector-cards">
          {sectors.map((item) => (
            <article key={item.code}>
              <span>{item.code}</span>
              <h3>{item.label}</h3>
              <strong>{fmt(item.point.monthly)}</strong>
              <div className="ipp-change-track">
                <i
                  style={{
                    width: `${Math.min(100, (Math.abs(item.point.monthly) / Math.max(...sectors.map((sector) => Math.abs(sector.point.monthly)), 1)) * 100)}%`,
                  }}
                />
              </div>
              <small>
                Índice {item.point.index.toFixed(2).replace(".", ",")} ·
                Acumulada {fmt(item.point.accumulated)}
              </small>
            </article>
          ))}
        </div>
        <div className="ipp-chart-pair ipp-main-charts">
          <IppSeriesChart
            title="Evolución IPP Industrias"
            series={data.industries}
            year={year}
            month={month}
          />
          <IppSeriesChart
            title="Evolución IPP Industrias sin cobre"
            series={data.noCopper}
            year={year}
            month={month}
          />
        </div>
      </section>
      <IppSectorSection
        title="Índice de Precios de Productor Industria Manufacturera"
        code="IPPMan"
        detail={data.manufacturing}
        year={year}
        month={month}
        divisions={manufacturingDivisions}
      />
      <IppSectorSection
        title="Índice de Precios de Productor Minería"
        code="IPPMin"
        detail={data.mining}
        year={year}
        month={month}
      />
      <IppSectorSection
        title="Índice de Precios de Distribución de Electricidad, Gas y Agua"
        code="IPDEGA"
        detail={data.ipdega}
        year={year}
        month={month}
      />
      <section className="resources">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Centro de recursos</span>
            <h2>Datos y documentación del IPP</h2>
          </div>
          <PriceSdmxBox dataset="IPP" />
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href="https://www.ine.gob.cl/estadisticas-por-tema/precios-e-inflacion/indice-de-precios-de-productor">
            Fuente oficial: ine.gob.cl ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

function InformalityLineChart({
  points: allPoints,
  categoryPoints: allCategoryPoints,
  categoryFootnotes,
}: {
  points: InformalityRate[];
  categoryPoints: CategorySeriesPoint[];
  categoryFootnotes: Record<string, string>;
}) {
  const [mode, setMode] = useState<"" | "rate" | "count">("rate");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const informalityPresets: TemporalPreset[] = [
    { value: 25, label: "25 períodos" },
    { value: 60, label: "5 años" },
    { value: 120, label: "10 años" },
    { value: "all", label: "Serie completa" },
  ];
  const temporal = useTemporalWindow(
    allPoints,
    allPoints.map((point) => `${formatQuarter(point.quarter)} ${point.year}`),
    informalityPresets,
    25,
  );
  const points = temporal.visible;
  const categoryPoints = allCategoryPoints.slice(
    temporal.start,
    temporal.end + 1,
  );
  const tween = useChartTween(
    { mode, selectedCategories },
    `${mode}|${selectedCategories.join("-")}`,
  );
  const w = 880,
    h = 350,
    pL = 88,
    pR = 24,
    pT = 24,
    pB = 92;
  const baseSeries =
    mode === "rate"
      ? [
          { key: "rate" as const, label: "Total país", color: "#123f87" },
          { key: "womenRate" as const, label: "Mujeres", color: "#e63b35" },
          { key: "menRate" as const, label: "Hombres", color: "#0096bd" },
        ]
      : mode === "count"
        ? [
            {
              key: "informal" as const,
              label: "Ambos sexos",
              color: "#123f87",
            },
            {
              key: "womenInformal" as const,
              label: "Mujeres",
              color: "#e63b35",
            },
            { key: "menInformal" as const, label: "Hombres", color: "#0096bd" },
          ]
        : [];
  const visibleBaseSeries = selectedCategories.length === 0 ? baseSeries : [];
  const categoryOptions =
      categoryPoints[0]?.items
        .filter((item) => !item.label.startsWith("Total"))
        .flatMap((item) =>
          ["formal", "informal"].map((kind) => ({
            id: `${item.label}|${kind}`,
            label: `${item.label} (${kind === "formal" ? "formales" : "informales"})`,
            references: item.references,
          })),
        ) || [],
    categoryColors = ["#7b4bb7", "#d97706", "#16805f", "#b83280", "#5b6b19"];
  const categorySeries = selectedCategories.map((id, index) => {
    const [category, kind] = id.split("|") as [string, "formal" | "informal"];
    return {
      id,
      label: `${category} (${kind === "formal" ? "formales" : "informales"})`,
      color: categoryColors[index],
      values: categoryPoints.map((point) => {
        const item = point.items.find((value) => value.label === category);
        return {
          value: item ? Math.round(item[kind] * 1000) : null,
          quality: item?.[`${kind}Quality`] || null,
          references: item?.references || [],
        };
      }),
    };
  });
  const snapshotValues = (snapshot: {
    mode: "" | "rate" | "count";
    selectedCategories: string[];
  }) => {
    if (snapshot.selectedCategories.length)
      return snapshot.selectedCategories.map((id) => {
        const [category, kind] = id.split("|") as [
          string,
          "formal" | "informal",
        ];
        return categoryPoints.map((point) => {
          const item = point.items.find((value) => value.label === category);
          return item ? Math.round(item[kind] * 1000) : 0;
        });
      });
    const keys =
      snapshot.mode === "rate"
        ? (["rate", "womenRate", "menRate"] as const)
        : snapshot.mode === "count"
          ? (["informal", "womenInformal", "menInformal"] as const)
          : [];
    return keys.map((key) =>
      points.map((point) =>
        snapshot.mode === "count" ? Math.round(point[key] * 1000) : point[key],
      ),
    );
  };
  const previousValues = snapshotValues(tween.previous);
  const categoryMode = selectedCategories.length > 0;
  const baseValue = (
    point: InformalityRate,
    key: (typeof visibleBaseSeries)[number]["key"],
  ) => (mode === "count" ? Math.round(point[key] * 1000) : point[key]);
  const baseValues = points.flatMap((point) =>
      visibleBaseSeries.map((item) => baseValue(point, item.key)),
    ),
    categoryValues = categorySeries.flatMap((series) =>
      series.values
        .map((item) => item.value)
        .filter((value): value is number => value !== null),
    ),
    values = [...baseValues, ...categoryValues],
    safeValues = values.length ? values : [0, 1],
    rawMin = Math.min(...safeValues),
    rawMax = Math.max(...safeValues),
    padding = Math.max(
      (rawMax - rawMin) * 0.14,
      categoryMode || mode === "count" ? 10000 : 1,
    );
  const min = Math.max(0, rawMin - padding),
    max = rawMax + padding,
    x = (i: number) =>
      pL + (i * (w - pL - pR)) / Math.max(1, points.length - 1),
    y = (v: number) => h - pB - ((v - min) * (h - pT - pB)) / (max - min);
  const previousFlat = previousValues.flat(),
    previousSafe = previousFlat.length ? previousFlat : [0, 1],
    previousRawMin = Math.min(...previousSafe),
    previousRawMax = Math.max(...previousSafe),
    previousPadding = Math.max(
      (previousRawMax - previousRawMin) * 0.14,
      tween.previous.selectedCategories.length ||
        tween.previous.mode === "count"
        ? 10000
        : 1,
    ),
    previousMin = Math.max(0, previousRawMin - previousPadding),
    previousMax = previousRawMax + previousPadding;
  const interpolate = (
    value: number,
    seriesIndex: number,
    pointIndex: number,
  ) => {
    const source = previousValues[seriesIndex] ?? previousValues[0];
    const start = source?.[pointIndex] ?? value;
    const mappedStart =
      min +
      ((start - previousMin) / Math.max(0.0001, previousMax - previousMin)) *
        (max - min);
    return mappedStart + (value - mappedStart) * tween.progress;
  };
  const categoryY = (value: number) => y(value);
  const valueLabel = (value: number) =>
    !categoryMode && mode === "rate"
      ? `${value.toFixed(1).replace(".", ",")}%`
      : `${Math.round(value).toLocaleString("es-CL")} personas`;
  const title = categoryMode
    ? "Personas ocupadas según categoría en la ocupación"
    : mode === "rate"
      ? "Tasa de ocupación informal, según sexo"
      : mode === "count"
        ? "Cantidad de personas ocupadas informales, según sexo"
        : "Seleccione un indicador";
  const yUnit =
    !categoryMode && mode === "rate" ? "Porcentaje (%)" : "Personas ocupadas";
  const visibleQualities = new Set(
      categorySeries.flatMap((series) =>
        series.values.map((item) => item.quality).filter(Boolean),
      ),
    ),
    visibleReferences = new Set(
      categorySeries.flatMap((series) =>
        series.values.flatMap((item) => item.references),
      ),
    );
  const selectCategories = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = Array.from(
      event.target.selectedOptions,
      (option) => option.value,
    );
    if (next.length <= 5) {
      setSelectedCategories(next);
      if (next.length) setMode("");
    }
  };
  return (
    <div className="chart-shell informal-chart">
      <div className="chart-head">
        <div className="informal-chart-heading">
          <span className="eyebrow">Trimestres móviles</span>
          <h2>{title}</h2>
          <div className="series-legend">
            {visibleBaseSeries.map((series) => (
              <span key={series.key}>
                <i style={{ background: series.color }} />
                <b>{series.label}</b>
              </span>
            ))}
            {categorySeries.map((series) => (
              <span key={series.id}>
                <i style={{ background: series.color }} />
                <b>{series.label}</b>
              </span>
            ))}
          </div>
        </div>
        <div className="informal-chart-controls">
          <label>
            Indicador
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as "" | "rate" | "count");
                setSelectedCategories([]);
              }}
            >
              <option value="">Selecciona un indicador</option>
              <option value="rate">Tasa de ocupación informal</option>
              <option value="count">Cantidad de ocupados informales</option>
            </select>
          </label>
          <label>
            Categoría en la ocupación{" "}
            <small>{selectedCategories.length}/5 seleccionadas</small>
            <select
              className="category-multiselect"
              multiple
              size={Math.min(6, categoryOptions.length)}
              value={selectedCategories}
              onChange={selectCategories}
            >
              {categoryOptions.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={
                    selectedCategories.length >= 5 &&
                    !selectedCategories.includes(option.id)
                  }
                >
                  {option.label}
                  {option.references.length
                    ? ` [${option.references.join(", ")}]`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="multi-help">
            Use Ctrl o Cmd para seleccionar varias categorías. Máximo cinco.
          </p>
        </div>
      </div>
      <svg
        className="chart chart-motion"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`, últimos trece períodos`}
      >
        <text
          className="axis-title"
          transform="translate(22 141) rotate(-90)"
          textAnchor="middle"
        >
          {yUnit}
        </text>
        {[0, 1, 2, 3, 4].map((i) => {
          const v = min + ((max - min) * i) / 4;
          return (
            <g key={i}>
              <line x1={pL} x2={w - pR} y1={y(v)} y2={y(v)} />
              <text x={pL - 9} y={y(v) + 4} textAnchor="end">
                {!categoryMode && mode === "rate"
                  ? `${v.toFixed(1).replace(".", ",")}%`
                  : v.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => (
          <text
            className="x-label"
            key={`${p.year}-${p.quarter}`}
            transform={`translate(${x(i)},${h - pB + 14}) rotate(-90)`}
            textAnchor="end"
          >
            {p.quarter.toLowerCase().replaceAll(" ", "")}{" "}
            {String(p.year).slice(-2)}
          </text>
        ))}
        {visibleBaseSeries.map((s, seriesIndex) => {
          const d = points
            .map(
              (p, i) =>
                `${i ? "L" : "M"}${x(i)},${y(interpolate(baseValue(p, s.key), seriesIndex, i))}`,
            )
            .join(" ");
          return (
            <g key={`series-slot-${seriesIndex}`}>
              <path className="line" d={d} style={{ stroke: s.color }} />
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(interpolate(baseValue(p, s.key), seriesIndex, i))}
                  r={i === points.length - 1 ? 5 : 3}
                  fill={s.color}
                >
                  <title>
                    {s.label}, {formatQuarter(p.quarter)} {p.year}:{" "}
                    {valueLabel(baseValue(p, s.key))}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
        {categorySeries.map((s, seriesIndex) => {
          const d = s.values
            .map((item, i) =>
              item.value === null
                ? ""
                : `${i ? "L" : "M"}${x(i)},${categoryY(interpolate(item.value, seriesIndex, i))}`,
            )
            .join(" ");
          return (
            <g key={`series-slot-${seriesIndex}`}>
              <path
                className="line category-line"
                d={d}
                style={{ stroke: s.color }}
              />
              {s.values.map((item, i) =>
                item.value === null ? null : (
                  <g key={i}>
                    <circle
                      cx={x(i)}
                      cy={categoryY(interpolate(item.value, seriesIndex, i))}
                      r={i === s.values.length - 1 ? 5 : 3}
                      fill={s.color}
                    >
                      <title>
                        {s.label}, {formatQuarter(points[i].quarter)}{" "}
                        {points[i].year}: {valueLabel(item.value)}
                        {item.quality ? ` (${item.quality})` : ""}
                      </title>
                    </circle>
                    {item.quality && (
                      <text
                        className="quality-label"
                        x={x(i) + 5}
                        y={
                          categoryY(interpolate(item.value, seriesIndex, i)) - 7
                        }
                      >
                        {item.quality}
                      </text>
                    )}
                  </g>
                ),
              )}
            </g>
          );
        })}
      </svg>
      {temporal.controls}
      <div className="chart-notes informal-chart-notes">
        {Array.from(visibleReferences).map((reference) => (
          <p key={reference}>
            <b>[{reference}]</b> {categoryFootnotes[reference]}
          </p>
        ))}
        {visibleQualities.has("a") && (
          <p>
            <b>a:</b> estimación poco fiable (coeficiente de variación mayor a
            15% y menor o igual a 30%; en estimaciones de razón, no cumple el
            umbral de aceptación asociado a su error estándar).
          </p>
        )}
        {visibleQualities.has("b") && (
          <p>
            <b>b:</b> estimación no fiable (número de casos muestrales menor a
            60, grados de libertad menores a 9 o coeficiente de variación mayor
            a 30%).
          </p>
        )}
      </div>
      <div className="chart-foot">
        <span>
          Fuente: INE, Encuesta Nacional de Empleo. Las cantidades se expresan
          en personas.
        </span>
        <span>Últimos 13 períodos hasta el trimestre seleccionado.</span>
      </div>
    </div>
  );
}

function InformalityTable({
  title,
  items,
  previous,
}: {
  title: string;
  items: InformalityItem[];
  previous?: InformalityItem[];
}) {
  const prev = new Map((previous || []).map((item) => [item.label, item]));
  const rows = items.map((item) => {
    const prior = prev.get(item.label),
      total = item.formal + item.informal,
      annual = prior ? (item.informal / prior.informal - 1) * 100 : null,
      incidence = prior
        ? ((item.informal - prior.informal) /
            (prev.get(items[0].label)?.informal || 1)) *
          100
        : null;
    return { ...item, rate: (item.informal / total) * 100, annual, incidence };
  });
  const tableType = title.includes("grupo")
    ? "Grupo ocupacional"
    : "Categoría ocupacional";
  return (
    <article className="data-table-wrap">
      <div className="data-table-title">
        <span>Cuadro estadístico · {tableType}</span>
        <h3>{title}</h3>
        <p>
          Total país. El período y las comparaciones corresponden al trimestre
          móvil seleccionado.
        </p>
      </div>
      <div className="table-scroll">
        <table>
          <colgroup>
            <col />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>Clasificación</th>
              <th>Tasa de ocupación informal</th>
              <th>Personas ocupadas informales</th>
              <th>Variación en 12 meses</th>
              <th>Incidencia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isTotal = row.label.startsWith("Total");
              return (
                <tr className={isTotal ? "total-row" : ""} key={row.label}>
                  <th>{row.label}</th>
                  <td>
                    <strong>{row.rate.toFixed(1).replace(".", ",")}%</strong>
                  </td>
                  <td>
                    {Math.round(row.informal * 1000).toLocaleString("es-CL")}
                  </td>
                  <td>
                    <span
                      className={
                        row.annual !== null && row.annual < 0
                          ? "negative-change"
                          : "positive-change"
                      }
                    >
                      {row.annual === null
                        ? "—"
                        : `${row.annual > 0 ? "+" : ""}${row.annual.toFixed(1).replace(".", ",")}%`}
                    </span>
                  </td>
                  <td>
                    {row.incidence === null || isTotal
                      ? "—"
                      : `${row.incidence.toFixed(1).replace(".", ",")} pp.`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>Fuente: INE, Encuesta Nacional de Empleo.</span>
        <span>
          La suma de incidencias puede diferir del total por efecto del
          redondeo.
        </span>
      </div>
    </article>
  );
}

function IncidenceList({
  items,
}: {
  items: { label: string; annual: number; incidence: number }[];
}) {
  // El ranking se presenta dentro del mismo módulo narrativo al que pertenece.
  return (
    <div className="incidence-list">
      <h4>Mayores incidencias positivas</h4>
      <ol>
        {items.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <div>
              <strong>{item.annual.toFixed(1).replace(".", ",")}%</strong>
              <small>{item.incidence.toFixed(1).replace(".", ",")} pp.</small>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LaborSdmxBox({ context }: { context: "ene" | "informality" }) {
  const titleId = `labor-sdmx-title-${context}`;
  return (
    <section className="ene-sdmx" aria-labelledby={titleId}>
      <div className="ene-sdmx-head">
        <div>
          <span className="eyebrow">Datos abiertos · SDMX y API</span>
          <h3 id={titleId}>Todo el mercado laboral en una misma fuente</h3>
          <p>
            Descarga las series de Ocupación y Desocupación e Informalidad
            Laboral, consulta su estructura o intégralas directamente en tus
            aplicaciones. La API revisa los Excel oficiales y añade
            automáticamente los nuevos períodos a la caché pública.
          </p>
        </div>
        <span className="api-badge">Dataflow laboral · versión 2.0</span>
      </div>
      <div className="ene-sdmx-options">
        <article>
          <span>01</span>
          <h4>Descargar todos los datos</h4>
          <p>
            Indicadores principales y desagregaciones por sexo, actividad
            económica, categoría ocupacional, grupo de ocupación y presencia
            efectiva en el empleo.
          </p>
          <a
            href="/api/sdmx/data/INE.GOB.CL,DF_ENE_MERCADO_LABORAL,2.0/all"
            download
          >
            Descargar SDMX-CSV 2.0 ↓
          </a>
        </article>
        <article>
          <span>02</span>
          <h4>Explorar la estructura</h4>
          <p>
            Conceptos, listas de códigos, DSD y Dataflow con agencia oficial
            INE.GOB.CL y cobertura laboral ampliada.
          </p>
          <a href="/sdmx/00_Estructuras_Empleo_2.0.xml" download>
            Descargar estructuras SDMX-ML 3.0 ↓
          </a>
        </article>
        <article>
          <span>03</span>
          <h4>Consumir mediante API</h4>
          <p>
            Filtra por conjunto, sexo, desglose, categoría, indicador y cantidad
            de períodos. La respuesta conserva los decimales de origen.
          </p>
          <a
            href="/api/sdmx/data/INE.GOB.CL,DF_ENE_MERCADO_LABORAL,2.0/all?format=json"
            target="_blank"
            rel="noreferrer"
          >
            Ver metadatos de la API ↗
          </a>
        </article>
      </div>
      <div className="ene-api-example">
        <div>
          <span>Ejemplo · conjunto completo</span>
          <code>
            GET /api/sdmx/data/INE.GOB.CL,DF_ENE_MERCADO_LABORAL,2.0/all
          </code>
        </div>
        <div className="ene-api-query-example">
          <span>Ejemplo · Informalidad por rama · últimos 13 períodos</span>
          <code>
            GET
            /api/sdmx/data/INE.GOB.CL,DF_ENE_MERCADO_LABORAL,2.0/all?dataset=INFORMALITY&amp;breakdown=ECONOMIC_ACTIVITY&amp;last_n_periods=13
          </code>
          <a
            href="/api/sdmx/data/INE.GOB.CL,DF_ENE_MERCADO_LABORAL,2.0/all?dataset=INFORMALITY&breakdown=ECONOMIC_ACTIVITY&last_n_periods=13"
            target="_blank"
            rel="noreferrer"
          >
            Ejecutar consulta y descargar SDMX-CSV ↗
          </a>
        </div>
        <div className="ene-api-meta" aria-label="Metadatos del conjunto">
          <span>
            <b>Frecuencia</b> Trimestre móvil
          </span>
          <span>
            <b>Ámbito</b> Nacional
          </span>
          <span>
            <b>Sexo</b> Total, mujeres y hombres
          </span>
          <span>
            <b>Calidad</b> F, A y B
          </span>
        </div>
        <p>
          Dimensiones: <b>DATASET</b>, <b>REF_AREA</b>, <b>SEX</b>,{" "}
          <b>BREAKDOWN</b>, <b>CATEGORY</b>, <b>INDICATOR</b> y{" "}
          <b>TIME_PERIOD</b>. El período identifica el mes final del trimestre
          móvil. La ruta anterior del piloto permanece disponible por
          compatibilidad.
        </p>
        <div className="ene-sdmx-secondary">
          <a href="/sdmx/Guia_tecnica_Empleo_SDMX_2.0.pdf" download>
            Guía técnica en PDF ↓
          </a>
          <a href="/sdmx/Informe_estructura_SDMX_Empleo_2.0.pdf" download>
            Informe de estructura ↓
          </a>
          <a href="/sdmx/transformar_empleo_sdmx.py" download>
            Actualizador automatizado ↓
          </a>
          <a href="/sdmx/informe_validacion_empleo_2.0.json" download>
            Informe de validación ↓
          </a>
        </div>
      </div>
    </section>
  );
}

function PriceSdmxBox({ dataset }: { dataset: "IPC" | "IPP" }) {
  const isIpc = dataset === "IPC";
  const dataflow = isIpc ? "DF_IPC" : "DF_IPP";
  const titleId = `price-sdmx-title-${dataset.toLowerCase()}`;
  const apiPath = `/api/sdmx/data/INE.GOB.CL,${dataflow},1.0/all`;
  return (
    <section className="ene-sdmx price-sdmx" aria-labelledby={titleId}>
      <div className="ene-sdmx-head">
        <div>
          <span className="eyebrow">Datos abiertos · SDMX y API</span>
          <h3 id={titleId}>
            {isIpc
              ? "IPC interoperable y reutilizable"
              : "Todos los índices de precios de productor"}
          </h3>
          <p>
            Descarga las series en SDMX-CSV, consulta la estructura formal o
            intégralas mediante API. Los nuevos meses se incorporan
            automáticamente cuando cambian los archivos oficiales del INE.
          </p>
        </div>
        <span className="api-badge">Dataflow {dataset} · versión 1.0</span>
      </div>
      <div className="ene-sdmx-options">
        <article>
          <span>01</span>
          <h4>Descargar todos los datos</h4>
          <p>
            {isIpc
              ? "IPC general, divisiones CCIF e índices analíticos, con todos los decimales disponibles."
              : "IPP Industrias, sin cobre, manufactura, minería, IPDEGA, divisiones e impulsores."}
          </p>
          <a href={apiPath} download>
            Descargar SDMX-CSV 1.0 ↓
          </a>
        </article>
        <article>
          <span>02</span>
          <h4>Explorar la estructura</h4>
          <p>
            Conceptos, listas de códigos, DSD y Dataflow con agencia oficial
            INE.GOB.CL, frecuencia mensual y período base.
          </p>
          <a href="/sdmx/00_Estructuras_Precios_1.0.xml" download>
            Descargar estructuras SDMX-ML 3.0 ↓
          </a>
        </article>
        <article>
          <span>03</span>
          <h4>Consumir mediante API</h4>
          <p>
            Filtra por desglose, categoría, indicador, rango temporal o número
            de meses recientes.
          </p>
          <a
            href={`/api/sdmx/metadata?dataset=${dataset}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver metadatos de la API ↗
          </a>
        </article>
      </div>
      <div className="ene-api-example">
        <div>
          <span>Ejemplo · conjunto completo</span>
          <code>GET {apiPath}</code>
        </div>
        <div className="ene-api-query-example">
          <span>Ejemplo · últimos 25 meses del índice y sus variaciones</span>
          <code>
            GET {apiPath}
            ?indicator=INDEX,MONTHLY_CHANGE,ANNUAL_CHANGE&amp;last_n_periods=25
          </code>
          <a
            href={`${apiPath}?indicator=INDEX,MONTHLY_CHANGE,ANNUAL_CHANGE&last_n_periods=25`}
            target="_blank"
            rel="noreferrer"
          >
            Ejecutar consulta y descargar SDMX-CSV ↗
          </a>
        </div>
        <div className="ene-api-meta" aria-label={`Metadatos del ${dataset}`}>
          <span>
            <b>Frecuencia</b> Mensual
          </span>
          <span>
            <b>Ámbito</b> Nacional
          </span>
          <span>
            <b>Agencia</b> INE.GOB.CL
          </span>
          <span>
            <b>Precisión</b> Decimales de origen
          </span>
        </div>
        <p>
          Dimensiones: <b>DATASET</b>, <b>REF_AREA</b>, <b>BREAKDOWN</b>,{" "}
          <b>CATEGORY</b>, <b>INDICATOR</b> y <b>TIME_PERIOD</b>. Las
          observaciones sin marcas de calidad “a” o “b” se codifican como{" "}
          <b>F</b> (estimación fiable), según el criterio aplicado al mercado
          laboral.
        </p>
        <div className="ene-sdmx-secondary">
          <a href="/sdmx/Guia_tecnica_Precios_SDMX_1.0.pdf" download>
            Guía técnica en PDF ↓
          </a>
          <a href="/sdmx/Informe_estructura_SDMX_Precios_1.0.pdf" download>
            Informe de estructura en PDF ↓
          </a>
          <a href="/sdmx/transformar_precios_sdmx.py" download>
            Transformador automatizado ↓
          </a>
          <a href="/sdmx/informe_validacion_precios_1.0.json" download>
            Informe de validación ↓
          </a>
        </div>
      </div>
    </section>
  );
}

function InformalityPage({
  onEne,
  onIpc,
  onIpp,
  onBirths,
  onFertility,
  onDeaths,
}: {
  onEne: () => void;
  onIpc: () => void;
  onIpp: () => void;
  onBirths: () => void;
  onFertility: () => void;
  onDeaths: () => void;
}) {
  const fallback = informalityRawData as InformalityData;
  const [data, setData] = useState<InformalityData>(fallback);
  const [cacheReady, setCacheReady] = useState(false);
  const [period, setPeriod] = useState(
    `${fallback.rates.at(-1)!.year}|${fallback.rates.at(-1)!.quarter}`,
  );

  useEffect(() => {
    let active = true;

    fetch("/api/informality-data", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            payload.error || "No fue posible actualizar los datos",
          );
        }
        return payload as Partial<InformalityData> & {
          cache?: { updatedAt?: string };
        };
      })
      .then((payload) => {
        if (!active) return;
        const next = {
          ...fallback,
          ...payload,
          hours: fallback.hours,
          categoryFootnotes: fallback.categoryFootnotes,
          updated: payload.updated || fallback.updated,
        } as InformalityData;
        setData(next);
        setCacheReady(true);
        const latest = next.rates.at(-1);
        if (latest) setPeriod(`${latest.year}|${latest.quarter}`);
        void fetch("/api/informality-data?refresh=1", { cache: "no-store" })
          .then((response) => (response.ok ? response.json() : null))
          .then((updated) => {
            if (active && updated?.cache?.status === "updated")
              setData({ ...fallback, ...updated } as InformalityData);
          });
      })
      .catch(() => {
        // La versión incluida en el sitio permanece disponible si la fuente falla.
        setCacheReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!cacheReady)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  const periods = [...data.rates].reverse(),
    [yearText, quarter] = period.split("|"),
    year = +yearText;
  const index = data.rates.findIndex(
      (p) => p.year === year && p.quarter === quarter,
    ),
    current = data.rates[index],
    previous = data.rates.find(
      (p) => p.year === year - 1 && p.quarter === quarter,
    );
  const group = data.groups.find(
      (p) => p.year === year && p.quarter === quarter,
    ),
    groupPrev = data.groups.find(
      (p) => p.year === year - 1 && p.quarter === quarter,
    ),
    category = data.categories.find(
      (p) => p.year === year && p.quarter === quarter,
    ),
    categoryPrev = data.categories.find(
      (p) => p.year === year - 1 && p.quarter === quarter,
    ),
    branch = data.branches.find(
      (p) => p.year === year && p.quarter === quarter,
    ),
    branchPrev = data.branches.find(
      (p) => p.year === year - 1 && p.quarter === quarter,
    );
  const rateDelta = previous ? current.rate - previous.rate : null,
    informalAnnual = previous
      ? (current.informal / previous.informal - 1) * 100
      : null;
  const rank = (items?: InformalityItem[], prevItems?: InformalityItem[]) => {
    const pm = new Map((prevItems || []).map((i) => [i.label, i]));
    return (items || [])
      .filter((i) => !i.label.startsWith("Total"))
      .map((i) => ({
        label: i.label,
        annual: pm.get(i.label)
          ? (i.informal / pm.get(i.label)!.informal - 1) * 100
          : 0,
        incidence: pm.get(i.label)
          ? ((i.informal - pm.get(i.label)!.informal) /
              (previous?.informal || 1)) *
            100
          : 0,
      }))
      .sort((a, b) => b.incidence - a.incidence);
  };
  const topBranches = rank(branch?.items, branchPrev?.items).slice(0, 3),
    topCategories = rank(category?.items, categoryPrev?.items).slice(0, 3),
    topGroups = rank(group?.items, groupPrev?.items).slice(0, 3),
    chartPoints = data.rates.slice(0, index + 1),
    categoryChartPoints = chartPoints.map((point) =>
      data.categorySeries.find(
        (item) => item.year === point.year && item.quarter === point.quarter,
      )!,
    ),
    periodLabel = `${formatQuarter(quarter)} de ${year}`;
  const fmt = (v: number | null, d = 1) =>
    v === null ? "—" : `${v.toFixed(d).replace(".", ",")}%`;
  // Estas frases siguen el estilo analítico del boletín y se recalculan para el período elegido.
  const movement = (value: number | null) =>
    value === null
      ? "no dispone de comparación anual"
      : value >= 0
        ? `creció ${fmt(value)}`
        : `disminuyó ${fmt(Math.abs(value))}`;
  const driversText = (items: { label: string; annual: number }[]) =>
    items.length
      ? items
          .slice(0, 2)
          .map((item) => `${item.label.toLowerCase()} (${fmt(item.annual)})`)
          .join(" y ")
      : "no presenta desgloses con incidencias positivas disponibles";
  return (
    <main>
      <PriceHeader
        onLabor={onEne}
        onInformality={() => {}}
        onIpc={onIpc}
        onIpp={onIpp}
        onBirths={onBirths}
        onFertility={onFertility}
        onDeaths={onDeaths}
        current="informality"
      />
      <section className="hero wrap ipc-hero informal-hero">
        <div>
          <span className="eyebrow">Mercado laboral · ENE</span>
          <h1>
            Informalidad
            <br />
            laboral<sup>1</sup>
          </h1>
          <p>
            Una mirada interactiva a la ocupación informal, sus principales
            características y evolución reciente.
          </p>
        </div>
        <div className="period-box">
          <label htmlFor="informal-period">Trimestre móvil consultado</label>
          <select
            id="informal-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {periods.map((p) => (
              <option
                key={`${p.year}-${p.quarter}`}
                value={`${p.year}|${p.quarter}`}
              >
                {formatQuarter(p.quarter)} {p.year}
              </option>
            ))}
          </select>
          <small>Datos oficiales actualizados hasta {data.updated}.</small>
        </div>
      </section>
      <section className="wrap informal-overview">
        <div>
          <span className="eyebrow">Panorama general · {periodLabel}</span>
          <h2>La ocupación informal en cifras</h2>
          <p className="lead">
            La población ocupada informal alcanzó{" "}
            <b>
              {Math.round(current.informal * 1000).toLocaleString("es-CL")}{" "}
              personas
            </b>{" "}
            y representó el <b>{fmt(current.rate)}</b> del total de personas
            ocupadas. En doce meses, la ocupación informal{" "}
            {informalAnnual !== null && informalAnnual >= 0
              ? "creció"
              : "disminuyó"}{" "}
            <b>{fmt(Math.abs(informalAnnual || 0))}</b>.
          </p>
        </div>
        <aside className="informal-summary">
          <span>Tasa de ocupación informal</span>
          <strong>{fmt(current.rate)}</strong>
          <small>
            {rateDelta === null
              ? "Sin comparación anual"
              : `${rateDelta >= 0 ? "+" : "−"}${Math.abs(rateDelta).toFixed(1).replace(".", ",")} pp. en doce meses`}
          </small>
        </aside>
      </section>
      <section className="wrap kpis informal-kpis">
        <article>
          <div>
            <h3>Ocupadas informales</h3>
            <strong>
              {(current.informal / 1000).toFixed(2).replace(".", ",")}{" "}
              <small>mill.</small>
            </strong>
            <p>{fmt(informalAnnual)} en doce meses</p>
          </div>
        </article>
        <article>
          <div>
            <h3>Tasa mujeres</h3>
            <strong>{fmt(current.womenRate)}</strong>
            <p>
              {fmt(previous ? current.womenRate - previous.womenRate : null)}{" "}
              pp. en doce meses
            </p>
          </div>
        </article>
        <article>
          <div>
            <h3>Tasa hombres</h3>
            <strong>{fmt(current.menRate)}</strong>
            <p>
              {fmt(previous ? current.menRate - previous.menRate : null)} pp. en
              doce meses
            </p>
          </div>
        </article>
      </section>
      <section className="wrap informal-chart-section">
        <InformalityLineChart
          points={chartPoints}
          categoryPoints={categoryChartPoints}
          categoryFootnotes={data.categoryFootnotes}
        />
      </section>
      <section className="informal-section">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">
              Principales indicadores · {periodLabel}
            </span>
            <h2>Qué explica la evolución de la informalidad</h2>
            <p>
              Actividad económica, grupo ocupacional y categoría en la
              ocupación.
            </p>
          </div>
          <div className="informal-narratives">
            <article>
              <span className="eyebrow">
                Actividad económica<sup>2</sup>
              </span>
              <h3>Actividad económica</h3>
              <p>
                En doce meses, la población ocupada informal{" "}
                {movement(informalAnnual)}. Esta evolución estuvo influida
                principalmente por <b>{driversText(topBranches)}</b>.
              </p>
              <p>
                Las ramas destacadas se ordenan según su incidencia en la
                variación anual del total de personas ocupadas informales.
              </p>
              <IncidenceList items={topBranches} />
            </article>
            <article>
              <span className="eyebrow">Categoría en la ocupación</span>
              <h3>Análisis por categoría ocupacional</h3>
              <p>
                La evolución anual de las personas ocupadas informales fue
                incidida principalmente por <b>{driversText(topCategories)}</b>.
              </p>
              <p>
                Estas categorías explican los aportes positivos de mayor
                magnitud en el trimestre móvil seleccionado.
              </p>
              <IncidenceList items={topCategories} />
            </article>
            <article>
              <span className="eyebrow">
                Grupo ocupacional<sup>3</sup>
              </span>
              <h3>Análisis por grupo ocupacional</h3>
              <p>
                Las principales incidencias en la variación anual de la
                población ocupada informal provinieron de{" "}
                <b>{driversText(topGroups)}</b>.
              </p>
              <p>
                El detalle se presenta conforme a los grandes grupos de la
                clasificación CIUO 08.CL.
              </p>
              <IncidenceList items={topGroups} />
            </article>
          </div>
          <div className="informality-tables">
            <div className="tables-heading">
              <span className="eyebrow">Detalle estadístico</span>
              <h3>Resultados por clasificación ocupacional</h3>
              <p>
                Consulte las estimaciones y su evolución anual para cada grupo y
                categoría.
              </p>
            </div>
            {group && (
              <InformalityTable
                title="Población ocupada informal según grupo ocupacional (CIUO 08.CL)"
                items={group.items}
                previous={groupPrev?.items}
              />
            )}
            {category && (
              <InformalityTable
                title="Población ocupada informal según categoría en la ocupación"
                items={category.items}
                previous={categoryPrev?.items}
              />
            )}
          </div>
          <div className="informality-footnotes">
            <p>
              <sup>1</sup> A partir de la difusión de los resultados del
              trimestre móvil febrero-abril de 2022, la Encuesta Nacional de
              Empleo (ENE) publica una nota estadística que presenta las
              principales estimaciones, con sus respectivas desagregaciones, de
              acuerdo con los criterios de calidad estadística institucional,
              además de los códigos AAPOR, que presentan indicadores de
              rendimiento y calidad en el monitoreo del proceso de recolección
              de datos. Para más información, ver la Nota estadística ENE N.º
              48.
            </p>
            <p>
              <sup>2</sup> Se refiere al sector al que pertenece la unidad
              económica que le paga el sueldo a la persona ocupada, o de la que
              es dueño, por lo que la rama de actividad económica puede diferir
              de aquella donde trabaja la persona ocupada, para los casos en que
              sea subcontratada.
            </p>
            <p>
              <sup>3</sup> Adaptación nacional del Clasificador Internacional
              Uniforme de Ocupaciones del año 2008 (CIUO 08.CL).
            </p>
          </div>
        </div>
      </section>
      <section className="resources informal-resources">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Centro de recursos</span>
            <h2>Datos y documentación de Informalidad Laboral</h2>
          </div>
          <div className="resource-grid informal-resource-grid">
            <article>
              <span>01</span>
              <h3>Cuadros estadísticos</h3>
              <p>
                Series oficiales de informalidad laboral de la Encuesta Nacional
                de Empleo.
              </p>
              <div className="resource-links">
                <a href="https://www.ine.gob.cl/docs/default-source/informalidad-y-condiciones-laborales/cuadros-estadisticos/proyecciones_censo_2017/informalidad_tasas.xlsx">
                  Informalidad laboral y tasa de ocupación informal
                </a>
                <a href="https://www.ine.gob.cl/docs/default-source/informalidad-y-condiciones-laborales/cuadros-estadisticos/proyecciones_censo_2017/informalidad_rama.xlsx">
                  Informalidad laboral por rama de actividad económica de la
                  empresa que paga
                </a>
                <a href="https://www.ine.gob.cl/docs/default-source/informalidad-y-condiciones-laborales/cuadros-estadisticos/proyecciones_censo_2017/informalidad_categoria.xlsx">
                  Informalidad laboral por categoría en la ocupación
                </a>
                <a href="https://www.ine.gob.cl/docs/default-source/informalidad-y-condiciones-laborales/cuadros-estadisticos/proyecciones_censo_2017/informalidad_grupo.xlsx">
                  Informalidad laboral por grupo de ocupación
                </a>
              </div>
            </article>
            <article>
              <span>02</span>
              <h3>Metodología</h3>
              <p>
                Conceptos, definiciones y criterios utilizados para medir la
                informalidad laboral.
              </p>
              <div className="resource-links">
                <a href="https://www.ine.gob.cl/docs/default-source/informalidad-y-condiciones-laborales/metodologia/documentos/metodologia-informalidad-2021.pdf">
                  Marco conceptual y manual metodológico 2021
                </a>
                <a href="https://www.ine.gob.cl/docs/default-source/informalidad-y-condiciones-laborales/metodologia/documentos/glosario-informalidad-2019.pdf">
                  Glosario 2019
                </a>
              </div>
            </article>
            <a href="https://www.ine.gob.cl/estadisticas-por-tema/mercado-laboral/informalidad-laboral">
              <span>03</span>
              <h3>Toda la documentación</h3>
              <p>
                Cuadros estadísticos, boletines, separatas técnicas, infografías
                y documentos metodológicos.
              </p>
              <b>Ver documentación ↗</b>
            </a>
          </div>
          <LaborSdmxBox context="informality" />
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href="https://www.ine.gob.cl/estadisticas-por-tema/mercado-laboral/informalidad-laboral">
            Fuente oficial: ine.gob.cl ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

const BIRTH_SERIES = {
  observed: "Nacimientos observados",
  men: "Nacimientos hombres",
  women: "Nacimientos mujeres",
  masculinity: "Índice de masculinidad",
} as const;
type BirthSeriesKey = keyof typeof BIRTH_SERIES;

function BirthLineChart({ data }: { data: BirthPoint[] }) {
  const [metric, setMetric] = useState<BirthSeriesKey>("observed");
  const temporal = useTemporalWindow(
    data,
    data.map((point) => `${point.year}${point.provisional ? "(p)" : ""}`),
    [
      { value: 11, label: "11 años" },
      { value: 20, label: "20 años" },
      { value: "all", label: "Serie completa" },
    ],
    11,
  );
  const points = temporal.visible,
    values = points.map((point) => point[metric]),
    rawMin = Math.min(...values),
    rawMax = Math.max(...values),
    span = Math.max(rawMax - rawMin, metric === "masculinity" ? 1 : 1000),
    min = rawMin - span * 0.16,
    max = rawMax + span * 0.16,
    w = 900,
    h = 370,
    pL = 76,
    pR = 24,
    pT = 26,
    pB = 70;
  const x = (index: number) =>
      pL + (index * (w - pL - pR)) / Math.max(1, points.length - 1),
    y = (value: number) =>
      h - pB - ((value - min) * (h - pT - pB)) / (max - min),
    ticks = Array.from(
      { length: 5 },
      (_, index) => min + ((max - min) * index) / 4,
    ),
    line = points
      .map(
        (point, index) => `${index ? "L" : "M"}${x(index)},${y(point[metric])}`,
      )
      .join(" ");
  const format = (value: number) =>
    metric === "masculinity"
      ? value.toFixed(1).replace(".", ",")
      : Math.round(value).toLocaleString("es-CL");
  return (
    <div className="chart-shell birth-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Últimos 11 años por ventana</span>
          <h2>Evolución de los nacimientos</h2>
        </div>
        <label>
          Serie
          <select
            value={metric}
            onChange={(event) =>
              setMetric(event.target.value as BirthSeriesKey)
            }
          >
            {Object.entries(BIRTH_SERIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {ticks.map((value) => (
          <g key={value}>
            <line x1={pL} x2={w - pR} y1={y(value)} y2={y(value)} />
            <text x={pL - 10} y={y(value) + 4} textAnchor="end">
              {format(value)}
            </text>
          </g>
        ))}
        {points.map((point, index) => (
          <text
            key={point.year}
            x={x(index)}
            y={h - pB + 25}
            textAnchor="middle"
          >
            {point.year}
            {point.provisional ? "(p)" : ""}
          </text>
        ))}
        <path className="line" d={line} style={{ stroke: "#123f87" }} />
        {points.map((point, index) => (
          <circle
            key={point.year}
            cx={x(index)}
            cy={y(point[metric])}
            r={index === points.length - 1 ? 5 : 3}
            fill="#123f87"
          >
            <title>
              {BIRTH_SERIES[metric]}, {point.year}: {format(point[metric])}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function BirthAgeChart({ data }: { data: BirthPoint[] }) {
  const latest = data.at(-1)!.year,
    [selectedYear, setSelectedYear] = useState(latest),
    [displayYear, setDisplayYear] = useState(latest),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setDisplayYear((current) => {
          if (current >= selectedYear) {
            clearInterval(timer);
            setPlaying(false);
            return selectedYear;
          }
          return current + 1;
        }),
      520,
    );
    return () => clearInterval(timer);
  }, [playing, selectedYear, data]);
  const point = data.find((item) => item.year === displayYear)!,
    values = point.ages.map((item) => item.value),
    max = Math.max(...values) * 1.12,
    w = 900,
    h = 390,
    pL = 66,
    pR = 20,
    pT = 25,
    pB = 135,
    step = (w - pL - pR) / point.ages.length,
    barWidth = Math.min(52, step * 0.62),
    y = (value: number) => h - pB - (value * (h - pT - pB)) / max;
  return (
    <div className="chart-shell birth-chart birth-age-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Composición por edad materna</span>
          <h2>Distribución de nacimientos</h2>
        </div>
        <div className="birth-age-controls">
          <label>
            Año
            <select
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(+event.target.value);
                setDisplayYear(+event.target.value);
                setPlaying(false);
              }}
            >
              {[...data].reverse().map((item) => (
                <option key={item.year} value={item.year}>
                  {item.year}
                  {item.provisional ? " (p)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            className={playing ? "playing" : ""}
            onClick={() => {
              if (playing) setPlaying(false);
              else {
                setDisplayYear(data[0].year);
                setPlaying(true);
              }
            }}
          >
            {playing ? "❚❚ Pausar" : "▶ Reproducir desde 1992"}
          </button>
        </div>
      </div>
      <div className="birth-play-year">
        {displayYear}
        {point.provisional ? " (provisional)" : ""}
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const value = max * tick;
          return (
            <g key={tick}>
              <line x1={pL} x2={w - pR} y1={y(value)} y2={y(value)} />
              <text x={pL - 9} y={y(value) + 4} textAnchor="end">
                {Math.round(value).toLocaleString("es-CL")}
              </text>
            </g>
          );
        })}
        {point.ages.map((item, index) => {
          const x = pL + step * index + step / 2;
          return (
            <g key={item.label}>
              <rect
                x={x - barWidth / 2}
                y={y(item.value)}
                width={barWidth}
                height={h - pB - y(item.value)}
                rx="3"
                fill="#123f87"
              >
                <title>
                  {item.label}: {item.value.toLocaleString("es-CL")}
                </title>
              </rect>
              <text
                transform={`translate(${x},${h - pB + 14}) rotate(-90)`}
                textAnchor="end"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="chart-source">
        No incluye nacimientos de mujeres de edad no especificada.
      </p>
    </div>
  );
}

function BirthComparisonChart({
  data,
  mode,
}: {
  data: BirthPoint[];
  mode: "annual" | "transform";
}) {
  const [chartState, setChartState] = useState<{
    transform: "index" | "annual" | "accumulated";
    active: Array<"observed" | "men" | "women">;
  }>(() => ({ transform: "index", active: ["observed", "men", "women"] }));
  const { transform, active } = chartState;
  const metric = mode === "annual" ? "annual" : transform,
    series = [
      {
        key: "observed" as const,
        label: "Observados Totales",
        color: "#123f87",
      },
      { key: "men" as const, label: "Hombres", color: "#0096bd" },
      { key: "women" as const, label: "Mujeres", color: "#e63b35" },
    ];
  const value = (
    point: BirthPoint,
    key: "observed" | "men" | "women",
    index: number,
  ) =>
    metric === "index"
      ? (point[key] / data[0][key]) * 100
      : metric === "accumulated"
        ? (point[key] / data[0][key] - 1) * 100
        : index === 0
          ? 0
          : (point[key] / data[index - 1][key] - 1) * 100;
  const visibleSeries = series.filter((item) => active.includes(item.key)),
    values = visibleSeries.flatMap((item) =>
      data.map((point, index) => value(point, item.key, index)),
    ),
    rawMin = Math.min(...values),
    rawMax = Math.max(...values),
    span = Math.max(rawMax - rawMin, 5),
    min = rawMin - span * 0.12,
    max = rawMax + span * 0.12,
    w = 900,
    h = 390,
    pL = 70,
    pR = 24,
    pT = 24,
    pB = 72,
    x = (index: number) => pL + (index * (w - pL - pR)) / (data.length - 1),
    y = (v: number) => h - pB - ((v - min) * (h - pT - pB)) / (max - min),
    ticks = Array.from(
      { length: 5 },
      (_, index) => min + ((max - min) * index) / 4,
    );
  const toggle = (key: "observed" | "men" | "women") =>
    setChartState((current) => ({
      ...current,
      active: current.active.includes(key)
        ? current.active.length === 1
          ? current.active
          : current.active.filter((item) => item !== key)
        : [...current.active, key],
    }));
  return (
    <div className="chart-shell birth-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Comparación anual</span>
          <h2>
            {mode === "annual"
              ? "Variación interanual de los nacimientos"
              : "Índice y cambio acumulado desde 1992"}
          </h2>
        </div>
        {mode === "transform" && (
          <label>
            Indicador
            <select
              value={transform}
              onChange={(event) =>
                setChartState((current) => ({
                  ...current,
                  transform: event.target.value as
                    "index" | "annual" | "accumulated",
                }))
              }
            >
              <option value="index">Índice 1992=100</option>
              <option value="annual">Variación anual (%)</option>
              <option value="accumulated">
                Variación acumulada desde 1992 (%)
              </option>
            </select>
          </label>
        )}
      </div>
      <div
        className="series-legend birth-series-controls"
        aria-label="Series visibles"
      >
        {series.map((item) => (
          <button
            type="button"
            key={item.key}
            className={active.includes(item.key) ? "on" : ""}
            aria-pressed={active.includes(item.key)}
            onClick={() => toggle(item.key)}
          >
            <i style={{ background: item.color }} />
            <b>{item.label}</b>
          </button>
        ))}
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pL} x2={w - pR} y1={y(tick)} y2={y(tick)} />
            <text x={pL - 9} y={y(tick) + 4} textAnchor="end">
              {tick.toFixed(1).replace(".", ",")}
              {metric === "index" ? "" : "%"}
            </text>
          </g>
        ))}
        {data
          .filter((_, index) => index % 4 === 0 || index === data.length - 1)
          .map((point) => (
            <text
              key={point.year}
              x={x(data.indexOf(point))}
              y={h - pB + 24}
              textAnchor="middle"
            >
              {point.year}
            </text>
          ))}
        {series.map((item) => {
          const line = data
            .map(
              (point, index) =>
                `${index ? "L" : "M"}${x(index)},${y(value(point, item.key, index))}`,
            )
            .join(" ");
          const visible = active.includes(item.key);
          return (
            <g
              className="birth-series"
              key={item.key}
              style={{
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              <path className="line" d={line} style={{ stroke: item.color }} />
              {data.map((point, index) => (
                <circle
                  key={point.year}
                  cx={x(index)}
                  cy={y(value(point, item.key, index))}
                  r={index === data.length - 1 ? 4 : 2.3}
                  fill={item.color}
                >
                  <title>
                    {item.label}, {point.year}:{" "}
                    {value(point, item.key, index).toFixed(1).replace(".", ",")}
                    {metric === "index" ? "" : "%"}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FertilityTrendChart({ data: allData }: { data: FertilityPoint[] }) {
  const [metric, setMetric] = useState<"birthRate" | "generalRate">(
    "birthRate",
  );
  const temporal = useTemporalWindow(
    allData,
    allData.map((point) => String(point.year)),
    [
      { value: 11, label: "11 años" },
      { value: 20, label: "20 años" },
      { value: "all", label: "Serie completa" },
    ],
    11,
  );
  const data = temporal.visible,
    w = 900,
    h = 390,
    pL = 70,
    pR = 25,
    pT = 30,
    pB = 66;
  const labels = {
      birthRate: "Tasa bruta de natalidad",
      generalRate: "Tasa de fecundidad general",
    },
    values = data.map((point) => point[metric]),
    min = Math.min(...values) * 0.88,
    max = Math.max(...values) * 1.08;
  const x = (index: number) => pL + (index * (w - pL - pR)) / (data.length - 1),
    y = (value: number) =>
      h - pB - ((value - min) * (h - pT - pB)) / (max - min),
    ticks = Array.from(
      { length: 5 },
      (_, index) => min + ((max - min) * index) / 4,
    );
  return (
    <div className="chart-shell birth-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Tendencia de largo plazo</span>
          <h2>{labels[metric]}</h2>
        </div>
        <label>
          Indicador
          <select
            value={metric}
            onChange={(event) =>
              setMetric(event.target.value as "birthRate" | "generalRate")
            }
          >
            <option value="birthRate">Tasa bruta de natalidad</option>
            <option value="generalRate">Tasa de fecundidad general</option>
          </select>
        </label>
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {ticks.map((value) => (
          <g key={value}>
            <line x1={pL} x2={w - pR} y1={y(value)} y2={y(value)} />
            <text x={pL - 9} y={y(value) + 4} textAnchor="end">
              {value.toFixed(1).replace(".", ",")}
            </text>
          </g>
        ))}
        {data
          .filter((_, index) => index % 4 === 0 || index === data.length - 1)
          .map((point) => (
            <text
              key={point.year}
              x={x(data.indexOf(point))}
              y={h - pB + 25}
              textAnchor="middle"
            >
              {point.year}
            </text>
          ))}
        <path
          className="line"
          d={data
            .map(
              (point, index) =>
                `${index ? "L" : "M"}${x(index)},${y(point[metric])}`,
            )
            .join(" ")}
          style={{ stroke: "#123f87" }}
        />
        {data.map((point, index) => (
          <circle
            key={point.year}
            cx={x(index)}
            cy={y(point[metric])}
            r={index === data.length - 1 ? 5 : 2.5}
            fill="#123f87"
          >
            <title>
              {labels[metric]}, {point.year}:{" "}
              {point[metric].toFixed(1).replace(".", ",")}
            </title>
          </circle>
        ))}
      </svg>
      {temporal.controls}
      <p className="chart-source">
        Por cada 1.000 personas (natalidad) o mujeres de 15 a 49 años
        (fecundidad general).
      </p>
    </div>
  );
}

function SpecificFertilityChart({ data }: { data: FertilityPoint[] }) {
  const latest = data.at(-1)!.year,
    [selectedYear, setSelectedYear] = useState(latest),
    [displayYear, setDisplayYear] = useState(latest),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const firstFrame = window.setTimeout(() => setDisplayYear(data[0].year), 0),
      timer = window.setInterval(
        () =>
          setDisplayYear((current) => {
            if (current >= selectedYear) {
              window.clearInterval(timer);
              setPlaying(false);
              return selectedYear;
            }
            return current + 1;
          }),
        520,
      );
    return () => {
      window.clearTimeout(firstFrame);
      window.clearInterval(timer);
    };
  }, [playing, selectedYear, data]);
  const point = data.find((item) => item.year === displayYear)!,
    w = 900,
    h = 390,
    pL = 65,
    pR = 24,
    pT = 25,
    pB = 75,
    max = Math.max(...point.specificRates.map((item) => item.value)) * 1.18,
    step = (w - pL - pR) / point.specificRates.length,
    y = (value: number) => h - pB - (value * (h - pT - pB)) / max;
  return (
    <div className="chart-shell birth-chart fertility-age-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Composición por edad materna</span>
          <h2>Tasa específica de fecundidad</h2>
          <p className="chart-subtitle">
            Nacidos vivos por cada 1.000 mujeres de cada grupo de edad.
          </p>
        </div>
        <div className="birth-age-controls">
          <label>
            Año
            <select
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(+event.target.value);
                setDisplayYear(+event.target.value);
                setPlaying(false);
              }}
            >
              {[...data].reverse().map((item) => (
                <option key={item.year} value={item.year}>
                  {item.year}
                  {item.provisional ? " (p)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            className={playing ? "playing" : ""}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? "❚❚ Pausar" : "▶ Reproducir desde 1992"}
          </button>
        </div>
      </div>
      <div className="birth-play-year">
        {displayYear}
        {point.provisional ? " (provisional)" : ""}
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line x1={pL} x2={w - pR} y1={y(max * tick)} y2={y(max * tick)} />
            <text x={pL - 9} y={y(max * tick) + 4} textAnchor="end">
              {(max * tick).toFixed(0)}
            </text>
          </g>
        ))}
        {point.specificRates.map((item, index) => {
          const center = pL + step * index + step / 2;
          return (
            <g key={item.label}>
              <rect
                x={center - step * 0.31}
                y={y(item.value)}
                width={step * 0.62}
                height={h - pB - y(item.value)}
                rx="4"
                fill="#123f87"
              >
                <title>
                  {item.label} años: {item.value.toFixed(1).replace(".", ",")}
                </title>
              </rect>
              <text x={center} y={h - pB + 23} textAnchor="middle">
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FertilitySelectorChart({
  data: allData,
  kind,
}: {
  data: FertilityPoint[];
  kind: "rates" | "ages";
}) {
  const options =
    kind === "rates"
      ? {
          tgf: "Tasa Global de Fecundidad (TGF)",
          tbr: "Tasa bruta de reproducción (TBR)",
        }
      : {
          meanFertilityAge: "Edad media de la fecundidad",
          meanMotherAge: "Edad media de las madres",
          medianMotherAge: "Edad mediana de las madres",
        };
  const [metric, setMetric] = useState<keyof FertilityPoint>(
    Object.keys(options)[0] as keyof FertilityPoint,
  );
  const temporal = useTemporalWindow(
    allData,
    allData.map((point) => String(point.year)),
    [
      { value: 11, label: "11 años" },
      { value: 20, label: "20 años" },
      { value: "all", label: "Serie completa" },
    ],
    11,
  );
  const data = temporal.visible,
    w = 900,
    h = 390,
    pL = 68,
    pR = 24,
    pT = 28,
    pB = 65,
    values = data.map((point) => point[metric] as number),
    rawMin = Math.min(...values),
    rawMax = Math.max(...values),
    span = Math.max(rawMax - rawMin, 0.5),
    min = rawMin - span * 0.15,
    max = rawMax + span * 0.15;
  const x = (index: number) => pL + (index * (w - pL - pR)) / (data.length - 1),
    y = (value: number) =>
      h - pB - ((value - min) * (h - pT - pB)) / (max - min),
    ticks = Array.from(
      { length: 5 },
      (_, index) => min + ((max - min) * index) / 4,
    );
  return (
    <div className="chart-shell birth-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">
            {kind === "rates"
              ? "Intensidad reproductiva"
              : "Calendario de la maternidad"}
          </span>
          <h2>{options[metric as keyof typeof options]}</h2>
        </div>
        <label>
          Indicador
          <select
            value={String(metric)}
            onChange={(event) =>
              setMetric(event.target.value as keyof FertilityPoint)
            }
          >
            {Object.entries(options).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {ticks.map((value) => (
          <g key={value}>
            <line x1={pL} x2={w - pR} y1={y(value)} y2={y(value)} />
            <text x={pL - 9} y={y(value) + 4} textAnchor="end">
              {value.toFixed(kind === "rates" ? 2 : 1).replace(".", ",")}
            </text>
          </g>
        ))}
        {data
          .filter((_, index) => index % 4 === 0 || index === data.length - 1)
          .map((point) => (
            <text
              key={point.year}
              x={x(data.indexOf(point))}
              y={h - pB + 25}
              textAnchor="middle"
            >
              {point.year}
            </text>
          ))}
        <path
          className="line"
          d={data
            .map(
              (point, index) =>
                `${index ? "L" : "M"}${x(index)},${y(point[metric] as number)}`,
            )
            .join(" ")}
          style={{ stroke: kind === "rates" ? "#e43d37" : "#123f87" }}
        />
        {data.map((point, index) => (
          <circle
            key={point.year}
            cx={x(index)}
            cy={y(point[metric] as number)}
            r={index === data.length - 1 ? 5 : 2.5}
            fill={kind === "rates" ? "#e43d37" : "#123f87"}
          >
            <title>
              {point.year}:{" "}
              {(point[metric] as number)
                .toFixed(kind === "rates" ? 2 : 1)
                .replace(".", ",")}
            </title>
          </circle>
        ))}
      </svg>
      {temporal.controls}
    </div>
  );
}

function FertilityPage({
  onLabor,
  onInformality,
  onIpc,
  onIpp,
  onBirths,
  onDeaths,
}: {
  onLabor: () => void;
  onInformality: () => void;
  onIpc: () => void;
  onIpp: () => void;
  onBirths: () => void;
  onDeaths: () => void;
}) {
  const vital = useVitalData();
  if (!vital.ready)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  const data = vital.data.fertility.series,
    latest = data.at(-1)!,
    first = data[0],
    peakLatest = [...latest.specificRates].sort((a, b) => b.value - a.value)[0],
    peakFirst = [...first.specificRates].sort((a, b) => b.value - a.value)[0];
  const pct = (current: number, base: number) =>
    Math.abs((current / base - 1) * 100)
      .toFixed(1)
      .replace(".", ",");
  return (
    <main>
      <PriceHeader
        onLabor={onLabor}
        onInformality={onInformality}
        onIpc={onIpc}
        onIpp={onIpp}
        onBirths={onBirths}
        onFertility={() => {}}
        onDeaths={onDeaths}
        current="fertility"
      />
      <section className="hero wrap births-hero">
        <div>
          <span className="eyebrow">
            Demografía y población · Estadísticas vitales
          </span>
          <h1>
            Fecundidad
            <br />
            en Chile
          </h1>
          <p>
            Cómo han cambiado la intensidad, el calendario y la composición por
            edad de la fecundidad entre 1992 y 2024.
          </p>
        </div>
        <aside className="births-latest latest-value-first">
          <span>Último año disponible</span>
          <b>{latest.tgf.toFixed(2).replace(".", ",")} hijos/as por mujer</b>
          <strong>
            {latest.year}
            <small>(p)</small>
          </strong>
        </aside>
      </section>
      <section className="wrap kpis birth-kpis">
        <article>
          <div>
            <h3>Tasa bruta de natalidad</h3>
            <strong>{latest.birthRate.toFixed(1).replace(".", ",")}</strong>
            <p>por cada 1.000 personas</p>
          </div>
        </article>
        <article>
          <div>
            <h3>Tasa de fecundidad general</h3>
            <strong>{latest.generalRate.toFixed(1).replace(".", ",")}</strong>
            <p>por cada 1.000 mujeres de 15–49</p>
          </div>
        </article>
        <article>
          <div>
            <h3>Tasa global de fecundidad</h3>
            <strong>{latest.tgf.toFixed(2).replace(".", ",")}</strong>
            <p>hijos/as por mujer</p>
          </div>
        </article>
        <article>
          <div>
            <h3>Edad media de la fecundidad</h3>
            <strong>
              {latest.meanFertilityAge.toFixed(1).replace(".", ",")}
            </strong>
            <p>años</p>
          </div>
        </article>
      </section>
      <section className="wrap births-story">
        <div className="births-reading">
          <span className="eyebrow">Transformación demográfica</span>
          <h2>Menos fecundidad y nacimientos a edades más tardías</h2>
          <p>
            Entre 1992 y {latest.year}, la tasa bruta de natalidad disminuyó{" "}
            <b>{pct(latest.birthRate, first.birthRate)}%</b> y la tasa de
            fecundidad general cayó{" "}
            <b>{pct(latest.generalRate, first.generalRate)}%</b>.
          </p>
          <p>
            El máximo de las tasas específicas pasó de{" "}
            <b>{peakFirst.label} años</b> en 1992 a{" "}
            <b>{peakLatest.label} años</b> en {latest.year}, señal de un
            calendario reproductivo más tardío.
          </p>
        </div>
        <FertilityTrendChart data={data} />
      </section>
      <section className="births-analysis">
        <div className="wrap fertility-grid">
          <div className="fertility-narrative">
            <span className="eyebrow">Fecundidad por edad</span>
            <h2>La mayor intensidad se concentra después de los 30 años</h2>
            <p>
              En {latest.year}, la tasa más alta correspondió al grupo de{" "}
              {peakLatest.label} años, con{" "}
              {peakLatest.value.toFixed(1).replace(".", ",")} nacidos vivos por
              cada 1.000 mujeres. La fecundidad adolescente llegó a{" "}
              {latest.specificRates[0].value.toFixed(1).replace(".", ",")},
              frente a{" "}
              {first.specificRates[0].value.toFixed(1).replace(".", ",")} en
              1992.
            </p>
          </div>
          <SpecificFertilityChart data={data} />
          <div className="fertility-narrative">
            <span className="eyebrow">Reemplazo generacional</span>
            <h2>La fecundidad se ubica bajo el nivel de reemplazo</h2>
            <p>
              La TGF descendió de {first.tgf.toFixed(2).replace(".", ",")} a{" "}
              {latest.tgf.toFixed(2).replace(".", ",")} hijos/as por mujer. La
              TBR, que aproxima el número medio de hijas por mujer bajo el
              patrón vigente, pasó de {first.tbr.toFixed(2).replace(".", ",")} a{" "}
              {latest.tbr.toFixed(2).replace(".", ",")}.
            </p>
          </div>
          <FertilitySelectorChart data={data} kind="rates" />
          <div className="fertility-narrative">
            <span className="eyebrow">Postergación de la maternidad</span>
            <h2>
              Tres medidas confirman el desplazamiento hacia edades mayores
            </h2>
            <p>
              La edad media de la fecundidad aumentó de{" "}
              {first.meanFertilityAge.toFixed(1).replace(".", ",")} a{" "}
              {latest.meanFertilityAge.toFixed(1).replace(".", ",")} años. En{" "}
              {latest.year}, la edad media de las madres fue{" "}
              {latest.meanMotherAge.toFixed(1).replace(".", ",")} y la mediana{" "}
              {latest.medianMotherAge.toFixed(1).replace(".", ",")} años.
            </p>
          </div>
          <FertilitySelectorChart data={data} kind="ages" />
          <div className="fertility-narrative fertility-extra">
            <span className="eyebrow">Lectura para investigación</span>
            <h2>La caída combina quantum y tempo</h2>
            <p>
              La serie muestra simultáneamente una reducción de la intensidad
              total de la fecundidad y una postergación del calendario. Esto es
              relevante al estudiar envejecimiento, demanda futura por
              educación, formación de hogares y necesidades de cuidados: una TGF
              baja describe el patrón del período, pero no equivale por sí sola
              a la descendencia final de una cohorte.
            </p>
          </div>
        </div>
      </section>
      <section className="fertility-glossary">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Conceptos demográficos</span>
            <h2>Glosario</h2>
          </div>
          <div className="glossary-grid">
            <article>
              <h3>Tasa bruta de natalidad</h3>
              <p>
                Corresponde al número de nacidos vivos por cada 1.000 personas.
              </p>
            </article>
            <article>
              <h3>Tasa de fecundidad general</h3>
              <p>
                Corresponde al número de nacidos vivos por cada 1.000 mujeres en
                edad fértil (15-49 años).
              </p>
            </article>
            <article>
              <h3>Nacidos vivos por edad de la madre</h3>
              <p>
                Están ajustados a los nacimientos corregidos mediante prorrateo,
                incluyendo casos de edad ignorada; el grupo 15 a 19 años incluye
                nacimientos de menores de 15 años y el grupo 45 a 49 años
                incluye nacimientos de mujeres de 50 años y más.
              </p>
            </article>
            <article>
              <h3>Tasas específicas de fecundidad</h3>
              <p>
                Corresponden al número de nacidos vivos por cada 1.000 mujeres
                de dicho grupo de edad.
              </p>
            </article>
            <article>
              <h3>Tasa global de fecundidad</h3>
              <p>
                Corresponde al número de hijos/as que tendría una mujer al
                finalizar su edad fértil (15 a 49 años) si está afecta a la
                fecundidad actual y no estuviera expuesta al riesgo de la
                mortalidad antes del término del período fértil.
              </p>
            </article>
            <article>
              <h3>Edad media de la fecundidad</h3>
              <p>
                Se refiere a la edad teórica a la que, en promedio, se situarían
                todos los nacimientos de cada mujer. Se obtiene multiplicando
                las tasas específicas por edad por el punto medio del intervalo
                y dividiendo la suma de estos valores por la sumatoria de las
                tasas de fecundidad.
              </p>
            </article>
            <article>
              <h3>Edad media de las madres</h3>
              <p>
                Corresponde a la edad promedio de todas las madres que tuvieron
                hijos vivos en un período determinado.
              </p>
            </article>
            <article>
              <h3>Edad mediana de las madres</h3>
              <p>
                Es la edad que divide exactamente a la mitad a las madres que
                tuvieron nacidos vivos: 50% se encuentra por debajo y 50% por
                sobre ella.
              </p>
            </article>
          </div>
        </div>
      </section>
      <section className="resources">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Fuente oficial</span>
            <h2>Series de estadísticas vitales</h2>
            <p>
              Cifras 1992–2024. Los años 2023 y 2024 corresponden a cifras
              provisionales.
            </p>
          </div>
          <a
            className="birth-download"
            href="https://www.ine.gob.cl/docs/default-source/nacimientos-matrimonios-y-defunciones/cuadros-estadisticos/series-hist%C3%B3ricas/series-vitales-1992-2024%28p%29.xlsx"
          >
            Descargar Excel oficial ↗
          </a>
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href="https://www.ine.gob.cl/estadisticas-por-tema/demografia-y-migracion/nacimientos-matrimonios-y-defunciones">
            Fuente oficial: ine.gob.cl ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

const DEATH_SERIES = {
  total: "Defunciones totales",
  men: "Defunciones de hombres",
  women: "Defunciones de mujeres",
  masculinity: "Índice de masculinidad",
} as const;
const EARLY_DEATH_SERIES = {
  neonatal: "Menores de 28 días",
  infant: "Menores de 1 año",
  age1to4: "Niños y niñas de 1 a 4 años",
  fetal: "Defunciones fetales",
} as const;

function DeathTrendChart({ data: allData }: { data: DeathPoint[] }) {
  const [metric, setMetric] = useState<keyof typeof DEATH_SERIES>("total");
  const temporal = useTemporalWindow(
    allData,
    allData.map((point) => String(point.year)),
    [
      { value: 11, label: "11 años" },
      { value: 20, label: "20 años" },
      { value: "all", label: "Serie completa" },
    ],
    11,
  );
  const data = temporal.visible,
    values = data.map((point) => point[metric] as number),
    min = Math.min(...values) * 0.9,
    max = Math.max(...values) * 1.08,
    w = 900,
    h = 390,
    pL = 76,
    pR = 25,
    pT = 28,
    pB = 66,
    x = (index: number) => pL + (index * (w - pL - pR)) / (data.length - 1),
    y = (value: number) =>
      h - pB - ((value - min) * (h - pT - pB)) / (max - min),
    ticks = Array.from(
      { length: 5 },
      (_, index) => min + ((max - min) * index) / 4,
    ),
    format = (value: number) =>
      metric === "masculinity"
        ? value.toFixed(1).replace(".", ",")
        : Math.round(value).toLocaleString("es-CL");
  return (
    <div className="chart-shell birth-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Serie histórica</span>
          <h2>{DEATH_SERIES[metric]}</h2>
        </div>
        <label>
          Indicador
          <select
            value={metric}
            onChange={(event) =>
              setMetric(event.target.value as keyof typeof DEATH_SERIES)
            }
          >
            {Object.entries(DEATH_SERIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {ticks.map((value) => (
          <g key={value}>
            <line x1={pL} x2={w - pR} y1={y(value)} y2={y(value)} />
            <text x={pL - 9} y={y(value) + 4} textAnchor="end">
              {format(value)}
            </text>
          </g>
        ))}
        {data
          .filter((_, index) => index % 4 === 0 || index === data.length - 1)
          .map((point) => (
            <text
              key={point.year}
              x={x(data.indexOf(point))}
              y={h - pB + 25}
              textAnchor="middle"
            >
              {point.year}
            </text>
          ))}
        <path
          className="line"
          d={data
            .map(
              (point, index) =>
                `${index ? "L" : "M"}${x(index)},${y(point[metric] as number)}`,
            )
            .join(" ")}
          style={{ stroke: "#123f87" }}
        />
        {data.map((point, index) => (
          <circle
            key={point.year}
            cx={x(index)}
            cy={y(point[metric] as number)}
            r={index === data.length - 1 ? 5 : 2.5}
            fill="#123f87"
          >
            <title>
              {DEATH_SERIES[metric]}, {point.year}:{" "}
              {format(point[metric] as number)}
            </title>
          </circle>
        ))}
      </svg>
      {temporal.controls}
    </div>
  );
}

function EarlyDeathsChart({
  data: allData,
  mode,
}: {
  data: DeathPoint[];
  mode: "counts" | "rates";
}) {
  type EarlyKey = keyof typeof EARLY_DEATH_SERIES;
  const [metric, setMetric] = useState<EarlyKey>(
    mode === "counts" ? "infant" : "neonatal",
  );
  const temporal = useTemporalWindow(
    allData,
    allData.map((point) => String(point.year)),
    [
      { value: 11, label: "11 años" },
      { value: 20, label: "20 años" },
      { value: "all", label: "Serie completa" },
    ],
    11,
  );
  const data = temporal.visible,
    rateKey: Record<EarlyKey, keyof DeathPoint> = {
      neonatal: "neonatalPerThousandBirths",
      infant: "infantPerThousandBirths",
      age1to4: "age1to4PerThousandBirths",
      fetal: "fetalPerThousandBirths",
    },
    valueOf = (point: DeathPoint) =>
      (mode === "counts" ? point[metric] : point[rateKey[metric]]) as
        number | null,
    available = data.filter((point) => valueOf(point) !== null),
    values = available.map((point) => valueOf(point) as number),
    max = Math.max(...values) * 1.12,
    w = 900,
    h = 390,
    pL = 74,
    pR = 25,
    pT = 28,
    pB = 70,
    x = (year: number) =>
      pL +
      ((year - data[0].year) * (w - pL - pR)) /
        (data.at(-1)!.year - data[0].year),
    y = (value: number) => h - pB - (value * (h - pT - pB)) / max,
    format = (value: number) =>
      mode === "counts"
        ? Math.round(value).toLocaleString("es-CL")
        : value.toFixed(1).replace(".", ",");
  return (
    <div className="chart-shell birth-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">
            {mode === "counts"
              ? "Mortalidad temprana"
              : "Relación con los nacimientos"}
          </span>
          <h2>
            {EARLY_DEATH_SERIES[metric]}
            {mode === "rates" ? " por 1.000 nacimientos" : ""}
          </h2>
        </div>
        <label>
          Serie
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as EarlyKey)}
          >
            {Object.entries(EARLY_DEATH_SERIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line x1={pL} x2={w - pR} y1={y(max * tick)} y2={y(max * tick)} />
            <text x={pL - 9} y={y(max * tick) + 4} textAnchor="end">
              {format(max * tick)}
            </text>
          </g>
        ))}
        {data
          .filter((_, index) => index % 4 === 0 || index === data.length - 1)
          .map((point) => (
            <text
              key={point.year}
              x={x(point.year)}
              y={h - pB + 25}
              textAnchor="middle"
            >
              {point.year}
            </text>
          ))}
        <path
          className="line"
          d={available
            .map(
              (point, index) =>
                `${index ? "L" : "M"}${x(point.year)},${y(valueOf(point) as number)}`,
            )
            .join(" ")}
          style={{ stroke: "#e43d37" }}
        />
        {available.map((point) => (
          <circle
            key={point.year}
            cx={x(point.year)}
            cy={y(valueOf(point) as number)}
            r={point === available.at(-1) ? 5 : 2.5}
            fill="#e43d37"
          >
            <title>
              {point.year}: {format(valueOf(point) as number)}
            </title>
          </circle>
        ))}
      </svg>
      {temporal.controls}
      <p className="chart-source">
        Las razones se calcularon con nacimientos observados. Los valores no
        publicados en la fuente oficial se muestran como interrupciones de la
        serie.
      </p>
    </div>
  );
}

function EarlyDeathKpis({
  data,
  mode,
}: {
  data: DeathPoint[];
  mode: "counts" | "rates";
}) {
  type EarlyKey = keyof typeof EARLY_DEATH_SERIES;
  const keys: EarlyKey[] = ["fetal", "neonatal", "infant", "age1to4"],
    rateKey: Record<EarlyKey, keyof DeathPoint> = {
      fetal: "fetalPerThousandBirths",
      neonatal: "neonatalPerThousandBirths",
      infant: "infantPerThousandBirths",
      age1to4: "age1to4PerThousandBirths",
    },
    valueOf = (point: DeathPoint, key: EarlyKey) =>
      (mode === "counts" ? point[key] : point[rateKey[key]]) as number | null;
  return (
    <div className="early-death-kpis">
      {keys.map((key) => {
        const latest = [...data]
            .reverse()
            .find((point) => valueOf(point, key) !== null)!,
          previous = data.find((point) => point.year === latest.year - 1),
          value = valueOf(latest, key)!,
          previousValue = previous ? valueOf(previous, key) : null,
          difference = previousValue === null ? null : value - previousValue,
          percentage =
            previousValue === null ? null : (difference! / previousValue) * 100;
        return (
          <article key={`${mode}-${key}`}>
            <span>
              {latest.year}
              {latest.provisional ? " (p)" : ""}
            </span>
            <h3>{EARLY_DEATH_SERIES[key]}</h3>
            <strong>
              {mode === "counts"
                ? Math.round(value).toLocaleString("es-CL")
                : value.toFixed(1).replace(".", ",")}
            </strong>
            <small>
              {mode === "rates" ? "por 1.000 nacimientos" : "defunciones"}
            </small>
            <div
              className={
                difference !== null && difference > 0
                  ? "change up"
                  : "change down"
              }
            >
              {difference === null ? (
                <p>Sin comparación anual</p>
              ) : (
                <>
                  <p>
                    {difference! >= 0 ? "+" : "−"}
                    {Math.abs(difference!).toLocaleString("es-CL", {
                      maximumFractionDigits: mode === "counts" ? 0 : 1,
                    })}{" "}
                    {mode === "counts" ? "defunciones" : "por 1.000"}
                  </p>
                  <b>
                    {percentage! >= 0 ? "+" : "−"}
                    {Math.abs(percentage!).toFixed(1).replace(".", ",")}%
                    respecto de {previous!.year}
                  </b>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function pearson(points: { x: number; y: number }[]) {
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length,
    meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const numerator = points.reduce(
      (sum, point) => sum + (point.x - meanX) * (point.y - meanY),
      0,
    ),
    denominator = Math.sqrt(
      points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0) *
        points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0),
    );
  return numerator / denominator;
}

function MaternalMortalityScatter({ data }: { data: DeathPoint[] }) {
  const points = data
      .filter((point) => point.neonatalPerThousandBirths !== null)
      .map((point) => ({
        year: point.year,
        x: point.youngMotherShare,
        y: point.neonatalPerThousandBirths as number,
      })),
    r = pearson(points),
    w = 900,
    h = 410,
    pL = 76,
    pR = 28,
    pT = 28,
    pB = 74;
  const minX = Math.min(...points.map((point) => point.x)) * 0.9,
    maxX = Math.max(...points.map((point) => point.x)) * 1.06,
    minY = Math.min(...points.map((point) => point.y)) * 0.85,
    maxY = Math.max(...points.map((point) => point.y)) * 1.08;
  const x = (value: number) =>
      pL + ((value - minX) * (w - pL - pR)) / (maxX - minX),
    y = (value: number) =>
      h - pB - ((value - minY) * (h - pT - pB)) / (maxY - minY);
  return (
    <div className="chart-shell birth-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Análisis ecológico · 1992–2022</span>
          <h2>Maternidad adolescente y mortalidad neonatal</h2>
          <p className="chart-subtitle">
            Participación de nacimientos de madres menores de 20 años y
            defunciones de menores de 28 días por 1.000 nacimientos.
          </p>
        </div>
        <div className="correlation-badge">
          <small>Correlación de Pearson</small>
          <strong>r = {r.toFixed(2).replace(".", ",")}</strong>
        </div>
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={`x${tick}`}>
            <line
              x1={x(minX + (maxX - minX) * tick)}
              x2={x(minX + (maxX - minX) * tick)}
              y1={pT}
              y2={h - pB}
            />
            <text
              x={x(minX + (maxX - minX) * tick)}
              y={h - pB + 25}
              textAnchor="middle"
            >
              {(minX + (maxX - minX) * tick).toFixed(1).replace(".", ",")}%
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <text
            key={`y${tick}`}
            x={pL - 9}
            y={y(minY + (maxY - minY) * tick) + 4}
            textAnchor="end"
          >
            {(minY + (maxY - minY) * tick).toFixed(1).replace(".", ",")}
          </text>
        ))}
        {points.map((point) => (
          <circle
            key={point.year}
            cx={x(point.x)}
            cy={y(point.y)}
            r={
              point.year % 5 === 0 || point.year === 1992 || point.year === 2022
                ? 5
                : 3
            }
            fill={point.year === 2022 ? "#e43d37" : "#123f87"}
          >
            <title>
              {point.year}: madres menores de 20 años{" "}
              {point.x.toFixed(1).replace(".", ",")}% · mortalidad neonatal{" "}
              {point.y.toFixed(1).replace(".", ",")} por 1.000
            </title>
          </circle>
        ))}
      </svg>
      <p className="chart-source">
        <b>Lectura cautelosa:</b> la correlación resume la evolución conjunta de
        dos series nacionales. No mide riesgo individual ni demuestra
        causalidad; ambas variables también responden a cambios sanitarios,
        sociales y de registro ocurridos en el tiempo.
      </p>
    </div>
  );
}

const MORTALITY_RATES = {
  crude: "Tasa bruta de mortalidad",
  infant: "Tasa de mortalidad infantil",
  neonatal: "Tasa de mortalidad neonatal",
  fetal: "Tasa de defunciones fetales",
  under5: "Tasa de mortalidad en la niñez",
} as const;
const LIFE_SERIES = {
  lifeBoth: { label: "Ambos sexos", color: "#123f87" },
  lifeMen: { label: "Hombres", color: "#0096bd" },
  lifeWomen: { label: "Mujeres", color: "#e43d37" },
} as const;

function MortalityRatesChart({ data: allData }: { data: MortalityPoint[] }) {
  type RateKey = keyof typeof MORTALITY_RATES;
  const colors: Record<RateKey, string> = {
      crude: "#123f87",
      infant: "#e43d37",
      neonatal: "#0096bd",
      fetal: "#8b5fbf",
      under5: "#16806a",
    },
    [active, setActive] = useState<RateKey[]>([
      "crude",
      "infant",
      "neonatal",
      "fetal",
      "under5",
    ]);
  const temporal = useTemporalWindow(
    allData,
    allData.map((point) => String(point.year)),
    [
      { value: 11, label: "11 años" },
      { value: 20, label: "20 años" },
      { value: "all", label: "Serie completa" },
    ],
    11,
  );
  const data = temporal.visible,
    w = 900,
    h = 430,
    pL = 70,
    pR = 24,
    pT = 28,
    pB = 72;
  const values = active.flatMap((key) =>
      data
        .map((point) => point[key])
        .filter((value): value is number => value !== null),
    ),
    max = Math.max(...values) * 1.1,
    x = (index: number) => pL + (index * (w - pL - pR)) / (data.length - 1),
    y = (value: number) => h - pB - (value * (h - pT - pB)) / max;
  const toggle = (key: RateKey) =>
    setActive((current) =>
      current.includes(key)
        ? current.length === 1
          ? current
          : current.filter((item) => item !== key)
        : [...current, key],
    );
  const segments = (key: RateKey) => {
    const result: MortalityPoint[][] = [];
    let segment: MortalityPoint[] = [];
    data.forEach((point) => {
      if (point[key] === null) {
        if (segment.length) result.push(segment);
        segment = [];
      } else segment.push(point);
    });
    if (segment.length) result.push(segment);
    return result;
  };
  return (
    <div className="chart-shell birth-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Mortalidad general y primeras edades</span>
          <h2>Evolución de las tasas de mortalidad</h2>
        </div>
        <label className="mortality-multiselect">
          Series visibles
          <select
            multiple
            value={active}
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map(
                (option) => option.value as RateKey,
              );
              if (selected.length) setActive(selected);
            }}
          >
            {Object.entries(MORTALITY_RATES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="series-legend birth-series-controls"
        aria-label="Tasas visibles"
      >
        {Object.entries(MORTALITY_RATES).map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={active.includes(key as RateKey) ? "on" : ""}
            aria-pressed={active.includes(key as RateKey)}
            onClick={() => toggle(key as RateKey)}
          >
            <i style={{ background: colors[key as RateKey] }} />
            <b>{label}</b>
          </button>
        ))}
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line x1={pL} x2={w - pR} y1={y(max * tick)} y2={y(max * tick)} />
            <text x={pL - 9} y={y(max * tick) + 4} textAnchor="end">
              {(max * tick).toFixed(1).replace(".", ",")}
            </text>
          </g>
        ))}
        {data
          .filter((_, index) => index % 4 === 0 || index === data.length - 1)
          .map((point) => (
            <text
              key={point.year}
              x={x(data.indexOf(point))}
              y={h - pB + 25}
              textAnchor="middle"
            >
              {point.year}
            </text>
          ))}
        {active.map((key) => (
          <g className="birth-series" key={key}>
            {segments(key).map((segment, segmentIndex) => (
              <path
                key={segmentIndex}
                className="line"
                d={segment
                  .map(
                    (point, index) =>
                      `${index ? "L" : "M"}${x(data.indexOf(point))},${y(point[key] as number)}`,
                  )
                  .join(" ")}
                style={{ stroke: colors[key] }}
              />
            ))}
            {data
              .filter((point) => point[key] !== null)
              .map((point) => (
                <circle
                  key={point.year}
                  cx={x(data.indexOf(point))}
                  cy={y(point[key] as number)}
                  r={point.year === data.at(-1)?.year ? 4 : 2.3}
                  fill={colors[key]}
                >
                  <title>
                    {MORTALITY_RATES[key]}, {point.year}:{" "}
                    {(point[key] as number).toFixed(1).replace(".", ",")}
                  </title>
                </circle>
              ))}
          </g>
        ))}
      </svg>
      {temporal.controls}
      <p className="chart-source">
        Las tasas infantil, neonatal, fetal y en la niñez se expresan por 1.000;
        la tasa bruta corresponde a defunciones por 1.000 habitantes. No se unen
        los años sin datos publicados.
      </p>
    </div>
  );
}

function LifeExpectancyChart({ data: allData }: { data: MortalityPoint[] }) {
  type LifeKey = keyof typeof LIFE_SERIES;
  const [active, setActive] = useState<LifeKey[]>([
    "lifeBoth",
    "lifeMen",
    "lifeWomen",
  ]);
  const temporal = useTemporalWindow(
    allData,
    allData.map((point) => String(point.year)),
    [
      { value: 11, label: "11 años" },
      { value: 20, label: "20 años" },
      { value: "all", label: "Serie completa" },
    ],
    11,
  );
  const data = temporal.visible,
    w = 900,
    h = 410,
    pL = 68,
    pR = 24,
    pT = 28,
    pB = 70,
    values = data.flatMap((point) => active.map((key) => point[key])),
    min = Math.min(...values) - 1,
    max = Math.max(...values) + 1,
    x = (index: number) => pL + (index * (w - pL - pR)) / (data.length - 1),
    y = (value: number) =>
      h - pB - ((value - min) * (h - pT - pB)) / (max - min),
    toggle = (key: LifeKey) =>
      setActive((current) =>
        current.includes(key)
          ? current.length === 1
            ? current
            : current.filter((item) => item !== key)
          : [...current, key],
      );
  return (
    <div className="chart-shell birth-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Longevidad</span>
          <h2>Esperanza de vida al nacer</h2>
        </div>
      </div>
      <div className="series-legend birth-series-controls">
        {Object.entries(LIFE_SERIES).map(([key, item]) => (
          <button
            type="button"
            key={key}
            className={active.includes(key as LifeKey) ? "on" : ""}
            aria-pressed={active.includes(key as LifeKey)}
            onClick={() => toggle(key as LifeKey)}
          >
            <i style={{ background: item.color }} />
            <b>{item.label}</b>
          </button>
        ))}
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const value = min + (max - min) * tick;
          return (
            <g key={tick}>
              <line x1={pL} x2={w - pR} y1={y(value)} y2={y(value)} />
              <text x={pL - 9} y={y(value) + 4} textAnchor="end">
                {value.toFixed(1).replace(".", ",")}
              </text>
            </g>
          );
        })}
        {data
          .filter((_, index) => index % 4 === 0 || index === data.length - 1)
          .map((point) => (
            <text
              key={point.year}
              x={x(data.indexOf(point))}
              y={h - pB + 25}
              textAnchor="middle"
            >
              {point.year}
            </text>
          ))}
        {active.map((key) => (
          <g className="birth-series" key={key}>
            <path
              className="line"
              d={data
                .map(
                  (point, index) =>
                    `${index ? "L" : "M"}${x(index)},${y(point[key])}`,
                )
                .join(" ")}
              style={{ stroke: LIFE_SERIES[key].color }}
            />
            {data.map((point, index) => (
              <circle
                key={point.year}
                cx={x(index)}
                cy={y(point[key])}
                r={index === data.length - 1 ? 4 : 2.3}
                fill={LIFE_SERIES[key].color}
              >
                <title>
                  {LIFE_SERIES[key].label}, {point.year}:{" "}
                  {point[key].toFixed(2).replace(".", ",")} años
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      {temporal.controls}
    </div>
  );
}

function LifeExpectancyBars({ data }: { data: MortalityPoint[] }) {
  const latest = data.at(-1)!.year,
    [selectedYear, setSelectedYear] = useState(latest),
    [displayYear, setDisplayYear] = useState(latest),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const first = window.setTimeout(() => setDisplayYear(data[0].year), 0),
      timer = window.setInterval(
        () =>
          setDisplayYear((current) => {
            if (current >= selectedYear) {
              window.clearInterval(timer);
              setPlaying(false);
              return selectedYear;
            }
            return current + 1;
          }),
        520,
      );
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [playing, selectedYear, data]);
  const point = data.find((item) => item.year === displayYear)!,
    bars = [
      { label: "Ambos sexos", value: point.lifeBoth, color: "#123f87" },
      { label: "Hombres", value: point.lifeMen, color: "#0096bd" },
      { label: "Mujeres", value: point.lifeWomen, color: "#e43d37" },
    ],
    w = 900,
    h = 400,
    pL = 76,
    pR = 30,
    pT = 25,
    pB = 80,
    min = 65,
    max = 86,
    step = (w - pL - pR) / bars.length,
    y = (value: number) =>
      h - pB - ((value - min) * (h - pT - pB)) / (max - min);
  return (
    <div className="chart-shell birth-chart life-bars-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Comparación por sexo</span>
          <h2>Esperanza de vida en el año seleccionado</h2>
        </div>
        <div className="birth-age-controls">
          <label>
            Año
            <select
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(+event.target.value);
                setDisplayYear(+event.target.value);
                setPlaying(false);
              }}
            >
              {[...data].reverse().map((item) => (
                <option key={item.year} value={item.year}>
                  {item.year}
                  {item.provisional ? " (p)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            className={playing ? "playing" : ""}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? "❚❚ Pausar" : "▶ Reproducir desde 1992"}
          </button>
        </div>
      </div>
      <div className="birth-play-year">
        {displayYear}
        {point.provisional ? " (provisional)" : ""}
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {[65, 70, 75, 80, 85].map((value) => (
          <g key={value}>
            <line x1={pL} x2={w - pR} y1={y(value)} y2={y(value)} />
            <text x={pL - 9} y={y(value) + 4} textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        {bars.map((bar, index) => {
          const center = pL + step * index + step / 2;
          return (
            <g key={bar.label}>
              <rect
                x={center - step * 0.27}
                y={y(bar.value)}
                width={step * 0.54}
                height={h - pB - y(bar.value)}
                rx="5"
                fill={bar.color}
              >
                <title>
                  {bar.label}: {bar.value.toFixed(2).replace(".", ",")} años
                </title>
              </rect>
              <text
                x={center}
                y={y(bar.value) - 9}
                textAnchor="middle"
                className="bar-value"
              >
                {bar.value.toFixed(1).replace(".", ",")}
              </text>
              <text x={center} y={h - pB + 26} textAnchor="middle">
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function UnionTotalsChart({
  marriages: allMarriages,
  auc: allAuc,
}: {
  marriages: MarriagePoint[];
  auc: AucPoint[];
}) {
  const [active, setActive] = useState(["marriages", "auc"]);
  const temporal = useTemporalWindow(
    allMarriages,
    allMarriages.map((point) => String(point.year)),
    [
      { value: 11, label: "11 años" },
      { value: 20, label: "20 años" },
      { value: "all", label: "Serie completa" },
    ],
    11,
  );
  const marriages = temporal.visible;
  const auc = allAuc.filter(
    (point) =>
      point.year >= marriages[0].year && point.year <= marriages.at(-1)!.year,
  );
  const [firstYear, lastYear] = [marriages[0].year, marriages.at(-1)!.year];
  const series = {
    marriages: {
      label: "Matrimonios",
      color: "#123f87",
      points: marriages.map((point) => ({
        year: point.year,
        value: point.total,
      })),
    },
    auc: {
      label: "Acuerdos de Unión Civil",
      color: "#e43d37",
      points: auc.map((point) => ({ year: point.year, value: point.total })),
    },
  };
  const w = 900,
    h = 420,
    pL = 78,
    pR = 24,
    pT = 28,
    pB = 72,
    max =
      Math.max(
        ...active.flatMap((key) =>
          series[key as keyof typeof series].points.map((point) => point.value),
        ),
      ) * 1.1,
    x = (year: number) =>
      pL +
      ((year - firstYear) * (w - pL - pR)) / Math.max(1, lastYear - firstYear),
    y = (value: number) => h - pB - (value * (h - pT - pB)) / max,
    toggle = (key: string) =>
      setActive((current) =>
        current.includes(key)
          ? current.length === 1
            ? current
            : current.filter((item) => item !== key)
          : [...current, key],
      );
  return (
    <div className="chart-shell birth-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Volumen anual</span>
          <h2>Matrimonios y Acuerdos de Unión Civil</h2>
        </div>
      </div>
      <div className="series-legend birth-series-controls">
        {Object.entries(series).map(([key, item]) => (
          <button
            key={key}
            type="button"
            className={active.includes(key) ? "on" : ""}
            aria-pressed={active.includes(key)}
            onClick={() => toggle(key)}
          >
            <i style={{ background: item.color }} />
            <b>{item.label}</b>
          </button>
        ))}
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line x1={pL} x2={w - pR} y1={y(max * tick)} y2={y(max * tick)} />
            <text x={pL - 9} y={y(max * tick) + 4} textAnchor="end">
              {Math.round(max * tick).toLocaleString("es-CL")}
            </text>
          </g>
        ))}
        {marriages
          .filter(
            (_, index) => index % 4 === 0 || index === marriages.length - 1,
          )
          .map((point) => (
            <text
              key={point.year}
              x={x(point.year)}
              y={h - pB + 25}
              textAnchor="middle"
            >
              {point.year}
            </text>
          ))}
        {active.map((key) => {
          const item = series[key as keyof typeof series];
          return (
            <g className="birth-series" key={key}>
              <path
                className="line"
                d={item.points
                  .map(
                    (point, index) =>
                      `${index ? "L" : "M"}${x(point.year)},${y(point.value)}`,
                  )
                  .join(" ")}
                style={{ stroke: item.color }}
              />
              {item.points.map((point) => (
                <circle
                  key={point.year}
                  cx={x(point.year)}
                  cy={y(point.value)}
                  r={point.year === 2024 ? 4 : 2.4}
                  fill={item.color}
                >
                  <title>
                    {item.label}, {point.year}:{" "}
                    {point.value.toLocaleString("es-CL")}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      {temporal.controls}
    </div>
  );
}

function UnionRatesChart({
  marriages: allMarriages,
  auc: allAuc,
}: {
  marriages: MarriagePoint[];
  auc: AucPoint[];
}) {
  const temporal = useTemporalWindow(
    allMarriages,
    allMarriages.map((point) => String(point.year)),
    [
      { value: 11, label: "11 años" },
      { value: 20, label: "20 años" },
      { value: "all", label: "Serie completa" },
    ],
    11,
  );
  const marriages = temporal.visible;
  const auc = allAuc.filter(
    (point) =>
      point.year >= marriages[0].year && point.year <= marriages.at(-1)!.year,
  );
  const firstYear = marriages[0].year,
    lastYear = marriages.at(-1)!.year,
    series = [
      {
        key: "marriages",
        label: "Tasa bruta de nupcialidad",
        color: "#123f87",
        points: marriages,
      },
      { key: "auc", label: "Tasa bruta de AUC", color: "#e43d37", points: auc },
    ],
    w = 900,
    h = 390,
    pL = 70,
    pR = 24,
    pT = 28,
    pB = 70,
    values = series.flatMap((item) => item.points.map((point) => point.rate)),
    min = Math.min(...values) * 0.85,
    max = Math.max(...values) * 1.1,
    x = (year: number) =>
      pL +
      ((year - firstYear) * (w - pL - pR)) / Math.max(1, lastYear - firstYear),
    y = (value: number) =>
      h - pB - ((value - min) * (h - pT - pB)) / (max - min);
  return (
    <div className="chart-shell birth-chart compact-union-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Intensidad relativa</span>
          <h2>Tasas brutas de matrimonios y AUC</h2>
        </div>
      </div>
      <div className="series-legend birth-series-controls">
        {series.map((item) => (
          <button
            key={item.key}
            type="button"
            className="on"
            aria-pressed="true"
          >
            <i style={{ background: item.color }} />
            <b>{item.label}</b>
          </button>
        ))}
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const value = min + (max - min) * tick;
          return (
            <g key={tick}>
              <line x1={pL} x2={w - pR} y1={y(value)} y2={y(value)} />
              <text x={pL - 9} y={y(value) + 4} textAnchor="end">
                {value.toFixed(1).replace(".", ",")}
              </text>
            </g>
          );
        })}
        {marriages
          .filter(
            (_, index) => index % 4 === 0 || index === marriages.length - 1,
          )
          .map((point) => (
            <text
              key={point.year}
              x={x(point.year)}
              y={h - pB + 25}
              textAnchor="middle"
            >
              {point.year}
            </text>
          ))}
        {series.map((item) => (
          <g className="birth-series" key={item.key}>
            <path
              className="line"
              d={item.points
                .map(
                  (point, index) =>
                    `${index ? "L" : "M"}${x(point.year)},${y(point.rate)}`,
                )
                .join(" ")}
              style={{ stroke: item.color }}
            />
            {item.points.map((point, index) => (
              <circle
                key={point.year}
                cx={x(point.year)}
                cy={y(point.rate)}
                r={index === item.points.length - 1 ? 5 : 2.5}
                fill={item.color}
              >
                <title>
                  {item.label}, {point.year}:{" "}
                  {point.rate.toFixed(2).replace(".", ",")}
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      {temporal.controls}
      <p className="chart-source">
        Se reproduce la tasa bruta publicada en el archivo oficial del INE.
      </p>
    </div>
  );
}

function MarriageAgeChart({ data }: { data: MarriagePoint[] }) {
  const detailed = useMemo(
      () => data.filter((point) => point.menAge && point.womenAge),
      [data],
    ),
    latest = detailed.at(-1)!.year,
    [selectedYear, setSelectedYear] = useState(latest),
    [displayYear, setDisplayYear] = useState(latest),
    [playing, setPlaying] = useState(false),
    [activeSexes, setActiveSexes] = useState<Array<"men" | "women">>([
      "men",
      "women",
    ]);
  useEffect(() => {
    if (!playing) return;
    const first = window.setTimeout(() => setDisplayYear(detailed[0].year), 0),
      timer = window.setInterval(
        () =>
          setDisplayYear((current) => {
            const index = detailed.findIndex((point) => point.year === current);
            if (
              index < 0 ||
              index >= detailed.length - 1 ||
              detailed[index + 1].year > selectedYear
            ) {
              window.clearInterval(timer);
              setPlaying(false);
              return selectedYear;
            }
            return detailed[index + 1].year;
          }),
        520,
      );
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [playing, selectedYear, detailed]);
  const point = detailed.find((item) => item.year === displayYear)!,
    men = point.menAge!.groups,
    women = point.womenAge!.groups,
    w = 900,
    h = 420,
    pL = 68,
    pR = 22,
    pT = 25,
    pB = 115,
    max =
      Math.max(
        ...men.map((item) => item.value),
        ...women.map((item) => item.value),
      ) * 1.12,
    step = (w - pL - pR) / men.length,
    y = (value: number) => h - pB - (value * (h - pT - pB)) / max;
  const toggleSex = (sex: "men" | "women") =>
    setActiveSexes((current) =>
      current.includes(sex)
        ? current.filter((item) => item !== sex)
        : [...current, sex],
    );
  return (
    <div className="chart-shell birth-chart marriage-age-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Calendario de los matrimonios</span>
          <h2>Matrimonios por grupo de edad y sexo</h2>
          <p className="chart-subtitle">
            La desagregación etaria está disponible hasta 2021.
          </p>
        </div>
        <div className="birth-age-controls">
          <label>
            Año
            <select
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(+event.target.value);
                setDisplayYear(+event.target.value);
                setPlaying(false);
              }}
            >
              {[...detailed].reverse().map((item) => (
                <option key={item.year}>{item.year}</option>
              ))}
            </select>
          </label>
          <button
            className={playing ? "playing" : ""}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? "❚❚ Pausar" : "▶ Reproducir desde 1992"}
          </button>
        </div>
      </div>
      <div className="birth-play-year">{displayYear}</div>
      <div
        className="series-legend birth-series-controls"
        aria-label="Series visibles"
      >
        <button
          type="button"
          className={activeSexes.includes("men") ? "on" : ""}
          aria-pressed={activeSexes.includes("men")}
          aria-label={`${activeSexes.includes("men") ? "Ocultar" : "Mostrar"} serie Hombres`}
          onClick={() => toggleSex("men")}
        >
          <i style={{ background: "#0096bd" }} />
          <b>Hombres</b>
          <small>{activeSexes.includes("men") ? "Visible" : "Oculta"}</small>
        </button>
        <button
          type="button"
          className={activeSexes.includes("women") ? "on" : ""}
          aria-pressed={activeSexes.includes("women")}
          aria-label={`${activeSexes.includes("women") ? "Ocultar" : "Mostrar"} serie Mujeres`}
          onClick={() => toggleSex("women")}
        >
          <i style={{ background: "#e43d37" }} />
          <b>Mujeres</b>
          <small>{activeSexes.includes("women") ? "Visible" : "Oculta"}</small>
        </button>
      </div>
      <p className="series-toggle-help" aria-live="polite">
        Haz clic en cada etiqueta para mostrar u ocultar su serie.
        {!activeSexes.length && " Ambas series están ocultas."}
      </p>
      <svg
        className="chart chart-motion"
        viewBox={`0 0 ${w} ${h}`}
        aria-label={`Calendario de los matrimonios. Series visibles: ${activeSexes.length ? activeSexes.map((sex) => (sex === "men" ? "Hombres" : "Mujeres")).join(" y ") : "ninguna"}.`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line x1={pL} x2={w - pR} y1={y(max * tick)} y2={y(max * tick)} />
            <text x={pL - 9} y={y(max * tick) + 4} textAnchor="end">
              {Math.round(max * tick).toLocaleString("es-CL")}
            </text>
          </g>
        ))}
        {men.map((item, index) => {
          const center = pL + step * index + step / 2,
            width = step * 0.32;
          return (
            <g key={item.label}>
              {activeSexes.includes("men") && (
                <rect
                  className="birth-series"
                  x={center - width - 1}
                  y={y(item.value)}
                  width={width}
                  height={h - pB - y(item.value)}
                  rx="2"
                  fill="#0096bd"
                >
                  <title>
                    Hombres {item.label}: {item.value.toLocaleString("es-CL")}
                  </title>
                </rect>
              )}
              {activeSexes.includes("women") && (
                <rect
                  className="birth-series"
                  x={center + 1}
                  y={y(women[index].value)}
                  width={width}
                  height={h - pB - y(women[index].value)}
                  rx="2"
                  fill="#e43d37"
                >
                  <title>
                    Mujeres {item.label}:{" "}
                    {women[index].value.toLocaleString("es-CL")}
                  </title>
                </rect>
              )}
              <text
                transform={`translate(${center},${h - pB + 17}) rotate(-55)`}
                textAnchor="end"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AucCompositionChart({ data }: { data: AucPoint[] }) {
  const latest = data.at(-1)!.year,
    [selectedYear, setSelectedYear] = useState(latest),
    [displayYear, setDisplayYear] = useState(latest),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const first = window.setTimeout(() => setDisplayYear(data[0].year), 0),
      timer = window.setInterval(
        () =>
          setDisplayYear((current) => {
            if (current >= selectedYear) {
              window.clearInterval(timer);
              setPlaying(false);
              return selectedYear;
            }
            return current + 1;
          }),
        650,
      );
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [playing, selectedYear, data]);
  const point = data.find((item) => item.year === displayYear)!,
    bars = [
      { label: "Distinto sexo", value: point.differentSex, color: "#123f87" },
      {
        label: "Mismo sexo · hombres",
        value: point.sameSexMen,
        color: "#0096bd",
      },
      {
        label: "Mismo sexo · mujeres",
        value: point.sameSexWomen,
        color: "#e43d37",
      },
    ],
    w = 900,
    h = 400,
    pL = 75,
    pR = 25,
    pT = 25,
    pB = 85,
    max = Math.max(...bars.map((bar) => bar.value)) * 1.15,
    step = (w - pL - pR) / bars.length,
    y = (value: number) => h - pB - (value * (h - pT - pB)) / max;
  return (
    <div className="chart-shell birth-chart auc-composition-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Composición de los AUC</span>
          <h2>Acuerdos según sexo de la pareja</h2>
        </div>
        <div className="birth-age-controls">
          <label>
            Año
            <select
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(+event.target.value);
                setDisplayYear(+event.target.value);
                setPlaying(false);
              }}
            >
              {[...data].reverse().map((item) => (
                <option key={item.year} value={item.year}>
                  {item.year}
                  {item.provisional ? " (p)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            className={playing ? "playing" : ""}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? "❚❚ Pausar" : "▶ Reproducir desde 2017"}
          </button>
        </div>
      </div>
      <div className="birth-play-year">
        {displayYear}
        {point.provisional ? " (provisional)" : ""}
      </div>
      <svg className="chart chart-motion" viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line x1={pL} x2={w - pR} y1={y(max * tick)} y2={y(max * tick)} />
            <text x={pL - 9} y={y(max * tick) + 4} textAnchor="end">
              {Math.round(max * tick).toLocaleString("es-CL")}
            </text>
          </g>
        ))}
        {bars.map((bar, index) => {
          const center = pL + step * index + step / 2;
          return (
            <g key={bar.label}>
              <rect
                x={center - step * 0.28}
                y={y(bar.value)}
                width={step * 0.56}
                height={h - pB - y(bar.value)}
                rx="5"
                fill={bar.color}
              >
                <title>
                  {bar.label}: {bar.value.toLocaleString("es-CL")}
                </title>
              </rect>
              <text
                x={center}
                y={y(bar.value) - 9}
                textAnchor="middle"
                className="bar-value"
              >
                {bar.value.toLocaleString("es-CL")}
              </text>
              <text x={center} y={h - pB + 27} textAnchor="middle">
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function UnionsPage({
  onLabor,
  onInformality,
  onIpc,
  onIpp,
  onBirths,
  onFertility,
  onDeaths,
}: {
  onLabor: () => void;
  onInformality: () => void;
  onIpc: () => void;
  onIpp: () => void;
  onBirths: () => void;
  onFertility: () => void;
  onDeaths: () => void;
}) {
  const vital = useVitalData();
  if (!vital.ready)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  const raw = vital.data.unions,
    marriages = raw.marriages,
    auc = raw.auc,
    latestMarriage = marriages.at(-1)!,
    previousMarriage = marriages.at(-2)!,
    latestAuc = auc.at(-1)!,
    previousAuc = auc.at(-2)!,
    firstMarriage = marriages[0],
    lastDetailed = [...marriages]
      .reverse()
      .find((point) => point.menAge && point.womenAge)!,
    pandemicMarriage = marriages.find((point) => point.year === 2020)!,
    prePandemicMarriage = marriages.find((point) => point.year === 2019)!,
    sameSexShare = (latestAuc.sameSex / latestAuc.total) * 100,
    differentSexShare = (latestAuc.differentSex / latestAuc.total) * 100,
    marriageAnnual = (latestMarriage.total / previousMarriage.total - 1) * 100,
    aucAnnual = (latestAuc.total / previousAuc.total - 1) * 100;
  return (
    <main>
      <PriceHeader
        onLabor={onLabor}
        onInformality={onInformality}
        onIpc={onIpc}
        onIpp={onIpp}
        onBirths={onBirths}
        onFertility={onFertility}
        onDeaths={onDeaths}
        onUnions={() => {}}
        current="unions"
      />
      <section className="hero wrap births-hero">
        <div>
          <span className="eyebrow">
            Demografía y población · Estadísticas vitales
          </span>
          <h1>
            Matrimonios
            <br />y Acuerdos de Unión Civil (AUC) en Chile
          </h1>
          <p>
            Una historia sobre la intensidad, el calendario y la diversificación
            de las uniones formalizadas.
          </p>
        </div>
        <aside className="births-latest latest-value-first">
          <span>Último año disponible</span>
          <div className="union-latest-metrics">
            <b>{latestMarriage.total.toLocaleString("es-CL")} matrimonios</b>
            <small>
              {marriageAnnual >= 0 ? "+" : "−"}
              {Math.abs(marriageAnnual).toFixed(1).replace(".", ",")}% anual
            </small>
            <b>{latestAuc.total.toLocaleString("es-CL")} AUC</b>
            <small>
              {aucAnnual >= 0 ? "+" : "−"}
              {Math.abs(aucAnnual).toFixed(1).replace(".", ",")}% anual
            </small>
          </div>
          <strong>
            {latestMarriage.year}
            <small>(p)</small>
          </strong>
        </aside>
      </section>
      <section className="wrap kpis birth-kpis union-kpis">
        <article>
          <div>
            <h3>Matrimonios</h3>
            <strong>{latestMarriage.total.toLocaleString("es-CL")}</strong>
            <p>{marriageAnnual.toFixed(1).replace(".", ",")}% anual</p>
          </div>
        </article>
        <article>
          <div>
            <h3>Tasa bruta de nupcialidad</h3>
            <strong>{latestMarriage.rate.toFixed(1).replace(".", ",")}</strong>
            <p>valor publicado</p>
          </div>
        </article>
        <article>
          <div>
            <h3>Acuerdos de Unión Civil</h3>
            <strong>{latestAuc.total.toLocaleString("es-CL")}</strong>
            <p>+{aucAnnual.toFixed(1).replace(".", ",")}% anual</p>
          </div>
        </article>
        <article>
          <div>
            <h3>AUC de parejas del mismo sexo</h3>
            <strong>{sameSexShare.toFixed(1).replace(".", ",")}%</strong>
            <p>{latestAuc.sameSex.toLocaleString("es-CL")} acuerdos</p>
          </div>
        </article>
        <article>
          <div>
            <h3>AUC de parejas de distinto sexo</h3>
            <strong>{differentSexShare.toFixed(1).replace(".", ",")}%</strong>
            <p>{latestAuc.differentSex.toLocaleString("es-CL")} acuerdos</p>
          </div>
        </article>
      </section>
      <section className="wrap births-story">
        <div className="births-reading">
          <span className="eyebrow">Transformación de las uniones</span>
          <h2>
            Menos matrimonios que en los noventa y una expansión reciente del
            AUC
          </h2>
          <p>
            Entre 1992 y {latestMarriage.year}, los matrimonios disminuyeron{" "}
            <b>
              {Math.abs((latestMarriage.total / firstMarriage.total - 1) * 100)
                .toFixed(1)
                .replace(".", ",")}
              %
            </b>
            . El AUC, disponible desde 2017, alcanzó{" "}
            {latestAuc.total.toLocaleString("es-CL")} inscripciones en{" "}
            {latestAuc.year}, su mayor registro de la serie.
          </p>
          <p>
            Ambas formas cayeron en 2020 por las restricciones de la pandemia,
            pero sus recuperaciones posteriores siguieron trayectorias
            distintas.
          </p>
        </div>
        <UnionTotalsChart marriages={marriages} auc={auc} />
      </section>
      <section className="births-analysis">
        <div className="wrap fertility-grid">
          <div className="union-story-pair">
            <div className="fertility-narrative">
              <span className="eyebrow">Intensidad</span>
              <h2>El volumen debe leerse junto con la tasa</h2>
              <p>
                Los conteos dependen del tamaño de la población. La tasa bruta
                de nupcialidad permite observar una caída estructural desde los
                niveles de los años noventa, además del descenso excepcional de
                2020 y el rebote de 2022.
              </p>
            </div>
            <div className="fertility-narrative">
              <span className="eyebrow">Pandemia y recuperación</span>
              <h2>Un choque común, seguido por respuestas diferentes</h2>
              <p>
                Los matrimonios cayeron{" "}
                {Math.abs(
                  (pandemicMarriage.total / prePandemicMarriage.total - 1) *
                    100,
                )
                  .toFixed(1)
                  .replace(".", ",")}
                % en 2020. En 2024 se situaron nuevamente cerca de su nivel de
                2019, mientras los AUC crecieron con fuerza en 2023 y 2024.
              </p>
            </div>
          </div>
          <UnionRatesChart marriages={marriages} auc={auc} />
          <div className="fertility-narrative">
            <span className="eyebrow">Postergación del matrimonio</span>
            <h2>El grupo modal se desplazó desde los 20–24 a los 30–34 años</h2>
            <p>
              En 1992, el mayor número de matrimonios se concentraba entre 20 y
              24 años tanto en hombres como en mujeres. En {lastDetailed.year},
              el máximo se ubicó entre {lastDetailed.menAge!.modalGroup} años
              para ambos sexos. La edad media aproximada por grupos alcanzó{" "}
              {lastDetailed.menAge!.approxMean.toFixed(1).replace(".", ",")}{" "}
              años en hombres y{" "}
              {lastDetailed.womenAge!.approxMean.toFixed(1).replace(".", ",")}{" "}
              en mujeres.
            </p>
            <p>
              La media es una aproximación construida con puntos medios de
              grupos quinquenales; sirve para describir el desplazamiento del
              calendario, no reemplaza una edad media oficial.
            </p>
          </div>
          <MarriageAgeChart data={marriages} />
          <div className="fertility-narrative">
            <span className="eyebrow">Diversificación institucional</span>
            <h2>
              Los AUC crecen, principalmente entre parejas de distinto sexo
            </h2>
            <p>
              En {latestAuc.year}, los acuerdos de parejas de distinto sexo
              representaron{" "}
              {((latestAuc.differentSex / latestAuc.total) * 100)
                .toFixed(1)
                .replace(".", ",")}
              % del total. Los AUC de parejas del mismo sexo sumaron{" "}
              {latestAuc.sameSex.toLocaleString("es-CL")}; dentro de ellos,{" "}
              {latestAuc.sameSexWomen.toLocaleString("es-CL")} correspondieron a
              parejas de mujeres y{" "}
              {latestAuc.sameSexMen.toLocaleString("es-CL")} a parejas de
              hombres.
            </p>
          </div>
          <AucCompositionChart data={auc} />
          <div className="fertility-narrative fertility-extra">
            <span className="eyebrow">Lectura demográfica</span>
            <h2>Formalización de uniones no equivale a formación de parejas</h2>
            <p>
              Estas estadísticas registran actos legales ocurridos en cada año.
              No miden todas las convivencias, separaciones ni trayectorias de
              pareja. Por ello, la caída de la nupcialidad no debe interpretarse
              automáticamente como una reducción equivalente de la vida en
              pareja; también puede reflejar postergación, convivencia no
              matrimonial y cambios en las preferencias institucionales.
            </p>
          </div>
        </div>
      </section>
      <section className="resources">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Fuente oficial</span>
            <h2>Series de estadísticas vitales</h2>
            <p>
              Matrimonios 1992–2024 y AUC 2017–2024. Los años 2022–2024 son
              provisionales; la desagregación etaria de matrimonios llega hasta
              2021.
            </p>
          </div>
          <a
            className="birth-download"
            href="https://www.ine.gob.cl/docs/default-source/nacimientos-matrimonios-y-defunciones/cuadros-estadisticos/series-hist%C3%B3ricas/series-vitales-1992-2024%28p%29.xlsx"
          >
            Descargar Excel oficial ↗
          </a>
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href="https://www.ine.gob.cl/estadisticas-por-tema/demografia-y-migracion/nacimientos-matrimonios-y-defunciones">
            Fuente oficial: ine.gob.cl ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

function MortalityPage({
  onLabor,
  onInformality,
  onIpc,
  onIpp,
  onBirths,
  onFertility,
  onDeaths,
}: {
  onLabor: () => void;
  onInformality: () => void;
  onIpc: () => void;
  onIpp: () => void;
  onBirths: () => void;
  onFertility: () => void;
  onDeaths: () => void;
}) {
  const vital = useVitalData();
  if (!vital.ready)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  const data = vital.data.mortality.series,
    latest = data.at(-1)!,
    previous = data.at(-2)!,
    first = data[0],
    prePandemic = data.find((point) => point.year === 2019)!,
    pandemic = data.find((point) => point.year === 2021)!,
    lifeGain = latest.lifeBoth - first.lifeBoth,
    gapFirst = first.lifeWomen - first.lifeMen,
    gapLatest = latest.lifeWomen - latest.lifeMen;
  return (
    <main>
      <PriceHeader
        onLabor={onLabor}
        onInformality={onInformality}
        onIpc={onIpc}
        onIpp={onIpp}
        onBirths={onBirths}
        onFertility={onFertility}
        onDeaths={onDeaths}
        onMortality={() => {}}
        current="mortality"
      />
      <section className="hero wrap births-hero">
        <div>
          <span className="eyebrow">
            Demografía y población · Estadísticas vitales
          </span>
          <h1>
            Mortalidad
            <br />
            en Chile
          </h1>
          <p>
            Cómo han cambiado la mortalidad general, la supervivencia en las
            primeras edades y la esperanza de vida desde 1992.
          </p>
        </div>
        <aside className="births-latest latest-value-first">
          <span>Último año disponible</span>
          <b>
            {latest.lifeBoth.toFixed(1).replace(".", ",")} años de esperanza de
            vida
          </b>
          <strong>
            {latest.year}
            <small>(p)</small>
          </strong>
        </aside>
      </section>
      <section className="wrap kpis birth-kpis">
        <article>
          <div>
            <h3>Tasa bruta de mortalidad</h3>
            <strong>{latest.crude.toFixed(1).replace(".", ",")}</strong>
            <p>por 1.000 habitantes</p>
          </div>
        </article>
        <article>
          <div>
            <h3>Mortalidad infantil</h3>
            <strong>{latest.infant.toFixed(1).replace(".", ",")}</strong>
            <p>por 1.000 nacidos vivos</p>
          </div>
        </article>
        <article>
          <div>
            <h3>Mortalidad en la niñez</h3>
            <strong>{latest.under5.toFixed(1).replace(".", ",")}</strong>
            <p>probabilidad por 1.000</p>
          </div>
        </article>
        <article>
          <div>
            <h3>Esperanza de vida</h3>
            <strong>{latest.lifeBoth.toFixed(1).replace(".", ",")}</strong>
            <p>años, ambos sexos</p>
          </div>
        </article>
      </section>
      <section className="wrap births-story">
        <div className="births-reading">
          <span className="eyebrow">Transición de la mortalidad</span>
          <h2>
            Menor mortalidad temprana, con una tasa bruta sensible al
            envejecimiento
          </h2>
          <p>
            Entre 1992 y {latest.year}, la mortalidad infantil disminuyó{" "}
            <b>
              {Math.abs((latest.infant / first.infant - 1) * 100)
                .toFixed(1)
                .replace(".", ",")}
              %
            </b>{" "}
            y la mortalidad en la niñez cayó{" "}
            <b>
              {Math.abs((latest.under5 / first.under5 - 1) * 100)
                .toFixed(1)
                .replace(".", ",")}
              %
            </b>
            .
          </p>
          <p>
            En cambio, la tasa bruta pasó de{" "}
            {first.crude.toFixed(1).replace(".", ",")} a{" "}
            {latest.crude.toFixed(1).replace(".", ",")} por 1.000 habitantes.
            Esto no implica necesariamente un deterioro sanitario: una población
            más envejecida registra más defunciones aun cuando los riesgos
            específicos por edad disminuyan.
          </p>
        </div>
        <MortalityRatesChart data={data} />
      </section>
      <section className="births-analysis">
        <div className="wrap fertility-grid">
          <div className="mortality-story-pair">
            <div className="fertility-narrative">
              <span className="eyebrow">Lectura en profundidad</span>
              <h2>Las primeras edades concentran una mejora histórica</h2>
              <p>
                La caída de la mortalidad infantil y en la niñez refleja avances
                acumulados en atención prenatal, parto, neonatología,
                vacunación, nutrición, saneamiento y acceso sanitario. Las
                series neonatal y fetal no tienen valores para 2023–2024; por
                ello el gráfico termina esas trayectorias en 2022, sin
                imputaciones.
              </p>
            </div>
            <div className="fertility-narrative">
              <span className="eyebrow">Esperanza de vida</span>
              <h2>
                Más años de vida, con una interrupción durante la pandemia
              </h2>
              <p>
                La esperanza de vida de ambos sexos aumentó{" "}
                <b>{lifeGain.toFixed(1).replace(".", ",")} años</b> entre 1992 y{" "}
                {latest.year}. Desde{" "}
                {prePandemic.lifeBoth.toFixed(2).replace(".", ",")} años en 2019
                descendió a {pandemic.lifeBoth.toFixed(2).replace(".", ",")} en
                2021, y luego se recuperó hasta{" "}
                {latest.lifeBoth.toFixed(2).replace(".", ",")} años.
              </p>
            </div>
          </div>
          <LifeExpectancyChart data={data} />
          <div className="fertility-narrative">
            <span className="eyebrow">Brecha por sexo</span>
            <h2>Las mujeres mantienen una mayor esperanza de vida</h2>
            <p>
              En {latest.year}, la esperanza de vida fue{" "}
              {latest.lifeWomen.toFixed(2).replace(".", ",")} años para las
              mujeres y {latest.lifeMen.toFixed(2).replace(".", ",")} para los
              hombres: una brecha de {gapLatest.toFixed(1).replace(".", ",")}{" "}
              años. En 1992 la diferencia era{" "}
              {gapFirst.toFixed(1).replace(".", ",")} años, por lo que la
              ventaja femenina se ha reducido, aunque sigue siendo sustantiva.
            </p>
            <p>
              Esta brecha sintetiza diferencias en mortalidad por causas
              externas, enfermedades crónicas, exposiciones laborales, conductas
              de riesgo y utilización de servicios de salud. No debe
              interpretarse como un atributo biológico aislado.
            </p>
          </div>
          <LifeExpectancyBars data={data} />
          <div className="fertility-narrative fertility-extra">
            <span className="eyebrow">Interpretación demográfica</span>
            <h2>La esperanza de vida es una medida de período</h2>
            <p>
              El indicador resume cuántos años viviría, en promedio, una cohorte
              hipotética expuesta durante toda su vida a las tasas de mortalidad
              observadas en ese año. No predice literalmente la longevidad de
              quienes nacieron en {latest.year}; permite comparar el patrón de
              mortalidad entre años y sexos sin depender de la estructura etaria
              de la población.
            </p>
          </div>
        </div>
      </section>
      <section className="resources">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Fuente oficial</span>
            <h2>Series de estadísticas vitales</h2>
            <p>
              Cifras 1992–2024. Los años 2023 y 2024 son provisionales; no
              incluyen tasas neonatal ni fetal.
            </p>
          </div>
          <a
            className="birth-download"
            href="https://www.ine.gob.cl/docs/default-source/nacimientos-matrimonios-y-defunciones/cuadros-estadisticos/series-hist%C3%B3ricas/series-vitales-1992-2024%28p%29.xlsx"
          >
            Descargar Excel oficial ↗
          </a>
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href="https://www.ine.gob.cl/estadisticas-por-tema/demografia-y-migracion/nacimientos-matrimonios-y-defunciones">
            Fuente oficial: ine.gob.cl ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

function DeathsPage({
  onLabor,
  onInformality,
  onIpc,
  onIpp,
  onBirths,
  onFertility,
  onMortality,
}: {
  onLabor: () => void;
  onInformality: () => void;
  onIpc: () => void;
  onIpp: () => void;
  onBirths: () => void;
  onFertility: () => void;
  onMortality: () => void;
}) {
  const vital = useVitalData();
  if (!vital.ready)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  const data = vital.data.deaths.series,
    latest = data.at(-1)!,
    previous = data.at(-2)!,
    first = data[0],
    lastNeonatal = [...data]
      .reverse()
      .find((point) => point.neonatal !== null)!,
    lastFetal = [...data].reverse().find((point) => point.fetal !== null)!,
    corrPoints = data
      .filter((point) => point.neonatalPerThousandBirths !== null)
      .map((point) => ({
        x: point.youngMotherShare,
        y: point.neonatalPerThousandBirths as number,
      })),
    correlation = pearson(corrPoints);
  const annual = (latest.total / previous.total - 1) * 100,
    change = (latest.total / first.total - 1) * 100;
  return (
    <main>
      <PriceHeader
        onLabor={onLabor}
        onInformality={onInformality}
        onIpc={onIpc}
        onIpp={onIpp}
        onBirths={onBirths}
        onFertility={onFertility}
        onDeaths={() => {}}
        onMortality={onMortality}
        current="deaths"
      />
      <section className="hero wrap births-hero">
        <div>
          <span className="eyebrow">
            Demografía y población · Estadísticas vitales
          </span>
          <h1>
            Defunciones
            <br />
            en Chile
          </h1>
          <p>
            Una lectura de largo plazo sobre el nivel de las defunciones, su
            composición por sexo y la mortalidad en las primeras etapas de la
            vida.
          </p>
        </div>
        <aside className="births-latest latest-value-first">
          <span>Último año disponible</span>
          <b>{latest.total.toLocaleString("es-CL")} defunciones</b>
          <strong>
            {latest.year}
            <small>(p)</small>
          </strong>
        </aside>
      </section>
      <section className="wrap kpis birth-kpis">
        <article>
          <div>
            <h3>Defunciones totales</h3>
            <strong>{latest.total.toLocaleString("es-CL")}</strong>
            <p>
              {annual >= 0 ? "+" : "−"}
              {Math.abs(annual).toFixed(1).replace(".", ",")}% respecto de{" "}
              {previous.year}
            </p>
          </div>
        </article>
        <article>
          <div>
            <h3>Defunciones de hombres</h3>
            <strong>{latest.men.toLocaleString("es-CL")}</strong>
            <p>
              {((latest.men / latest.total) * 100).toFixed(1).replace(".", ",")}
              % del total
            </p>
          </div>
        </article>
        <article>
          <div>
            <h3>Defunciones de mujeres</h3>
            <strong>{latest.women.toLocaleString("es-CL")}</strong>
            <p>
              {((latest.women / latest.total) * 100)
                .toFixed(1)
                .replace(".", ",")}
              % del total
            </p>
          </div>
        </article>
        <article>
          <div>
            <h3>Índice de masculinidad</h3>
            <strong>{latest.masculinity.toFixed(1).replace(".", ",")}</strong>
            <p>hombres por cada 100 mujeres</p>
          </div>
        </article>
      </section>
      <section className="wrap births-story">
        <div className="births-reading">
          <span className="eyebrow">Cambio de largo plazo</span>
          <h2>Más defunciones en una población más numerosa y envejecida</h2>
          <p>
            Entre 1992 y {latest.year}, el número anual de defunciones aumentó{" "}
            <b>{Math.abs(change).toFixed(1).replace(".", ",")}%</b>. Este conteo
            no es una tasa: está influido por el crecimiento y, especialmente,
            por el envejecimiento de la población.
          </p>
          <p>
            La sobremortalidad masculina persiste, aunque el índice bajó de{" "}
            <b>{first.masculinity.toFixed(1).replace(".", ",")}</b> a{" "}
            <b>{latest.masculinity.toFixed(1).replace(".", ",")}</b> hombres por
            cada 100 mujeres.
          </p>
        </div>
        <DeathTrendChart data={data} />
      </section>
      <section className="births-analysis">
        <div className="wrap fertility-grid">
          <div className="fertility-narrative">
            <span className="eyebrow">Primeras edades</span>
            <h2>Una reducción sostenida de las defunciones tempranas</h2>
            <p>
              Las defunciones de menores de un año descendieron de{" "}
              {first.infant!.toLocaleString("es-CL")} en 1992 a{" "}
              {latest.infant!.toLocaleString("es-CL")} en {latest.year}. Para
              defunciones neonatales y fetales, el último dato disponible en
              esta serie es {lastNeonatal.year} y {lastFetal.year},
              respectivamente.
            </p>
          </div>
          <EarlyDeathKpis data={data} mode="counts" />
          <EarlyDeathsChart data={data} mode="counts" />
          <div className="fertility-narrative">
            <span className="eyebrow">Escala comparable</span>
            <h2>El descenso supera la reducción del número de nacimientos</h2>
            <p>
              Al relacionar las defunciones con los nacimientos observados, las
              defunciones de menores de un año pasan de{" "}
              {first.infantPerThousandBirths!.toFixed(1).replace(".", ",")} por
              1.000 nacimientos en 1992 a{" "}
              {latest.infantPerThousandBirths!.toFixed(1).replace(".", ",")} en{" "}
              {latest.year}. La razón es descriptiva y no sustituye las tasas
              oficiales de mortalidad.
            </p>
          </div>
          <EarlyDeathKpis data={data} mode="rates" />
          <EarlyDeathsChart data={data} mode="rates" />
          <div className="fertility-narrative">
            <span className="eyebrow">Nacimientos y defunciones</span>
            <h2>Dos transformaciones que avanzan conjuntamente</h2>
            <p>
              Entre 1992 y 2022 disminuyeron tanto la proporción de nacimientos
              de madres menores de 20 años como las defunciones neonatales por
              1.000 nacimientos. La correlación nacional es positiva (r ={" "}
              {correlation.toFixed(2).replace(".", ",")}), pero no permite
              atribuir la mejora neonatal al cambio de la edad materna.
            </p>
          </div>
          <MaternalMortalityScatter data={data} />
          <div className="fertility-narrative fertility-extra">
            <span className="eyebrow">Implicancia para investigación</span>
            <h2>Separar volumen, estructura y riesgo</h2>
            <p>
              El aumento de las defunciones totales puede coexistir con una
              fuerte mejora de la supervivencia infantil. Para interpretar el
              fenómeno se deben distinguir el volumen de población, su
              estructura por edad y los riesgos específicos de morir. El
              análisis conjunto con nacimientos ayuda a contextualizar las
              primeras edades, pero las asociaciones agregadas deben
              complementarse con tasas oficiales y microdatos cuando se
              investiguen determinantes.
            </p>
          </div>
        </div>
      </section>
      <section className="resources">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Fuente oficial</span>
            <h2>Series de estadísticas vitales</h2>
            <p>
              Cifras 1992–2024. Los años 2023 y 2024 corresponden a cifras
              provisionales. La fuente no publica defunciones neonatales ni
              fetales para esos dos años.
            </p>
          </div>
          <a
            className="birth-download"
            href="https://www.ine.gob.cl/docs/default-source/nacimientos-matrimonios-y-defunciones/cuadros-estadisticos/series-hist%C3%B3ricas/series-vitales-1992-2024%28p%29.xlsx"
          >
            Descargar Excel oficial ↗
          </a>
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href="https://www.ine.gob.cl/estadisticas-por-tema/demografia-y-migracion/nacimientos-matrimonios-y-defunciones">
            Fuente oficial: ine.gob.cl ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

function BirthsPage({
  onLabor,
  onInformality,
  onIpc,
  onIpp,
  onFertility,
  onDeaths,
}: {
  onLabor: () => void;
  onInformality: () => void;
  onIpc: () => void;
  onIpp: () => void;
  onFertility: () => void;
  onDeaths: () => void;
}) {
  const vital = useVitalData();
  if (!vital.ready)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  const data = vital.data.births.series,
    latest = data.at(-1)!,
    previous = data.at(-2)!,
    annual = (latest.observed / previous.observed - 1) * 100,
    from1992 = (latest.observed / data[0].observed - 1) * 100;
  return (
    <main>
      <PriceHeader
        onLabor={onLabor}
        onInformality={onInformality}
        onIpc={onIpc}
        onIpp={onIpp}
        onBirths={() => {}}
        onFertility={onFertility}
        onDeaths={onDeaths}
        current="births"
      />
      <section className="hero wrap births-hero">
        <div>
          <span className="eyebrow">
            Demografía y población · Estadísticas vitales
          </span>
          <h1>
            Nacimientos
            <br />
            en Chile
          </h1>
          <p>
            Una mirada de largo plazo a los nacimientos observados, su
            composición por sexo y la edad de las madres.
          </p>
        </div>
        <aside className="births-latest latest-value-first">
          <span>Último año disponible</span>
          <b>{latest.observed.toLocaleString("es-CL")} nacimientos</b>
          <strong>
            {latest.year}
            <small>(p)</small>
          </strong>
        </aside>
      </section>
      <section className="wrap kpis birth-kpis">
        <article>
          <div>
            <h3>Nacimientos observados</h3>
            <strong>{latest.observed.toLocaleString("es-CL")}</strong>
            <p>
              {annual.toFixed(1).replace(".", ",")}% respecto de {previous.year}
            </p>
          </div>
        </article>
        <article>
          <div>
            <h3>Nacimientos hombres</h3>
            <strong>{latest.men.toLocaleString("es-CL")}</strong>
            <p>
              {(latest.men / previous.men - 1) * 100 >= 0 ? "+" : ""}
              {((latest.men / previous.men - 1) * 100)
                .toFixed(1)
                .replace(".", ",")}
              % anual
            </p>
          </div>
        </article>
        <article>
          <div>
            <h3>Nacimientos mujeres</h3>
            <strong>{latest.women.toLocaleString("es-CL")}</strong>
            <p>
              {(latest.women / previous.women - 1) * 100 >= 0 ? "+" : ""}
              {((latest.women / previous.women - 1) * 100)
                .toFixed(1)
                .replace(".", ",")}
              % anual
            </p>
          </div>
        </article>
        <article>
          <div>
            <h3>Índice de masculinidad</h3>
            <strong>{latest.masculinity.toFixed(1).replace(".", ",")}</strong>
            <p>hombres por cada 100 mujeres</p>
          </div>
        </article>
      </section>
      <section className="wrap births-story">
        <div className="births-reading">
          <span className="eyebrow">Tendencia de largo plazo</span>
          <h2>Menos nacimientos y una maternidad más tardía</h2>
          <p>
            Entre 1992 y {latest.year}, los nacimientos observados disminuyeron{" "}
            <b>{Math.abs(from1992).toFixed(1).replace(".", ",")}%</b>. En el
            último año disponible se registraron{" "}
            <b>
              {Math.abs(latest.observed - previous.observed).toLocaleString(
                "es-CL",
              )}{" "}
              nacimientos menos
            </b>{" "}
            que en {previous.year}.
          </p>
          <p>
            La distribución por edad muestra el desplazamiento de los
            nacimientos hacia edades maternas mayores: el grupo con más
            nacimientos en {latest.year} fue{" "}
            <b>{[...latest.ages].sort((a, b) => b.value - a.value)[0].label}</b>
            .
          </p>
        </div>
        <BirthLineChart data={data} />
      </section>
      <section className="births-analysis">
        <div className="wrap">
          <BirthAgeChart data={data} />
          <BirthComparisonChart data={data} mode="annual" />
          <BirthComparisonChart data={data} mode="transform" />
        </div>
      </section>
      <section className="resources">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Fuente oficial</span>
            <h2>Series de estadísticas vitales</h2>
            <p>
              Cifras 1992–2024. Los años 2023 y 2024 corresponden a cifras
              provisionales.
            </p>
          </div>
          <a
            className="birth-download"
            href="https://www.ine.gob.cl/docs/default-source/nacimientos-matrimonios-y-defunciones/cuadros-estadisticos/series-hist%C3%B3ricas/series-vitales-1992-2024%28p%29.xlsx"
          >
            Descargar Excel oficial ↗
          </a>
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href="https://www.ine.gob.cl/estadisticas-por-tema/demografia-y-migracion/nacimientos-matrimonios-y-defunciones">
            Fuente oficial: ine.gob.cl ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

const POLICE_METRICS: Array<{
  id: PoliceMetric;
  label: string;
  color: string;
}> = [
  { id: "denuncias", label: "Denuncias", color: "#123f87" },
  { id: "detenidos", label: "Personas detenidas", color: "#d0443c" },
  { id: "victimas", label: "Número de víctimas", color: "#16836f" },
];
const policeNumber = new Intl.NumberFormat("es-CL");
const policeVariation = (current: number, previous?: number) =>
  previous ? (current / previous - 1) * 100 : null;

function PoliceSeriesChart({
  institution,
}: {
  institution: PoliceInstitution;
}) {
  const [mode, setMode] = useState<"number" | "variation">("number");
  const [active, setActive] = useState<PoliceMetric[]>(
    POLICE_METRICS.map((item) => item.id),
  );
  const allYears = institution.series.denuncias.map((point) => point.year);
  const temporal = useTemporalWindow(
    allYears,
    allYears.map(String),
    [
      { value: 5, label: "5 años" },
      { value: "all", label: "Serie completa" },
    ],
    5,
  );
  const years = temporal.visible;
  const yearSet = new Set(years);
  const width = 920,
    height = 430,
    left = 78,
    right = 28,
    top = 28,
    bottom = 58;
  const series = active.map((metric) => ({
    metric,
    points: institution.series[metric]
      .map((point, index, all) => ({
        year: point.year,
        value:
          mode === "number"
            ? point.total
            : policeVariation(point.total, all[index - 1]?.total),
      }))
      .filter(
        (point): point is { year: number; value: number } =>
          point.value !== null && yearSet.has(point.year),
      ),
  }));
  const values = series.flatMap((item) =>
    item.points.map((point) => point.value),
  );
  const min = mode === "variation" ? Math.min(0, ...values) : 0;
  const max = Math.max(1, ...values);
  const x = (year: number) =>
    left +
    ((year - years[0]) / (years.at(-1)! - years[0])) * (width - left - right);
  const y = (value: number) =>
    top + ((max - value) / Math.max(1, max - min)) * (height - top - bottom);
  const toggle = (metric: PoliceMetric) =>
    setActive((current) =>
      current.includes(metric)
        ? current.filter((item) => item !== metric)
        : [...current, metric],
    );
  return (
    <div className="chart-shell police-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Serie histórica · 2016–2024</span>
          <h2>Evolución de los registros policiales</h2>
          <p className="chart-subtitle">
            Activa o desactiva las series para comparar su trayectoria.
          </p>
        </div>
        <label className="police-mode">
          Unidad
          <select
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as "number" | "variation")
            }
          >
            <option value="number">Número</option>
            <option value="variation">Variación anual</option>
          </select>
        </label>
      </div>
      <div className="police-legend">
        {POLICE_METRICS.map((item) => (
          <button
            key={item.id}
            className={active.includes(item.id) ? "active" : ""}
            onClick={() => toggle(item.id)}
          >
            <i style={{ background: item.color }} />
            {item.label}
          </button>
        ))}
      </div>
      {active.length ? (
        <svg
          className="chart chart-motion"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Series históricas de ${institution.label}`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((share) => {
            const value = min + (max - min) * share;
            return (
              <g key={share}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y(value)}
                  y2={y(value)}
                />
                <text x={left - 12} y={y(value) + 4} textAnchor="end">
                  {mode === "number"
                    ? policeNumber.format(Math.round(value))
                    : `${value.toFixed(1).replace(".", ",")}%`}
                </text>
              </g>
            );
          })}
          {mode === "variation" && (
            <line
              className="police-zero"
              x1={left}
              x2={width - right}
              y1={y(0)}
              y2={y(0)}
            />
          )}
          {years.map((year) => (
            <text key={year} x={x(year)} y={height - 20} textAnchor="middle">
              {year}
            </text>
          ))}
          {series.map(({ metric, points }) => {
            const meta = POLICE_METRICS.find((item) => item.id === metric)!;
            return (
              <g key={metric}>
                <path
                  className="police-line"
                  d={points
                    .map(
                      (point, index) =>
                        `${index ? "L" : "M"}${x(point.year)},${y(point.value)}`,
                    )
                    .join(" ")}
                  style={{ stroke: meta.color }}
                />
                {points.map((point) => (
                  <circle
                    key={point.year}
                    cx={x(point.year)}
                    cy={y(point.value)}
                    r="4"
                    fill={meta.color}
                  >
                    <title>{`${meta.label} · ${point.year}: ${mode === "number" ? policeNumber.format(point.value) : `${point.value.toFixed(1).replace(".", ",")}%`}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="police-empty">
          Selecciona al menos una serie para visualizar el gráfico.
        </div>
      )}
      {temporal.controls}
      <p className="chart-source">
        Fuente: registros administrativos de Carabineros de Chile y Policía de
        Investigaciones. INE, cuadros estadísticos policiales.
      </p>
    </div>
  );
}

function PoliceRegionalMap({
  institution,
}: {
  institution: PoliceInstitution;
}) {
  const [metric, setMetric] = useState<PoliceMetric>("denuncias");
  const metricSeries = institution.series[metric],
    point = metricSeries.at(-1),
    previousPoint = metricSeries.at(-2);
  if (!point) return null;
  const entries = Object.entries(point.regions).filter(
    (entry): entry is [string, number] => Number.isFinite(entry[1]),
  );
  const values = entries.map(([, value]) => value),
    min = Math.min(...values),
    max = Math.max(...values);
  const color = (value: number) => {
    const ratio = (value - min) / Math.max(1, max - min),
      light = [217, 240, 247],
      dark = [18, 63, 135],
      c = (i: number) => Math.round(light[i] + (dark[i] - light[i]) * ratio);
    return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
  };
  const label = POLICE_METRICS.find((item) => item.id === metric)!.label;
  const regionalChange = (region: string, current: number) => {
    const previous = previousPoint?.regions[region];
    if (!Number.isFinite(previous) || previous === 0)
      return "Var. anual sin comparación";
    const people = current - previous!,
      percent = (people / previous!) * 100,
      signedPeople = `${people < 0 ? "−" : ""}${policeNumber.format(Math.abs(people))}`,
      signedPercent = `${percent < 0 ? "−" : ""}${Math.abs(percent).toFixed(1).replace(".", ",")}%`;
    return `Var. anual ${signedPercent} | ${signedPeople} personas`;
  };
  return (
    <div className="chart-shell enusc-chart enusc-map-chart police-map-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Comparación regional · {point.year}</span>
          <h2>{label} por región</h2>
          <p className="chart-subtitle">
            El color representa el volumen registrado en cada región para el
            último año disponible de la serie.
          </p>
        </div>
        <label className="police-mode">
          Indicador
          <select
            value={metric}
            onChange={(event) => setMetric(event.target.value as PoliceMetric)}
          >
            {POLICE_METRICS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="enusc-map-layout">
        <svg
          className="chart chart-motion enusc-region-map"
          viewBox="0 0 820 850"
          role="img"
          aria-label={`${label} por región en ${point.year}`}
        >
          {(chileRegionsMapRaw as ChileRegionPath[]).map((region) => {
            const value = point.regions[region.region],
              position = CHILE_REGION_LABELS[region.region];
            if (!Number.isFinite(value) || !position) return null;
            const change = regionalChange(region.region, value!);
            return (
              <g key={region.code}>
                <path d={region.path} fill={color(value!)} fillRule="evenodd">
                  <title>{`${enuscLabel(region.region)}: ${policeNumber.format(value!)} (${change})`}</title>
                </path>
                <polyline
                  className="enusc-map-leader"
                  points={`${position.anchorX},${position.anchorY} 360,${position.labelY} 378,${position.labelY}`}
                />
                <text
                  className="enusc-map-region-label"
                  x="386"
                  y={position.labelY - 5}
                >
                  <tspan x="386">{enuscLabel(region.region)}</tspan>
                  <tspan
                    className="enusc-map-region-value"
                    x="386"
                    dy="17"
                  >{`${policeNumber.format(value!)} (${change})`}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="enusc-map-scale">
        <i />
        <small>{policeNumber.format(min)}</small>
        <small>{policeNumber.format(max)}</small>
      </div>
    </div>
  );
}

function PoliceChapter({
  institution,
  chapter,
}: {
  institution: PoliceInstitution;
  chapter: string;
}) {
  const narrative = (metric: PoliceMetric) => {
    const series = institution.series[metric];
    const current = series.at(-1);
    const previous = series.at(-2);
    if (!current) return null;
    return {
      current: current.total,
      year: current.year,
      previousYear: previous?.year,
      change: policeVariation(current.total, previous?.total),
    };
  };
  const summary = Object.fromEntries(
    POLICE_METRICS.map((item) => [item.id, narrative(item.id)]),
  ) as Record<PoliceMetric, ReturnType<typeof narrative>>;
  const changeText = (metric: PoliceMetric) => {
    const value = summary[metric];
    if (!value || value.change === null)
      return "sin comparación anual disponible";
    return `${value.change >= 0 ? "aumentó" : "disminuyó"} ${Math.abs(value.change).toFixed(1).replace(".", ",")}%`;
  };
  const isCarabineros = institution.label === "Carabineros de Chile";
  return (
    <section className="police-chapter">
      <div className="wrap police-chapter-intro">
        <span className="eyebrow">{chapter}</span>
        <h2>{institution.label}</h2>
        <p>
          Una lectura integrada de denuncias, personas detenidas y víctimas
          registradas, con foco en su evolución temporal y distribución
          territorial.
        </p>
      </div>
      <div className="wrap police-narratives">
        {POLICE_METRICS.map((item) => {
          const value = narrative(item.id);
          if (!value) return null;
          return (
            <article key={item.id}>
              <span>
                {item.label} · {value.year}
              </span>
              <strong>{policeNumber.format(value.current)}</strong>
              <small>
                {value.change === null
                  ? "Sin comparación anual disponible"
                  : `${value.change >= 0 ? "Aumentaron" : "Disminuyeron"} ${Math.abs(value.change).toFixed(1).replace(".", ",")}% respecto de ${value.previousYear}`}
              </small>
            </article>
          );
        })}
      </div>
      <div className="wrap police-story-row">
        <div className="police-analysis fertility-narrative">
          <span className="eyebrow">Evolución temporal</span>
          <h2>
            {isCarabineros
              ? "Los registros recuperan dinamismo, con trayectorias distintas entre indicadores"
              : "Las tres series describen dimensiones relacionadas, pero no intercambiables"}
          </h2>
          <p>
            En el último año disponible, el número de denuncias{" "}
            {changeText("denuncias")}, mientras que las víctimas{" "}
            {changeText("victimas")} y las personas detenidas{" "}
            {changeText("detenidos")} respecto del año anterior.
          </p>
          <p>
            {isCarabineros
              ? "La comparación conjunta permite observar cómo cambia la actividad policial registrada, sin interpretar automáticamente las diferencias como un aumento o disminución equivalente de la delincuencia."
              : "Cada indicador representa una unidad de análisis distinta y una misma investigación puede involucrar más de una persona o registro."}
          </p>
        </div>
        <PoliceSeriesChart institution={institution} />
      </div>
      <div className="wrap police-story-row police-territory-row">
        <div className="police-analysis fertility-narrative">
          <span className="eyebrow">Distribución territorial</span>
          <h2>
            El volumen de registros varía considerablemente entre regiones
          </h2>
          <p>
            El mapa permite cambiar entre denuncias, personas detenidas y
            víctimas para reconocer patrones territoriales y comparar la
            concentración de los registros.
          </p>
          <p>
            Las diferencias regionales deben interpretarse considerando el
            tamaño de la población, la concentración urbana y la distribución de
            las unidades policiales. Los valores son números absolutos y no
            tasas por habitante.
          </p>
        </div>
        <PoliceRegionalMap institution={institution} />
      </div>
    </section>
  );
}

export function PolicePage({
  onLabor,
  onInformality,
  onIpc,
  onIpp,
  onBirths,
  onEnusc,
}: {
  onLabor: () => void;
  onInformality: () => void;
  onIpc: () => void;
  onIpp: () => void;
  onBirths: () => void;
  onEnusc: () => void;
}) {
  const [data, setData] = useState<PoliceData>(policeRawData as PoliceData);
  const [cacheReady, setCacheReady] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/police-data", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error();
        return payload as PoliceData;
      })
      .then((payload) => {
        if (
          active &&
          payload.institutions?.carabineros?.series?.denuncias?.length
        ) {
          setData(payload);
          setCacheReady(true);
        }
        void fetch("/api/police-data?refresh=1", { cache: "no-store" })
          .then((response) => (response.ok ? response.json() : null))
          .then((updated) => {
            if (active && updated?.cache?.status === "updated")
              setData(updated as PoliceData);
          });
      })
      .catch(() => {
        /* La copia local permanece visible si la fuente oficial no responde. */
        setCacheReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!cacheReady)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  return (
    <main className="police-page">
      <PriceHeader
        onLabor={onLabor}
        onInformality={onInformality}
        onIpc={onIpc}
        onIpp={onIpp}
        onBirths={onBirths}
        onEnusc={onEnusc}
        onPolice={() => {}}
        current="police"
      />
      <section className="hero wrap births-hero police-hero">
        <div>
          <span className="eyebrow">
            Condiciones de vida · Registros administrativos
          </span>
          <h1>
            Estadísticas
            <br />
            policiales
          </h1>
          <p>
            La trayectoria de denuncias, personas detenidas y víctimas
            registradas por Carabineros de Chile y la Policía de
            Investigaciones.
          </p>
        </div>
        <aside className="births-latest latest-value-first">
          <span>Último año disponible</span>
          <strong>{data.updated}</strong>
          <b>Series comparables desde 2016</b>
        </aside>
      </section>
      <div className="wrap police-note">
        <b>Cómo leer esta historia</b>
        <p>
          Las cifras corresponden a registros administrativos y no equivalen a
          prevalencias de victimización. Una persona puede aparecer más de una
          vez en los registros.
        </p>
      </div>
      <PoliceChapter
        chapter="Capítulo 1"
        institution={data.institutions.carabineros}
      />
      <PoliceChapter chapter="Capítulo 2" institution={data.institutions.pdi} />
      <section className="police-official-source">
        <div className="wrap">
          <span className="eyebrow">FUENTE OFICIAL</span>
          <h2>Estadísticas policiales y judiciales</h2>
          <p>
            Consulta en el sitio del INE los productos oficiales, cuadros
            estadísticos, boletines y antecedentes metodológicos de esta
            operación estadística.
          </p>
          <a
            className="birth-download"
            href="https://www.ine.gob.cl/estadisticas-por-tema/sociedad-y-condiciones-de-vida/estadisticas-policiales-y-judiciales"
          >
            Ir a la fuente oficial ↗
          </a>
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href="https://www.ine.gob.cl/estadisticas-por-tema/sociedad-y-condiciones-de-vida/estadisticas-policiales-y-judiciales">
            Fuente oficial: ine.gob.cl ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

const ENUSC_SOURCE =
  "https://www.ine.gob.cl/docs/default-source/seguridad-ciudadana/cuadros-estadisticos/2025/tabulados-regionales---enusc-2025.xlsx";
const enuscPercent = (value: number) =>
  `${(value * 100).toFixed(1).replace(".", ",")}%`;
const enuscLabel = (label: string) =>
  label ? label.charAt(0).toLocaleUpperCase("es-CL") + label.slice(1) : label;
const shortEnuscTitle = (title: string) =>
  enuscLabel(
    title
      .replace(/^Proporción de (personas|hogares) (que |)/i, "")
      .replace(/^Durante los últimos doce meses[^…]*… ¿Ha dejado de /i, "")
      .replace(/^Durante los últimos doce meses[^?]*\? /i, "")
      .replace(/^¿Cuál es /i, "")
      .replace(/^¿Cómo percibe usted[^?]*\? /i, "")
      .replace(/\?$/, ""),
  );

function EnuscQualityNotes({
  notes,
  definitions,
}: {
  notes: Array<string | null>;
  definitions: Record<string, string>;
}) {
  const visible = [...new Set(notes.filter((note): note is string => !!note))]
    .filter((note) => note === "1" || note === "2")
    .sort();
  if (!visible.length) return null;
  return (
    <div className="enusc-quality-notes">
      {visible.map((note) => (
        <p key={note}>
          <b>{note}.</b> {definitions[note]}
        </p>
      ))}
    </div>
  );
}

type EnuscChartItem = EnuscEstimate & { label: string; color?: string };

function EnuscIntervalChart({
  eyebrow,
  title,
  subtitle,
  items,
  definitions,
  compact = false,
  featured = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  items: EnuscChartItem[];
  definitions: Record<string, string>;
  compact?: boolean;
  featured?: boolean;
}) {
  const w = 900,
    pL = compact ? 250 : 315,
    pR = 50,
    pT = 30,
    row = 42,
    pB = 58,
    h = pT + items.length * row + pB,
    observedMax = Math.max(
      0.1,
      ...items.map((item) => item.upper ?? item.estimate),
    ),
    max = observedMax > 0.8 ? 1 : Math.min(1, observedMax * 1.2),
    x = (value: number) => pL + (value * (w - pL - pR)) / max;
  return (
    <div
      className={`chart-shell enusc-chart ${featured ? "featured-enusc-chart" : ""}`}
    >
      <div className="chart-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {subtitle && <p className="chart-subtitle">{subtitle}</p>}
        </div>
      </div>
      <svg
        className="chart chart-motion"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${title}. Estimaciones con intervalos de confianza.`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((share) => {
          const value = max * share;
          return (
            <g key={share}>
              <line x1={x(value)} x2={x(value)} y1={pT - 8} y2={h - pB} />
              <text x={x(value)} y={h - 23} textAnchor="middle">
                {enuscPercent(value)}
              </text>
            </g>
          );
        })}
        {items.map((item, index) => {
          const cy = pT + index * row + row / 2,
            color = item.color || "#123f87";
          return (
            <g key={`${item.label}-${index}`} className="enusc-interval-row">
              <text
                className="enusc-item-label"
                x={pL - 14}
                y={cy + 4}
                textAnchor="end"
              >
                {enuscLabel(item.label).length > 38
                  ? `${enuscLabel(item.label).slice(0, 36)}…`
                  : enuscLabel(item.label)}
                {item.note ? `  ${item.note}` : ""}
              </text>
              {item.lower !== null && item.upper !== null && (
                <>
                  <line
                    className="confidence-line"
                    x1={x(item.lower)}
                    x2={x(item.upper)}
                    y1={cy}
                    y2={cy}
                    style={{ stroke: color }}
                  />
                  <line
                    className="confidence-cap"
                    x1={x(item.lower)}
                    x2={x(item.lower)}
                    y1={cy - 5}
                    y2={cy + 5}
                    style={{ stroke: color }}
                  />
                  <line
                    className="confidence-cap"
                    x1={x(item.upper)}
                    x2={x(item.upper)}
                    y1={cy - 5}
                    y2={cy + 5}
                    style={{ stroke: color }}
                  />
                </>
              )}
              <circle cx={x(item.estimate)} cy={cy} r="3.4" fill={color}>
                <title>
                  {enuscLabel(item.label)}: {enuscPercent(item.estimate)};
                  intervalo de confianza{" "}
                  {item.lower === null
                    ? "no disponible"
                    : `${enuscPercent(item.lower)}–${enuscPercent(item.upper!)}`}
                  {item.note ? `; nota ${item.note}` : ""}
                </title>
              </circle>
              <text
                className="enusc-value-label"
                x={Math.min(w - pR + 2, x(item.estimate) + 11)}
                y={cy + 4}
              >
                {enuscPercent(item.estimate)}
                {item.note ? (
                  <tspan className="quality-label"> {item.note}</tspan>
                ) : null}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="chart-source">
        Punto: estimación. Línea horizontal: intervalo de confianza.
      </p>
      <EnuscQualityNotes
        notes={items.map((item) => item.note)}
        definitions={definitions}
      />
    </div>
  );
}

const CHILE_REGION_LABELS: Record<
  string,
  { anchorX: number; anchorY: number; labelY: number }
> = {
  "ARICA Y PARINACOTA": { anchorX: 230, anchorY: 40, labelY: 34 },
  TARAPACÁ: { anchorX: 240, anchorY: 78, labelY: 72 },
  ANTOFAGASTA: { anchorX: 250, anchorY: 140, labelY: 118 },
  ATACAMA: { anchorX: 220, anchorY: 220, labelY: 172 },
  COQUIMBO: { anchorX: 190, anchorY: 286, labelY: 226 },
  VALPARAÍSO: { anchorX: 180, anchorY: 334, labelY: 280 },
  METROPOLITANA: { anchorX: 190, anchorY: 347, labelY: 334 },
  "O'HIGGINS": { anchorX: 182, anchorY: 364, labelY: 388 },
  MAULE: { anchorX: 170, anchorY: 390, labelY: 442 },
  ÑUBLE: { anchorX: 155, anchorY: 407, labelY: 496 },
  BIOBÍO: { anchorX: 140, anchorY: 425, labelY: 550 },
  "LA ARAUCANÍA": { anchorX: 145, anchorY: 448, labelY: 604 },
  "LOS RÍOS": { anchorX: 132, anchorY: 475, labelY: 658 },
  "LOS LAGOS": { anchorX: 115, anchorY: 520, labelY: 712 },
  AYSÉN: { anchorX: 100, anchorY: 610, labelY: 766 },
  MAGALLANES: { anchorX: 180, anchorY: 730, labelY: 820 },
};

function EnuscRegionalMap({
  title,
  items,
  definitions,
}: {
  title: string;
  items: EnuscChartItem[];
  definitions: Record<string, string>;
}) {
  const paths = chileRegionsMapRaw as ChileRegionPath[],
    validItems = items.filter((item) => Number.isFinite(item.estimate)),
    values = validItems.map((item) => item.estimate),
    min = Math.min(...values),
    max = Math.max(...values),
    minItem = validItems.reduce((lowest, item) =>
      item.estimate < lowest.estimate ? item : lowest,
    ),
    maxItem = validItems.reduce((highest, item) =>
      item.estimate > highest.estimate ? item : highest,
    ),
    intensity = (value: number) => (value - min) / Math.max(0.0001, max - min),
    color = (value: number) => {
      const ratio = intensity(value),
        light = [217, 240, 247],
        dark = [18, 63, 135],
        channel = (index: number) =>
          Math.round(light[index] + (dark[index] - light[index]) * ratio);
      return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
    };
  if (!validItems.length) return null;
  return (
    <div className="chart-shell enusc-chart enusc-map-chart">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Comparación regional</span>
          <h2>{title}</h2>
          <p className="chart-subtitle">
            Cada región se colorea según su estimación. Las etiquetas muestran
            el valor y su intervalo de confianza.
          </p>
        </div>
      </div>
      <div className="enusc-map-layout">
        <svg
          className="chart chart-motion enusc-region-map"
          viewBox="0 0 820 850"
          role="img"
          aria-label={`Mapa regional de Chile para ${title}`}
        >
          {paths.map((region) => {
            const item = items.find(
              (candidate) => candidate.label === region.region,
            );
            const position = CHILE_REGION_LABELS[region.region];
            if (!item || !position || !Number.isFinite(item.estimate))
              return null;
            return (
              <g key={region.code}>
                <path
                  d={region.path}
                  fill={color(item.estimate)}
                  fillRule="evenodd"
                  aria-label={`${enuscLabel(region.region)}: ${enuscPercent(item.estimate)}${item.note ? `, nota ${item.note}` : ""}`}
                >
                  <title>
                    {enuscLabel(region.region)}: {enuscPercent(item.estimate)};
                    IC{" "}
                    {item.lower === null
                      ? "no disponible"
                      : `${enuscPercent(item.lower)}–${enuscPercent(item.upper!)}`}
                    {item.note ? `; nota ${item.note}` : ""}
                  </title>
                </path>
                <polyline
                  className="enusc-map-leader"
                  points={`${position.anchorX},${position.anchorY} 360,${position.labelY} 378,${position.labelY}`}
                />
                <text
                  className="enusc-map-region-label"
                  x="386"
                  y={position.labelY - 5}
                >
                  <tspan x="386">{enuscLabel(region.region)}</tspan>
                  <tspan className="enusc-map-region-value" x="386" dy="17">
                    {enuscPercent(item.estimate)}
                    {item.note ? ` ${item.note}` : ""} · IC{" "}
                    {item.lower === null
                      ? "no disponible"
                      : `${enuscPercent(item.lower)}–${enuscPercent(item.upper!)}`}
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="enusc-map-scale" aria-label="Escala de color del mapa">
        <i />
        <small>
          {enuscLabel(minItem.label)} · {enuscPercent(min)}
        </small>
        <small>
          {enuscLabel(maxItem.label)} · {enuscPercent(max)}
        </small>
      </div>
      <EnuscQualityNotes
        notes={items.map((item) => item.note)}
        definitions={definitions}
      />
    </div>
  );
}

function EnuscExplorer({ data }: { data: EnuscData }) {
  const themes = Object.keys(data.themes),
    [theme, setTheme] = useState(themes[0]),
    options = data.metadata.filter((item) => item.theme === theme),
    [variable, setVariable] = useState(options[0].variable),
    meta =
      data.metadata.find((item) => item.variable === variable) || options[0],
    records = data.tabulations[meta.variable],
    regions = [...new Set(records.map((record) => record.region))],
    [region, setRegion] = useState("TOTAL NACIONAL"),
    regionalRecords = records.filter((record) => record.region === region),
    groups = regionalRecords[0]?.estimates.map((item) => item.group) || [
      "Total",
    ],
    [group, setGroup] = useState("Total");
  const chartItems: EnuscChartItem[] =
    meta.type === "Categórica"
      ? regionalRecords
          .map((record) => {
            const estimate =
              record.estimates.find((item) => item.group === group) ||
              record.estimates[0];
            return estimate
              ? { ...estimate, label: record.category || estimate.group }
              : null;
          })
          .filter((item): item is EnuscChartItem => !!item)
      : (regionalRecords[0]?.estimates || []).map((item) => ({
          ...item,
          label: item.group,
        }));
  return (
    <div className="enusc-explorer">
      <div className="enusc-explorer-controls">
        <label>
          Tema
          <select
            value={theme}
            onChange={(event) => {
              const nextTheme = event.target.value;
              const next = data.metadata.find(
                (item) => item.theme === nextTheme,
              )!;
              setTheme(nextTheme);
              setVariable(next.variable);
              setRegion("TOTAL NACIONAL");
              setGroup("Total");
            }}
          >
            {themes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Indicador
          <select
            value={meta.variable}
            onChange={(event) => {
              setVariable(event.target.value);
              setRegion("TOTAL NACIONAL");
              setGroup("Total");
            }}
          >
            {options.map((item) => (
              <option key={item.variable} value={item.variable}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Territorio
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          >
            {regions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        {meta.type === "Categórica" && (
          <label>
            Desagregación
            <select
              value={groups.includes(group) ? group : groups[0]}
              onChange={(event) => setGroup(event.target.value)}
            >
              {groups.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="enusc-explorer-meta">
        <span>{meta.weight}</span>
        <span>{meta.disaggregation}</span>
        <span>N = {meta.sample.toLocaleString("es-CL")}</span>
        {meta.filter !== "-" && <span>Filtro: {meta.filter}</span>}
      </div>
      <EnuscIntervalChart
        eyebrow={`${meta.theme} · ${region}`}
        title={meta.title}
        subtitle={`${meta.type} · ponderación por ${meta.weight.toLowerCase()}`}
        items={chartItems}
        definitions={data.qualityNotes}
        compact
      />
    </div>
  );
}

function EnuscPage({
  onLabor,
  onInformality,
  onIpc,
  onIpp,
  onBirths,
  onPolice,
}: {
  onLabor: () => void;
  onInformality: () => void;
  onIpc: () => void;
  onIpp: () => void;
  onBirths: () => void;
  onPolice: () => void;
}) {
  const [data, setData] = useState<EnuscData>(enuscInitialRaw as EnuscData),
    [fullDataReady, setFullDataReady] = useState(false),
    [error, setError] = useState(false),
    [regionalVariable, setRegionalVariable] = useState("PAD_SEX"),
    [gapVariable, setGapVariable] = useState("PCOS_SEX"),
    [institutionVariable, setInstitutionVariable] =
      useState("EV_CONFIA_CCH_SEX");
  useEffect(() => {
    let active = true;
    fetch("/api/enusc-data", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<EnuscData>;
      })
      .then((payload) => {
        if (active) {
          setData(payload);
          setFullDataReady(true);
          void fetch("/api/enusc-data?refresh=1", { cache: "no-store" })
            .then((response) => (response.ok ? response.json() : null))
            .then((updated) => {
              if (active && updated?.cache?.status === "updated")
                setData(updated as EnuscData);
            });
        }
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);
  if (!fullDataReady && !error)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  const meta = (variable: string) =>
      data.metadata.find((item) => item.variable === variable)!,
    national = (variable: string, group = "Total") => {
      const record = data.tabulations[variable].find(
        (item) => item.region === "TOTAL NACIONAL",
      )!;
      return (
        record.estimates.find((item) => item.group === group) ||
        record.estimates[0]
      );
    },
    storyVariables = [
      ["VH_DC_NSE", "Hogares victimizados", "#123f87"],
      ["PAD_SEX", "Percibe aumento en el país", "#e43d37"],
      ["PADB_SEX", "Percibe aumento en el barrio", "#ef8c32"],
      ["PCOS_SEX", "Inseguridad al caminar de noche", "#6f4ab5"],
      ["PED_SEX", "Cree que será víctima", "#16806a"],
    ] as const,
    storyItems = storyVariables.map(([variable, label, color]) => ({
      ...national(variable),
      label,
      color,
    })),
    behaviorItems = data.metadata
      .filter(
        (item) =>
          item.variable.startsWith("P_MOD_ACTIVIDADES_") &&
          item.variable.endsWith("_SEX"),
      )
      .map((item) => ({
        ...national(item.variable),
        label: shortEnuscTitle(item.title),
      })),
    neighborhoodItems = data.metadata
      .filter(
        (item) =>
          (item.variable.startsWith("P_DESORDENES_") ||
            item.variable.startsWith("P_INCIVILIDADES_")) &&
          item.variable.endsWith("_SEX"),
      )
      .map((item) => ({
        ...national(item.variable),
        label: shortEnuscTitle(item.title),
      })),
    victimItems = [
      ["VH_DC_NSE", "Delitos consultados"],
      ["VH_DV_NSE", "Delitos violentos"],
      ["VH_ROBOS_NSE", "Robos con o sin violencia"],
      ["VH_CIBER_NSE", "Ciberdelitos"],
      ["VH_ECON_NSE", "Delitos económicos"],
      ["VH_EMERG_NSE", "Delitos emergentes"],
      ["VH_VAN_NSE", "Vandalismo"],
    ].map(([variable, label]) => ({ ...national(variable), label })),
    reportItems = [
      ["DEN_VHDC_NSE", "Delitos consultados"],
      ["DEN_ROBOS_NSE", "Robos con o sin violencia"],
      ["DEN_ECON_NSE", "Delitos económicos"],
      ["DEN_CIBER", "Ciberdelitos"],
      ["DEN_VHDV_ULT", "Delitos violentos (último evento)"],
    ]
      .filter(([variable]) => data.tabulations[variable])
      .map(([variable, label]) => ({ ...national(variable), label })),
    protectionItems = data.metadata
      .filter(
        (item) =>
          item.variable.startsWith("MEDIDAS_") &&
          item.variable.endsWith("_NSE"),
      )
      .map((item) => ({
        ...national(item.variable),
        label: shortEnuscTitle(item.title),
      })),
    regionalItems = data.tabulations[regionalVariable]
      .filter(
        (record) => record.region !== "TOTAL NACIONAL" && !record.category,
      )
      .map((record) => ({
        ...(record.estimates.find((item) => item.group === "Total") ||
          record.estimates[0]),
        label: record.region,
      }))
      .sort((a, b) => b.estimate - a.estimate),
    gapRecord = data.tabulations[gapVariable].find(
      (item) => item.region === "TOTAL NACIONAL",
    )!,
    institutionItems = data.tabulations[institutionVariable]
      .filter((record) => record.region === "TOTAL NACIONAL")
      .map((record) => ({
        ...(record.estimates.find((item) => item.group === "Total") ||
          record.estimates[0]),
        label: record.category || "Total",
      }));
  return (
    <main className="enusc-page">
      <PriceHeader
        onLabor={onLabor}
        onInformality={onInformality}
        onIpc={onIpc}
        onIpp={onIpp}
        onBirths={onBirths}
        onPolice={onPolice}
        current="enusc"
      />
      <section className="hero wrap enusc-hero">
        <div>
          <span className="eyebrow">Condiciones de vida · ENUSC 2025</span>
          <h1>
            Victimización e
            <br />
            inseguridad
          </h1>
          <p>
            Una lectura de la victimización, el temor y las respuestas
            cotidianas en Chile.
          </p>
        </div>
        <div className="period-box">
          <span>Tabulados</span>
          <strong>286</strong>
          <b>indicadores y desagregaciones</b>
          <small>55.796 personas en la muestra indicada</small>
        </div>
      </section>
      <section className="wrap enusc-kpis">
        {storyItems.slice(0, 4).map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>
              {enuscPercent(item.estimate)}
              {item.note && <sup>{item.note}</sup>}
            </strong>
            <small>
              IC: {enuscPercent(item.lower!)}–{enuscPercent(item.upper!)}
            </small>
          </article>
        ))}
      </section>
      <section className="wrap births-story enusc-opening">
        <div className="births-reading">
          <span className="eyebrow">Capítulo 1 · La distancia</span>
          <h2>La percepción de inseguridad no equivale a la victimización</h2>
          <p>
            En 2025, <b>{enuscPercent(national("VH_DC_NSE").estimate)}</b> de
            los hogares fue victimizado por alguno de los delitos consultados.
            Al mismo tiempo, <b>{enuscPercent(national("PAD_SEX").estimate)}</b>{" "}
            de las personas percibió que la delincuencia aumentó en el país y{" "}
            <b>{enuscPercent(national("PCOS_SEX").estimate)}</b> declaró
            inseguridad al caminar a solas por su barrio cuando está oscuro.
          </p>
          <p>
            La distancia entre experiencia, expectativa y percepción es
            sustantiva, pero no constituye una contradicción: cada indicador
            mide un fenómeno, universo y referencia territorial diferente.
          </p>
        </div>
        <EnuscIntervalChart
          eyebrow="Experiencia, percepción y expectativa"
          title="Cinco dimensiones de la seguridad ciudadana"
          items={storyItems}
          definitions={data.qualityNotes}
          compact
          featured
        />
      </section>
      <section className="enusc-topic enusc-topic-gray">
        <div className="wrap enusc-topic-grid">
          <div className="fertility-narrative">
            <span className="eyebrow">Brechas demográficas</span>
            <h2>El temor se distribuye de forma desigual</h2>
            <p>
              La inseguridad al caminar de noche es{" "}
              {enuscPercent(
                national("PCOS_SEX", "Mujer").estimate -
                  national("PCOS_SEX", "Hombre").estimate,
              )}{" "}
              más alta entre mujeres que entre hombres. Los intervalos permiten
              evaluar la precisión de cada diferencia antes de interpretar su
              magnitud.
            </p>
            <label className="enusc-inline-select">
              Indicador
              <select
                value={gapVariable}
                onChange={(event) => setGapVariable(event.target.value)}
              >
                <option value="PAD_SEX">Percepción país</option>
                <option value="PADB_SEX">Percepción barrio</option>
                <option value="PCOS_SEX">
                  Inseguridad al caminar de noche
                </option>
                <option value="PED_SEX">Expectativa de victimización</option>
                <option value="VP_DV_SEX">
                  Victimización por delitos violentos
                </option>
              </select>
            </label>
          </div>
          <EnuscIntervalChart
            eyebrow="Sexo"
            title={meta(gapVariable).title}
            items={gapRecord.estimates.map((item) => ({
              ...item,
              label: item.group,
            }))}
            definitions={data.qualityNotes}
            compact
          />
        </div>
      </section>
      <section className="enusc-topic">
        <div className="wrap enusc-topic-grid">
          <div className="fertility-narrative">
            <span className="eyebrow">Vida cotidiana</span>
            <h2>El temor también restringe actividades</h2>
            <p>
              Las catorce preguntas permiten observar costos conductuales de la
              inseguridad: evitar lugares, medios de transporte, actividades
              recreativas, objetos visibles o salidas nocturnas. Se presentan
              conjuntamente para no fragmentar una misma experiencia.
            </p>
          </div>
          <EnuscIntervalChart
            eyebrow="Cambios de comportamiento"
            title="Actividades que se dejan de realizar por temor"
            items={behaviorItems}
            definitions={data.qualityNotes}
          />
        </div>
      </section>
      <section className="enusc-topic enusc-topic-gray">
        <div className="wrap enusc-topic-grid">
          <div className="fertility-narrative">
            <span className="eyebrow">Entorno inmediato</span>
            <h2>Desórdenes e incivilidades forman el paisaje del barrio</h2>
            <p>
              La presencia reportada de robos, balaceras, comercio ilegal,
              consumo de alcohol o drogas y deterioro del espacio público ayuda
              a describir el contexto en que se forma la percepción de riesgo.
            </p>
          </div>
          <EnuscIntervalChart
            eyebrow="Entorno barrial"
            title="Frecuencia percibida de desórdenes e incivilidades"
            items={neighborhoodItems}
            definitions={data.qualityNotes}
          />
        </div>
      </section>
      <section className="enusc-topic">
        <div className="wrap enusc-topic-grid">
          <div className="fertility-narrative">
            <span className="eyebrow">Victimización</span>
            <h2>Los delitos consultados tienen perfiles muy distintos</h2>
            <p>
              La victimización agregada reúne hechos heterogéneos. La
              comparación por familias separa delitos violentos, robos,
              ciberdelitos, delitos económicos, emergentes y vandalismo, todos
              ponderados a nivel de hogar en esta vista.
            </p>
          </div>
          <EnuscIntervalChart
            eyebrow="Familias de delitos"
            title="Hogares victimizados durante los últimos doce meses"
            items={victimItems}
            definitions={data.qualityNotes}
            compact
          />
        </div>
      </section>
      <section className="enusc-topic enusc-topic-gray">
        <div className="wrap enusc-topic-grid">
          <div className="fertility-narrative">
            <span className="eyebrow">Denuncia y cifra oculta</span>
            <h2>
              Una parte importante de los delitos no llega a conocimiento
              institucional
            </h2>
            <p>
              Las tasas de denuncia varían según el delito. La lectura debe
              considerar el último evento cuando así lo especifica el tabulado y
              no confundir denuncia con prevalencia.
            </p>
          </div>
          <EnuscIntervalChart
            eyebrow="Respuesta institucional"
            title="Proporción de hogares que denuncian"
            items={reportItems}
            definitions={data.qualityNotes}
            compact
          />
        </div>
      </section>
      <section className="enusc-topic">
        <div className="wrap enusc-topic-grid">
          <div className="fertility-narrative">
            <span className="eyebrow">Instituciones</span>
            <h2>
              Conocimiento, confianza y evaluación son dimensiones diferentes
            </h2>
            <p>
              La ENUSC permite comparar el conocimiento y la confianza en
              Carabineros, PDI y Fiscalía, además de evaluar aspectos concretos
              del trabajo policial en la comuna.
            </p>
            <label className="enusc-inline-select">
              Institución
              <select
                value={institutionVariable}
                onChange={(event) => setInstitutionVariable(event.target.value)}
              >
                <option value="EV_CONFIA_CCH_SEX">
                  Confianza en Carabineros
                </option>
                <option value="EV_CONFIA_PDI_SEX">Confianza en PDI</option>
                <option value="EV_CONFIA_FMP_SEX">Confianza en Fiscalía</option>
                <option value="EV_CONOCE_CCH_SEX">
                  Conocimiento de Carabineros
                </option>
                <option value="EV_CONOCE_PDI_SEX">Conocimiento de PDI</option>
              </select>
            </label>
          </div>
          <EnuscIntervalChart
            eyebrow="Instituciones y policías"
            title={meta(institutionVariable).title}
            items={institutionItems}
            definitions={data.qualityNotes}
            compact
          />
        </div>
      </section>
      <section className="enusc-topic enusc-topic-gray">
        <div className="wrap enusc-topic-grid">
          <div className="fertility-narrative">
            <span className="eyebrow">Protección del hogar</span>
            <h2>
              La respuesta privada combina barreras, tecnología y vigilancia
            </h2>
            <p>
              Rejas, cerraduras, cámaras, alarmas e iluminación describen
              estrategias distintas. Las brechas por NSE pueden examinarse en el
              explorador para estudiar desigualdades de acceso a protección.
            </p>
          </div>
          <EnuscIntervalChart
            eyebrow="Medidas del hogar"
            title="Disponibilidad de elementos de seguridad"
            items={protectionItems}
            definitions={data.qualityNotes}
          />
        </div>
      </section>
      <section className="enusc-territory">
        <div className="wrap enusc-topic-grid">
          <div className="fertility-narrative">
            <span className="eyebrow">Capítulo 2 · Territorio</span>
            <h2>Una misma pregunta, dieciséis realidades regionales</h2>
            <p>
              El ranking muestra estimaciones e intervalos de confianza. Una
              posición más alta no implica necesariamente una diferencia
              estadísticamente concluyente.
            </p>
            <label className="enusc-inline-select">
              Indicador regional
              <select
                value={regionalVariable}
                onChange={(event) => setRegionalVariable(event.target.value)}
              >
                <option value="PAD_SEX">
                  Percepción de aumento en el país
                </option>
                <option value="PADB_SEX">
                  Percepción de aumento en el barrio
                </option>
                <option value="PCOS_SEX">
                  Inseguridad al caminar de noche
                </option>
                <option value="PED_SEX">Expectativa de victimización</option>
                <option value="VP_DC_SEX">Personas victimizadas</option>
              </select>
            </label>
          </div>
          <EnuscRegionalMap
            title={meta(regionalVariable).title}
            items={regionalItems}
            definitions={data.qualityNotes}
          />
        </div>
      </section>
      <section className="enusc-explorer-section">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Explorador ENUSC</span>
            <h2>Los 286 tabulados en una sola interfaz</h2>
            <p>
              Selecciona tema, indicador, territorio y desagregación. Cada vista
              conserva estimación, intervalo de confianza y nota de calidad.
            </p>
          </div>
          {fullDataReady ? (
            <EnuscExplorer data={data} />
          ) : (
            <div className="enusc-loading">
              <p>
                {error
                  ? "El explorador completo no está disponible temporalmente; la historia principal permanece operativa."
                  : "Cargando el explorador completo en segundo plano…"}
              </p>
            </div>
          )}
        </div>
      </section>
      <section className="resources">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Lectura responsable</span>
            <h2>Calidad y comparabilidad</h2>
            <p>
              Las estimaciones por persona y por hogar no comparten denominador.
              Los intervalos expresan incertidumbre y las notas 1 y 2
              condicionan el uso analítico.
            </p>
          </div>
          <div className="enusc-method-grid">
            <article>
              <b>1. Estimación poco fiable</b>
              <p>{data.qualityNotes["1"]}</p>
            </article>
            <article>
              <b>2. Estimación no fiable</b>
              <p>{data.qualityNotes["2"]}</p>
            </article>
          </div>
          <a className="birth-download" href={ENUSC_SOURCE}>
            Descargar tabulados oficiales ↗
          </a>
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href={ENUSC_SOURCE}>Fuente oficial: ine.gob.cl ↗</a>
        </div>
      </footer>
    </main>
  );
}

function LandingPage({
  onNavigate,
}: {
  onNavigate: (destination: SiteDestination) => void;
}) {
  const topics: {
    number: string;
    title: string;
    description: string;
    destination: SiteDestination;
  }[] = [
    {
      number: "01",
      title: "Mercado laboral",
      description:
        "Ocupación, desocupación, participación e informalidad explicadas mediante series y relatos.",
      destination: "ene",
    },
    {
      number: "02",
      title: "Precios",
      description:
        "IPC e índices de precios de productor para comprender la evolución de los precios.",
      destination: "ipc",
    },
    {
      number: "03",
      title: "Demografía y población",
      description:
        "Nacimientos, fecundidad, defunciones, mortalidad, matrimonios y acuerdos de unión civil.",
      destination: "births",
    },
    {
      number: "04",
      title: "Condiciones de vida",
      description:
        "Victimización, percepción de inseguridad y estadísticas policiales presentadas territorialmente.",
      destination: "enusc",
    },
    {
      number: "05",
      title: "Industria y construcción",
      description:
        "Producción industrial, energía y permisos de edificación para seguir la actividad económica.",
      destination: "industry",
    },
    {
      number: "06",
      title: "Servicios",
      description:
        "Comercio, turismo y supermercados a través de indicadores coyunturales y comparaciones.",
      destination: "commerce",
    },
  ];

  return (
    <main className="landing-page">
      <SectionHeader current="home" onNavigate={onNavigate} />

      <section className="landing-hero">
        <div className="wrap landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="eyebrow">
              INE · Estadísticas oficiales de Chile
            </span>
            <h1>Los datos cuentan historias sobre el país que habitamos.</h1>
            <p>
              Relatos Estadísticos transforma cifras oficiales en recorridos
              visuales, comparables e interactivos para acercar la información
              del INE a todas las personas.
            </p>
            <div className="landing-actions">
              <button onClick={() => onNavigate("ene")}>
                Explorar los relatos
              </button>
            </div>
          </div>
          <aside
            className="landing-data-path"
            aria-label="Recorrido de los datos"
          >
            <span>Cómo funciona</span>
            <ol>
              <li>
                <b>Fuente oficial</b>
                <small>Los datos se originan y publican en ine.gob.cl.</small>
              </li>
              <li>
                <b>Lectura interactiva</b>
                <small>
                  Indicadores, gráficos y contexto facilitan su comprensión.
                </small>
              </li>
            </ol>
          </aside>
        </div>
      </section>

      <section className="landing-intro">
        <div className="wrap landing-intro-grid">
          <div className="section-title">
            <span className="eyebrow">Un sitio para explorar</span>
            <h2>Estadísticas públicas explicadas paso a paso</h2>
          </div>
          <div>
            <p>
              Cada relato combina cifras, comparaciones temporales, notas de
              calidad y contexto. Puedes seleccionar períodos, activar series,
              recorrer regiones y descargar los gráficos que necesites.
            </p>
            <p>
              Las visualizaciones facilitan la lectura, pero las cifras y
              documentos publicados por el Instituto Nacional de Estadísticas en{" "}
              <a href="https://www.ine.gob.cl">www.ine.gob.cl</a> constituyen
              siempre la fuente oficial.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-topics">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Temas disponibles</span>
            <h2>Distintas miradas sobre Chile</h2>
            <p>Elige un tema y comienza el recorrido.</p>
          </div>
          <div className="landing-topic-grid">
            {topics.map((topic) => (
              <button
                key={topic.number}
                onClick={() => onNavigate(topic.destination)}
              >
                <span>{topic.number}</span>
                <h3>{topic.title}</h3>
                <p>{topic.description}</p>
                <b>Ver relato →</b>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-how">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Dos formas de comenzar</span>
            <h2>Explora según lo que necesites</h2>
          </div>
          <div className="landing-how-grid">
            <article>
              <b>Quiero comprender</b>
              <p>
                Recorre las historias y observa qué cambió, dónde y para
                quiénes.
              </p>
            </article>
            <article>
              <b>Quiero comparar</b>
              <p>
                Selecciona períodos, territorios e indicadores dentro de los
                gráficos.
              </p>
            </article>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href="https://www.ine.gob.cl">Fuente oficial: ine.gob.cl ↗</a>
        </div>
      </footer>
    </main>
  );
}

const ENE_REGIONS = [
  ["CL", "País"],
  ["CL-AP", "Región de Arica y Parinacota"],
  ["CL-TA", "Región de Tarapacá"],
  ["CL-AN", "Región de Antofagasta"],
  ["CL-AT", "Región de Atacama"],
  ["CL-CO", "Región de Coquimbo"],
  ["CL-VA", "Región de Valparaíso"],
  ["CL-RM", "Región Metropolitana de Santiago"],
  ["CL-LI", "Región del Libertador General Bernardo O’Higgins"],
  ["CL-ML", "Región del Maule"],
  ["CL-NB", "Región de Ñuble"],
  ["CL-BI", "Región del Biobío"],
  ["CL-AR", "Región de La Araucanía"],
  ["CL-LR", "Región de Los Ríos"],
  ["CL-LL", "Región de Los Lagos"],
  ["CL-AI", "Región de Aysén del General Carlos Ibáñez del Campo"],
  ["CL-MA", "Región de Magallanes y de la Antártica Chilena"],
] as const;

type DendrogramNode = {
  id: string;
  label: string;
  value: number;
  parentValue?: number;
  x: number;
  y: number;
  tone: "root" | "labor" | "inactive" | "detail";
};

function LaborPopulationDendrogram({
  nationalSeriesBySex,
  regionalSeries,
  year,
  quarter,
  onPeriod,
}: {
  nationalSeriesBySex: Record<string, Point[]>;
  regionalSeries?: Record<string, Point[]>;
  year: number;
  quarter: string;
  onPeriod: (point: Point) => void;
}) {
  const [region, setRegion] = useState("CL");
  const [sex, setSex] = useState("Total");

  // El archivo oficial desagrega por sexo a nivel país; las hojas regionales
  // contienen el total de ambos sexos.
  const series =
    region === "CL"
      ? nationalSeriesBySex[sex] || nationalSeriesBySex.Total || []
      : regionalSeries?.[region] || [];
  const current =
    series.find((item) => item.year === year && item.quarter === quarter) ||
    series.at(-1);

  if (!current) return null;
  const currentIndex = series.findIndex(
    (item) => item.year === current.year && item.quarter === current.quarter,
  );
  const previousPeriod = currentIndex > 0 ? series[currentIndex - 1] : null;
  const previousYear =
    series.find(
      (item) =>
        item.year === current.year - 1 && item.quarter === current.quarter,
    ) || null;

  // La fuente viene ordenada cronológicamente; se invierte para mostrar primero
  // el trimestre móvil más reciente.
  const periodOptions = [...series].reverse();
  const level = (value: number | undefined, fallback = 0) =>
    Number.isFinite(value) ? Number(value) : fallback;
  const pet = level(current.pet);
  const labor = level(current.labor);
  const employed = level(current.employed);
  const unemployed = level(current.unemployed);
  const inactive = level(current.inactive, Math.max(pet - labor, 0));
  const ceased = level(current.ceased);
  const firstJob = level(current.firstJob);
  const initiators = level(current.initiators);
  const potential = level(current.potential);
  const habitual = level(current.habitual);
  const nodes: DendrogramNode[] = [
    {
      id: "pet",
      label: "Población en edad de trabajar",
      value: pet,
      x: 28,
      y: 268,
      tone: "root",
    },
    {
      id: "labor",
      label: "Fuerza de trabajo",
      value: labor,
      parentValue: pet,
      x: 282,
      y: 132,
      tone: "labor",
    },
    {
      id: "inactive",
      label: "Fuera de la fuerza de trabajo",
      value: inactive,
      parentValue: pet,
      x: 282,
      y: 420,
      tone: "inactive",
    },
    {
      id: "employed",
      label: "Personas ocupadas",
      value: employed,
      parentValue: labor,
      x: 546,
      y: 52,
      tone: "detail",
    },
    {
      id: "unemployed",
      label: "Personas desocupadas",
      value: unemployed,
      parentValue: labor,
      x: 546,
      y: 212,
      tone: "detail",
    },
    {
      id: "initiators",
      label: "Personas iniciadoras",
      value: initiators,
      parentValue: inactive,
      x: 546,
      y: 356,
      tone: "detail",
    },
    {
      id: "potential",
      label: "Inactivas potencialmente activas",
      value: potential,
      parentValue: inactive,
      x: 546,
      y: 452,
      tone: "detail",
    },
    {
      id: "habitual",
      label: "Personas inactivas habituales",
      value: habitual,
      parentValue: inactive,
      x: 546,
      y: 548,
      tone: "detail",
    },
    {
      id: "ceased",
      label: "Personas cesantes",
      value: ceased,
      parentValue: unemployed,
      x: 814,
      y: 164,
      tone: "detail",
    },
    {
      id: "firstJob",
      label: "Buscan trabajo por primera vez",
      value: firstJob,
      parentValue: unemployed,
      x: 814,
      y: 260,
      tone: "detail",
    },
  ];
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const links = [
    ["pet", "labor"],
    ["pet", "inactive"],
    ["labor", "employed"],
    ["labor", "unemployed"],
    ["unemployed", "ceased"],
    ["unemployed", "firstJob"],
    ["inactive", "initiators"],
    ["inactive", "potential"],
    ["inactive", "habitual"],
  ] as const;
  const formatPeople = (value: number) =>
    (value * 1000).toLocaleString("es-CL", { maximumFractionDigits: 0 });
  const regionLabel =
    ENE_REGIONS.find(([code]) => code === region)?.[1] || "País";
  const sexLabel =
    sex === "Hombres"
      ? "Hombres"
      : sex === "Mujeres"
        ? "Mujeres"
        : "Ambos sexos";
  const geographicPhrase =
    region === "CL"
      ? "para el país"
      : `para la región de ${regionLabel.replace(/^Región (?:de |del )?/, "")}`;

  // Cada porcentaje representa la participación dentro de la categoría madre.
  const shareFor = (point: Point | null, nodeId: string) => {
    if (!point || nodeId === "pet") return null;
    const pointInactive = level(
      point.inactive,
      Math.max(level(point.pet) - level(point.labor), 0),
    );
    const ratios: Record<string, [number, number]> = {
      labor: [level(point.labor), level(point.pet)],
      inactive: [pointInactive, level(point.pet)],
      employed: [level(point.employed), level(point.labor)],
      unemployed: [level(point.unemployed), level(point.labor)],
      ceased: [level(point.ceased), level(point.unemployed)],
      firstJob: [level(point.firstJob), level(point.unemployed)],
      initiators: [level(point.initiators), pointInactive],
      potential: [level(point.potential), pointInactive],
      habitual: [level(point.habitual), pointInactive],
    };
    const ratio = ratios[nodeId];
    return ratio && ratio[1] > 0 ? (ratio[0] / ratio[1]) * 100 : null;
  };
  const formatPp = (value: number | null) =>
    value === null ? "s/d" : `${value.toFixed(1).replace(".", ",")} p.p.`;

  return (
    <section className="labor-tree-section" aria-labelledby="labor-tree-title">
      <div className="wrap">
        <div className="labor-tree-head">
          <div className="section-title">
            <span className="eyebrow">Estructura de la población</span>
            <h2 id="labor-tree-title">
              Cómo se distribuye la población en edad de trabajar
            </h2>
            <p>
              Cada rama descompone la categoría anterior {geographicPhrase},{" "}
              {sexLabel.toLowerCase()}, en{" "}
              {formatQuarter(current.quarter).toLowerCase()} de {current.year}.
            </p>
          </div>
          <div className="labor-tree-controls">
            <label>
              Región
              <select
                value={region}
                onChange={(event) => {
                  const nextRegion = event.target.value;
                  setRegion(nextRegion);
                  if (nextRegion !== "CL") setSex("Total");
                  const nextSeries =
                    nextRegion === "CL"
                      ? nationalSeriesBySex[sex] ||
                        nationalSeriesBySex.Total ||
                        []
                      : regionalSeries?.[nextRegion] || [];
                  const matching = nextSeries.find(
                    (item) => item.year === year && item.quarter === quarter,
                  );
                  if (!matching && nextSeries.length)
                    onPeriod(nextSeries.at(-1)!);
                }}
              >
                {ENE_REGIONS.map(([code, label]) => (
                  <option
                    key={code}
                    value={code}
                    disabled={code !== "CL" && !regionalSeries?.[code]?.length}
                  >
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sexo
              <select
                value={sex}
                onChange={(event) => {
                  const nextSex = event.target.value;
                  setSex(nextSex);
                  const nextSeries = nationalSeriesBySex[nextSex] || [];
                  const matching = nextSeries.find(
                    (item) => item.year === year && item.quarter === quarter,
                  );
                  if (!matching && nextSeries.length)
                    onPeriod(nextSeries.at(-1)!);
                }}
                disabled={region !== "CL"}
                aria-describedby={
                  region !== "CL" ? "labor-tree-sex-note" : undefined
                }
              >
                <option value="Total">Ambos sexos</option>
                <option value="Hombres">Hombres</option>
                <option value="Mujeres">Mujeres</option>
              </select>
            </label>
            <label>
              Período
              <select
                value={`${current.year}::${current.quarter}`}
                onChange={(event) => {
                  const selected = series.find(
                    (item) =>
                      `${item.year}::${item.quarter}` === event.target.value,
                  );
                  if (selected) onPeriod(selected);
                }}
              >
                {periodOptions.map((item) => (
                  <option
                    key={`${item.year}-${item.quarter}`}
                    value={`${item.year}::${item.quarter}`}
                  >
                    {formatQuarter(item.quarter)} {item.year}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="labor-tree-card">
          <div className="labor-tree-period" aria-live="polite">
            <span>
              {regionLabel} · {sexLabel}
            </span>
            <strong>
              {formatQuarter(current.quarter)} {current.year}
            </strong>
          </div>
          <svg
            className="labor-tree"
            viewBox="0 0 1040 660"
            role="img"
            aria-label={`Dendrograma de la población en edad de trabajar de ${regionLabel}, ${sexLabel}, ${formatQuarter(current.quarter)} de ${current.year}`}
          >
            <g className="labor-tree-links" aria-hidden="true">
              {links.map(([fromId, toId]) => {
                const from = byId[fromId],
                  to = byId[toId];
                const x1 = from.x + 194,
                  y1 = from.y + 38,
                  x2 = to.x,
                  y2 = to.y + 38;
                return (
                  <path
                    key={`${fromId}-${toId}`}
                    d={`M${x1},${y1} C${x1 + 34},${y1} ${x2 - 34},${y2} ${x2},${y2}`}
                  />
                );
              })}
            </g>
            {nodes.map((node) => {
              const shareValue = shareFor(current, node.id);
              const previousShare = shareFor(previousPeriod, node.id);
              const annualShare = shareFor(previousYear, node.id);
              const previousDelta =
                shareValue !== null && previousShare !== null
                  ? shareValue - previousShare
                  : null;
              const annualDelta =
                shareValue !== null && annualShare !== null
                  ? shareValue - annualShare
                  : null;
              const share =
                shareValue !== null
                  ? `${shareValue.toFixed(1).replace(".", ",")}% de la categoría anterior`
                  : "Universo de referencia";
              const words = node.label.split(" ");
              const labelLines = words
                .reduce<string[]>((lines, word) => {
                  const currentLine = lines.at(-1) || "";
                  if (!currentLine || `${currentLine} ${word}`.length <= 28) {
                    if (lines.length)
                      lines[lines.length - 1] = `${currentLine} ${word}`.trim();
                    else lines.push(word);
                  } else lines.push(word);
                  return lines;
                }, [])
                .slice(0, 2);
              return (
                <g
                  key={`${node.id}-${current.year}-${current.quarter}-${region}-${sex}`}
                  className={`labor-tree-node ${node.tone}`}
                  transform={`translate(${node.x} ${node.y})`}
                  role="group"
                  aria-label={`${node.label}: ${formatPeople(node.value)} personas; ${share}`}
                >
                  <rect width="194" height="76" rx="10" />
                  <text className="node-label" x="14" y="20">
                    {labelLines.map((line, index) => (
                      <tspan key={line} x="14" dy={index === 0 ? 0 : 13}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                  <text className="node-value" x="14" y="54">
                    {formatPeople(node.value)}
                  </text>
                  {shareValue !== null && (
                    <>
                      <text
                        className="node-share"
                        x="72"
                        y="68"
                        textAnchor="end"
                      >
                        {share.split(" ")[0]}
                      </text>
                      <text
                        className={`node-delta ${previousDelta !== null && previousDelta < 0 ? "negative" : ""}`}
                        x="80"
                        y="61"
                      >
                        Ant.: {formatPp(previousDelta)}
                      </text>
                      <text
                        className={`node-delta ${annualDelta !== null && annualDelta < 0 ? "negative" : ""}`}
                        x="80"
                        y="71"
                      >
                        Anual: {formatPp(annualDelta)}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="labor-tree-note">
            <span>Valores expresados en personas.</span>
            <span>
              Los porcentajes corresponden a la categoría inmediatamente
              anterior.
            </span>
            <span id="labor-tree-sex-note">
              La desagregación por sexo está disponible para el total país.
            </span>
            <span>Fuente: INE, Encuesta Nacional de Empleo.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [remoteEne, setRemoteEne] = useState<EneRemoteData | null>(null);
  const data = useMemo(() => {
    const d = structuredClone(rawData) as EneData;
    if (remoteEne) {
      d.series = remoteEne.series;
      d.sectorContributions = remoteEne.sectorContributions;
      d.absentEmployment = remoteEne.absentEmployment;
      d.metadata.updated = remoteEne.cache?.updatedAt || d.metadata.updated;
    }
    return d;
  }, [remoteEne]);
  const liveIndicatorData = useMemo<IndicatorData>(() => {
    const base = structuredClone(indicatorData) as IndicatorData;
    if (remoteEne?.indicatorSeries) base.series = remoteEne.indicatorSeries;
    return base;
  }, [remoteEne]);
  const [year, setYear] = useState(latest.Total.year);
  const [quarter, setQuarter] = useState(latest.Total.quarter);
  const [indicator, setIndicator] = useState("unemploymentRate");
  const [active, setActive] = useState(["Total", "Mujeres", "Hombres"]);
  const [menu, setMenu] = useState(false);
  const [view, setView] = useState<
    | "home"
    | "ene"
    | "informality"
    | "ipc"
    | "ipp"
    | "births"
    | "fertility"
    | "deaths"
    | "mortality"
    | "unions"
    | "enusc"
    | "police"
    | "energy"
    | "industry"
    | "permits"
    | "commerce"
    | "tourism"
    | "supermarkets"
    | "businessDemography"
  >("home");
  useOperationSections(view);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [laborOpen, setLaborOpen] = useState(false);
  const [demographyOpen, setDemographyOpen] = useState(false);
  const [livingOpen, setLivingOpen] = useState(false);
  const [industryOpen, setIndustryOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [experimentalOpen, setExperimentalOpen] = useState(false);
  const openDestination = async (destination: string) => {
    if (["commerce", "tourism", "supermarkets"].includes(destination)) {
      try {
        await primeDataset(destination as PrefetchKey);
      } catch {
        /* La página conserva su estado de respaldo. */
      }
    }
    setView(destination as typeof view);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    void Promise.allSettled([
      primeDataset("commerce"),
      primeDataset("tourism"),
      primeDataset("supermarkets"),
    ]);
  }, []);
  useEffect(() => {
    if (view !== "ene") return;
    let activeRequest = true;
    fetch("/api/ene-data", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "No fue posible actualizar la ENE");
        return payload as EneRemoteData;
      })
      .then((payload) => {
        if (!activeRequest) return;
        setRemoteEne(payload);
        const latestPeriod = payload.series.Total?.at(-1);
        if (latestPeriod) {
          setYear(latestPeriod.year);
          setQuarter(latestPeriod.quarter);
        }
        return fetch("/api/ene-data?refresh=1", { cache: "no-store" });
      })
      .then(async (response) => {
        if (!response || !response.ok) return null;
        const payload = await response.json();
        return payload.cache?.status === "updated"
          ? (payload as EneRemoteData)
          : null;
      })
      .then((payload) => {
        if (activeRequest && payload) setRemoteEne(payload);
      })
      .catch(() => {
        /* La copia incluida mantiene la página operativa si aún no existe caché. */
      });
    return () => {
      activeRequest = false;
    };
  }, [view]);
  useEffect(() => {
    const navigate = (event: Event) => {
      const destination = (event as CustomEvent<string>).detail;
      if (destination === "mortality") {
        setView("mortality");
        window.scrollTo(0, 0);
      }
      if (destination === "unions") {
        setView("unions");
        window.scrollTo(0, 0);
      }
      if (destination === "enusc") {
        setView("enusc");
        window.scrollTo(0, 0);
      }
      if (destination === "police") {
        setView("police");
        window.scrollTo(0, 0);
      }
      if (
        destination === "energy" ||
        destination === "industry" ||
        destination === "permits" ||
        destination === "commerce" ||
        destination === "tourism" ||
        destination === "supermarkets"
      ) {
        void openDestination(destination);
      }
    };
    window.addEventListener("site:navigate", navigate);
    return () => window.removeEventListener("site:navigate", navigate);
  }, []);
  useChartStandardHeadings();
  useChartDownloads();
  useChartEndpointLabels();
  const periods = useMemo(
    () =>
      data?.series.Total.map((p) => ({ year: p.year, quarter: p.quarter })) ||
      [],
    [data],
  );
  const point =
    data?.series.Total.find((p) => p.year === year && p.quarter === quarter) ||
    latest.Total;
  const prev = data?.series.Total.find(
    (p) => p.year === year - 1 && p.quarter === quarter,
  );
  const women =
    data?.series.Mujeres.find(
      (p) => p.year === year && p.quarter === quarter,
    ) || latest.Mujeres;
  const men =
    data?.series.Hombres.find(
      (p) => p.year === year && p.quarter === quarter,
    ) || latest.Hombres;
  const selectedIndex =
    data?.series.Total.findIndex(
      (p) => p.year === year && p.quarter === quarter,
    ) ?? -1;
  const priorPeriod =
    selectedIndex > 0 ? data?.series.Total[selectedIndex - 1] : undefined;
  // Variaciones dinámicas utilizadas por todas las narrativas del informe.
  const unemploymentDelta = prev
    ? point.unemploymentRate - prev.unemploymentRate
    : null;
  const employedDelta = prev
    ? (point.employed / prev.employed - 1) * 100
    : null;
  const laborDelta = prev ? (point.labor / prev.labor - 1) * 100 : null;
  const unemployedDelta = prev
    ? (point.unemployed / prev.unemployed - 1) * 100
    : null;
  const ceasedDelta =
    prev && point.ceased && prev.ceased
      ? (point.ceased / prev.ceased - 1) * 100
      : null;
  const firstJobDelta =
    prev && point.firstJob && prev.firstJob
      ? (point.firstJob / prev.firstJob - 1) * 100
      : null;
  const womenPrev = data?.series.Mujeres.find(
    (p) => p.year === year - 1 && p.quarter === quarter,
  );
  const menPrev = data?.series.Hombres.find(
    (p) => p.year === year - 1 && p.quarter === quarter,
  );
  const womenRateDelta = womenPrev
    ? women.unemploymentRate - womenPrev.unemploymentRate
    : null;
  const menRateDelta = menPrev
    ? men.unemploymentRate - menPrev.unemploymentRate
    : null;
  const womenEmployedDelta = womenPrev
    ? (women.employed / womenPrev.employed - 1) * 100
    : null;
  const menEmployedDelta = menPrev
    ? (men.employed / menPrev.employed - 1) * 100
    : null;
  const inactive = point.pet - point.labor;
  const inactiveDelta = prev
    ? (inactive / (prev.pet - prev.labor) - 1) * 100
    : null;
  // Las variaciones se obtienen desde las tasas oficiales publicadas a una decimal,
  // evitando que decimales internos produzcan una diferencia que el boletín reporta como nula.
  const participationDelta = prev
    ? Math.round(point.participation * 10) / 10 -
      Math.round(prev.participation * 10) / 10
    : null;
  const employmentRateDelta = prev
    ? Math.round(point.employmentRate * 10) / 10 -
      Math.round(prev.employmentRate * 10) / 10
    : null;
  const inactiveComponents = INACTIVE_COMPONENTS.find(
    (p) => p.year === year && p.quarter === quarter,
  );
  const genderGap = women.unemploymentRate - men.unemploymentRate;
  const seasonalIndex =
    data?.seasonal?.findIndex(
      (p) => p.year === year && p.quarter === quarter,
    ) ?? -1;
  const seasonalPoint =
    seasonalIndex >= 0 ? data?.seasonal[seasonalIndex] : undefined;
  const priorSeasonal =
    seasonalIndex > 0 ? data?.seasonal[seasonalIndex - 1] : undefined;
  const seasonalDelta =
    seasonalPoint && priorSeasonal
      ? seasonalPoint.value - priorSeasonal.value
      : null;
  const sectors =
    data?.sectorContributions?.find(
      (p) => p.year === year && p.quarter === quarter,
    )?.items || [];
  const categories =
    data?.categoryContributions?.find(
      (p) => p.year === year && p.quarter === quarter,
    )?.items || [];
  const absent = data?.absentEmployment?.find(
    (p) => p.year === year && p.quarter === quarter,
  );
  const quarterLabel = formatQuarter(quarter);
  const shortQuarter = quarterLabel;
  const periodText = `${quarterLabel.toLowerCase()} de ${year}`;
  const direction = (
    value: number | null,
    up = "aumentó",
    down = "disminuyó",
  ) =>
    value === null
      ? "no tiene comparación anual disponible"
      : `${value >= 0 ? up : down} ${Math.abs(value).toFixed(1).replace(".", ",")}%`;
  const pluralDirection = (value: number | null) =>
    direction(value, "aumentaron", "disminuyeron");
  const signedPercent = (value: number | null) =>
    value === null
      ? "Sin comparación anual"
      : `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1).replace(".", ",")}% en 12 meses`;
  const rateChange = (value: number | null) =>
    value === null
      ? "sin comparación anual disponible"
      : Math.abs(value) < 0.05
        ? "sin presentar variación en doce meses"
        : `${value > 0 ? "creciendo" : "decreciendo"} ${Math.abs(value).toFixed(1).replace(".", ",")} pp. en doce meses`;
  const ppText = (value: number | null) =>
    value === null
      ? "sin comparación anual disponible"
      : `${value >= 0 ? "aumentó" : "disminuyó"} ${Math.abs(value).toFixed(1).replace(".", ",")} pp. en doce meses`;
  const toggle = (k: string) =>
    setActive((a) =>
      a.includes(k)
        ? a.length === 1
          ? a
          : a.filter((x) => x !== k)
        : [...a, k],
    );
  if (view === "home")
    return (
      <LandingPage
        onNavigate={(destination) => void openDestination(destination)}
      />
    );
  if (view === "ene" && !remoteEne)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  if (view === "informality")
    return (
      <InformalityPage
        onEne={() => setView("ene")}
        onIpc={() => {
          setView("ipc");
          window.scrollTo(0, 0);
        }}
        onIpp={() => {
          setView("ipp");
          window.scrollTo(0, 0);
        }}
        onBirths={() => {
          setView("births");
          window.scrollTo(0, 0);
        }}
        onFertility={() => {
          setView("fertility");
          window.scrollTo(0, 0);
        }}
        onDeaths={() => {
          setView("deaths");
          window.scrollTo(0, 0);
        }}
      />
    );
  if (view === "ipc")
    return (
      <IpcPage
        onLabor={() => setView("ene")}
        onInformality={() => {
          setView("informality");
          window.scrollTo(0, 0);
        }}
        onIpp={() => {
          setView("ipp");
          window.scrollTo(0, 0);
        }}
        onBirths={() => {
          setView("births");
          window.scrollTo(0, 0);
        }}
        onFertility={() => {
          setView("fertility");
          window.scrollTo(0, 0);
        }}
        onDeaths={() => {
          setView("deaths");
          window.scrollTo(0, 0);
        }}
      />
    );
  if (view === "ipp")
    return (
      <IppPage
        onLabor={() => setView("ene")}
        onInformality={() => {
          setView("informality");
          window.scrollTo(0, 0);
        }}
        onIpc={() => {
          setView("ipc");
          window.scrollTo(0, 0);
        }}
        onBirths={() => {
          setView("births");
          window.scrollTo(0, 0);
        }}
        onFertility={() => {
          setView("fertility");
          window.scrollTo(0, 0);
        }}
        onDeaths={() => {
          setView("deaths");
          window.scrollTo(0, 0);
        }}
      />
    );
  if (view === "births")
    return (
      <BirthsPage
        onLabor={() => setView("ene")}
        onInformality={() => {
          setView("informality");
          window.scrollTo(0, 0);
        }}
        onIpc={() => {
          setView("ipc");
          window.scrollTo(0, 0);
        }}
        onIpp={() => {
          setView("ipp");
          window.scrollTo(0, 0);
        }}
        onFertility={() => {
          setView("fertility");
          window.scrollTo(0, 0);
        }}
        onDeaths={() => {
          setView("deaths");
          window.scrollTo(0, 0);
        }}
      />
    );
  if (view === "fertility")
    return (
      <FertilityPage
        onLabor={() => setView("ene")}
        onInformality={() => {
          setView("informality");
          window.scrollTo(0, 0);
        }}
        onIpc={() => {
          setView("ipc");
          window.scrollTo(0, 0);
        }}
        onIpp={() => {
          setView("ipp");
          window.scrollTo(0, 0);
        }}
        onBirths={() => {
          setView("births");
          window.scrollTo(0, 0);
        }}
        onDeaths={() => {
          setView("deaths");
          window.scrollTo(0, 0);
        }}
      />
    );
  if (view === "deaths")
    return (
      <DeathsPage
        onLabor={() => setView("ene")}
        onInformality={() => {
          setView("informality");
          window.scrollTo(0, 0);
        }}
        onIpc={() => {
          setView("ipc");
          window.scrollTo(0, 0);
        }}
        onIpp={() => {
          setView("ipp");
          window.scrollTo(0, 0);
        }}
        onBirths={() => {
          setView("births");
          window.scrollTo(0, 0);
        }}
        onFertility={() => {
          setView("fertility");
          window.scrollTo(0, 0);
        }}
        onMortality={() => {
          setView("mortality");
          window.scrollTo(0, 0);
        }}
      />
    );
  if (view === "mortality")
    return (
      <MortalityPage
        onLabor={() => setView("ene")}
        onInformality={() => {
          setView("informality");
          window.scrollTo(0, 0);
        }}
        onIpc={() => {
          setView("ipc");
          window.scrollTo(0, 0);
        }}
        onIpp={() => {
          setView("ipp");
          window.scrollTo(0, 0);
        }}
        onBirths={() => {
          setView("births");
          window.scrollTo(0, 0);
        }}
        onFertility={() => {
          setView("fertility");
          window.scrollTo(0, 0);
        }}
        onDeaths={() => {
          setView("deaths");
          window.scrollTo(0, 0);
        }}
      />
    );
  if (view === "unions")
    return (
      <UnionsPage
        onLabor={() => setView("ene")}
        onInformality={() => {
          setView("informality");
          window.scrollTo(0, 0);
        }}
        onIpc={() => {
          setView("ipc");
          window.scrollTo(0, 0);
        }}
        onIpp={() => {
          setView("ipp");
          window.scrollTo(0, 0);
        }}
        onBirths={() => {
          setView("births");
          window.scrollTo(0, 0);
        }}
        onFertility={() => {
          setView("fertility");
          window.scrollTo(0, 0);
        }}
        onDeaths={() => {
          setView("deaths");
          window.scrollTo(0, 0);
        }}
      />
    );
  if (view === "enusc")
    return (
      <EnuscPage
        onLabor={() => setView("ene")}
        onInformality={() => setView("informality")}
        onIpc={() => setView("ipc")}
        onIpp={() => setView("ipp")}
        onBirths={() => setView("births")}
        onPolice={() => {
          setView("police");
          window.scrollTo(0, 0);
        }}
      />
    );
  if (view === "police")
    return (
      <PolicePage
        onLabor={() => setView("ene")}
        onInformality={() => setView("informality")}
        onIpc={() => setView("ipc")}
        onIpp={() => setView("ipp")}
        onBirths={() => setView("births")}
        onEnusc={() => {
          setView("enusc");
          window.scrollTo(0, 0);
        }}
      />
    );
  if (
    view === "energy" ||
    view === "industry" ||
    view === "permits" ||
    view === "commerce"
  )
    return (
      <EconomicPage
        key={view}
        kind={view}
        onNavigate={(destination) => void openDestination(destination)}
      />
    );
  if (view === "tourism")
    return (
      <TourismPage
        onNavigate={(destination) => void openDestination(destination)}
      />
    );
  if (view === "supermarkets")
    return (
      <SupermarketsPage
        onNavigate={(destination) => void openDestination(destination)}
      />
    );
  if (view === "businessDemography")
    return (
      <BusinessDemographyPage
        onNavigate={(destination) => void openDestination(destination)}
      />
    );
  return (
    <main>
      <header>
        <div className="topbar">
          <div className="brand">
            <RelatosHeaderLogo />
          </div>
          <nav className="utility">
            <a href="https://www.ine.gob.cl/institucional/">Acerca del INE</a>
            <button aria-label="Abrir menú" onClick={() => setMenu(!menu)}>
              <Icon name="menu" />
            </button>
          </nav>
        </div>
        <nav className={`topics ${menu ? "open" : ""}`}>
          <HomeNavLink />
          <div
            className={`topic-dropdown ${laborOpen ? "open" : ""}`}
            onMouseLeave={() => setLaborOpen(false)}
          >
            <button
              className="active"
              onClick={() => setLaborOpen((value) => !value)}
            >
              Mercado laboral
            </button>
            <div className="topic-submenu">
              <button
                aria-current="page"
                onClick={() => {
                  setLaborOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Ocupación y desocupación
              </button>
              <button
                onClick={() => {
                  setView("informality");
                  setLaborOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Informalidad laboral
              </button>
            </div>
          </div>
          <div
            className={`topic-dropdown ${pricesOpen ? "open" : ""}`}
            onMouseLeave={() => setPricesOpen(false)}
          >
            <button
              onClick={() => setPricesOpen((value) => !value)}
              aria-expanded={pricesOpen}
              aria-haspopup="menu"
              aria-controls="price-menu-ene"
            >
              Precios
            </button>
            <div id="price-menu-ene" className="topic-submenu" role="menu">
              <button
                role="menuitem"
                onClick={() => {
                  setView("ipc");
                  setPricesOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Índice de Precios al Consumidor
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setView("ipp");
                  setPricesOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Índice de Precios al Productor
              </button>
            </div>
          </div>
          <div
            className={`topic-dropdown ${demographyOpen ? "open" : ""}`}
            onMouseLeave={() => setDemographyOpen(false)}
          >
            <button onClick={() => setDemographyOpen((value) => !value)}>
              Demografía y población
            </button>
            <div className="topic-submenu">
              <button
                onClick={() => {
                  setView("births");
                  setDemographyOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Nacimientos
              </button>
              <button
                onClick={() => {
                  setView("fertility");
                  setDemographyOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Fecundidad
              </button>
              <button
                onClick={() => {
                  setView("deaths");
                  setDemographyOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Defunciones
              </button>
              <button
                onClick={() => {
                  setView("mortality");
                  setDemographyOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Mortalidad
              </button>
              <button
                onClick={() => {
                  setView("unions");
                  setDemographyOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Matrimonios y AUC
              </button>
            </div>
          </div>
          <div
            className={`topic-dropdown ${livingOpen ? "open" : ""}`}
            onMouseLeave={() => setLivingOpen(false)}
          >
            <button onClick={() => setLivingOpen((value) => !value)}>
              Condiciones de vida
            </button>
            <div className="topic-submenu">
              <button
                onClick={() => {
                  setView("enusc");
                  setLivingOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                ENUSC
              </button>
              <button
                onClick={() => {
                  setView("police");
                  setLivingOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Policías
              </button>
            </div>
          </div>
          <div
            className={`topic-dropdown ${industryOpen ? "open" : ""}`}
            onMouseLeave={() => setIndustryOpen(false)}
          >
            <button onClick={() => setIndustryOpen((value) => !value)}>
              Industria, Energía y Construcción
            </button>
            <div className="topic-submenu">
              <button
                onClick={() => {
                  setView("permits");
                  setIndustryOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Permisos de Edificación
              </button>
              <button
                onClick={() => {
                  setView("energy");
                  setIndustryOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Energía
              </button>
              <button
                onClick={() => {
                  setView("industry");
                  setIndustryOpen(false);
                  window.scrollTo(0, 0);
                }}
              >
                Industria
              </button>
            </div>
          </div>
          <div
            className={`topic-dropdown ${servicesOpen ? "open" : ""}`}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button onClick={() => setServicesOpen((value) => !value)}>
              Servicios
            </button>
            <div className="topic-submenu">
              <button
                onClick={() => {
                  setServicesOpen(false);
                  void openDestination("commerce");
                }}
              >
                Comercio
              </button>
              <button
                onClick={() => {
                  setServicesOpen(false);
                  void openDestination("tourism");
                }}
              >
                Turismo
              </button>
              <button
                onClick={() => {
                  setServicesOpen(false);
                  void openDestination("supermarkets");
                }}
              >
                Supermercados
              </button>
            </div>
          </div>
          <div className="topics-divider" aria-hidden="true" />
          <div
            className={`topic-dropdown ${experimentalOpen ? "open" : ""}`}
            onMouseLeave={() => setExperimentalOpen(false)}
          >
            <button onClick={() => setExperimentalOpen((value) => !value)}>
              Estadísticas Experimentales
            </button>
            <div className="topic-submenu">
              <button
                onClick={() => {
                  setExperimentalOpen(false);
                  void openDestination("businessDemography");
                }}
              >
                Demografía de empresas
              </button>
            </div>
          </div>
        </nav>
      </header>
      <section id="inicio" className="hero wrap">
        <div>
          <span className="eyebrow">Mercado laboral · ENE</span>
          <h1>
            Encuesta Nacional
            <br />
            de Empleo
          </h1>
          <p>
            Principales indicadores del mercado laboral en Chile, actualizados
            mensualmente.
          </p>
        </div>
        <div className="period-box">
          <span>Período consultado</span>
          <div className="selectors">
            <select
              value={year}
              onChange={(e) => {
                const y = +e.target.value;
                setYear(y);
                const qs = periods.filter((p) => p.year === y);
                setQuarter(qs.at(-1)?.quarter || quarter);
              }}
            >
              {[...new Set(periods.map((p) => p.year))].reverse().map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
            >
              {periods
                .filter((p) => p.year === year)
                .map((p) => (
                  <option key={p.quarter} value={p.quarter}>
                    {formatQuarter(p.quarter)}
                  </option>
                ))}
            </select>
          </div>
          <small>Última actualización: 30 de junio de 2026</small>
        </div>
      </section>
      <section className="wrap kpis principal-kpis">
        <article className="alert">
          <div className="kpi-icon">
            <Icon name="user" />
          </div>
          <div>
            <h3>Tasa de desocupación nacional</h3>
            <strong>
              {point.unemploymentRate.toFixed(1).replace(".", ",")}
              <small>%</small>
            </strong>
            <p
              className={
                unemploymentDelta !== null && unemploymentDelta > 0
                  ? "up"
                  : "down"
              }
            >
              {unemploymentDelta !== null && unemploymentDelta >= 0 ? "↗" : "↘"}{" "}
              {unemploymentDelta === null
                ? "Sin comparación anual"
                : `${Math.abs(unemploymentDelta).toFixed(1).replace(".", ",")} pp. a 12 meses`}
            </p>
          </div>
        </article>
        <article>
          <div className="kpi-icon">
            <Icon name="brief" />
          </div>
          <div>
            <h3>Personas ocupadas</h3>
            <strong className="level">
              {(point.employed * 1000).toLocaleString("es-CL", {
                maximumFractionDigits: 0,
              })}
            </strong>
            <p
              className={
                employedDelta !== null && employedDelta > 0 ? "up" : "down"
              }
            >
              {employedDelta !== null && employedDelta >= 0 ? "↗" : "↘"}{" "}
              {employedDelta === null
                ? "Sin comparación anual"
                : `${Math.abs(employedDelta).toFixed(1).replace(".", ",")}% a 12 meses`}
            </p>
          </div>
        </article>
        <article>
          <div className="kpi-icon">
            <Icon name="people" />
          </div>
          <div>
            <h3>Fuerza de trabajo</h3>
            <strong className="level">
              {(point.labor * 1000).toLocaleString("es-CL", {
                maximumFractionDigits: 0,
              })}
            </strong>
            <p
              className={laborDelta !== null && laborDelta > 0 ? "up" : "down"}
            >
              {laborDelta !== null && laborDelta >= 0 ? "↗" : "↘"}{" "}
              {laborDelta === null
                ? "Sin comparación anual"
                : `${Math.abs(laborDelta).toFixed(1).replace(".", ",")}% a 12 meses`}
            </p>
          </div>
        </article>
        <article className="seasonal">
          <div className="kpi-icon">
            <Icon name="user" />
          </div>
          <div>
            <h3>Desocupación ajustada estacionalmente</h3>
            <strong>
              {seasonalPoint
                ? seasonalPoint.value.toFixed(1).replace(".", ",")
                : "—"}
              <small>{seasonalPoint ? "%" : ""}</small>
            </strong>
            <p
              className={
                seasonalDelta !== null && seasonalDelta > 0 ? "up" : "down"
              }
            >
              {seasonalDelta !== null && seasonalDelta >= 0 ? "↗" : "↘"}{" "}
              {seasonalDelta === null
                ? "Sin dato comparable"
                : `${Math.abs(seasonalDelta).toFixed(1).replace(".", ",")} pp. respecto del trimestre anterior`}
            </p>
          </div>
        </article>
        <article className="sectors">
          <div>
            <span className="eyebrow">Incidencias positivas</span>
            <h3>Tres sectores que más impulsan la ocupación</h3>
            <ol>
              {sectors.length ? (
                sectors.map((sector, index) => (
                  <li key={sector.label}>
                    <span>{index + 1}</span>
                    <b>{sector.label}</b>
                    <em>
                      {sector.change >= 0 ? "+" : ""}
                      {sector.change.toFixed(1).replace(".", ",")}% anual
                    </em>
                  </li>
                ))
              ) : (
                <li className="no-data">
                  No hay información sectorial comparable para este período.
                </li>
              )}
            </ol>
          </div>
        </article>
      </section>
      <section className="wrap dashboard">
        {data && (
          <Chart
            data={liveIndicatorData}
            indicatorId={indicator}
            onIndicator={setIndicator}
            active={active}
            onToggle={toggle}
            year={year}
            quarter={quarter}
          />
        )}
        <aside>
          <span className="eyebrow">
            En contexto · {shortQuarter} {year}
          </span>
          <h2>Qué muestran los datos</h2>
          <div className="insight">
            <b>
              Desocupación:{" "}
              {point.unemploymentRate.toFixed(1).replace(".", ",")}%
            </b>
            <p>La tasa de desocupación {ppText(unemploymentDelta)}.</p>
          </div>
          <div className="insight">
            <b>Brecha entre mujeres y hombres</b>
            <p>
              La tasa femenina fue{" "}
              {women.unemploymentRate.toFixed(1).replace(".", ",")}% y la
              masculina {men.unemploymentRate.toFixed(1).replace(".", ",")}%,
              una diferencia de{" "}
              {Math.abs(genderGap).toFixed(1).replace(".", ",")} pp.{" "}
              {genderGap >= 0
                ? "a favor de los hombres"
                : "a favor de las mujeres"}
              .
            </p>
          </div>
          <div className="insight">
            <b>
              {employedDelta !== null && employedDelta >= 0
                ? "Aumentan"
                : "Disminuyen"}{" "}
              las personas ocupadas
            </b>
            <p>
              La población ocupada {direction(employedDelta)} en doce meses.
            </p>
          </div>
          <a href="#analisis">Ver análisis completo →</a>
        </aside>
      </section>
      <section id="analisis" className="analysis wrap">
        <div className="section-title">
          <span className="eyebrow">
            Resultados del período · {shortQuarter} {year}
          </span>
          <h2>El mercado laboral, en detalle</h2>
          <p>Lectura sintética del trimestre móvil {periodText}.</p>
        </div>
        <div className="analysis-grid">
          <article>
            <span>01</span>
            <h3>Fuerza de trabajo</h3>
            <p>
              La fuerza de trabajo alcanzó{" "}
              {(point.labor * 1000).toLocaleString("es-CL", {
                maximumFractionDigits: 0,
              })}{" "}
              personas y {direction(laborDelta)} respecto del mismo trimestre
              móvil del año anterior.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Ocupación</h3>
            <p>
              Se estimaron{" "}
              {(point.employed * 1000).toLocaleString("es-CL", {
                maximumFractionDigits: 0,
              })}{" "}
              personas ocupadas. La tasa de ocupación fue{" "}
              {point.employmentRate.toFixed(1).replace(".", ",")}% y el nivel de
              ocupación {direction(employedDelta)} anualmente.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Fuera de la fuerza de trabajo</h3>
            <p>
              Se estimaron{" "}
              {(inactive * 1000).toLocaleString("es-CL", {
                maximumFractionDigits: 0,
              })}{" "}
              personas fuera de la fuerza de trabajo, cifra que{" "}
              {direction(inactiveDelta)} en doce meses.
            </p>
          </article>
          <article>
            <span>04</span>
            <h3>Desocupación</h3>
            <p>
              La población desocupada llegó a{" "}
              {(point.unemployed * 1000).toLocaleString("es-CL", {
                maximumFractionDigits: 0,
              })}{" "}
              personas. La tasa de{" "}
              {point.unemploymentRate.toFixed(1).replace(".", ",")}%{" "}
              {ppText(unemploymentDelta)}.
            </p>
          </article>
          <article>
            <span>05</span>
            <h3>Participación laboral</h3>
            <p>
              La tasa de participación se situó en{" "}
              {point.participation.toFixed(1).replace(".", ",")}%,{" "}
              {prev
                ? `${point.participation - prev.participation >= 0 ? "aumentando" : "disminuyendo"} ${Math.abs(
                    point.participation - prev.participation,
                  )
                    .toFixed(1)
                    .replace(".", ",")} pp. anualmente`
                : "sin comparación anual disponible"}
              .
            </p>
          </article>
          <article>
            <span>06</span>
            <h3>Comparación con el período anterior</h3>
            <p>
              {priorPeriod
                ? `Frente a ${formatQuarter(priorPeriod.quarter).toLowerCase()} de ${priorPeriod.year}, la tasa de desocupación ${point.unemploymentRate - priorPeriod.unemploymentRate >= 0 ? "subió" : "bajó"} ${Math.abs(
                    point.unemploymentRate - priorPeriod.unemploymentRate,
                  )
                    .toFixed(1)
                    .replace(".", ",")} pp.`
                : "No existe un trimestre móvil anterior disponible en la serie."}
            </p>
          </article>
        </div>
      </section>
      <LaborPopulationDendrogram
        nationalSeriesBySex={data.series}
        regionalSeries={remoteEne?.regionalSeries}
        year={year}
        quarter={quarter}
        onPeriod={(selected) => {
          setYear(selected.year);
          setQuarter(selected.quarter);
        }}
      />
      <section className="topic-analysis">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">
              Análisis temático · {shortQuarter} {year}
            </span>
            <h2>Desocupación</h2>
            <p>
              Composición, diferencias por sexo y evolución desestacionalizada.
            </p>
          </div>
          <div className="unemployment-lead">
            <div>
              <p className="lead">
                La tasa de desocupación nacional fue{" "}
                <b>{point.unemploymentRate.toFixed(1).replace(".", ",")}%</b> y{" "}
                {ppText(unemploymentDelta)}. Esto ocurrió porque la fuerza de
                trabajo {direction(laborDelta)}, mientras la población ocupada{" "}
                {direction(employedDelta)}.
              </p>
              <p>
                Las personas desocupadas totalizaron{" "}
                <b>
                  {(point.unemployed * 1000).toLocaleString("es-CL", {
                    maximumFractionDigits: 0,
                  })}
                </b>{" "}
                y {direction(unemployedDelta)} en doce meses
                {ceasedDelta !== null && firstJobDelta !== null
                  ? `, incididas por quienes se encontraban cesantes (${pluralDirection(ceasedDelta)}) y por quienes buscaban trabajo por primera vez (${pluralDirection(firstJobDelta)})`
                  : ""}
                .
              </p>
            </div>
            <div className="topic-number">
              <span>Tasa nacional</span>
              <strong>
                {point.unemploymentRate.toFixed(1).replace(".", ",")}
                <small>%</small>
              </strong>
              <em>
                {unemploymentDelta === null
                  ? "Sin comparación anual"
                  : `${unemploymentDelta >= 0 ? "+" : "−"}${Math.abs(unemploymentDelta).toFixed(1).replace(".", ",")} pp. en 12 meses`}
              </em>
            </div>
          </div>
          <div className="unemployment-grid">
            <article>
              <span className="eyebrow">Según sexo</span>
              <h3>
                Una brecha de {Math.abs(genderGap).toFixed(1).replace(".", ",")}{" "}
                puntos porcentuales
              </h3>
              {[
                ["Mujeres", women, womenRateDelta, "#e43d37"],
                ["Hombres", men, menRateDelta, "#0096bd"],
              ].map(([label, p, d, color]) => {
                const item = p as Point;
                const delta = d as number | null;
                return (
                  <div className="sex-row" key={label as string}>
                    <div>
                      <b>{label as string}</b>
                      <small>
                        {delta === null
                          ? "Sin comparación anual"
                          : `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1).replace(".", ",")} pp. anual`}
                      </small>
                    </div>
                    <div className="sex-track">
                      <i
                        style={{
                          width: `${Math.min((item.unemploymentRate / 14) * 100, 100)}%`,
                          background: color as string,
                        }}
                      />
                    </div>
                    <strong>
                      {item.unemploymentRate.toFixed(1).replace(".", ",")}%
                    </strong>
                  </div>
                );
              })}
            </article>
            <article>
              <span className="eyebrow">Ajuste estacional</span>
              <h3>Comparación con el trimestre móvil anterior</h3>
              <div className="seasonal-reading">
                <strong>
                  {seasonalPoint
                    ? seasonalPoint.value.toFixed(1).replace(".", ",")
                    : "—"}
                  <small>{seasonalPoint ? "%" : ""}</small>
                </strong>
                <p>
                  {seasonalDelta === null
                    ? "No hay información comparable para este período."
                    : `La tasa ajustada estacionalmente ${seasonalDelta >= 0 ? "aumentó" : "disminuyó"} ${Math.abs(seasonalDelta).toFixed(1).replace(".", ",")} pp. respecto del trimestre móvil anterior.`}
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className="occupation-analysis">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">
              Análisis temático · {shortQuarter} {year}
            </span>
            <h2>Ocupación</h2>
            <p>
              Evolución anual y actividades que explican el cambio de la
              población ocupada.
            </p>
          </div>
          <div className="occupation-lead">
            <div>
              <p className="lead">
                En el trimestre móvil {periodText}, se estimaron{" "}
                <b>
                  {(point.employed * 1000).toLocaleString("es-CL", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  personas ocupadas
                </b>
                . En doce meses, la población ocupada {direction(employedDelta)}
                .
              </p>
              <p>
                Según sexo, las mujeres ocupadas{" "}
                {pluralDirection(womenEmployedDelta)}, mientras los hombres
                ocupados {pluralDirection(menEmployedDelta)}.
              </p>
            </div>
            <div className="topic-number">
              <span>Total de personas ocupadas</span>
              <strong className="people-total">
                {(point.employed * 1000).toLocaleString("es-CL", {
                  maximumFractionDigits: 0,
                })}
              </strong>
              <em>
                {employedDelta === null
                  ? "Sin comparación anual"
                  : `${employedDelta >= 0 ? "+" : "−"}${Math.abs(employedDelta).toFixed(1).replace(".", ",")}% en 12 meses`}
              </em>
            </div>
          </div>
          <div className="occupation-sex">
            {[
              ["Mujeres", women, womenEmployedDelta, "#e43d37"],
              ["Hombres", men, menEmployedDelta, "#0096bd"],
            ].map(([label, p, d, color]) => {
              const item = p as Point;
              const delta = d as number | null;
              return (
                <article key={label as string}>
                  <i style={{ background: color as string }} />
                  <span>{label as string}</span>
                  <strong>
                    {(item.employed * 1000).toLocaleString("es-CL", {
                      maximumFractionDigits: 0,
                    })}
                  </strong>
                  <em>
                    {delta === null
                      ? "Sin comparación anual"
                      : `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1).replace(".", ",")}% anual`}
                  </em>
                </article>
              );
            })}
          </div>
          <article className="absent-employment">
            <div>
              <span className="eyebrow">Personas ocupadas ausentes</span>
              <h3>Presencia efectiva en el trabajo</h3>
            </div>
            {absent ? (
              <>
                <p>
                  {absent.presentChange === null ? (
                    "Para este período no existe una comparación interanual disponible. "
                  ) : (
                    <>
                      Las personas ocupadas presentes{" "}
                      {pluralDirection(absent.presentChange)} en doce
                      meses.{" "}
                    </>
                  )}
                  Las personas ocupadas ausentes totalizaron{" "}
                  <b>
                    {Math.round(absent.absent * 1000).toLocaleString("es-CL")}
                  </b>
                  , equivalentes al{" "}
                  <b>{absent.share.toFixed(1).replace(".", ",")}%</b> del total
                  {absent.change !== null && absent.changePeople !== null ? (
                    <>
                      ; en doce meses {pluralDirection(absent.change)}, lo que
                      representa{" "}
                      <b>
                        {Math.abs(absent.changePeople).toLocaleString("es-CL")}{" "}
                        personas {absent.changePeople >= 0 ? "más" : "menos"}
                      </b>
                    </>
                  ) : (
                    "."
                  )}
                </p>
                <div className="absent-metrics">
                  <span>
                    <strong>
                      {absent.share.toFixed(1).replace(".", ",")}%
                    </strong>
                    <small>del total de personas ocupadas</small>
                  </span>
                  <span>
                    <strong>{signedPercent(absent.change)}</strong>
                    <small>variación de ausentes</small>
                  </span>
                  <span>
                    <strong>
                      {absent.changePeople === null
                        ? "—"
                        : Math.abs(absent.changePeople).toLocaleString("es-CL")}
                    </strong>
                    <small>
                      {absent.changePeople === null
                        ? "sin comparación disponible"
                        : `personas ${absent.changePeople >= 0 ? "más" : "menos"}`}
                    </small>
                  </span>
                </div>
                {absent.quality && (
                  <p className="quality-note">
                    <b>Nota de calidad:</b> la estimación de personas ocupadas
                    ausentes está marcada como “{absent.quality}” en el cuadro
                    oficial; debe interpretarse según los criterios de calidad
                    del INE.
                  </p>
                )}
              </>
            ) : (
              <div className="absent-unavailable">
                <b>
                  Desagregación no disponible para {shortQuarter} {year}
                </b>
                <p>
                  No existe un registro coincidente en la serie oficial de
                  personas ocupadas ausentes.
                </p>
              </div>
            )}
          </article>
          <div className="occupation-drivers">
            <article>
              <span className="eyebrow">Actividad económica</span>
              <h3>Principales sectores que impulsaron la ocupación</h3>
              <ol>
                {sectors.length ? (
                  sectors.map((item, index) => (
                    <li key={item.label}>
                      <span>{index + 1}</span>
                      <div>
                        <b>{item.label}</b>
                        <small>
                          {item.change >= 0 ? "+" : ""}
                          {item.change.toFixed(1).replace(".", ",")}% en doce
                          meses
                        </small>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="empty-driver">
                    No hay ramas con incidencia positiva comparable para este
                    período.
                  </li>
                )}
              </ol>
            </article>
            <article>
              <span className="eyebrow">Categoría ocupacional</span>
              <h3>Categorías con mayor incidencia positiva</h3>
              <ol>
                {categories.length ? (
                  categories.map((item, index) => (
                    <li key={item.label}>
                      <span>{index + 1}</span>
                      <div>
                        <b>{item.label}</b>
                        <small>
                          {item.change >= 0 ? "+" : ""}
                          {item.change.toFixed(1).replace(".", ",")}% en doce
                          meses
                        </small>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="empty-driver">
                    No hay categorías con incidencia positiva comparable para
                    este período.
                  </li>
                )}
              </ol>
            </article>
          </div>
        </div>
      </section>
      <section className="participation-analysis">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">
              Análisis temático · {shortQuarter} {year}
            </span>
            <h2>Participación laboral</h2>
            <p>
              Participación, ocupación y evolución de la población fuera de la
              fuerza de trabajo.
            </p>
          </div>
          <div className="participation-lead">
            <p className="lead">
              En el trimestre móvil {periodText}, la tasa de participación se
              situó en{" "}
              <b>{point.participation.toFixed(1).replace(".", ",")}%</b>,{" "}
              {rateChange(participationDelta)}, mientras que la tasa de
              ocupación alcanzó{" "}
              <b>{point.employmentRate.toFixed(1).replace(".", ",")}%</b>,{" "}
              {rateChange(employmentRateDelta)}. En tanto, la población fuera de
              la fuerza de trabajo {direction(inactiveDelta)} en doce meses
              {inactiveComponents
                ? `, influida por las personas inactivas potencialmente activas (${inactiveComponents.potential.toFixed(1).replace(".", ",")}%) y las personas inactivas habituales (${inactiveComponents.habitual.toFixed(1).replace(".", ",")}%)`
                : "."}
            </p>
            <div className="participation-cards">
              <article>
                <span>Tasa de participación</span>
                <strong>
                  {point.participation.toFixed(1).replace(".", ",")}%
                </strong>
                <em>
                  {participationDelta === null
                    ? "Sin comparación anual"
                    : `${participationDelta >= 0 ? "+" : "−"}${Math.abs(participationDelta).toFixed(1).replace(".", ",")} pp. anual`}
                </em>
              </article>
              <article>
                <span>Tasa de ocupación</span>
                <strong>
                  {point.employmentRate.toFixed(1).replace(".", ",")}%
                </strong>
                <em>
                  {employmentRateDelta === null
                    ? "Sin comparación anual"
                    : Math.abs(employmentRateDelta) < 0.05
                      ? "0,0 pp. anual"
                      : `${employmentRateDelta > 0 ? "+" : "−"}${Math.abs(employmentRateDelta).toFixed(1).replace(".", ",")} pp. anual`}
                </em>
              </article>
              <article>
                <span>Fuerza de trabajo</span>
                <strong>
                  {Math.round(point.labor * 1000).toLocaleString("es-CL")}
                </strong>
                <em>{signedPercent(laborDelta)}</em>
              </article>
              <article>
                <span>Fuera de la fuerza de trabajo</span>
                <strong>
                  {Math.round(inactive * 1000).toLocaleString("es-CL")}
                </strong>
                <em>{signedPercent(inactiveDelta)}</em>
              </article>
            </div>
          </div>
          {inactiveComponents ? (
            <div className="inactive-breakdown">
              <article>
                <span>Personas inactivas potencialmente activas</span>
                <strong>
                  {inactiveComponents.potential >= 0 ? "+" : "−"}
                  {Math.abs(inactiveComponents.potential)
                    .toFixed(1)
                    .replace(".", ",")}
                  %
                </strong>
                <p>
                  Variación respecto del mismo trimestre móvil del año anterior.
                </p>
              </article>
              <article>
                <span>Personas inactivas habituales</span>
                <strong>
                  {inactiveComponents.habitual >= 0 ? "+" : "−"}
                  {Math.abs(inactiveComponents.habitual)
                    .toFixed(1)
                    .replace(".", ",")}
                  %
                </strong>
                <p>
                  Variación respecto del mismo trimestre móvil del año anterior.
                </p>
              </article>
            </div>
          ) : (
            <div className="inactive-source-note">
              <b>
                Desagregación no disponible para {shortQuarter} {year}
              </b>
              <p>
                Las tasas y el total fuera de la fuerza de trabajo se calculan
                para este período; la fuente cargada no contiene la serie
                histórica de sus componentes.
              </p>
            </div>
          )}
        </div>
      </section>
      <section id="recursos" className="resources">
        <div className="wrap">
          <div className="section-title">
            <span className="eyebrow">Centro de recursos</span>
            <h2>Datos y documentación</h2>
            <p>
              Accede a los archivos oficiales y reutiliza los indicadores de la
              ENE mediante estándares abiertos.
            </p>
          </div>
          <div className="resource-grid">
            {[
              ["Cuadros estadísticos", "Series y tabulados en formato Excel."],
              ["Metodología", "Diseño, conceptos y criterios de calidad."],
              ["Bases de datos", "Microdatos en formatos CSV y Stata."],
              ["Boletines en PDF", "Publicaciones nacionales y regionales."],
            ].map(([t, d], i) => (
              <a key={t} href={SOURCE} target="_blank">
                <span>0{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
                <b>Ir al repositorio oficial ↗</b>
              </a>
            ))}
          </div>
          {false && (
            <section className="ene-sdmx" aria-labelledby="ene-sdmx-title">
              <div className="ene-sdmx-head">
                <div>
                  <span className="eyebrow">Datos abiertos · SDMX y API</span>
                  <h3 id="ene-sdmx-title">
                    Una misma fuente, distintas formas de uso
                  </h3>
                  <p>
                    Descarga el conjunto completo en SDMX-CSV 2.0, consulta su
                    estructura estadística o intégralo directamente en tus
                    aplicaciones.
                  </p>
                </div>
                <span className="api-badge">Piloto ENE · versión 1.0</span>
              </div>

              <div className="ene-sdmx-options">
                <article>
                  <span>01</span>
                  <h4>Descargar datos SDMX</h4>
                  <p>
                    48.165 observaciones, 247 series y 195 períodos, desde marzo
                    de 2010 hasta mayo de 2026.
                  </p>
                  <a
                    href="/sdmx/ENE_IND_PRINCIPALES_completo_SDMX-CSV_2.0.csv"
                    download
                  >
                    Descargar SDMX-CSV 2.0 ↓
                  </a>
                </article>
                <article>
                  <span>02</span>
                  <h4>Explorar la estructura</h4>
                  <p>
                    Conceptos, listas de códigos, DSD y Dataflow con agencia
                    oficial INE.GOB.CL.
                  </p>
                  <a href="/sdmx/00_Estructuras_ENE_completo.xml" download>
                    Descargar estructuras SDMX-ML 3.0 ↓
                  </a>
                </article>
                <article>
                  <span>03</span>
                  <h4>Consumir mediante API</h4>
                  <p>
                    Endpoint estable para sistemas, scripts y herramientas de
                    análisis, con respuesta en SDMX-CSV.
                  </p>
                  <a
                    href="/api/sdmx/data/INE.GOB.CL,DF_ENE_IND_PRINCIPALES,1.0/all"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Probar endpoint ↗
                  </a>
                </article>
              </div>

              <div className="ene-api-example">
                <div>
                  <span>Ejemplo · Conjunto completo</span>
                  <code>
                    GET /api/sdmx/data/INE.GOB.CL,DF_ENE_IND_PRINCIPALES,1.0/all
                  </code>
                </div>
                <div className="ene-api-query-example">
                  <span>
                    Ejemplo · Región Metropolitana · últimos 13 trimestres
                    móviles
                  </span>
                  <code>
                    GET
                    /api/sdmx/data/INE.GOB.CL,DF_ENE_IND_PRINCIPALES,1.0/all?ref_area=CL-RM&amp;last_n_periods=13
                  </code>
                  <a
                    href="/api/sdmx/data/INE.GOB.CL,DF_ENE_IND_PRINCIPALES,1.0/all?ref_area=CL-RM&last_n_periods=13"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ejecutar consulta y descargar SDMX-CSV ↗
                  </a>
                </div>
                <div
                  className="ene-api-meta"
                  aria-label="Metadatos del conjunto"
                >
                  <span>
                    <b>FREQ</b> Trimestral móvil
                  </span>
                  <span>
                    <b>Ámbito</b> Nacional y regional
                  </span>
                  <span>
                    <b>Sexo</b> Total, mujeres y hombres
                  </span>
                  <span>
                    <b>Calidad</b> F, A y B
                  </span>
                </div>
                <p>
                  Dimensiones: <b>FREQ</b>, <b>REF_AREA</b>, <b>SEX</b>,{" "}
                  <b>INDICATOR</b> y <b>TIME_PERIOD</b>. El período corresponde
                  al mes final del trimestre móvil y los valores conservan todos
                  los decimales del archivo Excel.
                </p>
                <div className="ene-sdmx-secondary">
                  <a href="/sdmx/Guia_tecnica_ENE_SDMX.pdf" download>
                    Guía técnica en PDF ↓
                  </a>
                  <a href="/sdmx/transformar_ene_sdmx.py" download>
                    Transformador Excel → SDMX-CSV ↓
                  </a>
                  <a href="/sdmx/informe_validacion_completo.json" download>
                    Informe de validación ↓
                  </a>
                </div>
              </div>
            </section>
          )}
          <LaborSdmxBox context="ene" />
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>{GLOBAL_FOOTER_TEXT}</p>
          <a href={SOURCE}>Fuente oficial: ine.gob.cl ↗</a>
        </div>
      </footer>
    </main>
  );
}
