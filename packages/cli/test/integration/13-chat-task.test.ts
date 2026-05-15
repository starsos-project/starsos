import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

// A mock claude binary that writes a marker to a sentinel file then exits 0.
function mockClaudeBin(sentinel: string): string {
  const dir = mkdtempSync(join(tmpdir(), "starsos-mock-claude-"));
  const bin = join(dir, "claude");
  const script = `#!/usr/bin/env bash
echo "mock claude invoked"
echo "args: $@"
echo "starsos-task-marker" > "${sentinel}"
echo "task complete"
exit 0
`;
  writeFileSync(bin, script, "utf-8");
  chmodSync(bin, 0o755);
  return bin;
}

describe("IT-13 chat task subagent", () => {
  test("dispatches task and records it in tasks table", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const sentinel = join(home, "mock-marker.txt");
    const bin = mockClaudeBin(sentinel);

    const result = await runCli(home, [
      "chat",
      "task",
      AAA_UUID,
      "--prompt",
      "do something",
      "--claude-bin",
      bin,
      "--wait",
      "--json",
    ]);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout) as {
      taskId: string;
      chatUuid: string;
      backend: string;
      outputPath: string;
    };
    expect(parsed.chatUuid).toBe(AAA_UUID);
    expect(parsed.backend).toBe("headless-claude");
    expect(existsSync(parsed.outputPath)).toBe(true);

    // The mock wrote a marker to sentinel
    expect(existsSync(sentinel)).toBe(true);
    expect(readFileSync(sentinel, "utf-8")).toContain("starsos-task-marker");

    // Output file contains mock claude output
    const out = readFileSync(parsed.outputPath, "utf-8");
    expect(out).toContain("mock claude invoked");
    expect(out).toContain("task complete");
  });

  test("task-list shows the dispatched task", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const sentinel = join(home, "mock-marker.txt");
    const bin = mockClaudeBin(sentinel);

    await runCli(home, [
      "chat",
      "task",
      AAA_UUID,
      "--prompt",
      "test",
      "--claude-bin",
      bin,
      "--wait",
    ]);

    const list = await runCli(home, ["chat", "task-list", "--json"]);
    expect(list.exitCode).toBe(0);
    const tasks = JSON.parse(list.stdout) as Array<{
      id: string;
      chatUuid: string;
      status: string;
    }>;
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0]?.chatUuid).toBe(AAA_UUID);
    expect(["done", "running"]).toContain(tasks[0]?.status);
  });

  test("task-show returns output for an existing task", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const sentinel = join(home, "mock-marker.txt");
    const bin = mockClaudeBin(sentinel);

    const dispatch = await runCli(home, [
      "chat",
      "task",
      AAA_UUID,
      "--prompt",
      "test",
      "--claude-bin",
      bin,
      "--wait",
      "--json",
    ]);
    const parsed = JSON.parse(dispatch.stdout) as { taskId: string };

    const show = await runCli(home, ["chat", "task-show", parsed.taskId, "--json"]);
    expect(show.exitCode).toBe(0);
    const data = JSON.parse(show.stdout) as { id: string; output: string };
    expect(data.id).toBe(parsed.taskId);
    expect(data.output).toContain("mock claude invoked");
  });

  test("empty --prompt is rejected", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, [
      "chat",
      "task",
      AAA_UUID,
      "--prompt",
      "   ",
    ]);
    expect(result.exitCode).toBe(1);
  });

  test("unknown chat ref exits 1", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, [
      "chat",
      "task",
      "ffffffff",
      "--prompt",
      "x",
    ]);
    expect(result.exitCode).toBe(1);
  });
});
