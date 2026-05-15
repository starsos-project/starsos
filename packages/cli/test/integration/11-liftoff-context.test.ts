import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupTempHomes,
  makeTempHome,
  runCli,
  seedConfigWithFixtureArchive,
} from "./helpers/temp-home.ts";

afterEach(() => cleanupTempHomes());

const AAA_UUID = "aaaaaaaa-1111-2222-3333-444444444444";

function mockClaudeBin(): { binPath: string; recordPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "starsos-mock-"));
  const recordPath = join(dir, "args.txt");
  const binPath = join(dir, "claude");
  const script = `#!/usr/bin/env bash
printf "%s\\n" "$@" > "${recordPath}"
exit 0
`;
  writeFileSync(binPath, script, "utf-8");
  chmodSync(binPath, 0o755);
  return { binPath, recordPath };
}

describe("IT-11 implicit liftoff at chat resume", () => {
  test("prints liftoff context before spawning claude when project has CLAUDE.md + session-logs", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    // Set up the cwd referenced by fixture chat (/tmp/proj-a)
    const projDir = "/tmp/proj-a";
    if (!existsSync(projDir)) mkdirSync(projDir, { recursive: true });
    writeFileSync(
      join(projDir, "CLAUDE.md"),
      `## Tasks\n- [ ] task one\n- [ ] task two\n- [x] task three (done)\n`,
      "utf-8",
    );
    const logsDir = join(projDir, "session-logs");
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
    writeFileSync(
      join(logsDir, "2026-05-13-prev.md"),
      `# Session 2026-05-13 — earlier work\n\n**Status**: IN_ARBEIT\n\nThe previous session covered X.\n`,
      "utf-8",
    );

    const { binPath } = mockClaudeBin();
    const result = await runCli(home, [
      "chat",
      "resume",
      AAA_UUID,
      "--claude-bin",
      binPath,
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("liftoff");
    expect(result.stdout).toContain("task one");
    expect(result.stdout).toContain("last session log");
  });

  test("pre-liftoff.sh hook with non-zero exit aborts the resume", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    if (!existsSync("/tmp/proj-a")) mkdirSync("/tmp/proj-a", { recursive: true });

    // Write a pre-liftoff hook that fails
    const hookPath = join(home, "hooks", "pre-liftoff.sh");
    writeFileSync(
      hookPath,
      `#!/usr/bin/env bash\necho "veto from hook" >&2\nexit 7\n`,
      "utf-8",
    );
    chmodSync(hookPath, 0o755);

    const { binPath, recordPath } = mockClaudeBin();
    const result = await runCli(home, [
      "chat",
      "resume",
      AAA_UUID,
      "--claude-bin",
      binPath,
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("pre-liftoff hook aborted");
    expect(existsSync(recordPath)).toBe(false);
  });

  test("pre-liftoff.sh hook with exit 0 allows resume", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    if (!existsSync("/tmp/proj-a")) mkdirSync("/tmp/proj-a", { recursive: true });

    const hookPath = join(home, "hooks", "pre-liftoff.sh");
    writeFileSync(
      hookPath,
      `#!/usr/bin/env bash\necho "hook ran"\nexit 0\n`,
      "utf-8",
    );
    chmodSync(hookPath, 0o755);

    const { binPath, recordPath } = mockClaudeBin();
    const result = await runCli(home, [
      "chat",
      "resume",
      AAA_UUID,
      "--claude-bin",
      binPath,
    ]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(recordPath)).toBe(true);
    const args = readFileSync(recordPath, "utf-8").trim().split("\n");
    expect(args).toEqual(["--resume", AAA_UUID]);
  });
});
