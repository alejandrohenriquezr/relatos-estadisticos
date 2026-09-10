#!/usr/bin/env python3
"""Valida la integridad básica de los archivos versionados.

Detecta texto no UTF-8, JSON inválido, HTML sin estructura reconocible y
firmas incorrectas de XLSX/PDF. El objetivo es impedir que una sincronización
de archivos vuelva a introducir contenido binario o texto recodificado.
"""
from pathlib import Path
import json
import subprocess
import sys

TEXT_EXTENSIONS = {
    ".css", ".csv", ".html", ".js", ".json", ".md", ".mjs", ".py",
    ".ts", ".tsx", ".txt", ".xml", ".yml", ".yaml",
}
SKIP_PREFIXES = ("node_modules/", ".git/", "dist/", ".next/")


def tracked_files() -> list[Path]:
    """Obtiene únicamente archivos controlados por Git."""
    output = subprocess.check_output(["git", "ls-files", "-z"])
    return [Path(item.decode("utf-8")) for item in output.split(b"\0") if item]


def main() -> int:
    errors: list[str] = []
    checked = 0

    for path in tracked_files():
        rel = path.as_posix()
        if rel.startswith(SKIP_PREFIXES) or not path.is_file():
            continue
        checked += 1
        data = path.read_bytes()
        suffix = path.suffix.lower()
        text: str | None = None

        if suffix in TEXT_EXTENSIONS:
            try:
                text = data.decode("utf-8")
            except UnicodeDecodeError as exc:
                errors.append(f"TEXT_NOT_UTF8 {rel}: {exc}")
                continue

        if suffix == ".json" and text is not None:
            try:
                json.loads(text)
            except json.JSONDecodeError as exc:
                errors.append(f"INVALID_JSON {rel}: line {exc.lineno}, column {exc.colno}: {exc.msg}")

        if suffix == ".html" and text is not None:
            head = text.lstrip().lower()[:1000]
            if not (head.startswith("<!doctype html") or head.startswith("<html")):
                errors.append(f"INVALID_HTML_HEADER {rel}")

        if suffix == ".xlsx" and not data.startswith(b"PK\x03\x04"):
            errors.append(f"INVALID_XLSX_SIGNATURE {rel}")

        if suffix == ".pdf" and not data.startswith(b"%PDF-"):
            errors.append(f"INVALID_PDF_SIGNATURE {rel}")

    print(f"Archivos versionados revisados: {checked}")
    if errors:
        print("Errores de integridad:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Integridad básica: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
