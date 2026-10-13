import { describe, it, expect } from "vitest";
import { quoteDelivery, deliveryStage, collectFromCustomer, mapsUrl, telHref } from "@/lib/delivery";
import { can, homeFor, ROUTE_PERMISSIONS } from "@/lib/rbac";

const zone = (o: Partial<{ fee: number; minOrder: number; freeFrom: number | null }> = {}) => ({ id: "z1", name: "Центр", fee: 15000, minOrder: 0, freeFrom: null, ...o });

describe("цена доставки по зонам", () => {
  it("обычная цена зоны", () => {
    expect(quoteDelivery(zone(), 50000)).toEqual({ ok: true, fee: 15000, free: false });
  });
  it("ниже минимального заказа — отказ с понятным текстом", () => {
    const r = quoteDelivery(zone({ minOrder: 60000 }), 45000);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error).toContain("Центр"); expect(r.error).toMatch(/15\s?000/); }
  });
  it("ровно минимальный заказ проходит", () => {
    expect(quoteDelivery(zone({ minOrder: 60000 }), 60000).ok).toBe(true);
  });
  it("бесплатно от порога, включая сам порог", () => {
    expect(quoteDelivery(zone({ freeFrom: 100000 }), 99999)).toEqual({ ok: true, fee: 15000, free: false });
    expect(quoteDelivery(zone({ freeFrom: 100000 }), 100000)).toEqual({ ok: true, fee: 0, free: true });
  });
  it("порог 0 или пустой не делает доставку бесплатной", () => {
    expect(quoteDelivery(zone({ freeFrom: 0 }), 1000).fee).toBe(15000);
    expect(quoteDelivery(zone({ freeFrom: null }), 1000).fee).toBe(15000);
  });
  it("зона с нулевой ценой — бесплатно, но не по порогу", () => {
    expect(quoteDelivery(zone({ fee: 0 }), 1000)).toEqual({ ok: true, fee: 0, free: false });
  });
});

describe("этап доставки", () => {
  const d = (status: string, courierId: string | null = null, pickedUpAt: Date | null = null) => deliveryStage({ status, courierId, pickedUpAt });
  it("готовится, пока не READY, даже если курьер назначен", () => {
    expect(d("NEW")).toBe("cooking"); expect(d("PREPARING", "c1")).toBe("cooking");
  });
  it("READY: ждёт курьера → назначен → в пути", () => {
    expect(d("READY")).toBe("waiting");
    expect(d("READY", "c1")).toBe("assigned");
    expect(d("READY", "c1", new Date())).toBe("onway");
  });
  it("завершён и отменён", () => {
    expect(d("COMPLETED", "c1", new Date())).toBe("done");
    expect(d("CANCELLED", "c1")).toBe("cancelled");
  });
});

describe("сколько брать с клиента", () => {
  it("наличные при получении — вся сумма", () => {
    expect(collectFromCustomer(80000, [{ method: "CASH", status: "PENDING", amount: 80000 }])).toEqual({ amount: 80000, method: "CASH" });
  });
  it("карта при получении — тоже просим сумму", () => {
    expect(collectFromCustomer(80000, [{ method: "CARD", status: "PENDING", amount: 80000 }]).amount).toBe(80000);
  });
  it("оплачено — ничего не берём", () => {
    expect(collectFromCustomer(80000, [{ method: "ONLINE", status: "PAID", amount: 80000 }]).amount).toBe(0);
  });
  it("онлайн ещё не подтверждён — наличные не берём", () => {
    expect(collectFromCustomer(80000, [{ method: "ONLINE", status: "PENDING", amount: 80000 }]).amount).toBe(0);
  });
  it("нет платежей — ничего", () => {
    expect(collectFromCustomer(80000, []).amount).toBe(0);
  });
});

describe("ссылки", () => {
  it("карта кодирует адрес", () => {
    expect(mapsUrl("ул. Навруз, 10")).toBe("https://yandex.com/maps/?text=%D1%83%D0%BB.%20%D0%9D%D0%B0%D0%B2%D1%80%D1%83%D0%B7%2C%2010");
  });
  it("телефон для звонка без пробелов и скобок", () => {
    expect(telHref("+998 (90) 123-45-67")).toBe("tel:+998901234567");
  });
});

describe("курьер: права и маршруты", () => {
  it("курьер видит только свой экран и печать", () => {
    expect(can("COURIER", "courier.use")).toBe(true);
    for (const p of ["pos.use", "orders.manage", "dashboard.view", "waiter.use", "settings.edit"] as const) expect(can("COURIER", p)).toBe(false);
    expect(homeFor("COURIER")).toBe("/courier");
  });
  it("зоны — настройки, доска — управление заказами; зоны проверяются раньше", () => {
    const i = (p: string) => ROUTE_PERMISSIONS.findIndex(([x]) => x === p);
    expect(ROUTE_PERMISSIONS[i("/admin/delivery/zones")][1]).toBe("settings.edit");
    expect(ROUTE_PERMISSIONS[i("/admin/delivery")][1]).toBe("orders.manage");
    expect(i("/admin/delivery/zones")).toBeLessThan(i("/admin/delivery"));
  });
  it("кассир и бариста не получают курьерский экран", () => {
    expect(can("CASHIER", "courier.use")).toBe(false);
    expect(can("BARISTA", "courier.use")).toBe(false);
  });
});
