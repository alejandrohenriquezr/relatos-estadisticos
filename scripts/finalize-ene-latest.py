from pathlib import Path
import re


def sub_once(text: str, pattern: str, replacement: str, label: str, flags=re.S) -> str:
    result, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return result


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


path = Path("app/page.tsx")
text = path.read_text()

# La copia local versionada es la única fuente inicial. El último período se
# deriva de sus series, por lo que una regeneración futura no exige editar TSX.
text = sub_once(
    text,
    r"const latest: Record<string, Point> = \{.*?\n\};\n\nfunction Icon",
    """const initialEne = rawData as EneData;
const latest: Record<string, Point> = {
  Total: initialEne.series.Total.at(-1)!,
  Mujeres: initialEne.series.Mujeres.at(-1)!,
  Hombres: initialEne.series.Hombres.at(-1)!,
};

function Icon""",
    "latest ENE dinámico",
)

# Ya no se inyecta un trimestre fijo cuando la API todavía no respondió: el
# snapshot local contiene la serie completa validada.
text = sub_once(
    text,
    r"    \} else \{\n      Object\.keys\(latest\)\.forEach\(\(k\) => \{\n        if \(\n          !d\.series\[k\]\.some\(\(p\) => p\.year === 2026 && p\.quarter === \"Mar - May\"\)\n        \)\n          d\.series\[k\]\.push\(latest\[k\]\);\n      \}\);\n    \}",
    "    }",
    "inyección ENE obsoleta",
)

text = replace_once(
    text,
    '  const [year, setYear] = useState(2026);\n  const [quarter, setQuarter] = useState("Mar - May");',
    "  const [year, setYear] = useState(latest.Total.year);\n  const [quarter, setQuarter] = useState(latest.Total.quarter);",
    "período inicial ENE",
)

path.write_text(text)
