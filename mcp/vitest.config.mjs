import { defineConfig } from "vitest/config";

// Own config so vitest does not climb to the drawdb root vite.config.js
// (which requires `vite`, not installed for a standalone `cd mcp` setup).
export default defineConfig({
  test: {
    include: ["test/**/*.test.mjs"],
    root: import.meta.dirname,
  },
});
