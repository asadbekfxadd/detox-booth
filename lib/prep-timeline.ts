/**
 * Расписание анимации «Смотреть сборку»: по одному ингредиенту (кладут на доску, рубят, «бац» в блендер), затем взбивание,
 * банку поднимают над стаканом, наклоняют и льют, ставят трубочку. Длина цикла зависит от числа ингредиентов,
 * поэтому keyframes считаем здесь, а не пишем руками в процентах. Время везде в секундах от начала цикла.
 */
export type PrepPlan = { n: number; chop: boolean };
type Stop = [t: number, css: string];

const f = (x: number) => Math.round(x * 100) / 100;

/** keyframes из списка (секунда, стили); начало и конец цикла достраиваются значениями ближайших остановок. */
function kf(name: string, cycle: number, stops: Stop[]): string {
  const s = [...stops].sort((a, b) => a[0] - b[0]);
  if (s[0][0] > 0) s.unshift([0, s[0][1]]);
  if (s[s.length - 1][0] < cycle) s.push([cycle, s[s.length - 1][1]]);
  return `@keyframes ${name}{${s.map(([t, css]) => `${f((t / cycle) * 100)}%{${css}}`).join("")}}`;
}

export const BOARD_X = 104;   // ингредиент всегда лежит по центру доски
export const ITEM_Y = 304;
export const MOUTH_X = 268;   // горловина блендера
export const MOUTH_Y = 92;

export function prepTimeline({ n, chop }: PrepPlan): { cycle: number; css: string } {
  const N = Math.max(1, Math.min(3, Math.round(n)));
  const SLOT = chop ? 2.7 : 1.7;               // сколько времени на один ингредиент
  const S = (i: number) => 0.3 + i * SLOT;     // ингредиент появился на доске
  const hop = (i: number) => S(i) + (chop ? 1.65 : 0.7); // прыжок в блендер
  const arrive = (i: number) => hop(i) + 0.85;  // долетел до горловины
  const T1 = hop(N - 1) + 1.2;                  // все ингредиенты в банке
  const T2 = T1 + 2.3;                          // взбили, начинаем лить
  const cycle = f(T2 + 6.1);
  let css = "";
  const add = (name: string, cls: string, stops: Stop[]) => {
    css += kf(name, cycle, stops) + `.${cls}{animation:${name} ${cycle}s ease-in-out infinite both}`;
  };

  // доска
  add("prep-board", "prep-board", [[0, "opacity:0;transform:translateY(18px)"], [0.3, "opacity:1;transform:none"], [hop(N - 1) + 0.2, "opacity:1;transform:none"], [hop(N - 1) + 0.7, "opacity:0;transform:translateY(18px)"]]);

  // каждый ингредиент: появился, (разрублен), прыжок, падение внутрь
  for (let i = 0; i < N; i++) {
    const s = S(i), h = hop(i);
    add(`prep-pc-${i}`, `prep-pc-${i}`, [
      [s, "opacity:0;translate:0 -34px;scale:.6"], [s + 0.4, "opacity:1;translate:0 0;scale:1.08"], [s + 0.55, "opacity:1;translate:0 0;scale:1"],
      [h - 0.12, "opacity:1;translate:0 0;scale:1"], [h, "opacity:1;translate:0 -8px;scale:1"],
      [h + 0.5, "opacity:1;translate:calc(var(--dx) * .55) calc(var(--dy) - 56px);scale:.95"],
      [h + 0.85, "opacity:1;translate:var(--dx) var(--dy);scale:.85"],
      [h + 1.05, "opacity:0;translate:var(--dx) calc(var(--dy) + 80px);scale:.5"],
    ]);
    if (chop) {
      for (const [side, sign] of [["l", -1], ["r", 1]] as const) {
        add(`prep-half-${side}-${i}`, `prep-half-${side}-${i}`, [
          [s + 0.88, "transform:none"], [s + 0.9, `transform:translateX(${sign}px) rotate(${sign}deg) scale(1,.95)`],
          [s + 1.05, `transform:translateX(${sign * 7}px) rotate(${sign * 6}deg)`], [s + 1.3, `transform:translateX(${sign * 7}px) rotate(${sign * 6}deg)`],
          [s + 1.4, `transform:translateX(${sign * 12}px) rotate(${sign * 10}deg)`],
        ]);
      }
    }
  }

  // нож: над ингредиентом, два удара, пока ждёт следующего висит над доской
  if (chop) {
    const k = (x: number, y: number, r: number, o = 1) => `opacity:${o};transform:translate(${x}px,${y}px) rotate(${r}deg)`;
    const stops: Stop[] = [[0, k(BOARD_X, -92, -18, 0)]];
    for (let i = 0; i < N; i++) {
      const s = S(i);
      stops.push([s + 0.45, k(BOARD_X, -62, -12)], [s + 0.9, k(BOARD_X, 0, 0)], [s + 1.05, k(BOARD_X, -46, -12)],
        [s + 1.2, k(BOARD_X + 8, -50, -12)], [s + 1.32, k(BOARD_X + 8, 0, 0)], [s + 1.55, k(BOARD_X, -62, -12)]);
    }
    stops.push([S(N - 1) + 1.9, k(BOARD_X, -92, -22, 0)]);
    add("prep-knife", "prep-knife", stops);
  }

  // блендер: уровень поднимается с каждым ингредиентом, потом взбивание
  const level = (k: number) => `transform:translateY(${f(100 - (72 * (k + 1)) / N)}%)`;
  const liq: Stop[] = [[0, "transform:translateY(100%)"]];
  for (let i = 0; i < N; i++) liq.push([arrive(i), i === 0 ? "transform:translateY(100%)" : level(i - 1)], [arrive(i) + 0.5, level(i)]);
  liq.push([T2 + 1.4, level(N - 1)], [T2 + 3.1, "transform:translateY(100%)"]);
  add("prep-jar-level", "prep-liq-jar", liq);
  add("prep-foam", "prep-foam", [[0, "opacity:0"], [T1 + 0.3, "opacity:0"], [T1 + 0.6, "opacity:1"], [T2 - 0.1, "opacity:1"], [T2 + 0.3, "opacity:0"]]);
  add("prep-lid", "prep-lid", [[0, "opacity:0;transform:translateY(-18px)"], [T1 - 0.3, "opacity:0;transform:translateY(-18px)"], [T1, "opacity:1;transform:none"], [T2 - 0.1, "opacity:1;transform:none"], [T2 + 0.2, "opacity:0;transform:translateY(-18px)"]]);

  // банка: трясётся, потом поднимается над основанием, наклоняется, льёт, возвращается
  const lift = "translate(-48px,-26px)", tilt = `${lift} rotate(-28deg)`;
  const jar: Stop[] = [[0, "transform:none"], [T1 + 0.15, "transform:none"]];
  for (let k = 0; k < 6; k++) jar.push([T1 + 0.15 + (k + 1) * 0.3, `transform:translateX(${k % 2 ? 3 : -3}px) rotate(${k % 2 ? 1 : -1}deg)`]);
  jar.push([T2, "transform:none"], [T2 + 0.8, `transform:${lift}`], [T2 + 1.4, `transform:${tilt}`], [T2 + 3.1, `transform:${tilt}`], [T2 + 3.7, `transform:${lift}`], [T2 + 4.3, "transform:none"]);
  add("prep-jar", "prep-jar", jar);

  // струя и стакан
  add("prep-stream", "prep-pour", [[0, "stroke-dashoffset:1"], [T2 + 1.35, "stroke-dashoffset:1"], [T2 + 1.65, "stroke-dashoffset:0"], [T2 + 3, "stroke-dashoffset:0"], [T2 + 3.35, "stroke-dashoffset:-1"]]);
  add("prep-glass", "prep-glass", [[0, "opacity:0;transform:translateY(14px)"], [T1 + 0.4, "opacity:0;transform:translateY(14px)"], [T1 + 0.9, "opacity:1;transform:none"], [T2 + 5.2, "opacity:1"], [T2 + 5.7, "opacity:0"]]);
  add("prep-glass-level", "prep-liq-glass", [[0, "transform:translateY(100%)"], [T2 + 1.5, "transform:translateY(100%)"], [T2 + 3.1, "transform:translateY(8%)"]]);
  add("prep-straw", "prep-straw", [[0, "opacity:0;transform:translateY(-16px)"], [T2 + 3.4, "opacity:0;transform:translateY(-16px)"], [T2 + 3.9, "opacity:1;transform:none"]]);
  add("prep-finish", "prep-done", [[0, "opacity:0;transform:scale(.6)"], [T2 + 3.8, "opacity:0;transform:scale(.6)"], [T2 + 4.1, "opacity:1;transform:none"], [T2 + 5, "opacity:1;transform:none"], [T2 + 5.4, "opacity:0;transform:scale(.8)"]]);
  return { cycle, css };
}
