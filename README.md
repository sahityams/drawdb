<div align="center">
    <img width="64" alt="drawdb logo" src="./src/assets/icon-dark.png">
    <h1>drawDB</h1>
</div>

<h3 align="center">Free, simple, and intuitive database schema editor and SQL generator.</h3>

<div align="center" style="margin-bottom:12px;">
    <a href="https://drawdb.app/" style="display: flex; align-items: center;">
        <img src="https://img.shields.io/badge/Start%20building-grey" alt="drawDB"/>
    </a>
    <a href="https://discord.gg/BrjZgNrmR6" style="display: flex; align-items: center;">
        <img src="https://img.shields.io/discord/1196658537208758412.svg?label=Join%20the%20Discord&logo=discord" alt="Discord"/>
    </a>
    <a href="https://x.com/drawDB_" style="display: flex; align-items: center;">
        <img src="https://img.shields.io/badge/Follow%20us%20on%20X-blue?logo=X" alt="Follow us on X"/>
    </a>
    <a href="https://getmanta.ai/drawdb">
        <img src="https://getmanta.ai/api/badges?text=Manta%20Graph&link=drawdb" alt="DrawDB graph on Manta">
    </a> 
</div>

<h3 align="center"><img width="700" style="border-radius:5px;" alt="demo" src="drawdb.png"></h3>

DrawDB is a robust and user-friendly database entity relationship (DBER) editor right in your browser. Build diagrams with a few clicks, export sql scripts, customize your editor, and more without creating an account. See the full set of features [here](https://drawdb.app/).

## Getting Started

### Local Development

```bash
git clone https://github.com/drawdb-io/drawdb
cd drawdb
npm install
npm run dev
```

### Build

```bash
git clone https://github.com/drawdb-io/drawdb
cd drawdb
npm install
npm run build
```

### Docker Build

```bash
docker build -t drawdb .
docker run -p 3000:80 drawdb
```

If you want to enable sharing, set up the [server](https://github.com/drawdb-io/drawdb-server) and environment variables according to `.env.sample`. This is optional unless you need to share files.

### Docker Build with Local Bridge

To build with the Claude Code local bridge enabled:

```bash
docker build --build-arg VITE_LOCAL_BRIDGE=true -t drawdb .
docker run -p 3000:80 -v ./diagram_state.json:/usr/share/nginx/html/diagram_state.json drawdb
```

Mount `diagram_state.json` as a volume so external tools (Claude Code, MCP) can write to it and the app picks up changes automatically.

## Snowflake Database

Added Snowflake support for DrawDB. Design schemas using all native Snowflake types — `VARIANT`, `OBJECT`, `ARRAY`, `TIMESTAMP_NTZ`, `GEOGRAPHY`, and more. Import existing Snowflake DDL or export your diagram as production-ready Snowflake SQL.

## AI-Assisted Schema Design

DrawDB can be driven programmatically by AI agents like [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Describe a schema in natural language and watch it render in real time.

### Local Bridge

The local bridge lets external tools update the diagram by writing to a single JSON file. The editor polls for changes and renders them automatically.

1. Add `VITE_LOCAL_BRIDGE=true` to your `.env` file
2. Run `npm run dev`
3. Write diagram JSON to `public/diagram_state.json` — the UI refreshes within 1.5 seconds

### MCP Server

The bundled MCP server (`mcp-server.mjs`) gives Claude structured tools to read and modify your diagram from **any project directory** — no need to be inside the DrawDB repo. It works with both Claude Code (CLI) and Claude Desktop.

**Prerequisites:**

```bash
cd drawdb && npm install
```

#### Claude Code (CLI)

Run this once from any terminal:

```bash
# Replace <drawdb-dir> with the full path to your drawdb clone
#   Linux/macOS:  /home/user/projects/drawdb
#   Windows:      C:\Users\user\projects\drawdb
claude mcp add -s user drawdb -- node <drawdb-dir>/mcp-server.mjs
```

This writes to `~/.claude/settings.json` and applies to all Claude Code sessions.

#### Claude Desktop

Add a `drawdb` entry to the `mcpServers` object in your config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "drawdb": {
      "command": "node",
      "args": ["/<absolute-path-to-drawdb>/mcp-server.mjs"]
    }
  }
}
```

Replace the path in `args` with the full path to `mcp-server.mjs` on your machine. Restart Claude Desktop after saving.

#### Available Tools

Once registered, Claude can use these tools across all sessions:

| Tool | Description |
|------|-------------|
| `get_diagram` | Read the current diagram state |
| `set_diagram` | Replace the entire diagram |
| `add_table` | Add a single table with fields |
| `add_relationship` | Create a foreign key between tables |
| `remove_table` | Delete a table and its relationships |
| `clear_diagram` | Reset the diagram to empty |
| `list_types` | Show all supported data types |
