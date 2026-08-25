# drawdb-mcp

An MCP server exposing [DrawDB](https://drawdb.app)'s database-diagramming features to any
MCP-capable coding agent: schema editing, SQL / DBML / Mermaid / documentation rendering,
SQL / DBML import, and live Snowflake schema introspection — headless, no browser required.

Built on `@modelcontextprotocol/server` v2 (MCP spec `2026-07-28`). Serves both the new
stateless protocol and legacy 2025-era clients from one server.

## Install

```bash
cd mcp
npm install
npm run bundle   # generates src/generated/drawdb-core.mjs from DrawDB's source
```

`npm test` runs the same bundle step automatically (`pretest`).

## Run

```bash
# stdio (default) — for local agents (Claude Code, Codex, Cursor, …)
node bin/drawdb-mcp.mjs --stdio

# Streamable HTTP — for remote / serverless clients (binds 127.0.0.1)
node bin/drawdb-mcp.mjs --http --port 8787
```

Both transports expose the same 25 tools and negotiate protocol era automatically.

## Register with a coding agent

Use the **absolute** path to `bin/drawdb-mcp.mjs`. Replace `/ABS/PATH` below with the
output of `cd mcp && node -e "console.log(process.cwd()+'/bin/drawdb-mcp.mjs')"`.

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
    "drawdb": { "command": "node", "args": ["/ABS/PATH/bin/drawdb-mcp.mjs", "--stdio"] }
  }
}
```

### Remote / HTTP clients
Run `node bin/drawdb-mcp.mjs --http --port 8787` and register the URL
`http://127.0.0.1:8787/` (or wherever you deploy it) as a Streamable HTTP MCP server.

## Transport / tool matrix

| Registration | Transport | Protocol | Tools |
| --- | --- | --- | --- |
| Local (Claude, Codex, Cursor, …) | stdio | both eras (negotiated) | all 25 |
| Remote / serverless | Streamable HTTP | both eras (negotiated) | all 25 |

## Tools

See [`AGENTS.md`](./AGENTS.md) for the full document model, the workflow, and every tool's
signature. In short: **document CRUD** (tables, fields, references, indices, notes, areas,
types, enums), **render** (SQL / DBML / Mermaid / documentation), **import** (SQL / DBML),
`auto_arrange`, and `snowflake_schema_to_diagram`.

## How it works

The server reuses DrawDB's own feature modules (`src/utils/exportSQL`, `importSQL`,
`exportAs/*`, `dbml`, `src/data/datatypes`) via an esbuild bundle
(`scripts/bundle-core.mjs`), so SQL generation, parsing, and type handling stay identical
to the app. Everything operates on the canonical diagram document — the same object DrawDB
saves as `.ddb` — so files the server produces open directly in DrawDB.

## Development

```bash
npm test    # bundles core, then runs vitest (unit + tool + introspection tests)
```
