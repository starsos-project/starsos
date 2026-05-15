import { defineConfig } from "tsup";

// We use tsup for npm distribution. Runtime stays Bun.
// `bun:sqlite` and other Bun-builtins are marked external so the bundled
// output keeps `import { Database } from "bun:sqlite"` for Bun to resolve.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "esnext",
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: true,
  minify: false,
  splitting: false,
  external: ["bun:sqlite", "bun:test"],
  // Copy migration SQL files alongside the bundle.
  publicDir: "src/storage",
});
