import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirs: string[] = [];

export function makeTempHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "starsos-test-"));
  tempDirs.push(dir);
  return dir;
}

export function cleanupTempHomes(): void {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const FIXTURE_CLAUDE_ARCHIVE = join(
  import.meta.dir,
  "..",
  "fixtures",
  "claude-chats",
);

// Writes a minimal config.toml that points at the fixture archive.
export function seedConfigWithFixtureArchive(home: string): void {
  const path = join(home, "config.toml");
  const content = `
[general]
editor = "code"
claude_archive_path = "${FIXTURE_CLAUDE_ARCHIVE}"
`;
  Bun.write(path, content);
}

export async function runCli(starsosHome: string, args: string[]) {
  const cliEntry = join(import.meta.dir, "..", "..", "..", "src", "index.ts");
  const proc = Bun.spawn(["bun", "run", cliEntry, ...args], {
    env: { ...process.env, STARSOS_HOME: starsosHome },
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}
