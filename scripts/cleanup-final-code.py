from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, replacement: str, label: str, flags=re.S) -> str:
    result, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return result


# app/page.tsx: corrige únicamente observaciones de lint, sin tocar los valores ENE.
page = Path("app/page.tsx")
text = page.read_text()
text = replace_once(
    text,
    '"use client";\n\nimport {',
    '"use client";\n\nimport Link from "next/link";\nimport {',
    "import Link",
)
text = sub_once(
    text,
    r'<a\s+className="relatos-home-link"\s+href="/"\s+aria-label="Ir al inicio de Relatos Estadísticos"\s*>(.*?)</a>',
    r'<Link className="relatos-home-link" href="/" aria-label="Ir al inicio de Relatos Estadísticos">\1</Link>',
    "logo interno",
)
text = sub_once(
    text,
    r"function useChartTween<T>\(value: T, key: string, duration = 520\) \{.*?\n\}\n\n// Mantiene las abreviaturas",
    """function useChartTween<T>(value: T, key: string, duration = 520) {
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

// Mantiene las abreviaturas""",
    "useChartTween",
)
text = sub_once(
    text,
    r"\n\s*useEffect\(\(\) => \{\s*setRangeStart\(Math\.max\(0, available\.length - defaultLength\)\);\s*setRangeEnd\(Math\.max\(0, available\.length - 1\)\);\s*\}, \[available\.length, defaultLength\]\);",
    "",
    "effect rango IPP",
)
text = replace_once(
    text,
    "  const visibleStart = !customRange ? quickStart : rangeStart;",
    "  const visibleStart = !customRange\n    ? quickStart\n    : Math.min(rangeStart, Math.max(0, available.length - 1));",
    "clamp rango IPP",
)
text = sub_once(
    text,
    r'if \(\(refreshed as any\)\.cache\?\.status === "updated"\) apply\(refreshed\);',
    'if ((refreshed as { cache?: { status?: string } }).cache?.status === "updated") apply(refreshed);',
    "tipo IPP refresh",
    flags=0,
)
text = replace_once(
    text,
    "    setDisplayYear(data[0].year);\n    const timer = setInterval(",
    "    const timer = setInterval(",
    "reproducción nacimientos effect",
)
text = sub_once(
    text,
    r"onClick=\{\(\) => setPlaying\(\(value\) => !value\)\}",
    """onClick={() => {
              if (playing) setPlaying(false);
              else {
                setDisplayYear(data[0].year);
                setPlaying(true);
              }
            }}""",
    "reproducción nacimientos botón",
    flags=0,
)
text = sub_once(
    text,
    r'\s*useEffect\(\(\) => \{\s*const next = data\.metadata\.find\(\(item\) => item\.theme === theme\)!;\s*setVariable\(next\.variable\);\s*setRegion\("TOTAL NACIONAL"\);\s*setGroup\("Total"\);\s*\}, \[theme, data\.metadata\]\);\s*useEffect\(\(\) => \{\s*setRegion\("TOTAL NACIONAL"\);\s*setGroup\("Total"\);\s*\}, \[variable\]\);',
    "",
    "effects ENUSC",
)
text = sub_once(
    text,
    r"onChange=\{\(event\) => setTheme\(event\.target\.value\)\}",
    """onChange={(event) => {
              const nextTheme = event.target.value;
              const next = data.metadata.find((item) => item.theme === nextTheme)!;
              setTheme(nextTheme);
              setVariable(next.variable);
              setRegion("TOTAL NACIONAL");
              setGroup("Total");
            }}""",
    "selector tema ENUSC",
    flags=0,
)
text = sub_once(
    text,
    r"onChange=\{\(event\) => setVariable\(event\.target\.value\)\}",
    """onChange={(event) => {
              setVariable(event.target.value);
              setRegion("TOTAL NACIONAL");
              setGroup("Total");
            }}""",
    "selector indicador ENUSC",
    flags=0,
)
# El snapshot ENE puede existir sin series complementarias; todas esas colecciones son opcionales.
text = replace_once(
    text,
    "data?.seasonal.findIndex((p) => p.year === year && p.quarter === quarter) ??",
    "data?.seasonal?.findIndex((p) => p.year === year && p.quarter === quarter) ??",
    "seasonal opcional ENE",
)
text = replace_once(
    text,
    "data?.sectorContributions.find(",
    "data?.sectorContributions?.find(",
    "sectores opcionales ENE",
)
text = replace_once(
    text,
    "data?.categoryContributions.find(",
    "data?.categoryContributions?.find(",
    "categorías opcionales ENE",
)
text = replace_once(
    text,
    "const absent = data?.absentEmployment.find(",
    "const absent = data?.absentEmployment?.find(",
    "ausentes opcional ENE",
)
page.write_text(text)

# EconomicPage: difiere las actualizaciones iniciales del effect un microtask,
# preservando la invalidación mediante la bandera alive.
economic = Path("app/EconomicPage.tsx")
text = economic.read_text()
text = sub_once(
    text,
    r'useEffect\(\(\) => \{\s*let alive = true;\s*setData\(kind === "commerce" \? peekDataset\("commerce"\) : fallbackData\[kind\]\);\s*setError\(""\);\s*setMetric\(kind === "permits" \? "value" : "index"\);\s*const initialRequest =',
    """useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      setData(kind === "commerce" ? peekDataset("commerce") : fallbackData[kind]);
      setError("");
      setMetric(kind === "permits" ? "value" : "index");
    });
    const initialRequest =""",
    "EconomicPage effect",
)
economic.write_text(text)

# SDMX: la forma dinámica es deliberada y se documenta en el punto exacto.
for filename in ["lib/labor-sdmx.ts", "lib/price-sdmx.ts"]:
    path = Path(filename)
    source = path.read_text()
    source = replace_once(
        source,
        "type AnyRecord = Record<string, any>;",
        "// El payload normalizado reúne estructuras heterogéneas de varias operaciones.\n// eslint-disable-next-line @typescript-eslint/no-explicit-any\ntype AnyRecord = Record<string, any>;",
        filename,
    )
    path.write_text(source)

# El bundle XLSX es un tercero vendorizado; no corresponde analizarlo como fuente propia.
eslint = Path("eslint.config.mjs")
source = eslint.read_text()
source = replace_once(
    source,
    '    "build/**",\n    "next-env.d.ts",',
    '    "build/**",\n    "public/worker/vendor/**",\n    "next-env.d.ts",',
    "ignorar vendor",
)
eslint.write_text(source)
