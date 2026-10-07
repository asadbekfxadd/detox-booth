/** История заказов клиента без регистрации: id заказов хранятся только в браузере (id — длинный и неугадываемый). */
const KEY = "vb-orders";
const MAX = 10;
const ID = /^[a-z0-9]{20,40}$/i;

export function readOrderIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && ID.test(x)).slice(0, MAX) : [];
  } catch { return []; }
}

export function rememberOrder(id: string) {
  if (!ID.test(id)) return;
  try { localStorage.setItem(KEY, JSON.stringify([id, ...readOrderIds().filter((x) => x !== id)].slice(0, MAX))); } catch { /* необязательно */ }
}
