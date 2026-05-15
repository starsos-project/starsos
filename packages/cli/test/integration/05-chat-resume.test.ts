import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupTempHomes,
  makeTempHome,
  runCli,
  seedConfigWithFixtureArchive,
} from "./helpers/temp-home.ts";

const AAA_UUID = "aaaaaaaa-1111-2222-3333-444444444444";

const mockBins: string[] = [];

afterEach(() => {
  cleanupTempHomes();
  for (const b of mockBins.splice(0)) {
    try {
      // best-effort cleanup of mock binaries
      Bun.file(b);
    } catch {
      // ignore
    }
  }
});

function mockClaudeBin(): { binPath: string; recordPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "starsos-mock-"));
  const recordPath = join(dir, "args.txt");
  const binPath = join(dir, "claude");
  const script = `#!/usr/bin/env bash
echo "$PWD" > "${recordPath}.cwd"
printf "%s\\n" "$@" > "${recordPath}"
exit 0
`;
  writeFileSync(binPath, script, "utf-8");
  chmodSync(binPath, 0o755);
  mockBins.push(binPath);
  return { binPath, recordPath };
}

// Fixture chats reference /tmp/proj-a and /tmp/proj-b as cwds.
// Real spawn needs those paths to exist. --print does not.
beforeAll(() => {
  for (const p of ["/tmp/proj-a", "/tmp/proj-b"]) {
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }
});

describe("IT-05 chat resume", () => {
  test("--print outputs the resume command without spawning", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["chat", "resume", AAA_UUID, "--print"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--resume");
    expect(result.stdout).toContain(AAA_UUID);
    expect(result.stdout).toContain("/tmp/proj-a");
  });

  test("resume spawns the claude binary with --resume <uuid> in chat cwd", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const { binPath, recordPath } = mockClaudeBin();

    const result = await runCli(home, [
      "chat",
      "resume",
      AAA_UUID,
      "--claude-bin",
      binPath,
    ]);
    expect(result.exitCode).toBe(0);

    const args = readFileSync(recordPath, "utf-8").trim().split("\n");
    expect(args).toEqual(["--resume", AAA_UUID]);
    const cwd = readFileSync(`${recordPath}.cwd`, "utf-8").trim();
    // macOS resolves /tmp to /private/tmp via symlink — accept either.
    expect(cwd === "/tmp/proj-a" || cwd === "/private/tmp/proj-a").toBe(true);
  });

  test("unknown ref exits 1", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["chat", "resume", "ffffffff"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("chat not found");
  });

  test("accepts uuid prefix", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["chat", "resume", "aaaa", "--print"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(AAA_UUID);
  });
});
