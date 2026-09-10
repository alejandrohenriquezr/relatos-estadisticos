"use client";

import { useEffect } from "react";
import type { OperationConfig } from "../lib/operation-config";
import styles from "./OperationSections.module.css";

type SectionKey =
  | "analysis"
  | "publications"
  | "documentation"
  | "databases"
  | "resources";

type SectionDefinition = {
  key: SectionKey;
  label: string;
  description: string;
  patterns: RegExp[];
};

const SECTIONS: SectionDefinition[] = [
  {
    key: "analysis",
    label: "Análisis",
    description: "Análisis interactivo de los resultados de la operación.",
    patterns: [],
  },
  {
    key: "publications",
    label: "Publicaciones",
    description: "Boletines, informes, separatas y otras publicaciones disponibles.",
    patterns: [/bolet/i, /publicaci/i, /informe/i, /separata/i, /\.pdf(?:$|\?)/i],
  },
  {
    key: "documentation",
    label: "Documentación",
    description: "Metodologías, fichas técnicas, conceptos y documentación de referencia.",
    patterns: [/metodolog/i, /ficha/i, /document/i, /manual/i, /concept/i, /calidad/i],
  },
  {
    key: "databases",
    label: "Bases de datos",
    description: "Bases, microdatos y archivos de datos disponibles para descarga.",
    patterns: [/microdato/i, /base de dato/i, /\.csv(?:$|\?)/i, /\.dta(?:$|\?)/i, /stata/i],
  },
  {
    key: "resources",
    label: "Centro de recursos",
    description: "Cuadros estadísticos, planillas, API, SDMX y otros recursos de consulta.",
    patterns: [/cuadro/i, /excel/i, /xlsx/i, /xls/i, /sdmx/i, /api/i, /recurso/i],
  },
];

const managedSelector = "[data-operation-sections-ui='true']";

function enabledSections(config: OperationConfig) {
  return SECTIONS.filter((section) => Boolean(config[section.key]));
}

function restoreAnalysis(main: HTMLElement) {
  Array.from(main.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    if (child.matches(managedSelector) || child.tagName === "HEADER") return;
    if (child.dataset.operationPreviousHidden !== undefined) {
      child.hidden = child.dataset.operationPreviousHidden === "true";
      delete child.dataset.operationPreviousHidden;
    }
  });
}

function hideAnalysis(main: HTMLElement) {
  Array.from(main.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    if (child.matches(managedSelector) || child.tagName === "HEADER") return;
    if (child.dataset.operationPreviousHidden === undefined) {
      child.dataset.operationPreviousHidden = String(child.hidden);
    }
    child.hidden = true;
  });
}

function normalizedAnchorText(anchor: HTMLAnchorElement) {
  return `${anchor.textContent ?? ""} ${anchor.href}`.replace(/\s+/g, " ").trim();
}

function resourcesFor(main: HTMLElement, section: SectionDefinition) {
  if (section.key === "analysis") return [];
  const seen = new Set<string>();
  return Array.from(main.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .filter((anchor) => !anchor.closest(managedSelector))
    .filter((anchor) => section.patterns.some((pattern) => pattern.test(normalizedAnchorText(anchor))))
    .filter((anchor) => {
      const key = anchor.href;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 18);
}

function officialSource(main: HTMLElement) {
  return (
    main.querySelector<HTMLAnchorElement>(
      "a[href*='ine.gob.cl/estadisticas-por-tema']",
    )?.href ?? "https://www.ine.gob.cl/estadisticas-por-tema"
  );
}

function buildPanel(
  main: HTMLElement,
  config: OperationConfig,
  section: SectionDefinition,
) {
  const panel = document.createElement("section");
  panel.dataset.operationSectionsUi = "true";
  panel.className = styles.panel;
  panel.setAttribute("aria-live", "polite");

  const wrap = document.createElement("div");
  wrap.className = styles.wrap;
  const eyebrow = document.createElement("span");
  eyebrow.className = styles.eyebrow;
  eyebrow.textContent = config.label;
  const heading = document.createElement("h2");
  heading.textContent = section.label;
  const description = document.createElement("p");
  description.className = styles.description;
  description.textContent = section.description;
  wrap.append(eyebrow, heading, description);

  const resources = resourcesFor(main, section);
  if (resources.length) {
    const grid = document.createElement("div");
    grid.className = styles.grid;
    resources.forEach((source) => {
      const link = document.createElement("a");
      link.className = styles.card;
      link.href = source.href;
      link.target = source.target || "_blank";
      link.rel = "noreferrer";
      const title = document.createElement("strong");
      title.textContent = source.textContent?.trim() || "Abrir recurso";
      const host = document.createElement("small");
      try {
        host.textContent = new URL(source.href).hostname;
      } catch {
        host.textContent = "Recurso asociado";
      }
      link.append(title, host);
      grid.append(link);
    });
    wrap.append(grid);
  } else {
    const empty = document.createElement("div");
    empty.className = styles.empty;
    const text = document.createElement("p");
    text.textContent =
      "Esta sección está habilitada en el CMS, pero la revisión versionada no contiene recursos adicionales clasificados para esta categoría.";
    const link = document.createElement("a");
    link.href = officialSource(main);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Consultar la fuente oficial del INE";
    empty.append(text, link);
    wrap.append(empty);
  }

  panel.append(wrap);
  return panel;
}

function insertAfterHeader(main: HTMLElement, element: HTMLElement) {
  const header = Array.from(main.children).find(
    (child) => child instanceof HTMLElement && child.tagName === "HEADER",
  );
  if (header) header.insertAdjacentElement("afterend", element);
  else main.prepend(element);
}

export function useOperationSections(operation: string) {
  useEffect(() => {
    let cancelled = false;
    let main: HTMLElement | null = null;

    const clean = () => {
      if (main) restoreAnalysis(main);
      document.querySelectorAll(managedSelector).forEach((node) => node.remove());
    };

    if (operation === "home") {
      clean();
      return clean;
    }

    const mount = async () => {
      try {
        const response = await fetch("/api/operation-config", { cache: "no-store" });
        if (!response.ok) return;
        const configs = (await response.json()) as OperationConfig[];
        if (cancelled) return;
        const config = configs.find((item) => item.operation === operation);
        if (!config) return;

        main = document.querySelector<HTMLElement>("main");
        if (!main) return;
        clean();

        const enabled = enabledSections(config);
        if (!enabled.length || (enabled.length === 1 && enabled[0].key === "analysis")) {
          return;
        }

        const panels = new Map<SectionKey, HTMLElement>();
        enabled
          .filter((section) => section.key !== "analysis")
          .forEach((section) => {
            const panel = buildPanel(main!, config, section);
            panel.hidden = true;
            panels.set(section.key, panel);
            main!.append(panel);
          });

        const activate = (section: SectionDefinition) => {
          if (!main) return;
          const showingAnalysis = section.key === "analysis";
          if (showingAnalysis) restoreAnalysis(main);
          else hideAnalysis(main);
          panels.forEach((panel, key) => {
            panel.hidden = key !== section.key;
          });
          document
            .querySelectorAll<HTMLButtonElement>(
              `${managedSelector} button[data-section]`,
            )
            .forEach((button) => {
              const active = button.dataset.section === section.key;
              button.classList.toggle(styles.active, active);
              button.setAttribute("aria-selected", String(active));
            });
          window.scrollTo({ top: 0, behavior: "smooth" });
        };

        if (enabled.length >= 2) {
          const tabs = document.createElement("nav");
          tabs.dataset.operationSectionsUi = "true";
          tabs.className = styles.tabs;
          tabs.setAttribute("aria-label", `Secciones de ${config.label}`);
          tabs.setAttribute("role", "tablist");
          const inner = document.createElement("div");
          inner.className = styles.tabsInner;
          enabled.forEach((section) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.section = section.key;
            button.setAttribute("role", "tab");
            button.textContent = section.label;
            button.addEventListener("click", () => activate(section));
            inner.append(button);
          });
          tabs.append(inner);
          insertAfterHeader(main, tabs);
        }

        const initial =
          enabled.find((section) => section.key === "analysis") ?? enabled[0];
        activate(initial);
      } catch {
        // Una falla del CMS nunca debe impedir mostrar el análisis versionado.
      }
    };

    const frame = window.requestAnimationFrame(() => void mount());
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      clean();
    };
  }, [operation]);
}
