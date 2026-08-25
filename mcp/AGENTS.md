# DrawDB MCP server

An MCP server that exposes DrawDB's full database-diagramming feature set — schema
editing, SQL/DBML/Mermaid/documentation rendering, SQL/DBML import, and live Snowflake
introspection — to any MCP-capable coding agent. It is headless: it operates on a plain
**diagram document**, so no browser is required.

## Core concept: the document

Every tool operates on one JSON **document** with this shape:

```json
{
  "database": "snowflake",
  "title": "My schema",
  "tables": [
    {
      "id": "<nanoid>", "name": "users", "comment": "",
      "fields": [
        { "id": "<nanoid>", "name": "id", "type": "NUMBER",
          "primary": true, "unique": false, "notNull": true, "increment": false,
          "default": "", "check": "", "comment": "", "size": "" }
      ],
      "indices": [], "uniqueConstraints": []
    }
  ],
  "references": [
    { "id": "<nanoid>", "name": "fk_orders_user", "startTableId": "<orders id>",
      "startFieldId": "<orders.user_id id>", "endTableId": "<users id>",
      "endFieldId": "<users.id id>",
      "fields": [{ "startFieldId": "<...>", "endFieldId": "<...>" }],
      "updateConstraint": "No action", "deleteConstraint": "Cascade",
      "cardinality": "many_to_one" }
  ],
  "notes": [], "areas": [], "pan": { "x": 0, "y": 0 }, "zoom": 1,
  "enums": [], "types": []
}
```

Key facts:
- **IDs are strings** (`nanoid`), never integers. `add_*` tools mint the id and return it.
- Foreign keys live in **`references`** (not `relationships`). A reference links
  `startTable`/`startField` (the child/FK side) to `endTable`/`endField` (the parent/PK side).
- The document is **stateless between calls**: pass it in, get the updated document back,
  pass that into the next call. The server keeps no session.
- `database` is one of: `mysql`, `postgresql`, `transactsql`, `sqlite`, `mariadb`,
  `oraclesql`, `snowflake`, `generic`.

## Workflow

1. **Start** — `create_document` (empty) or `import_sql` / `import_dbml` /
   `snowflake_schema_to_diagram` (from existing SQL, DBML, or a live Snowflake schema).
   Each returns a full document.
2. **Mutate** — feed the document into `add_table`, `add_field`, `add_reference`,
   `set_database`, etc. Each returns `{ document, warnings }` (and `id` for `add_*`).
   `warnings` come from validation — dangling references, unknown types for the dialect,
   duplicate ids. Carry the returned `document` forward; don't reuse the pre-call copy.
3. **Emit** — `render_sql` (any dialect), `render_dbml`, `render_mermaid`,
   `render_documentation`, or `validate_document`.

Always thread the returned `document` into the next tool call — the server does not
remember it for you.

## Tools

### Document CRUD
- `create_document(database?)` → `{ document }`
- `get_document(document)` → `{ document }`
- `validate_document(document)` → `{ ok, warnings }`
- `set_database(document, database)`
- `add_table(document, name, x?, y?, fields?)` → `{ document, warnings, id }`
- `update_table(document, tableId, patch)`
- `remove_table(document, tableId)` — also drops references touching it
- `add_field(document, tableId, field)` → `{ document, warnings, id }`
- `update_field(document, tableId, fieldId, patch)`
- `remove_field(document, tableId, fieldId)` — also drops references touching it
- `add_reference(document, ref)` — `ref` has `startTableId/startFieldId/endTableId/endFieldId`, optional `name/cardinality/updateConstraint/deleteConstraint`
- `remove_reference(document, referenceId)`
- `add_index(document, tableId, index)`
- `add_note` / `add_area` / `add_type` / `add_enum(document, ...)`

### Render / import / convert
- `render_sql(document, dialect?)` → `{ sql }` — dialect defaults to `document.database`; pass any dialect to convert
- `render_dbml(document)` → `{ dbml }`
- `render_mermaid(document)` → `{ mermaid }`
- `render_documentation(document)` → `{ markdown }`
- `import_sql(sql, dialect)` → `{ document, warnings }`
- `import_dbml(dbml, database?)` → `{ document, warnings }`
- `auto_arrange(document)` → `{ document }` — lays out table positions

### Snowflake
- `snowflake_schema_to_diagram({ account, username, password?, authenticator?, warehouse?, database, schema, role? })` → `{ document, warnings }` — connects, reads `INFORMATION_SCHEMA`, returns a canonical document. Credentials are used for the single call and never stored.

## Notes for agents
- Tool results are returned as JSON text in `content[0].text`. Parse it, read `document`
  and `warnings`, and pass `document` to the next call.
- To convert dialects: `import_sql(sql, "postgresql")` then `render_sql(document, "snowflake")`.
- Non-empty `warnings` are advisory, not fatal — the document is still returned.
