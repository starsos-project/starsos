import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupTempHomes,
  makeTempHome,
  runCli,
} from "./helpers/temp-home.ts";

afterEach(() => cleanupTempHomes());

function seedConfigWithCustomArchive(home: string, archive: string): void {
  const path = join(home, "config.toml");
  writeFileSync(
    path,
    `[general]\nclaude_archive_path = "${archive}"\n`,
    "utf-8",
  );
}

async function runCliBackground(starsosHome: string, args: string[]) {
  const cliEntry = join(import.meta.dir, "..", "..", "src", "index.ts");
  return Bun.spawn(["bun", "run", cliEntry, ...args], {
    env: { ...process.env, STARSOS_HOME: starsosHome },
    stdout: "pipe",
    stderr: "pipe",
  });
}

describe("IT-09 chat watch", () => {
  test("watch starts, prints ready, exits cleanly on SIGTERM", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);

    const archive = mkdtempSync(join(tmpdir(), "starsos-archive-"));
    mkdirSync(join(archive, "proj-x"), { recursive: true });
    seedConfigWithCustomArchive(home, archive);

    const proc = await runCliBackground(home, ["chat", "watch"]);
    const stdoutReader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const start = Date.now();

    // wait for "ready" with 4s budget
    while (Date.now() - start < 4000) {
      const { value, done } = await stdoutReader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes("ready")) break;
    }
    expect(buffer).toContain("watching");
    expect(buffer).toContain("ready");

    proc.kill();
    await proc.exited;
  }, 10000);
});
