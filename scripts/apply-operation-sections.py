from pathlib import Path


path = Path("app/page.tsx")
text = path.read_text(encoding="utf-8")

import_line = 'import { primeDataset, type PrefetchKey } from "../lib/client-data-prefetch";\n'
new_import = import_line + 'import { useOperationSections } from "./OperationSections";\n'

if 'import { useOperationSections } from "./OperationSections";' not in text:
    if text.count(import_line) != 1:
        raise SystemExit("No se encontró de forma única el punto de importación del controlador CMS")
    text = text.replace(import_line, new_import, 1)

state_anchor = '''    | "businessDemography"
  >("home");
  const [pricesOpen, setPricesOpen] = useState(false);'''
state_replacement = '''    | "businessDemography"
  >("home");
  useOperationSections(view);
  const [pricesOpen, setPricesOpen] = useState(false);'''

if "useOperationSections(view);" not in text:
    if text.count(state_anchor) != 1:
        raise SystemExit("No se encontró de forma única el estado de navegación principal")
    text = text.replace(state_anchor, state_replacement, 1)

if text.count('import { useOperationSections } from "./OperationSections";') != 1:
    raise SystemExit("La importación del controlador CMS quedó duplicada")
if text.count("useOperationSections(view);") != 1:
    raise SystemExit("La activación del controlador CMS quedó duplicada")

path.write_text(text, encoding="utf-8")
print("Integración CMS aplicada a app/page.tsx")
