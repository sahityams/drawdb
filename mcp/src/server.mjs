import { McpServer } from "@modelcontextprotocol/server";
import { registerDocumentTools } from "./tools/document.mjs";
import { registerFeatureTools } from "./tools/features.mjs";

export function registerAllTools(server) {
  registerDocumentTools(server);
  registerFeatureTools(server);
}

export function buildServer() {
  const server = new McpServer({ name: "drawdb", version: "0.1.0" });
  registerAllTools(server);
  return server;
}

export function factory() {
  return buildServer();
}
