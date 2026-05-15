import { afterEach, describe, expect, test } from "bun:test";
import {
  cleanupTempHomes,
  makeTempHome,
  runCli,
  seedConfigWithFixtureArchive,
} from "./helpers/temp-home.ts";

afterEach(() => cleanupTempHomes());

const AAA_UUID = "aaaaaaaa-1111-2222-3333-444444444444";

describe("IT-04 chat show", () => {
  test("shows metadata of a known chat", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["chat", "show", AAA_UUID]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(AAA_UUID);
    expect(result.stdout).toContain("/tmp/proj-a");
    expect(result.stdout).toContain("status:");
    expect(result.stdout).toContain("messages:");
  });

  test("--json returns structured chat data with preview", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["chat", "show", AAA_UUID, "--json"]);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout) as {
      uuid: string;
      cwd: string | null;
      messageCount: number;
      status: string;
      tags: string[];
      notes: unknown[];
      preview: Array<{ kind: string; preview: string }>;
    };
    expect(parsed.uuid).toBe(AAA_UUID);
    expect(parsed.cwd).toBe("/tmp/proj-a");
    expect(parsed.messageCount).toBe(4);
    expect(parsed.status).toBe("active");
    expect(parsed.tags).toEqual([]);
    expect(parsed.notes).toEqual([]);
    expect(parsed.preview.length).toBeGreaterThan(0);
  });

  test("accepts uuid prefix", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["chat", "show", "aaaa"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(AAA_UUID);
  });

  test("unknown ref exits 1 with helpful error", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, ["chat", "show", "ffffffff"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("chat not found");
  });
});
