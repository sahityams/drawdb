<div align="center">
    <img width="64" alt="drawDB logo" src="./src/assets/icon-dark.png">
    <h1>drawDB &nbsp;+&nbsp; MCP</h1>
</div>

<h3 align="center">A database schema editor &mdash; now with an MCP server so AI coding agents can drive it.</h3>

<div align="center" style="margin-bottom:12px;">
    <a href="https://drawdb.app/"><img src="https://img.shields.io/badge/Start%20building-grey" alt="drawDB"/></a>
    <a href="https://discord.gg/BrjZgNrmR6"><img src="https://img.shields.io/discord/1196658537208758412.svg?label=Join%20the%20Discord&logo=discord" alt="Discord"/></a>
    <a href="https://x.com/drawDB_"><img src="https://img.shields.io/badge/Follow%20us%20on%20X-blue?logo=X" alt="Follow us on X"/></a>
</div>

<h3 align="center"><img width="700" style="border-radius:5px;" alt="drawDB screenshot demo" src="drawdb.png"></h3>

DrawDB is a robust, user‑friendly database entity‑relationship (ERD) editor that runs in
your browser. Build diagrams in a few clicks, import and export SQL, generate migrations,
and more — no account required. See the full feature set at [drawdb.app](https://drawdb.app/).

**This fork adds two things on top of upstream DrawDB:**

1. **Snowflake support** — Snowflake is a first‑class SQL dialect for import and export.
2. **An MCP server** (in [`mcp/`](./mcp)) — exposes DrawDB's whole engine to AI coding
   agents (Claude Code, Codex, Cursor, Windsurf, …) so they can design schemas, generate and
   convert SQL, import SQL/DBML, render ERDs, and reverse‑engineer a live Snowflake database
   — all headless, no browser.

---

## Two ways to use this repo

### 1. The DrawDB app (browser editor)

```bash
git clone <this-repo-url> drawdb
cd drawdb
npm install
npm run dev        # start the editor at http://localhost:5173
```

Other targets:

```bash
npm run build      # production build to dist/
```

```bash
docker build -t drawdb .
docker run -p 3000:80 drawdb
```

Sharing is optional and requires the [server](https://github.com/drawdb-io/drawdb-server)
plus the environment variables in `.env.sample`.

### 2. The MCP server (for AI agents)

The MCP server lives in [`mcp/`](./mcp) and is self‑contained — you don't need to run the
browser app to use it.

```bash
cd drawdb/mcp
npm install        # installs deps and builds the engine bundle
```

Then register it with your agent and start designing schemas by chatting. Full setup,
registration commands for each client, usage examples, and the tool reference are in
**[`mcp/README.md`](./mcp/README.md)**.

---

## Repository layout

```
.
├── src/            # the DrawDB browser app (React + Vite)
├── mcp/            # the MCP server — see mcp/README.md
├── public/
└── ...
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

- Join the discussion on [Discord](https://discord.gg/BrjZgNrmR6)
- Upstream project: [drawdb-io/drawdb](https://github.com/drawdb-io/drawdb)
