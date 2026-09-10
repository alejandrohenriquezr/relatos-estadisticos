import { NextRequest, NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";

const table = `CREATE TABLE IF NOT EXISTS statistical_operation_config (operation TEXT PRIMARY KEY, label TEXT NOT NULL, analysis TEXT NOT NULL DEFAULT 'on', publications TEXT NOT NULL DEFAULT 'off', documentation TEXT NOT NULL DEFAULT 'off', databases TEXT NOT NULL DEFAULT 'off', resources TEXT NOT NULL DEFAULT 'off', updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`;

export async function PUT(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json(
      { error: "Se requiere una sesión autenticada para modificar el CMS." },
      { status: 401 },
    );
  }

  const database = (
    globalThis as typeof globalThis & { __SITES_DB?: D1Database }
  ).__SITES_DB;
  if (!database) {
    return NextResponse.json(
      { error: "La base de datos D1 del CMS no está disponible en este despliegue." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const operation = String(body.operation ?? "");
    const label = String(body.label ?? operation);
    if (!operation) {
      return NextResponse.json({ error: "Operación inválida" }, { status: 400 });
    }

    await database.prepare(table).run();
    const onOff = (key: string, fallback: boolean) =>
      body[key] === undefined
        ? fallback
          ? "on"
          : "off"
        : body[key]
          ? "on"
          : "off";
    const now = new Date().toISOString();

    await database
      .prepare(
        "INSERT INTO statistical_operation_config (operation,label,analysis,publications,documentation,databases,resources,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(operation) DO UPDATE SET label=excluded.label,analysis=excluded.analysis,publications=excluded.publications,documentation=excluded.documentation,databases=excluded.databases,resources=excluded.resources,updated_at=excluded.updated_at,updated_by=excluded.updated_by",
      )
      .bind(
        operation,
        label,
        onOff("analysis", true),
        onOff("publications", false),
        onOff("documentation", false),
        onOff("databases", false),
        onOff("resources", false),
        now,
        user.email,
      )
      .run();

    return NextResponse.json({ ok: true, operation, updatedAt: now });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error de persistencia en D1",
      },
      { status: 500 },
    );
  }
}
