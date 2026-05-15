import { afterEach, describe, expect, test } from "bun:test";
import {
  cleanupTempHomes,
  makeTempHome,
  runCli,
  seedConfigWithFixtureArchive,
} from "./helpers/temp-home.ts";

afterEach(() => cleanupTempHomes());

describe("IT-03 chat list", () => {
  test("lists all chats from fixture archive", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["chat", "list"]);
    expect(result.exitCode).toBe(0);

    // The 3 fixture uuids must appear (shortened to 8 chars in table)
    expect(result.stdout).toContain("aaaaaaaa");
    expect(result.stdout).toContain("bbbbbbbb");
    expect(result.stdout).toContain("cccccccc");
  });

  test("--json output is parseable and contains all chats", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["chat", "list", "--json"]);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout) as Array<{
      uuid: string;
      cwd: string | null;
      messageCount: number;
      tags: string[];
    }>;
    expect(parsed.length).toBe(3);

    const uuids = parsed.map((p) => p.uuid).sort();
    expect(uuids).toEqual([
      "aaaaaaaa-1111-2222-3333-444444444444",
      "bbbbbbbb-1111-2222-3333-555555555555",
      "cccccccc-1111-2222-3333-666666666666",
    ]);

    const aaa = parsed.find((p) => p.uuid.startsWith("aaaa"));
    expect(aaa?.messageCount).toBe(4);
    expect(aaa?.cwd).toBe("/tmp/proj-a");
    expect(aaa?.tags).toEqual([]);
  });

  test("--plain output is tab-separated", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["chat", "list", "--plain"]);
    expect(result.exitCode).toBe(0);

    const lines = result.stdout.trim().split("\n");
    expect(lines.length).toBe(3);
    for (const line of lines) {
      expect(line.split("\t").length).toBe(5); // uuid, status, last, msgs, title
    }
  });

  test("sort is newest-first by last_message_at", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["chat", "list", "--json"]);
    const parsed = JSON.parse(result.stdout) as Array<{ uuid: string }>;
    // bbbbbbbb is newest (2026-05-14), aaaaaaaa is next (2026-05-13), cccccccc is oldest (2026-05-12)
    expect(parsed[0]?.uuid.startsWith("bbbb")).toBe(true);
    expect(parsed[1]?.uuid.startsWith("aaaa")).toBe(true);
    expect(parsed[2]?.uuid.startsWith("cccc")).toBe(true);
  });

  test("empty archive prints helpful message", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    const emptyDir = makeTempHome(); // empty claude_archive
    const path = `${home}/config.toml`;
    Bun.write(path, `[general]\nclaude_archive_path = "${emptyDir}"\n`);

    const result = await runCli(home, ["chat", "list"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("no chats found");
  });
});
