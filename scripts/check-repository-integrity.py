#!/usr/bin/env python3
"""Valida que los archivos versionados tengan un formato básico coherente.

El control detecta texto no UTF-8 en extensiones que deben ser texto y firmas
incorrectas en XLSX/PDF. Se usa en CI para evitar que una sincronización
vuelva a introducir archivos dañados.
"""
from pathlib import Path
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

        if path.suffix.lower() in TEXT_EXTENSIONS:
            try:
                data.decode("utf-8")
            except UnicodeDecodeError as exc:
                errors.append(f"TEXT_NOT_UTF8 {rel}: {exc}")

        if path.suffix.lower() == ".xlsx" and not data.startswith(b"PK\x03\x04"):
            errors.append(f"INVALID_XLSX_SIGNATURE {rel}")

        if path.suffix.lower() == ".pdf" and not data.startswith(b"%PDF-"):
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
