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

const AAA_UUID = "aaaaaaaa-1111-2222-3333-444444444444";

describe("IT-08 chat send inbox pattern", () => {
  test("queues a prompt into ~/.starsos/inboxes/<uuid>.md", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const send = await runCli(home, [
      "chat",
      "send",
      AAA_UUID,
      "--prompt",
      "remember the README",
    ]);
    expect(send.exitCode).toBe(0);

    const inboxPath = join(home, "inboxes", `${AAA_UUID}.md`);
    expect(existsSync(inboxPath)).toBe(true);
    const content = readFileSync(inboxPath, "utf-8");
    expect(content).toContain("remember the README");
    expect(content).toMatch(/^# \d{4}-\d{2}-\d{2}T/);
  });

  test("multiple sends append, count grows", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    await runCli(home, ["chat", "send", AAA_UUID, "--prompt", "one"]);
    await runCli(home, ["chat", "send", AAA_UUID, "--prompt", "two"]);
    const last = await runCli(home, [
      "chat",
      "send",
      AAA_UUID,
      "--prompt",
      "three",
      "--json",
    ]);

    const parsed = JSON.parse(last.stdout) as { pending: number };
    expect(parsed.pending).toBe(3);
  });

  test("chat show reports pendingInbox count", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    await runCli(home, ["chat", "send", AAA_UUID, "--prompt", "first"]);
    await runCli(home, ["chat", "send", AAA_UUID, "--prompt", "second"]);

    const show = await runCli(home, ["chat", "show", AAA_UUID, "--json"]);
    const parsed = JSON.parse(show.stdout) as { pendingInbox: number };
    expect(parsed.pendingInbox).toBe(2);
  });

  test("empty --prompt is rejected", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const result = await runCli(home, [
      "chat",
      "send",
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
      "send",
      "ffffffff",
      "--prompt",
      "x",
    ]);
    expect(result.exitCode).toBe(1);
  });
});
