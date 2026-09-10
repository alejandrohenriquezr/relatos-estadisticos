from pathlib import Path

path = Path(".github/workflows/ci.yml")
text = path.read_text()
old = '''      # El análisis estático queda temporalmente informativo mientras se
      # resuelven las observaciones heredadas documentadas en TECHNICAL_DEBT.md.
      - name: Auditar lint
        continue-on-error: true
        run: npm run lint'''
new = '''      # El análisis estático es una condición obligatoria del CI.
      - name: Auditar lint
        run: npm run lint'''
if old not in text:
    raise SystemExit("No se encontró el bloque informativo de lint en ci.yml")
path.write_text(text.replace(old, new, 1))
