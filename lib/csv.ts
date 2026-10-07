/** Ячейка CSV для Excel (разделитель «;»). Текст, который Excel принял бы за формулу, экранируется апострофом. */
export function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const csvLine = (...v: unknown[]) => v.map(csvCell).join(";");
