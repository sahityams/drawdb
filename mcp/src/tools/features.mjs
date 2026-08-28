import sqlParser from "node-sql-parser";
import { z } from "zod";
import {
  arrangeTables,
  exportSQL,
  fromDBML,
  importSQL,
  jsonToDocumentation,
  jsonToMermaid,
  toDBML,
} from "../generated/drawdb-core.mjs";
import { emptyDoc, validateDoc } from "../doc/model.mjs";

const { Parser } = sqlParser;
const DocumentInputSchema = z.record(z.any());

function cloneDoc(document) {
  return structuredClone(document);
}

function relationshipsAdapter(document) {
  return {
    ...document,
    relationships: document.references ?? [],
    subjectAreas: document.areas ?? [],
    enums: document.enums ?? [],
    types: document.types ?? [],
  };
}

function canonicalDocument(result, database) {
  const {
    relationships,
    references,
    areas,
    notes,
    enums,
    types,
    ...rest
  } = result ?? {};
  return {
    ...emptyDoc(database),
    ...rest,
    database,
    references: relationships ?? references ?? [],
    notes: notes ?? [],
    areas: areas ?? [],
    enums: enums ?? [],
    types: types ?? [],
  };
}

function withWarnings(document) {
  return {
    document,
    warnings: validateDoc(document).warnings,
  };
}

export function renderSql({ document, dialect }) {
  return {
    sql: exportSQL({
      ...document,
      database: dialect ?? document.database,
    }),
  };
}

export function renderDbml({ document }) {
  return {
    dbml: toDBML(relationshipsAdapter(document)),
  };
}

export function renderMermaid({ document }) {
  return {
    mermaid: jsonToMermaid(relationshipsAdapter(document)),
  };
}

export function renderDocumentation({ document }) {
  return {
    markdown: jsonToDocumentation(relationshipsAdapter(document)),
  };
}

export function importSql({ sql, dialect }) {
  const parser = new Parser();
  const ast = parser.astify(sql, { database: dialect });
  const imported = importSQL(ast, dialect, dialect);
  return withWarnings(canonicalDocument(imported, dialect));
}

export function importDbml({ dbml, database = "generic" }) {
  const imported = fromDBML(dbml, database);
  return withWarnings(canonicalDocument(imported, database));
}

export function autoArrange({ document }) {
  const next = cloneDoc(document);
  arrangeTables(next);
  return { document: next };
}

function toolResult(result) {
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
}

function registerJsonTool(server, name, description, inputSchema, handler) {
  server.registerTool(name, { description, inputSchema }, async (args) =>
    toolResult(handler(args)),
  );
}

export function registerFeatureTools(server) {
  registerJsonTool(
    server,
    "render_sql",
    "Render a DrawDB document as SQL.",
    z.object({
      document: DocumentInputSchema,
      dialect: z.string().optional(),
    }),
    renderSql,
  );
  registerJsonTool(
    server,
    "render_dbml",
    "Render a DrawDB document as DBML.",
    z.object({ document: DocumentInputSchema }),
    renderDbml,
  );
  registerJsonTool(
    server,
    "render_mermaid",
    "Render a DrawDB document as Mermaid ERD text.",
    z.object({ document: DocumentInputSchema }),
    renderMermaid,
  );
  registerJsonTool(
    server,
    "render_documentation",
    "Render a DrawDB document as Markdown documentation.",
    z.object({ document: DocumentInputSchema }),
    renderDocumentation,
  );
  registerJsonTool(
    server,
    "import_sql",
    "Import SQL into a canonical DrawDB document.",
    z.object({
      sql: z.string(),
      dialect: z.string(),
    }),
    importSql,
  );
  registerJsonTool(
    server,
    "import_dbml",
    "Import DBML into a canonical DrawDB document.",
    z.object({
      dbml: z.string(),
      database: z.string().optional(),
    }),
    importDbml,
  );
  registerJsonTool(
    server,
    "auto_arrange",
    "Auto-arrange tables in a DrawDB document.",
    z.object({ document: DocumentInputSchema }),
    autoArrange,
  );
}
