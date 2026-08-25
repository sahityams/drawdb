#!/usr/bin/env node
import { createServer } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import { factory } from "../src/server.mjs";

function parseArgs(argv) {
  const result = { transport: "stdio", port: 8787 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--stdio") {
      result.transport = "stdio";
    } else if (arg === "--http") {
      result.transport = "http";
    } else if (arg === "--port") {
      const port = Number.parseInt(argv[i + 1], 10);
      if (!Number.isInteger(port) || port <= 0) {
        throw new Error("--port requires a positive integer.");
      }
      result.port = port;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));

if (args.transport === "http") {
  const handler = createMcpHandler(factory, { legacy: true });
  const nodeHandler = toNodeHandler(handler);
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();

  createServer((req, res) => {
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;
    void nodeHandler(req, res);
  }).listen(args.port, "127.0.0.1", () => {
    console.error(`drawdb MCP HTTP listening on 127.0.0.1:${args.port}`);
  });
} else {
  // serveStdio takes the factory (not an instance); it owns the era decision
  // and pins one instance per connection. Default legacy:"serve" = dual-era.
  serveStdio(factory);
}
