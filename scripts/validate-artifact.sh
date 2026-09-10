#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.js"
hosting="${SITES_PROJECT_ROOT}/dist/.openai/hosting.json"
migrations_dir="${SITES_PROJECT_ROOT}/dist/.openai/drizzle"

[[ -f "${worker}" ]] || {
  echo "Missing Sites Worker entry: dist/server/index.js" >&2
  exit 66
}
[[ -f "${hosting}" ]] || {
  echo "Missing packaged Sites manifest: dist/.openai/hosting.json" >&2
  exit 66
}

# Si el proyecto declara migraciones Drizzle, el artefacto Sites debe llevarlas.
# Esto evita builds válidos que luego no puedan reconstruir el esquema D1.
if compgen -G "${SITES_PROJECT_ROOT}/drizzle/*.sql" >/dev/null; then
  [[ -d "${migrations_dir}" ]] || {
    echo "Missing packaged D1 migrations: dist/.openai/drizzle" >&2
    exit 66
  }

  for source_migration in "${SITES_PROJECT_ROOT}"/drizzle/*.sql; do
    migration_name="$(basename "${source_migration}")"
    [[ -f "${migrations_dir}/${migration_name}" ]] || {
      echo "Missing packaged D1 migration: dist/.openai/drizzle/${migration_name}" >&2
      exit 66
    }
  done
fi

node --input-type=module - "${worker}" "${hosting}" <<'NODE'
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const [workerPath, hostingPath] = process.argv.slice(2);
JSON.parse(await readFile(hostingPath, "utf8"));

const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
}
NODE

echo "Validated Sites artifact: Worker, hosting manifest and D1 migrations are present."
