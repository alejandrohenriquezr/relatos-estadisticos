import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import {
  defaults,
  rowToConfig,
  type OperationConfig,
} from "../../../../lib/operation-config";
import OperationEditor from "./OperationEditor";

const table = `CREATE TABLE IF NOT EXISTS statistical_operation_config (operation TEXT PRIMARY KEY, label TEXT NOT NULL, analysis TEXT NOT NULL DEFAULT 'on', publications TEXT NOT NULL DEFAULT 'off', documentation TEXT NOT NULL DEFAULT 'off', databases TEXT NOT NULL DEFAULT 'off', resources TEXT NOT NULL DEFAULT 'off', updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`;

async function loadConfig(operation: string): Promise<OperationConfig | null> {
  const fallback = defaults().find((item) => item.operation === operation);
  if (!fallback) return null;

  const database = (
    globalThis as typeof globalThis & { __SITES_DB?: D1Database }
  ).__SITES_DB;
  if (!database) return fallback;

  try {
    await database.prepare(table).run();
    const row = await database
      .prepare("SELECT * FROM statistical_operation_config WHERE operation = ?")
      .bind(operation)
      .first<Record<string, unknown>>();
    return row ? rowToConfig(row) : fallback;
  } catch {
    // El editor sigue operativo con los valores iniciales si D1 no responde.
    return fallback;
  }
}

export default async function OperationAdminPage({
  params,
}: {
  params: Promise<{ operation: string }>;
}) {
  await requireChatGPTUser("/admin");
  const { operation } = await params;
  const config = await loadConfig(operation);
  if (!config) notFound();

  return (
    <main className="admin-shell">
      <a href="/admin">← Volver al CMS</a>
      <h1>{config.label}</h1>
      <p>
        Define las secciones que el administrador editorial puede publicar para
        esta operación.
      </p>
      <OperationEditor config={config} />
    </main>
  );
}
