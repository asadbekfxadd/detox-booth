/**
 * Приход списком: разбор текста, вставленного из накладной, Excel или мессенджера.
 * Строка: «Название; количество [единица]; цена; срок годности», разделитель — табуляция (из Excel) или «;».
 * Цена и срок необязательны: цена берётся прежняя (средняя), срок — по умолчанию для ингредиента.
 * Цена указывается за ту же единицу, что и количество: «Клубника; 5 кг; 60000» — 60 000 за кг.
 */
export type ListIngredient = { id: string; name: string; unit: string; avgCost: number };
export type ListRow = { ingredientId: string; quantity: string; unitCost: string; big: boolean; expiresAt: string };
/** failed — исходные строки с ошибками: их оставляем в поле, чтобы поправить и вставить снова */
export type ParseResult = { rows: ListRow[]; errors: string[]; failed: string[] };

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const num = (s: string) => {
  const t = s.replace(/\s/g, "").replace(",", ".");
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
};
const UNITS: Record<string, "G" | "ML" | "PC" | "KG" | "L"> = { г: "G", гр: "G", кг: "KG", мл: "ML", л: "L", шт: "PC" };
/** Базовая единица ингредиента и какими единицами её можно записать. */
const ALLOWED: Record<string, { small: string[]; big: string[]; mult: number }> = {
  G: { small: ["G"], big: ["KG"], mult: 1000 }, ML: { small: ["ML"], big: ["L"], mult: 1000 }, PC: { small: ["PC"], big: [], mult: 1 },
};
const r6 = (n: number) => String(Number(n.toFixed(6)));

function parseDate(s: string): string | null {
  const t = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) { const d = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(t); if (d) m = [d[0], d[3], d[2].padStart(2, "0"), d[1].padStart(2, "0")] as unknown as RegExpExecArray; }
  if (!m) return null;
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}` ? null : `${m[1]}-${m[2]}-${m[3]}`;
}

export function findByName(name: string, list: ListIngredient[]): { ing?: ListIngredient; error?: string } {
  const n = norm(name);
  const exact = list.filter((i) => norm(i.name) === n);
  if (exact.length === 1) return { ing: exact[0] };
  if (exact.length > 1) return { error: `«${name}»: несколько одинаковых ингредиентов` };
  for (const test of [(x: string) => x.startsWith(n), (x: string) => x.includes(n)]) {
    const hit = list.filter((i) => test(norm(i.name)));
    if (hit.length === 1) return { ing: hit[0] };
    if (hit.length > 1) return { error: `«${name}»: подходит несколько (${hit.slice(0, 3).map((h) => h.name).join(", ")}), уточните название` };
  }
  return { error: `«${name}»: такого ингредиента нет` };
}

export function parseReceiveList(text: string, list: ListIngredient[]): ParseResult {
  const rows: ListRow[] = [], errors: string[] = [], failed: string[] = [];
  text.split(/\r?\n/).forEach((line, idx) => {
    if (!line.trim()) return;
    const n0 = errors.length;
    parseLine(line, idx);
    if (errors.length > n0) failed.push(line);
  });
  function parseLine(line: string, idx: number) {
    const at = `Строка ${idx + 1}`;
    const parts = (line.includes("\t") ? line.split("\t") : line.split(";")).map((p) => p.trim());
    const [name = "", qtyRaw = "", costRaw = "", dateRaw = ""] = parts;
    if (!name || !qtyRaw) { errors.push(`${at}: нужны название и количество`); return; }
    const found = findByName(name, list);
    if (!found.ing) { errors.push(`${at}: ${found.error}`); return; }
    const ing = found.ing;
    const qm = /^([\d\s.,]+?)\s*([а-яa-z]+)?\.?$/i.exec(qtyRaw);
    const q = qm ? num(qm[1]) : NaN;
    if (!(q > 0)) { errors.push(`${at}: «${qtyRaw}» — не количество`); return; }
    const unitKey = qm?.[2] ? UNITS[qm[2].toLowerCase()] : undefined;
    if (qm?.[2] && !unitKey) { errors.push(`${at}: неизвестная единица «${qm[2]}»`); return; }
    const al = ALLOWED[ing.unit] ?? ALLOWED.PC;
    let big = false;
    if (unitKey) {
      if (al.big.includes(unitKey)) big = true;
      else if (!al.small.includes(unitKey)) { errors.push(`${at}: «${ing.name}» считается не в «${qm![2]}»`); return; }
    }
    const mult = big ? al.mult : 1;
    let unitCost: string;
    if (costRaw === "") unitCost = r6(ing.avgCost * mult);
    else {
      const c = num(costRaw);
      if (!(c >= 0)) { errors.push(`${at}: «${costRaw}» — не цена`); return; }
      unitCost = r6(c);
    }
    let expiresAt = "";
    if (dateRaw) {
      const d = parseDate(dateRaw);
      if (!d) { errors.push(`${at}: срок годности «${dateRaw}» не распознан (ГГГГ-ММ-ДД или ДД.ММ.ГГГГ)`); return; }
      expiresAt = d;
    }
    rows.push({ ingredientId: ing.id, quantity: r6(q), unitCost, big, expiresAt });
  }
  return { rows, errors, failed };
}
