---
name: drawdb
description: >
  Design and manipulate database schemas as DrawDB diagrams through the drawdb MCP server.
  Use for: designing a database schema / ERD, generating SQL (MySQL, PostgreSQL, SQL Server,
  SQLite, MariaDB, Oracle, Snowflake) from a diagram, converting SQL between dialects,
  turning existing SQL or DBML into a diagram, rendering a schema as Mermaid or Markdown
  docs, or reverse-engineering a live Snowflake schema into a diagram.
  Trigger when the user mentions DrawDB, an ERD, "database schema", "generate SQL from",
  "convert this schema to <dialect>", "diagram this database", or "introspect Snowflake".
---

# DrawDB schema diagramming

The `drawdb` MCP server operates on a single JSON **document** describing a database
diagram. Full model and per-tool signatures are in the server's `AGENTS.md`; this skill is
the how-to.

## Prerequisite

The `drawdb` MCP server must be registered (see `mcp/README.md`). If its tools
(`create_document`, `render_sql`, …) aren't available, tell the user to register it first.

## The one rule

The server is **stateless**. Every tool takes a `document` and returns an updated
`document` (with `warnings`, and `id` for `add_*`). **Thread the returned `document` into
the next call** — never reuse the pre-call copy, or you lose edits.

IDs are strings the server mints; capture the `id` from `add_table` / `add_field` before
referencing them in `add_reference`.

## Recipes

**Design a schema from scratch**
1. `create_document(database)` — e.g. `"postgresql"` or `"snowflake"`.
2. `add_table(document, name, fields)` per table; keep each returned `document` and `id`.
3. `add_reference(document, { startTableId, startFieldId, endTableId, endFieldId })` for FKs
   (start = child/FK side, end = parent/PK side).
4. `render_sql(document)` for the DDL, or `render_mermaid` / `render_documentation`.

**Convert SQL between dialects**
`import_sql(sql, sourceDialect)` → take its `document` → `render_sql(document, targetDialect)`.

**Diagram existing SQL or DBML**
`import_sql(sql, dialect)` or `import_dbml(dbml)` → `render_mermaid(document)` to show it,
or `auto_arrange(document)` first for a tidy layout.

**Reverse-engineer a live Snowflake schema**
`snowflake_schema_to_diagram({ account, username, password, warehouse, database, schema })`
→ returns a `document` → render or edit it. Credentials are used once and never stored;
ask the user for them, don't invent them.

## Reading results

Each tool returns JSON in `content[0].text`. Parse it, use `document`, and surface any
non-empty `warnings` (dangling references, a type not valid for the dialect, duplicate ids)
to the user — they're advisory, not fatal.
