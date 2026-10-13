/** Доставка: чистая логика без БД. */

export type ZoneLike = { id: string; name: string; fee: number; minOrder: number; freeFrom: number | null };

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Цена доставки в зону. amount — сумма заказа после скидки (без доставки).
 * Меньше минимального заказа — нельзя; от порога «бесплатно с» — доставка 0.
 */
export function quoteDelivery(zone: ZoneLike, amount: number): { ok: true; fee: number; free: boolean } | { ok: false; error: string } {
  if (zone.minOrder > 0 && amount < zone.minOrder) {
    return { ok: false, error: `Минимальный заказ в зону «${zone.name}» — ${Math.round(zone.minOrder).toLocaleString("ru-RU")} сум. Добавьте ещё на ${Math.round(zone.minOrder - amount).toLocaleString("ru-RU")} сум.` };
  }
  const free = zone.freeFrom != null && zone.freeFrom > 0 && amount >= zone.freeFrom;
  return { ok: true, fee: free ? 0 : r2(zone.fee), free };
}

export type Stage = "cooking" | "waiting" | "assigned" | "onway" | "done" | "cancelled";

/** Этап доставки заказа. Статус заказа не меняется до «Доставлено»: READY + pickedUpAt = курьер в пути. */
export function deliveryStage(o: { status: string; courierId: string | null; pickedUpAt: Date | string | null }): Stage {
  if (o.status === "CANCELLED") return "cancelled";
  if (o.status === "COMPLETED") return "done";
  if (o.status === "READY") return o.pickedUpAt ? "onway" : o.courierId ? "assigned" : "waiting";
  return "cooking";
}

export const STAGE_LABEL: Record<Stage, string> = {
  cooking: "Готовится", waiting: "Ждёт курьера", assigned: "Курьер назначен", onway: "В пути", done: "Доставлен", cancelled: "Отменён",
};

/** Ссылка для навигации: поиск адреса в Яндекс Картах. */
export const mapsUrl = (address: string) => `https://yandex.com/maps/?text=${encodeURIComponent(address)}`;

/** Телефон для ссылки tel: — только цифры и плюс. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Сколько курьер должен получить от клиента: нет оплаты — вся сумма, онлайн/оплачено — ничего. */
export function collectFromCustomer(total: number, payments: { method: string; status: string; amount: number }[]) {
  const paid = payments.some((p) => p.status === "PAID");
  if (paid) return { amount: 0, method: null as string | null };
  const p = payments.find((x) => x.status === "PENDING");
  if (!p || p.method === "ONLINE") return { amount: 0, method: p?.method ?? null }; // онлайн ждёт подтверждения платежа, наличные не берём
  return { amount: r2(total), method: p.method };
}
