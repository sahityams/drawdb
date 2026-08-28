# drawdb-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI coding
agents the full power of [DrawDB](https://drawdb.app) — design database schemas, generate
and convert SQL, import existing SQL/DBML, render ERDs, and reverse‑engineer a live
Snowflake database — all headless, with no browser.

It reuses DrawDB's own engine, so SQL/DBML/Mermaid output is identical to the app, and the
documents it produces open directly in DrawDB.

---

## Features

- **Full schema editing** — create and modify tables, fields, foreign keys, indices,
  notes, areas, custom types, and enums.
- **SQL generation, every dialect** — MySQL, PostgreSQL, SQL Server, SQLite, MariaDB,
  Oracle, **Snowflake**, and a generic dialect. Convert a schema from one dialect to
  another in two calls.
- **Import** — turn existing SQL or DBML into a diagram.
- **Render** — DBML, Mermaid ERD, and Markdown documentation.
- **Live Snowflake introspection** — connect to a Snowflake schema and get a diagram back.
- **Any harness** — Claude Code, Claude Desktop, Codex CLI, Cursor, Windsurf, or any
  MCP‑capable client, over stdio or HTTP.
- **Dual protocol** — one server speaks both the new stateless MCP spec (`2026-07-28`) and
  older 2025‑era clients; the SDK negotiates automatically.

---

## Requirements

- **Node.js ≥ 20** (developed on Node 24)
- npm

---

## Setup

Clone the repository and install — that's it. Installing runs a build step that bundles
DrawDB's engine for Node, so the server is ready to run immediately:

```bash
git clone <this-repo-url> drawdb
cd drawdb/mcp
npm install
```

> `npm install` automatically runs `npm run bundle`, which generates
> `src/generated/drawdb-core.mjs`. If you ever need to regenerate it by hand (e.g. after
> changing DrawDB's source), run `npm run bundle`.

Verify it works:

```bash
npm test        # runs the full test suite
npm start       # starts the server on stdio (Ctrl-C to stop)
```

---

## Connect it to your agent

Every registration points at the same launcher, `bin/drawdb-mcp.mjs`, and needs its
**absolute path**. Print it once:

```bash
node -e "console.log(require('path').resolve('bin/drawdb-mcp.mjs'))"
```

Use that path (shown as `/ABS/PATH/bin/drawdb-mcp.mjs` below) in whichever client you use.

### Claude Code

```bash
claude mcp add -s user drawdb -- node /ABS/PATH/bin/drawdb-mcp.mjs --stdio
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "drawdb": {
      "command": "node",
      "args": ["/ABS/PATH/bin/drawdb-mcp.mjs", "--stdio"]
    }
  }
}
```

### Codex CLI

```bash
codex mcp add drawdb -- node /ABS/PATH/bin/drawdb-mcp.mjs --stdio
```

or in `~/.codex/config.toml`:

```toml
[mcp_servers.drawdb]
command = "node"
args = ["/ABS/PATH/bin/drawdb-mcp.mjs", "--stdio"]
```

### Cursor / Windsurf / other stdio MCP clients

Point the client's MCP config at the stdio command:

```json
{
  "mcpServers": {
    "drawdb": {
      "command": "node",
      "args": ["/ABS/PATH/bin/drawdb-mcp.mjs", "--stdio"]
    }
  }
}
```

### Remote / HTTP clients

Start the server over HTTP and register its URL as a Streamable HTTP MCP server:

```bash
node bin/drawdb-mcp.mjs --http --port 8787
# then register http://127.0.0.1:8787/
```

After registering, restart or reload your client so it picks up the new server. You should
see tools named `create_document`, `render_sql`, `snowflake_schema_to_diagram`, etc.

---

## Using it

The server is **stateless**: every tool takes a `document` (a JSON diagram) and returns an
updated one. You thread the returned document into the next call. IDs are strings the
server generates; `add_*` tools return the new id.

A typical flow, in plain terms:

1. **Start** a document — `create_document`, or `import_sql` / `import_dbml` /
   `snowflake_schema_to_diagram` to begin from something that already exists.
2. **Edit** it — `add_table`, `add_field`, `add_reference`, `set_database`, … Each call
   returns `{ document, warnings }` (validation warnings are advisory).
3. **Output** it — `render_sql` (any dialect), `render_dbml`, `render_mermaid`,
   `render_documentation`.

**Example prompts** you can give an agent once the server is connected:

- "Design a Postgres schema for a blog with users, posts, and comments, then show me the SQL."
- "Convert this MySQL schema to Snowflake." *(paste the SQL)*
- "Import this DDL and render it as a Mermaid ERD." *(paste the SQL)*
- "Introspect the `ANALYTICS` schema on our Snowflake account and diagram it."

The full document model and every tool signature are in **[`AGENTS.md`](./AGENTS.md)**.

---

## Tools

25 tools in four groups. See [`AGENTS.md`](./AGENTS.md) for exact parameters.

| Group | Tools |
| --- | --- |
| **Document CRUD** | `create_document`, `get_document`, `validate_document`, `set_database`, `add_table`, `update_table`, `remove_table`, `add_field`, `update_field`, `remove_field`, `add_reference`, `remove_reference`, `add_index`, `add_note`, `add_area`, `add_type`, `add_enum` |
| **Render** | `render_sql`, `render_dbml`, `render_mermaid`, `render_documentation` |
| **Import / layout** | `import_sql`, `import_dbml`, `auto_arrange` |
| **Snowflake** | `snowflake_schema_to_diagram` |

---

## Transports & protocol

| Command | Transport | Best for |
| --- | --- | --- |
| `--stdio` *(default)* | stdio | Local agents — Claude Code, Codex, Cursor, Windsurf |
| `--http --port N` | Streamable HTTP (binds `127.0.0.1`) | Remote / HTTP‑capable clients |

Both transports expose the same 25 tools and serve **both** the `2026-07-28` stateless
protocol and legacy 2025‑era clients — the client and server negotiate which to use, so you
don't have to configure it.

---

## How it works

```
your agent ──MCP──▶ drawdb-mcp ──▶ DrawDB engine (bundled)
                        │
              operates on one JSON "document"
              (the same object DrawDB saves as .ddb)
```

DrawDB's feature modules (`src/utils/exportSQL`, `importSQL`, `exportAs/*`, `dbml`,
`src/data/datatypes`) are browser ESM that plain Node can't import directly. The build step
`scripts/bundle-core.mjs` bundles them for Node with esbuild (stubbing the browser‑only
`i18n`/asset imports), producing `src/generated/drawdb-core.mjs`. The tools call that
bundle, so SQL, DBML, and type handling are identical to the DrawDB app — and any document
the server emits opens directly in DrawDB.

---

## Project layout

```
mcp/
├── bin/drawdb-mcp.mjs        # launcher (--stdio | --http)
├── src/
│   ├── server.mjs            # builds the McpServer, registers tools
│   ├── core-entry.mjs        # re-exports the DrawDB modules to bundle
│   ├── generated/            # built bundle (git-ignored)
│   ├── stubs/                # minimal i18n / databases stubs for Node
│   ├── doc/model.mjs         # document shape, validation, id minting
│   ├── tools/                # document, feature, and snowflake tools
│   └── snowflake/            # introspection (pure builder + driver client)
├── scripts/bundle-core.mjs   # esbuild build of the DrawDB engine
├── test/                     # vitest suites
├── AGENTS.md                 # document model + tool reference (for agents)
└── README.md
```

---

## Development

```bash
npm run bundle   # regenerate the DrawDB engine bundle
npm test         # bundle, then run the vitest suites
npm start        # run the server on stdio
```

Tests cover the SQL dialects, the document model and validation, the bundled engine, every
tool, and Snowflake introspection (the driver is mocked — no live account needed).

---

## Troubleshooting

- **Tools don't appear in the client** — confirm the registration uses the **absolute**
  path to `bin/drawdb-mcp.mjs`, then fully restart/reload the client.
- **`Cannot find module .../src/generated/drawdb-core.mjs`** — the bundle wasn't built. Run
  `npm run bundle` (it also runs automatically on `npm install` and `npm test`).
- **`snowflake_schema_to_diagram` fails to connect** — check the account/warehouse/database
  and credentials you passed; they're used only for that call and never stored.
- **Importing hand‑written Snowflake SQL fails to parse** — the underlying parser doesn't
  support a few Snowflake constructs (e.g. `VARIANT`/`OBJECT`/`ARRAY` columns, `AUTOINCREMENT`,
  `CHECK`). Export of those is still valid Snowflake DDL; only re‑import is limited.
