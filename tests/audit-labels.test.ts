import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ACTION_LABEL } from "@/lib/audit-labels";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (["node_modules", ".next", "tests"].includes(f)) return [];
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe("журнал действий", () => {
  it("у каждого записываемого действия есть русское название", () => {
    const root = path.resolve(__dirname, "..");
    const used = new Set<string>();
    for (const f of [...files(path.join(root, "app")), ...files(path.join(root, "services")), ...files(path.join(root, "lib"))]) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/action:\s*(?:\w+\s*\?\s*)?"([A-Z][A-Z_]+)"(?:\s*:\s*"([A-Z][A-Z_]+)")?/g)) { used.add(m[1]); if (m[2]) used.add(m[2]); }
    }
    const missing = [...used].filter((a) => !(a in ACTION_LABEL));
    expect(missing).toEqual([]);
  });
});
