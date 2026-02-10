#!/usr/bin/env node

/**
 * DrawDB MCP Server
 *
 * Provides tools to control DrawDB from any Claude Code session.
 * Register globally:  claude mcp add -s user drawdb -- node /path/to/drawdb/mcp-server.mjs
 *
 * Requires DrawDB dev server running: cd /path/to/drawdb && npm run dev
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAGRAM_PATH = path.join(__dirname, "public", "diagram_state.json");

const SUPPORTED_TYPES = [
  "NUMBER", "DECIMAL", "NUMERIC", "INT", "INTEGER", "BIGINT", "SMALLINT",
  "TINYINT", "BYTEINT", "FLOAT", "FLOAT4", "FLOAT8", "DOUBLE",
  "DOUBLE PRECISION", "REAL", "VARCHAR", "CHAR", "CHARACTER", "STRING",
  "TEXT", "BINARY", "VARBINARY", "BOOLEAN", "DATE", "TIME", "TIMESTAMP",
  "TIMESTAMP_LTZ", "TIMESTAMP_NTZ", "TIMESTAMP_TZ", "VARIANT", "OBJECT",
  "ARRAY", "GEOGRAPHY", "GEOMETRY",
];

const SUPPORTED_DATABASES = [
  "mysql", "postgresql", "transactsql", "sqlite",
  "mariadb", "oraclesql", "snowflake", "generic",
];

function readDiagram() {
  try {
    return JSON.parse(fs.readFileSync(DIAGRAM_PATH, "utf-8"));
  } catch {
    return { tables: [], relationships: [] };
  }
}

function writeDiagram(diagram) {
  fs.writeFileSync(DIAGRAM_PATH, JSON.stringify(diagram, null, 2) + "\n");
}

function nextId(items) {
  if (!items || items.length === 0) return 0;
  return Math.max(...items.map((i) => i.id)) + 1;
}

const server = new McpServer({
  name: "drawdb",
  version: "1.0.0",
});

// Tool: Get current diagram
server.tool(
  "get_diagram",
  "Read the current DrawDB diagram state. Returns all tables, relationships, and metadata.",
  {},
  async () => {
    const diagram = readDiagram();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(diagram, null, 2),
        },
      ],
    };
  },
);

// Tool: Set full diagram
server.tool(
  "set_diagram",
  "Replace the entire DrawDB diagram. Use this to load a complete schema. The browser will update automatically within 1.5 seconds.",
  {
    database: z
      .enum(SUPPORTED_DATABASES)
      .default("snowflake")
      .describe("Database type"),
    tables: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          x: z.number().default(0),
          y: z.number().default(0),
          comment: z.string().default(""),
          color: z.string().default("#175e7a"),
          fields: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              type: z.string().describe("Column type, e.g. VARCHAR, NUMBER, TIMESTAMP_NTZ"),
              primary: z.boolean().default(false),
              unique: z.boolean().default(false),
              notNull: z.boolean().default(false),
              increment: z.boolean().default(false),
              default: z.string().default(""),
              check: z.string().default(""),
              comment: z.string().default(""),
              size: z.string().default(""),
              values: z.array(z.string()).default([]),
            }),
          ),
          indices: z
            .array(
              z.object({
                id: z.number(),
                name: z.string(),
                unique: z.boolean().default(false),
                fields: z.array(z.string()),
              }),
            )
            .default([]),
        }),
      )
      .describe("Array of table definitions"),
    relationships: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          startTableId: z.number().describe("FK table id (child)"),
          startFieldId: z.number().describe("FK field id in child table"),
          endTableId: z.number().describe("Referenced table id (parent)"),
          endFieldId: z.number().describe("Referenced field id in parent"),
          cardinality: z
            .enum(["one_to_one", "one_to_many", "many_to_one"])
            .default("many_to_one"),
          updateConstraint: z.string().default("No action"),
          deleteConstraint: z.string().default("No action"),
        }),
      )
      .default([]),
  },
  async ({ database, tables, relationships }) => {
    const diagram = {
      database,
      tables,
      relationships,
      notes: [],
      subjectAreas: [],
      types: [],
      enums: [],
      pan: { x: 0, y: 0 },
      zoom: 1,
    };
    writeDiagram(diagram);
    return {
      content: [
        {
          type: "text",
          text: `Diagram updated: ${tables.length} tables, ${relationships.length} relationships. DrawDB will refresh automatically.`,
        },
      ],
    };
  },
);

// Tool: Add a table
server.tool(
  "add_table",
  "Add a single table to the existing DrawDB diagram.",
  {
    name: z.string().describe("Table name"),
    x: z.number().default(50).describe("X position on canvas"),
    y: z.number().default(50).describe("Y position on canvas"),
    color: z.string().default("#175e7a").describe("Table header color (hex)"),
    comment: z.string().default("").describe("Table comment"),
    fields: z.array(
      z.object({
        name: z.string(),
        type: z.string().describe("Column type"),
        primary: z.boolean().default(false),
        unique: z.boolean().default(false),
        notNull: z.boolean().default(false),
        increment: z.boolean().default(false),
        default: z.string().default(""),
        size: z.string().default(""),
        comment: z.string().default(""),
      }),
    ),
  },
  async ({ name, x, y, color, comment, fields }) => {
    const diagram = readDiagram();
    if (!diagram.tables) diagram.tables = [];

    const tableId = nextId(diagram.tables);
    const table = {
      id: tableId,
      name,
      x,
      y,
      comment,
      color,
      fields: fields.map((f, i) => ({
        id: i,
        name: f.name,
        type: f.type,
        primary: f.primary,
        unique: f.unique,
        notNull: f.notNull,
        increment: f.increment,
        default: f.default,
        check: "",
        comment: f.comment,
        size: f.size,
        values: [],
      })),
      indices: [],
    };

    diagram.tables.push(table);
    writeDiagram(diagram);

    return {
      content: [
        {
          type: "text",
          text: `Added table "${name}" (id: ${tableId}) with ${fields.length} fields.`,
        },
      ],
    };
  },
);

// Tool: Add a relationship
server.tool(
  "add_relationship",
  "Add a foreign key relationship between two tables in DrawDB.",
  {
    name: z.string().describe("FK constraint name"),
    startTableId: z.number().describe("Child table id (has the FK column)"),
    startFieldId: z.number().describe("FK field id in child table"),
    endTableId: z.number().describe("Parent table id (referenced)"),
    endFieldId: z.number().describe("PK field id in parent table"),
    cardinality: z
      .enum(["one_to_one", "one_to_many", "many_to_one"])
      .default("many_to_one"),
    updateConstraint: z.string().default("No action"),
    deleteConstraint: z.string().default("No action"),
  },
  async (params) => {
    const diagram = readDiagram();
    if (!diagram.relationships) diagram.relationships = [];

    const relId = nextId(diagram.relationships);
    diagram.relationships.push({ id: relId, ...params });
    writeDiagram(diagram);

    return {
      content: [
        {
          type: "text",
          text: `Added relationship "${params.name}" (id: ${relId}).`,
        },
      ],
    };
  },
);

// Tool: Remove a table
server.tool(
  "remove_table",
  "Remove a table and its relationships from the DrawDB diagram.",
  {
    tableId: z.number().describe("Table id to remove"),
  },
  async ({ tableId }) => {
    const diagram = readDiagram();
    const table = diagram.tables?.find((t) => t.id === tableId);
    if (!table) {
      return {
        content: [{ type: "text", text: `Table id ${tableId} not found.` }],
      };
    }

    diagram.tables = diagram.tables.filter((t) => t.id !== tableId);
    diagram.relationships = (diagram.relationships || []).filter(
      (r) => r.startTableId !== tableId && r.endTableId !== tableId,
    );
    writeDiagram(diagram);

    return {
      content: [
        {
          type: "text",
          text: `Removed table "${table.name}" and its relationships.`,
        },
      ],
    };
  },
);

// Tool: Clear diagram
server.tool(
  "clear_diagram",
  "Clear the entire DrawDB diagram (remove all tables and relationships).",
  {},
  async () => {
    writeDiagram({ tables: [], relationships: [] });
    return {
      content: [{ type: "text", text: "Diagram cleared." }],
    };
  },
);

// Tool: List supported types
server.tool(
  "list_types",
  "List all supported Snowflake data types in DrawDB.",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: `Supported Snowflake types:\n${SUPPORTED_TYPES.join(", ")}\n\nSupported databases:\n${SUPPORTED_DATABASES.join(", ")}`,
        },
      ],
    };
  },
);

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
