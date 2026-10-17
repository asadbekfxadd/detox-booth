import { describe, expect, it } from "vitest";
import { prepTimeline } from "@/lib/prep-timeline";

/** Для каждого @keyframes берём проценты по порядку: они должны строго возрастать и лежать в 0..100. */
function blocks(css: string) {
  return [...css.matchAll(/@keyframes ([\w-]+)\{((?:[\d.]+%\{[^}]*\})+)\}/g)].map((m) => ({ name: m[1], pcts: [...m[2].matchAll(/([\d.]+)%\{/g)].map((x) => Number(x[1])) }));
}

describe("расписание анимации сборки", () => {
  it("чем больше ингредиентов, тем длиннее цикл, и ножа нет без нарезки", () => {
    const one = prepTimeline({ n: 1, chop: true }).cycle, three = prepTimeline({ n: 3, chop: true }).cycle;
    expect(three).toBeGreaterThan(one + 4);
    expect(prepTimeline({ n: 3, chop: false }).cycle).toBeLessThan(three);
    expect(prepTimeline({ n: 2, chop: false }).css).not.toContain("prep-knife");
    expect(prepTimeline({ n: 2, chop: true }).css).toContain("prep-knife");
  });
  it.each([[1, true], [2, true], [3, true], [1, false], [3, false]])("n=%i chop=%s: проценты возрастают, все анимации используют общий цикл", (n, chop) => {
    const { css, cycle } = prepTimeline({ n, chop });
    const list = blocks(css);
    expect(list.length).toBeGreaterThan(8);
    for (const b of list) {
      expect(b.pcts[0]).toBe(0);
      expect(b.pcts[b.pcts.length - 1]).toBe(100);
      for (let i = 1; i < b.pcts.length; i++) expect(b.pcts[i], `${b.name} #${i}`).toBeGreaterThan(b.pcts[i - 1]);
    }
    expect([...css.matchAll(/animation:[\w-]+ ([\d.]+)s/g)].every((m) => Number(m[1]) === cycle)).toBe(true);
  });
  it("лишних ингредиентов больше трёх не бывает", () => {
    expect(prepTimeline({ n: 9, chop: true }).css).not.toContain("prep-pc-3");
  });
});
