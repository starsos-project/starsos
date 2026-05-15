import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanupTempHomes,
  makeTempHome,
  runCli,
  seedConfigWithFixtureArchive,
} from "./helpers/temp-home.ts";

afterEach(() => cleanupTempHomes());

const AAA_UUID = "aaaaaaaa-1111-2222-3333-444444444444";

describe("IT-12 chat done = touchdown", () => {
  test("writes session log to <cwd>/session-logs/YYYY-MM-DD-<slug>.md", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    if (existsSync("/tmp/proj-a/session-logs"))
      rmSync("/tmp/proj-a/session-logs", { recursive: true, force: true });
    if (!existsSync("/tmp/proj-a")) mkdirSync("/tmp/proj-a", { recursive: true });

    const result = await runCli(home, [
      "chat",
      "done",
      AAA_UUID,
      "--status",
      "FERTIG",
      "--summary",
      "Performance baseline complete",
    ]);
    expect(result.exitCode).toBe(0);

    // Find the generated log file
    const expectedSlug = "performance-baseline-complete";
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const expectedPath = `/tmp/proj-a/session-logs/${todayPrefix}-${expectedSlug}.md`;
    expect(existsSync(expectedPath)).toBe(true);

    const content = readFileSync(expectedPath, "utf-8");
    expect(content).toContain("Performance baseline complete");
    expect(content).toContain("FERTIG");
    expect(content).toContain(AAA_UUID);
  });

  test("marks chat as done in DB with touchdown metadata", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    if (!existsSync("/tmp/proj-a")) mkdirSync("/tmp/proj-a", { recursive: true });

    await runCli(home, [
      "chat",
      "done",
      AAA_UUID,
      "--status",
      "FERTIG",
      "--summary",
      "test summary",
    ]);

    const show = await runCli(home, ["chat", "show", AAA_UUID, "--json"]);
    const parsed = JSON.parse(show.stdout) as {
      status: string;
    };
    expect(parsed.status).toBe("done");
  });

  test("post-touchdown.sh hook receives expected env vars", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    if (!existsSync("/tmp/proj-a")) mkdirSync("/tmp/proj-a", { recursive: true });

    const sentinelPath = `/tmp/starsos-hook-out-${Date.now()}.txt`;
    const hookPath = join(home, "hooks", "post-touchdown.sh");
    writeFileSync(
      hookPath,
      `#!/usr/bin/env bash
{
  echo "STARSOS_CHAT_UUID=$STARSOS_CHAT_UUID"
  echo "STARSOS_TOUCHDOWN_SUMMARY=$STARSOS_TOUCHDOWN_SUMMARY"
  echo "STARSOS_TOUCHDOWN_STATUS=$STARSOS_TOUCHDOWN_STATUS"
  echo "STARSOS_TOUCHDOWN_LOG=$STARSOS_TOUCHDOWN_LOG"
  echo "STARSOS_PROJECT_SLUG=$STARSOS_PROJECT_SLUG"
} > "${sentinelPath}"
exit 0
`,
      "utf-8",
    );
    chmodSync(hookPath, 0o755);

    await runCli(home, [
      "chat",
      "done",
      AAA_UUID,
      "--status",
      "FERTIG",
      "--summary",
      "hook test",
    ]);

    expect(existsSync(sentinelPath)).toBe(true);
    const captured = readFileSync(sentinelPath, "utf-8");
    expect(captured).toContain(`STARSOS_CHAT_UUID=${AAA_UUID}`);
    expect(captured).toContain("STARSOS_TOUCHDOWN_SUMMARY=hook test");
    expect(captured).toContain("STARSOS_TOUCHDOWN_STATUS=FERTIG");
    expect(captured).toContain("STARSOS_TOUCHDOWN_LOG=/tmp/proj-a/session-logs/");
    rmSync(sentinelPath, { force: true });
  });

  test("empty --summary is rejected", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, [
      "chat",
      "done",
      AAA_UUID,
      "--status",
      "FERTIG",
      "--summary",
      "   ",
    ]);
    expect(result.exitCode).toBe(1);
  });

  test("uses --log-dir override when provided", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);
    const customDir = `/tmp/starsos-custom-logs-${Date.now()}`;

    const result = await runCli(home, [
      "chat",
      "done",
      AAA_UUID,
      "--status",
      "FERTIG",
      "--summary",
      "custom dir test",
      "--log-dir",
      customDir,
    ]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(customDir)).toBe(true);
    rmSync(customDir, { recursive: true, force: true });
  });
});
