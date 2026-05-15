import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanupTempHomes,
  makeTempHome,
  runCli,
  seedConfigWithFixtureArchive,
} from "./helpers/temp-home.ts";

afterEach(() => cleanupTempHomes());

describe("IT-07 status cockpit with aliases", () => {
  test("status groups chats by auto-detected project and assigns A/B letters", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["status", "--json"]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      projects: Array<{
        letter: string;
        name: string;
        chats: Array<{ alias: string; uuid: string; status: string }>;
      }>;
    };
    expect(parsed.projects.length).toBeGreaterThanOrEqual(2);
    // First project gets A, second gets B
    expect(parsed.projects[0]?.letter).toBe("A");
    expect(parsed.projects[1]?.letter).toBe("B");
    // Each chat has an alias like A1, A2, ...
    expect(parsed.projects[0]?.chats[0]?.alias).toBe("A1");
    if (parsed.projects[0]?.chats.length === 2) {
      expect(parsed.projects[0]?.chats[1]?.alias).toBe("A2");
    }
  });

  test("writes alias map to ~/.starsos/state/last-status.json", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    await runCli(home, ["status"]);
    const aliasPath = join(home, "state", "last-status.json");
    expect(existsSync(aliasPath)).toBe(true);
    const data = JSON.parse(readFileSync(aliasPath, "utf-8")) as {
      generatedAt: string;
      aliases: Record<string, string>;
    };
    expect(Object.keys(data.aliases)).toContain("A1");
    // All UUIDs are full UUIDs
    for (const uuid of Object.values(data.aliases)) {
      expect(uuid.length).toBeGreaterThan(20);
    }
  });

  test("alias A1 resolves on subsequent chat commands", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    // generate alias map first
    const statusResult = await runCli(home, ["status", "--json"]);
    const parsed = JSON.parse(statusResult.stdout) as {
      projects: Array<{ chats: Array<{ alias: string; uuid: string }> }>;
    };
    const a1Uuid = parsed.projects[0]?.chats[0]?.uuid;
    expect(a1Uuid).toBeDefined();

    // resolve A1 via chat show
    const show = await runCli(home, ["chat", "show", "A1", "--json"]);
    expect(show.exitCode).toBe(0);
    const shown = JSON.parse(show.stdout) as { uuid: string };
    expect(shown.uuid).toBe(a1Uuid as string);
  });

  test("--plain output has alias as first column", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["status", "--plain"]);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split("\n");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const cols = line.split("\t");
      expect(cols[0]).toMatch(/^[A-Z]+\d+$/);
    }
  });

  test("auto-detection creates projects for unique cwds", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    await runCli(home, ["status"]);
    // Now chat show should report project_slug populated automatically
    const aaa = await runCli(home, [
      "chat",
      "show",
      "aaaaaaaa",
      "--json",
    ]);
    const parsed = JSON.parse(aaa.stdout) as { projectSlug: string | null };
    expect(parsed.projectSlug).not.toBeNull();
  });
});
