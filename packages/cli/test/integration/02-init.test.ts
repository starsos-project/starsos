import { describe, expect, test, afterEach } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI_ENTRY = join(import.meta.dir, "..", "..", "src", "index.ts");

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "starsos-test-"));
  tempDirs.push(dir);
  return dir;
}

async function runCli(starsosHome: string, args: string[]) {
  const proc = Bun.spawn(["bun", "run", CLI_ENTRY, ...args], {
    env: { ...process.env, STARSOS_HOME: starsosHome },
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

describe("IT-02 idempotent init", () => {
  test("creates ~/.starsos/ with default sections on first run", async () => {
    const home = makeTempHome();

    const result = await runCli(home, ["init"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("initialized");
    expect(result.stderr).toBe("");
  });

  test("creates config.toml with default sections", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);

    const configPath = join(home, "config.toml");
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("[general]");
    expect(content).toContain("[chat]");
    expect(content).toContain("[liftoff]");
    expect(content).toContain("[touchdown]");
    expect(content).toContain("[mcp]");
  });

  test("creates stars.db with schema_version=1", async () => {
    const home = makeTempHome();
    const result = await runCli(home, ["init"]);

    const dbPath = join(home, "stars.db");
    expect(existsSync(dbPath)).toBe(true);
    expect(statSync(dbPath).size).toBeGreaterThan(0);
    expect(result.stdout).toContain("schema version: 1");
  });

  test("creates expected subdirectories", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);

    for (const sub of [
      "hooks",
      "inboxes",
      "tasks",
      "mcp-servers",
      "state",
      "logs",
      "touchdowns",
    ]) {
      expect(existsSync(join(home, sub))).toBe(true);
    }
  });

  test("second init is idempotent and reports already initialized", async () => {
    const home = makeTempHome();

    const first = await runCli(home, ["init"]);
    expect(first.exitCode).toBe(0);

    const second = await runCli(home, ["init"]);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("already initialized");
  });

  test("--json output is parseable JSON with expected fields", async () => {
    const home = makeTempHome();

    const result = await runCli(home, ["init", "--json"]);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout) as {
      starsosHome: string;
      alreadyInitialized: boolean;
      schemaVersion: number;
    };
    expect(parsed.starsosHome).toBe(home);
    expect(parsed.alreadyInitialized).toBe(false);
    expect(parsed.schemaVersion).toBe(1);
  });
});

describe("CLI surface", () => {
  test("--version prints version string", async () => {
    const home = makeTempHome();
    const result = await runCli(home, ["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^0\.1\.0-alpha\.\d+$/);
  });

  test("--help shows init command", async () => {
    const home = makeTempHome();
    const result = await runCli(home, ["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("init");
    expect(result.stdout).toContain("starsos");
  });
});
