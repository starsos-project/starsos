import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanupTempHomes,
  FIXTURE_CLAUDE_ARCHIVE,
  makeTempHome,
  runCli,
  seedConfigWithFixtureArchive,
} from "./helpers/temp-home.ts";

afterEach(() => cleanupTempHomes());

const AAA_UUID = "aaaaaaaa-1111-2222-3333-444444444444";
const AAA_JSONL = join(
  FIXTURE_CLAUDE_ARCHIVE,
  "proj-a",
  `${AAA_UUID}.jsonl`,
);

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("IT-06 tags and notes round-trip", () => {
  test("tag add → show → untag → show; source JSONL unchanged", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const before = sha256(AAA_JSONL);

    const tagResult = await runCli(home, ["chat", "tag", AAA_UUID, "wip", "urgent"]);
    expect(tagResult.exitCode).toBe(0);

    const show1 = await runCli(home, ["chat", "show", AAA_UUID, "--json"]);
    expect(show1.exitCode).toBe(0);
    const parsed1 = JSON.parse(show1.stdout) as { tags: string[] };
    expect(parsed1.tags).toContain("wip");
    expect(parsed1.tags).toContain("urgent");

    const untagResult = await runCli(home, ["chat", "untag", AAA_UUID, "urgent"]);
    expect(untagResult.exitCode).toBe(0);

    const show2 = await runCli(home, ["chat", "show", AAA_UUID, "--json"]);
    const parsed2 = JSON.parse(show2.stdout) as { tags: string[] };
    expect(parsed2.tags).toEqual(["wip"]);

    const after = sha256(AAA_JSONL);
    expect(after).toBe(before);
  });

  test("note add → show; ordering by createdAt; source JSONL unchanged", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const before = sha256(AAA_JSONL);

    const n1 = await runCli(home, ["chat", "note", AAA_UUID, "first note"]);
    expect(n1.exitCode).toBe(0);
    const n2 = await runCli(home, ["chat", "note", AAA_UUID, "second", "note"]);
    expect(n2.exitCode).toBe(0);

    const show = await runCli(home, ["chat", "show", AAA_UUID, "--json"]);
    const parsed = JSON.parse(show.stdout) as {
      notes: Array<{ body: string; createdAt: string }>;
    };
    expect(parsed.notes.length).toBe(2);
    expect(parsed.notes[0]?.body).toBe("first note");
    expect(parsed.notes[1]?.body).toBe("second note");

    const after = sha256(AAA_JSONL);
    expect(after).toBe(before);
  });

  test("chat link --project creates project and links chat", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const linkResult = await runCli(home, [
      "chat",
      "link",
      AAA_UUID,
      "--project",
      "066-FemaleFutureWP",
    ]);
    expect(linkResult.exitCode).toBe(0);

    const show = await runCli(home, ["chat", "show", AAA_UUID, "--json"]);
    const parsed = JSON.parse(show.stdout) as { projectSlug: string | null };
    expect(parsed.projectSlug).toBe("066-femalefuturewp");
  });

  test("chat link --unlink removes the link", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    await runCli(home, ["chat", "link", AAA_UUID, "--project", "foo"]);
    const unlink = await runCli(home, ["chat", "link", AAA_UUID, "--unlink"]);
    expect(unlink.exitCode).toBe(0);

    const show = await runCli(home, ["chat", "show", AAA_UUID, "--json"]);
    const parsed = JSON.parse(show.stdout) as { projectSlug: string | null };
    expect(parsed.projectSlug).toBeNull();
  });

  test("chat status set + read", async () => {
    const home = makeTempHome();
    await runCli(home, ["init"]);
    seedConfigWithFixtureArchive(home);

    const set = await runCli(home, ["chat", "status", AAA_UUID, "parked"]);
    expect(set.exitCode).toBe(0);

    const read = await runCli(home, ["chat", "status", AAA_UUID, "--json"]);
    const parsed = JSON.parse(read.stdout) as { status: string };
    expect(parsed.status).toBe("parked");

    const invalid = await runCli(home, [
      "chat",
      "status",
      AAA_UUID,
      "not-a-status",
    ]);
    expect(invalid.exitCode).toBe(1);
  });
});
