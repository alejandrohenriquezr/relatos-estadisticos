"use client";

import { useState } from "react";

export type TemporalPreset = {
  value: number | "all";
  label: string;
};

type TemporalChartControlsProps = {
  labels: string[];
  start: number;
  end: number;
  preset: number | "all" | "custom";
  presets: TemporalPreset[];
  onPreset: (value: number | "all") => void;
  onStart: (value: number) => void;
  onEnd: (value: number) => void;
  onCustom: () => void;
};

// Centraliza los tres niveles de lectura temporal para que todos los gráficos
// mantengan la misma jerarquía, accesibilidad y lenguaje visual.
export function TemporalChartControls({
  labels,
  start,
  end,
  preset,
  presets,
  onPreset,
  onStart,
  onEnd,
  onCustom,
}: TemporalChartControlsProps) {
  const safeStart = Math.min(start, Math.max(0, labels.length - 1));
  const safeEnd = Math.min(end, Math.max(0, labels.length - 1));
  return (
    <div className="ipp-time-levels chart-time-levels">
      <div className="ipp-time-reading">
        <span>Lectura actual</span>
        <strong>
          {labels[safeStart] || "Sin datos"} — {labels[safeEnd] || "Sin datos"}
        </strong>
        <small>{Math.max(0, safeEnd - safeStart + 1)} períodos visibles</small>
      </div>
      <div className="ipp-time-quick" aria-label="Rangos históricos rápidos">
        <span>Ampliar período</span>
        <div>
          {presets.map((item) => (
            <button
              type="button"
              key={String(item.value)}
              aria-pressed={preset === item.value}
              onClick={() => onPreset(item.value)}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={preset === "custom"}
            onClick={onCustom}
          >
            Elegir fechas
          </button>
        </div>
      </div>
      {preset === "custom" && (
        <div className="ipp-time-custom">
          <label>
            Desde
            <select
              value={safeStart}
              onChange={(event) => onStart(Number(event.target.value))}
            >
              {labels.map((label, index) => (
                <option key={`${label}-${index}`} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hasta
            <select
              value={safeEnd}
              onChange={(event) => onEnd(Number(event.target.value))}
            >
              {labels.map((label, index) => (
                <option key={`${label}-${index}`} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

// Gestiona la ventana visible sin modificar la serie original. Los rangos
// rápidos siempre terminan en el dato más reciente disponible. Los límites
// efectivos se derivan durante el render para que un cambio de largo de la
// serie no requiera un segundo render sincronizado desde un effect.
export function useTemporalWindow<T>(
  items: T[],
  labels: string[],
  presets: TemporalPreset[],
  initial: number,
) {
  const [preset, setPreset] = useState<number | "all" | "custom">(initial);
  const [customStart, setCustomStart] = useState(Math.max(0, items.length - initial));
  const [customEnd, setCustomEnd] = useState(Math.max(0, items.length - 1));
  const lastIndex = Math.max(0, items.length - 1);
  const quickCount = preset === "all" ? items.length : typeof preset === "number" ? preset : items.length;
  const start =
    preset === "custom"
      ? Math.min(customStart, lastIndex)
      : Math.max(0, items.length - quickCount);
  const end = preset === "custom" ? Math.min(customEnd, lastIndex) : lastIndex;

  const choosePreset = (value: number | "all") => setPreset(value);
  const chooseStart = (value: number) => {
    setPreset("custom");
    setCustomStart(value);
    if (value > end) setCustomEnd(value);
  };
  const chooseEnd = (value: number) => {
    setPreset("custom");
    setCustomEnd(value);
    if (value < start) setCustomStart(value);
  };

  return {
    start,
    end,
    visible: items.slice(start, end + 1),
    controls: (
      <TemporalChartControls
        labels={labels}
        start={start}
        end={end}
        preset={preset}
        presets={presets}
        onPreset={choosePreset}
        onStart={chooseStart}
        onEnd={chooseEnd}
        onCustom={() => setPreset("custom")}
      />
    ),
  };
}
