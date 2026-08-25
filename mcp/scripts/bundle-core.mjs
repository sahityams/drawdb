import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const mcpRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const srcDir = path.join(mcpRoot, "src");
const mcpNodeModules = path.join(mcpRoot, "node_modules");
const generatedDir = path.join(srcDir, "generated");
const entryPoint = "src/core-entry.mjs";
const outfile = "src/generated/drawdb-core.mjs";
const i18nStub = path.join(srcDir, "stubs", "i18n.mjs");
const databasesStub = path.join(srcDir, "stubs", "databases.mjs");

const browserCouplingStubs = {
  name: "browser-coupling-stubs",
  setup(builder) {
    builder.onResolve({ filter: /(^|\/)i18n\/i18n(\.js)?$/ }, () => ({
      path: i18nStub,
    }));
    builder.onResolve({ filter: /(^|\/)data\/databases(\.js)?$/ }, () => ({
      path: databasesStub,
    }));
  },
};

const assetImportGuard = {
  name: "asset-import-guard",
  setup(builder) {
    builder.onResolve({ filter: /\.(png|svg)$/ }, (args) => ({
      errors: [
        {
          text: `Unexpected asset import in DrawDB core bundle: ${args.path}`,
        },
      ],
    }));
  },
};

await mkdir(generatedDir, { recursive: true });

await build({
  bundle: true,
  platform: "node",
  format: "esm",
  absWorkingDir: mcpRoot,
  entryPoints: [entryPoint],
  outfile,
  // DrawDB's source files (../src) import bare deps (@dbml/core, nanoid).
  // esbuild would otherwise resolve those from the drawdb root node_modules,
  // which a standalone `cd mcp && npm install` never populates. Resolve them
  // from mcp/node_modules instead, so the bundle builds from a fresh clone.
  nodePaths: [mcpNodeModules],
  plugins: [browserCouplingStubs, assetImportGuard],
  loader: {
    ".png": "text",
    ".svg": "text",
  },
  // Bundled CJS deps (@dbml/core -> antlr4) call require("fs") at runtime.
  // ESM output has no require; provide one so the bundle runs under plain node
  // (not just under vitest, which shims it).
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  logLevel: "info",
});

console.log(`Bundled DrawDB core from ${path.join(mcpRoot, entryPoint)}`);
console.log(`Wrote ${path.join(mcpRoot, outfile)}`);
