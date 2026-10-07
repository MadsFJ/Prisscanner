import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Tests share one database, so run files one after another.
    fileParallelism: false,
  },
});
