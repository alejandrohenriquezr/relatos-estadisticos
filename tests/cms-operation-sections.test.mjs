import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const occurrences = (text, token) => text.split(token).length - 1;

test("la aplicación consume la configuración de secciones del CMS", () => {
  const page = read("app/page.tsx");
  const sections = read("app/OperationSections.tsx");

  assert.equal(
    occurrences(
      page,
      'import { useOperationSections } from "./OperationSections";',
    ),
    1,
  );
  assert.equal(occurrences(page, "useOperationSections(view);"), 1);
  assert.match(sections, /fetch\("\/api\/operation-config"/);
  assert.match(sections, /enabled\.length >= 2/);
  assert.match(sections, /Análisis/);
  assert.match(sections, /Publicaciones/);
  assert.match(sections, /Documentación/);
  assert.match(sections, /Bases de datos/);
  assert.match(sections, /Centro de recursos/);
});

test("el editor recupera la revisión persistida en D1", () => {
  const editorPage = read("app/admin/operations/[operation]/page.tsx");

  assert.match(editorPage, /rowToConfig/);
  assert.match(
    editorPage,
    /SELECT \* FROM statistical_operation_config WHERE operation = \?/,
  );
  assert.match(editorPage, /return row \? rowToConfig\(row\) : fallback/);
});

test("la escritura del CMS exige identidad y registra al usuario", () => {
  const route = read("app/api/admin/operations/route.ts");

  assert.match(route, /getChatGPTUser/);
  assert.match(route, /if \(!user\)/);
  assert.match(route, /status: 401/);
  assert.match(route, /user\.email/);
  assert.doesNotMatch(route, /site-owner/);
});
