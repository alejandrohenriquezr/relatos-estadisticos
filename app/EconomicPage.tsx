"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import energyFallback from "../public/economic-energy.json";
import industryFallback from "../public/economic-industry.json";
import permitsFallback from "../public/economic-permits.json";
import {
  peekDataset,
  primeDataset,
  refreshDataset,
} from "../lib/client-data-prefetch";
import SectionHeader, { IneLogo, type SiteDestination } from "./SectionHeader";
import {
  useTemporalWindow,
  type TemporalPreset,
} from "./TemporalChartControls";

type Kind = "energy" | "industry" | "permits" | "commerce";
type Point = {
  year: number;
  month: number;
  label: string;
  [key: string]: number | string | null;
};
const info = {
  energy: {
    title: "Producción de electricidad, gas y agua",
    eyebrow: "ENERGÍA",
    intro:
      "La producción de electricidad, gas y agua permite seguir la actividad de servicios esenciales y distinguir los movimientos coyunturales de las tendencias de fondo.",
  },
  industry: {
    title: "Índice de Producción Industrial",
    eyebrow: "INDUSTRIA",
    intro:
      "El Índice de Producción Industrial reúne minería, manufactura y electricidad, gas y agua. Su lectura conjunta muestra qué actividades explican el pulso industrial del país.",
  },
  permits: {
    title: "Permisos de Edificación",
    eyebrow: "CONSTRUCCIÓN",
    intro:
      "La superficie autorizada anticipa parte de la actividad constructiva. La composición entre vivienda y destinos no habitacionales ayuda a interpretar dónde se concentra el impulso.",
  },
  commerce: {
    title: "ÍNDICE DE ACTIVIDAD DEL COMERCIO",
    eyebrow: "SERVICIOS · COMERCIO",
    intro:
      "Una lectura de la evolución del comercio a precios constantes, desde el resultado agregado hasta productos y tipos de bienes.",
  },
} as const;
const fallbackData: Partial<Record<Kind, any>> = {
  energy: energyFallback,
  industry: industryFallback,
  permits: permitsFallback,
};
const fmt = (v: unknown, d = 1) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("es-CL", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : "—";
const monthName = (p?: Point) =>
  p
    ? new Intl.DateTimeFormat("es-CL", {
        month: "long",
        year: "numeric",
      }).format(new Date(p.year, p.month - 1, 1))
    : "Último período";
const changeWord = (v: unknown) =>
  typeof v === "number"
    ? v >= 0
      ? "aumentó"
      : "disminuyó"
    : "no presenta comparación";

function Spark({
  series,
  fields,
  labels,
  unit = "",
}: {
  series: Point[];
  fields: string[];
  labels: string[];
  unit?: string;
}) {
  const colors = ["#122f61", "#e34856", "#16a085", "#b06b00"];
  const [active, setActive] = useState(fields);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    label: string;
    value: number;
    color: string;
  } | null>(null);
  const temporalPresets: TemporalPreset[] = [
    { value: 25, label: "25 períodos" },
    { value: 60, label: "5 años" },
    { value: 120, label: "10 años" },
    { value: "all", label: "Serie completa" },
  ];
  const temporal = useTemporalWindow(
    series,
    series.map((point) => point.label),
    temporalPresets,
    25,
  );
  const usable = temporal.visible,
    isMulti = fields.length > 1;
  const visible = isMulti ? fields.filter((f) => active.includes(f)) : fields;
  const values = usable.flatMap((p) =>
    visible.map((f) => p[f]).filter((v): v is number => typeof v === "number"),
  );
  const rawMin = Math.min(...values),
    rawMax = Math.max(...values),
    spread = rawMax - rawMin || Math.abs(rawMax) || 1;
  const min = rawMin - spread * 0.08,
    max = rawMax + spread * 0.08,
    range = max - min || 1,
    w = 760,
    h = 390,
    left = 72,
    right = 18,
    top = 26,
    bottom = 112;
  const x = (i: number) =>
    left + (i * (w - left - right)) / Math.max(usable.length - 1, 1);
  const y = (v: number) => top + ((max - v) * (h - top - bottom)) / range;
  const ticks = Array.from({ length: 6 }, (_, i) => min + (range * i) / 5);
  const path = (field: string) =>
    usable
      .map((p, i) => {
        const v = p[field];
        return typeof v === "number"
          ? `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`
          : "";
      })
      .join(" ");
  const toggle = (field: string) =>
    setActive((current) =>
      current.includes(field)
        ? current.length === 1
          ? current
          : current.filter((x) => x !== field)
        : [...current, field],
    );
  return (
    <div
      className="econ-chart"
      role="img"
      aria-label={`Serie de ${labels.join(", ")}`}
    >
      <div className="econ-legend">
        {fields.map((f, i) => (
          <button
            type="button"
            aria-pressed={visible.includes(f)}
            className={visible.includes(f) ? "is-active" : ""}
            onClick={() => isMulti && toggle(f)}
            key={f}
          >
            <i style={{ background: colors[i] }} />
            {labels[i]}
          </button>
        ))}
      </div>
      <div className="econ-plot">
        {hover && (
          <div
            className="econ-tooltip"
            style={{
              left: `${(hover.x / w) * 100}%`,
              top: `${(hover.y / h) * 100}%`,
              borderColor: hover.color,
            }}
          >
            <b>{hover.label}</b>
            <span>
              {fmt(hover.value)}
              {unit}
            </span>
          </div>
        )}
        <svg
          className="chart chart-motion"
          viewBox={`0 0 ${w} ${h}`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((tick, i) => {
            const ty = y(tick);
            return (
              <g key={i}>
                <line
                  x1={left}
                  x2={w - right}
                  y1={ty}
                  y2={ty}
                  className="econ-grid"
                />
                <text x={left - 10} y={ty + 4} textAnchor="end">
                  {fmt(tick)}
                  {unit}
                </text>
              </g>
            );
          })}
          <line
            x1={left}
            x2={left}
            y1={top}
            y2={h - bottom}
            className="econ-axis"
          />
          <line
            x1={left}
            x2={w - right}
            y1={h - bottom}
            y2={h - bottom}
            className="econ-axis"
          />
          {usable.map((p, i) => (
            <text
              key={`${p.label}-x`}
              textAnchor="end"
              className="econ-x-label"
              transform={`translate(${x(i)} ${h - bottom + 14}) rotate(-90)`}
            >
              {p.label}
            </text>
          ))}
          {fields.map((f) => {
            const color = colors[fields.indexOf(f)],
              shown = visible.includes(f);
            return (
              <g
                key={isMulti ? f : "primary"}
                data-series={f}
                opacity={shown ? 1 : 0}
                className="econ-series"
              >
                <path
                  className="line"
                  d={path(f)}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {usable.map((p, i) => {
                  const v = p[f];
                  return typeof v === "number" ? (
                    <circle
                      key={isMulti ? `${f}-${p.label}` : p.label}
                      cx={x(i)}
                      cy={y(v)}
                      r="7"
                      fill="transparent"
                      stroke="transparent"
                      pointerEvents={shown ? "all" : "none"}
                      onMouseEnter={() =>
                        setHover({
                          x: x(i),
                          y: y(v),
                          label: p.label,
                          value: v,
                          color,
                        })
                      }
                    >
                      <title>
                        {p.label}: {fmt(v)}
                        {unit}
                      </title>
                    </circle>
                  ) : null;
                })}
              </g>
            );
          })}
        </svg>
      </div>
      {temporal.controls}
      <p className="econ-caption">{usable.length} períodos visibles.</p>
    </div>
  );
}
function Bars({ items }: { items: { label: string; value: number | null }[] }) {
  const max = Math.max(...items.map((x) => Math.abs(x.value ?? 0)), 1);
  return (
    <div className="econ-bars">
      {items.map((x) => {
        const value = x.value ?? 0,
          negative = value < 0,
          width = (Math.abs(value) / max) * 50;
        return (
          <div
            className={`econ-bar ${negative ? "is-negative" : "is-positive"}`}
            key={x.label}
          >
            <span>{x.label}</span>
            <div className="econ-bar-track">
              <i
                style={{
                  width: `${width}%`,
                  [negative ? "right" : "left"]: "50%",
                }}
              />
            </div>
            <b>{fmt(x.value)}%</b>
          </div>
        );
      })}
    </div>
  );
}

function IndustryDetail({ divisions }: { divisions: any[] }) {
  const valid = divisions.filter(
    (d) => typeof d.annual === "number" && Number.isFinite(d.annual),
  );
  const rises = [...valid]
    .filter((d) => d.annual > 0)
    .sort((a, b) => b.annual - a.annual)
    .slice(0, 3);
  const falls = [...valid]
    .filter((d) => d.annual < 0)
    .sort((a, b) => a.annual - b.annual)
    .slice(0, 3);
  const code = (label: string) =>
    label.split(":")[0].replace("División", "Div.");
  const name = (label: string) =>
    label.includes(":") ? label.slice(label.indexOf(":") + 1).trim() : label;
  const sentence = (items: any[]) =>
    items.map((d, i) => (
      <span key={d.label}>
        {i > 0 && (i === items.length - 1 ? " y " : ", ")}
        <strong>{code(d.label)}</strong> ({fmt(d.annual)}%)
      </span>
    ));
  return (
    <>
      <section className="wrap econ-story reverse">
        <article>
          <span className="eyebrow">Detalle por división</span>
          <h2>La industria no se mueve como un bloque</h2>
          <p>
            Las mayores variaciones positivas fueron {sentence(rises)}. En
            contraste, las tres caídas más pronunciadas correspondieron a{" "}
            {sentence(falls)}. Esta dispersión muestra que el resultado agregado
            combina trayectorias sectoriales muy distintas.
          </p>
        </article>
        <Bars
          items={divisions.map((d) => ({
            label: code(d.label),
            value: d.annual,
          }))}
        />
      </section>
      <section className="wrap industry-glossary">
        <div className="section-title">
          <span className="eyebrow">Glosario</span>
          <h2>Descripción de las divisiones industriales</h2>
          <p>
            Clasificación y glosas contenidas en el cuadro estadístico oficial.
          </p>
        </div>
        <div className="industry-glossary-grid">
          {divisions.map((d) => (
            <article key={d.label}>
              <b>{code(d.label)}</b>
              <p>{name(d.label)}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function CommercePage({
  data,
  onNavigate,
}: {
  data: any;
  onNavigate: (value: string) => void;
}) {
  const [division, setDivision] = useState("general"),
    [product, setProduct] = useState("Línea 1.1"),
    [goodsMetric, setGoodsMetric] = useState("annual");
  const metrics = {
    monthly: "Variación mensual (%)",
    annual: "Variación en 12 meses (%)",
    accumulated: "Variación acumulada (%)",
  } as const;
  const selectedDivision = data.divisions[division],
    selectedProduct =
      data.products[product] ?? (Object.values(data.products)[0] as any);
  const latest = selectedDivision.series.at(-1),
    seasonalLatest = data.seasonal.at(-1),
    durableLatest = data.goods.durable.series.at(-1),
    nonDurableLatest = data.goods.nonDurable.series.at(-1);
  const movement = (value: number) => (value >= 0 ? "aumentó" : "disminuyó");
  return (
    <main className="economic-page commerce-page">
      <SectionHeader
        current="commerce"
        onNavigate={(destination) => onNavigate(destination)}
      />
      <section className="births-hero wrap econ-hero">
        <div>
          <span className="eyebrow">SERVICIOS · COMERCIO</span>
          <h1>
            ÍNDICE DE ACTIVIDAD
            <br />
            DEL COMERCIO
          </h1>
          <p>Resultados a precios constantes, base promedio año 2018=100.</p>
        </div>
        <div className="period-box">
          <span>Último dato disponible</span>
          <strong>{monthName(latest)}</strong>
        </div>
      </section>
      <section className="wrap econ-kpis">
        <article>
          <span>Variación mensual</span>
          <strong>{fmt(data.divisions.general.series.at(-1).monthly)}%</strong>
          <p>Respecto del mes anterior</p>
        </article>
        <article>
          <span>Variación en 12 meses</span>
          <strong>{fmt(data.divisions.general.series.at(-1).annual)}%</strong>
          <p>Respecto de igual mes del año anterior</p>
        </article>
        <article>
          <span>Variación acumulada</span>
          <strong>
            {fmt(data.divisions.general.series.at(-1).accumulated)}%
          </strong>
          <p>Desde enero hasta el último período</p>
        </article>
      </section>
      <section className="wrap econ-story">
        <article>
          <span className="eyebrow">Serie original</span>
          <h2>El pulso reciente del comercio</h2>
          <p>
            En {monthName(latest)}, {selectedDivision.label.toLowerCase()}{" "}
            {movement(latest.annual)} {fmt(Math.abs(latest.annual))}% en doce
            meses y acumuló una variación de {fmt(latest.accumulated)}% en el
            año.
          </p>
          <p>
            La comparación entre divisiones permite distinguir si el movimiento
            proviene del comercio automotor, mayorista o minorista.
          </p>
        </article>
        <div>
          <label className="econ-select">
            Actividad
            <select
              value={division}
              onChange={(event) => setDivision(event.target.value)}
            >
              {Object.entries(data.divisions).map(([id, item]: any) => (
                <option value={id} key={id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <Spark
            series={selectedDivision.series}
            fields={["monthly", "annual", "accumulated"]}
            labels={Object.values(metrics)}
            unit="%"
          />
        </div>
      </section>
      <section className="commerce-band">
        <div className="wrap econ-story reverse">
          <article>
            <span className="eyebrow">Serie desestacionalizada</span>
            <h2>La señal mensual sin patrones estacionales</h2>
            <p>
              El IACM desestacionalizado registró una variación mensual de{" "}
              {fmt(seasonalLatest.monthly)}% y una variación interanual de{" "}
              {fmt(seasonalLatest.annual)}%.
            </p>
            <p>
              Al remover efectos estacionales y de calendario, esta serie
              entrega una lectura más limpia del impulso coyuntural.
            </p>
          </article>
          <Spark
            series={data.seasonal}
            fields={["monthly", "annual", "accumulated"]}
            labels={Object.values(metrics)}
            unit="%"
          />
        </div>
      </section>
      <section className="wrap econ-story">
        <article>
          <span className="eyebrow">Tendencia-ciclo</span>
          <h2>El ritmo subyacente del comercio</h2>
          <p>
            La variación mensual anualizada de la tendencia-ciclo fue{" "}
            {fmt(seasonalLatest.trendAnnualized)}%. Esta medida proyecta a doce
            meses el ritmo mensual subyacente y puede amplificar cambios
            recientes.
          </p>
          <p>
            La tendencia-ciclo suaviza la volatilidad irregular y ayuda a
            identificar aceleraciones o desaceleraciones persistentes. Sus
            últimos valores pueden revisarse al incorporar nueva información.
          </p>
        </article>
        <Spark
          series={data.seasonal}
          fields={["trendAnnualized"]}
          labels={["Variación mensual anualizada de la tendencia-ciclo"]}
          unit="%"
        />
      </section>
      <section className="commerce-band">
        <div className="wrap econ-story reverse">
          <article>
            <span className="eyebrow">Análisis a nivel de productos</span>
            <h2>Qué productos están moviendo el comercio minorista</h2>
            <p>
              En {monthName(selectedProduct.series.at(-1))},{" "}
              {selectedProduct.label.toLowerCase()} presentó una variación
              mensual de {fmt(selectedProduct.series.at(-1).monthly)}%, anual de{" "}
              {fmt(selectedProduct.series.at(-1).annual)}% y acumulada de{" "}
              {fmt(selectedProduct.series.at(-1).accumulated)}%.
            </p>
            <p>
              Las tres variaciones se calculan desde los índices oficiales
              publicados en la hoja 3.
            </p>
          </article>
          <div>
            <label className="econ-select">
              Producto
              <select
                value={product}
                onChange={(event) => setProduct(event.target.value)}
              >
                {Object.entries(data.products).map(([id, item]: any) => (
                  <option value={id} key={id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <Spark
              series={selectedProduct.series}
              fields={["monthly", "annual", "accumulated"]}
              labels={Object.values(metrics)}
              unit="%"
            />
          </div>
        </div>
      </section>
      <section className="wrap econ-story">
        <article>
          <span className="eyebrow">Bienes durables y no durables</span>
          <h2>Dos patrones de consumo distintos</h2>
          <p>
            Los bienes durables variaron {fmt(durableLatest.annual)}% en doce
            meses. Por su mayor valor y posibilidad de postergar la compra,
            suelen reaccionar con más intensidad al crédito, las tasas de
            interés y las expectativas.
          </p>
          <p>
            Los bienes no durables variaron {fmt(nonDurableLatest.annual)}%. Al
            incluir bienes de rotación frecuente, reflejan un consumo más
            recurrente, aunque también responden al ingreso real y a los precios
            relativos.
          </p>
        </article>
        <div>
          <label className="econ-select">
            Indicador
            <select
              value={goodsMetric}
              onChange={(event) => setGoodsMetric(event.target.value)}
            >
              {Object.entries(metrics).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Spark
            series={data.goods.durable.series.map(
              (point: any, index: number) => ({
                ...point,
                durable: point[goodsMetric],
                nonDurable: data.goods.nonDurable.series[index]?.[goodsMetric],
              }),
            )}
            fields={["durable", "nonDurable"]}
            labels={["Bienes durables", "Bienes no durables"]}
            unit="%"
          />
        </div>
      </section>
      <section className="resources">
        <div className="wrap econ-source">
          <span className="eyebrow">Fuente oficial</span>
          <h2>Series históricas del Índice de Actividad del Comercio</h2>
          <p>
            La página verifica si cambió el archivo oficial. Si no cambió,
            reutiliza la caché compartida; cuando cambia, procesa y almacena la
            nueva versión.
          </p>
          <a className="birth-download" href={data.source?.url}>
            Descargar planilla oficial ↗
          </a>
        </div>
      </section>
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>Información estadística para una mejor comprensión de Chile.</p>
        </div>
      </footer>
    </main>
  );
}

export default function EconomicPage({
  kind,
  onNavigate,
}: {
  kind: Kind;
  onNavigate: (v: string) => void;
}) {
  const [data, setData] = useState<any>(() =>
      kind === "commerce" ? peekDataset("commerce") : fallbackData[kind],
    ),
    [cacheReady, setCacheReady] = useState(false),
    [error, setError] = useState(""),
    [metric, setMetric] = useState(kind === "permits" ? "value" : "index");
  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      setData(
        kind === "commerce" ? peekDataset("commerce") : fallbackData[kind],
      );
      setError("");
      setMetric(kind === "permits" ? "value" : "index");
    });
    const initialRequest =
      kind === "commerce"
        ? primeDataset<any>("commerce")
        : fetch(`/api/economic-data?kind=${kind}`, { cache: "no-store" }).then(
            async (response) => {
              const payload = await response.json();
              if (!response.ok) throw new Error(payload.error);
              return payload;
            },
          );
    initialRequest
      .then(async (initial) => {
        if (!alive) return;
        setData(initial);
        setCacheReady(true);
        if (kind === "commerce") {
          const refreshed = await refreshDataset<any>("commerce");
          if (alive && refreshed) setData(refreshed);
        }
      })
      .catch(() => {
        /* La copia local queda como respaldo si la caché pública no responde. */
        setCacheReady(true);
      });
    return () => {
      alive = false;
    };
  }, [kind]);
  const series: Point[] = useMemo(
    () =>
      data
        ? kind === "permits"
          ? data.surface.total
          : kind === "commerce"
            ? []
            : data.main
        : [],
    [data, kind],
  );
  if (!cacheReady)
    return (
      <main className="data-loading" aria-busy="true">
        Cargando datos oficiales…
      </main>
    );
  const latest = series.at(-1);
  if (kind === "commerce")
    return data ? (
      <CommercePage data={data} onNavigate={onNavigate} />
    ) : (
      <main
        className="economic-page cache-ready-placeholder"
        aria-hidden="true"
      />
    );
  const title = info[kind];
  const annual = latest?.annual;
  const value = kind === "permits" ? latest?.value : latest?.index;
  const metricOptions =
    kind === "permits"
      ? [
          ["value", "Superficie"],
          ["annual", "Variación anual"],
          ["accumulated", "Variación acumulada"],
        ]
      : [
          ["index", "Índice original"],
          ["annual", "Variación anual"],
          ["monthly", "Variación mensual"],
          ["accumulated", "Variación acumulada"],
          ["seasonal", "Desestacionalizado"],
          ["trend", "Tendencia-ciclo"],
        ];
  const chartUnit =
    metric.includes("annual") ||
    metric.includes("monthly") ||
    metric === "accumulated"
      ? "%"
      : kind === "permits"
        ? " m²"
        : "";
  const source = data?.source;
  return (
    <main className="economic-page">
      <SectionHeader
        current={kind as SiteDestination}
        onNavigate={(destination) => onNavigate(destination)}
      />
      <section className="births-hero wrap econ-hero product-hero">
        <div>
          <span className="eyebrow">{title.eyebrow}</span>
          <h1>{title.title}</h1>
          <p>{title.intro}</p>
        </div>
        <div className="period-box">
          <span>Último dato disponible</span>
          <strong>{monthName(latest)}</strong>
          {source?.cache === "updated" ? (
            <small>Fuente actualizada</small>
          ) : source?.cache === "stale" ? (
            <small>Última versión almacenada</small>
          ) : null}
        </div>
      </section>
      {error ? (
        <section className="wrap econ-status">
          <h2>No pudimos cargar la serie</h2>
          <p>{error}. Intenta nuevamente en unos momentos.</p>
        </section>
      ) : !data ? (
        <section className="wrap econ-status">
          <p>Verificando la última planilla oficial y preparando los datos…</p>
        </section>
      ) : (
        <>
          <section className="wrap econ-kpis">
            <article>
              <span>
                {kind === "permits" ? "Superficie Total" : "Índice / nivel"}
              </span>
              <strong>{fmt(value, kind === "permits" ? 0 : 1)}</strong>
              <p>{kind === "permits" ? "Metros²" : monthName(latest)}</p>
            </article>
            <article>
              <span>Variación anual</span>
              <strong>{fmt(annual)}%</strong>
              <p>{changeWord(annual)} respecto de doce meses atrás</p>
            </article>
            <article>
              <span>
                {kind === "permits"
                  ? "Variación acumulada"
                  : "Variación mensual"}
              </span>
              <strong>
                {fmt(
                  kind === "permits" ? latest?.accumulated : latest?.monthly,
                )}
                %
              </strong>
              <p>
                {kind === "permits"
                  ? `Enero a ${new Intl.DateTimeFormat("es-CL", { month: "long" }).format(new Date(latest!.year, latest!.month - 1, 1))} respecto del año anterior`
                  : "Respecto del mes anterior"}
              </p>
            </article>
          </section>
          <section className="wrap econ-story">
            <article>
              <span className="eyebrow">Evolución reciente</span>
              <h2>
                {kind === "energy"
                  ? "La energía sostiene un avance moderado"
                  : kind === "industry"
                    ? "La actividad industrial refleja movimientos heterogéneos"
                    : "Los permisos muestran el pulso de la edificación"}
              </h2>
              <p>
                En {monthName(latest)}, el indicador {changeWord(annual)}{" "}
                {fmt(Math.abs(Number(annual)))}% en doce meses. La ventana de 25
                meses permite separar un movimiento puntual de una trayectoria
                persistente.
              </p>
              <p>
                {kind === "industry"
                  ? "La serie desestacionalizada facilita la comparación mensual, mientras la tendencia-ciclo suaviza las oscilaciones de corto plazo."
                  : kind === "energy"
                    ? "Electricidad, gas y agua no necesariamente se mueven en la misma dirección; su contribución explica el resultado agregado."
                    : "La superficie autorizada debe leerse como una señal anticipada y no como construcción efectivamente ejecutada."}
              </p>
            </article>
            <div>
              <label className="econ-select">
                Indicador
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  {metricOptions.map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <Spark
                series={series}
                fields={[metric]}
                labels={[
                  metricOptions.find((x) => x[0] === metric)?.[1] ?? metric,
                ]}
                unit={chartUnit}
              />
            </div>
          </section>
          {kind === "energy" && (
            <section className="wrap econ-story reverse">
              <article>
                <span className="eyebrow">Composición sectorial</span>
                <h2>Tres servicios, un resultado agregado</h2>
                <p>
                  La electricidad registra{" "}
                  {fmt(data.sectors.electricity.at(-1)?.annual)}% anual, el gas{" "}
                  {fmt(data.sectors.gas.at(-1)?.annual)}% y el agua{" "}
                  {fmt(data.sectors.water.at(-1)?.annual)}%. La comparación
                  revela qué componente empuja o contiene el índice.
                </p>
              </article>
              <Bars
                items={[
                  {
                    label: "Electricidad",
                    value: data.sectors.electricity.at(-1)?.annual,
                  },
                  { label: "Gas", value: data.sectors.gas.at(-1)?.annual },
                  { label: "Agua", value: data.sectors.water.at(-1)?.annual },
                ]}
              />
            </section>
          )}
          {kind === "industry" && <IndustryDetail divisions={data.divisions} />}
          {kind === "permits" && (
            <section className="wrap econ-story reverse">
              <article>
                <span className="eyebrow">Destino de la superficie</span>
                <h2>Vivienda y usos no habitacionales</h2>
                <p>
                  En el último mes, la superficie para vivienda fue{" "}
                  {fmt(data.surface.housing.at(-1)?.value, 0)} m² y la no
                  habitacional {fmt(data.surface.nonHousing.at(-1)?.value, 0)}{" "}
                  m². Su lectura conjunta evita que un solo destino oculte
                  cambios en la composición.
                </p>
              </article>
              <Spark
                series={data.composition}
                fields={[
                  "newHousing",
                  "extensions",
                  "industryCommerce",
                  "services",
                ]}
                labels={[
                  "Vivienda nueva",
                  "Ampliaciones",
                  "Industria/comercio",
                  "Servicios",
                ]}
                unit=" m²"
              />
            </section>
          )}
          <section className="resources">
            <div className="wrap econ-source">
              <span className="eyebrow">Fuente oficial</span>
              <h2>
                Series estadísticas del Instituto Nacional de Estadísticas
              </h2>
              <p>
                La página verifica en cada carga la ruta, fecha y versión de la
                planilla. Si no cambió, reutiliza la copia compartida; si
                cambió, procesa y guarda la nueva publicación.
              </p>
              <a className="birth-download" href={source?.url}>
                Descargar planilla oficial ↗
              </a>
            </div>
          </section>
        </>
      )}
      <footer>
        <div className="wrap">
          <div className="brand inverse">
            <IneLogo inverse />
            <b>Instituto Nacional de Estadísticas</b>
          </div>
          <p>Información estadística para una mejor comprensión de Chile.</p>
          <a href="https://www.ine.gob.cl/estadisticas-por-tema/industria-energia-y-construccion">
            Fuente oficial: ine.gob.cl ↗
          </a>
        </div>
      </footer>
    </main>
  );
}
