import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getLastStatusPath } from "../storage/paths.ts";

export interface AliasMap {
  generatedAt: string;
  aliases: Record<string, string>; // "A1" -> uuid
  reverse: Record<string, string>; // uuid -> "A1"
}

export function writeAliases(map: Record<string, string>): void {
  const path = getLastStatusPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const reverse: Record<string, string> = {};
  for (const [alias, uuid] of Object.entries(map)) reverse[uuid] = alias;
  const data: AliasMap = {
    generatedAt: new Date().toISOString(),
    aliases: map,
    reverse,
  };
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

export function readAliases(): AliasMap | null {
  const path = getLastStatusPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as AliasMap;
  } catch {
    return null;
  }
}
