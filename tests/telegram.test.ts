import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyInitData, webhookSecret, safeEqual, escapeHtml } from "@/lib/telegram";
import { orderMessage, kindForStatus, ordersMessage, locationsMessage, greeting } from "@/lib/telegram-messages";

const TOKEN = "123456:TEST-token";
const NOW = 1_800_000_000_000;

/** initData так, как его подписывает Telegram */
function sign(fields: Record<string, string>, token = TOKEN) {
  const check = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
const user = (o: object = {}) => JSON.stringify({ id: 777000111, first_name: "Анна", last_name: "К", username: "anna_k", language_code: "ru", allows_write_to_pm: true, ...o });
const fresh = (extra: Record<string, string> = {}) => ({ auth_date: String(Math.floor(NOW / 1000) - 60), query_id: "AAH", user: user(), ...extra });

describe("проверка данных Mini App", () => {
  it("верная подпись: возвращает пользователя", () => {
    expect(verifyInitData(sign(fresh()), TOKEN, NOW)).toEqual({ id: "777000111", firstName: "Анна", lastName: "К", username: "anna_k", languageCode: "ru", allowsWrite: true });
  });
  it("подмена поля ломает подпись", () => {
    const ok = sign(fresh());
    const p = new URLSearchParams(ok); p.set("user", user({ id: 1 }));
    expect(verifyInitData(p.toString(), TOKEN, NOW)).toBeNull();
  });
  it("чужой токен или пустой токен — отказ", () => {
    expect(verifyInitData(sign(fresh()), "999:other", NOW)).toBeNull();
    expect(verifyInitData(sign(fresh()), "", NOW)).toBeNull();
  });
  it("просроченные данные не принимаются, будущая дата тоже", () => {
    expect(verifyInitData(sign(fresh({ auth_date: String(Math.floor(NOW / 1000) - 3 * 86400) })), TOKEN, NOW)).toBeNull();
    expect(verifyInitData(sign(fresh({ auth_date: String(Math.floor(NOW / 1000) + 3600) })), TOKEN, NOW)).toBeNull();
  });
  it("нет подписи, мусор, слишком длинная строка", () => {
    expect(verifyInitData("", TOKEN, NOW)).toBeNull();
    expect(verifyInitData("user=%7B%7D", TOKEN, NOW)).toBeNull();
    expect(verifyInitData("hash=zzz&user=1", TOKEN, NOW)).toBeNull();
    expect(verifyInitData("a=" + "x".repeat(5000), TOKEN, NOW)).toBeNull();
  });
  it("бот и нечисловой id не проходят", () => {
    expect(verifyInitData(sign(fresh({ user: user({ is_bot: true }) })), TOKEN, NOW)).toBeNull();
    expect(verifyInitData(sign(fresh({ user: user({ id: "abc" }) })), TOKEN, NOW)).toBeNull();
    expect(verifyInitData(sign(fresh({ user: "not json" })), TOKEN, NOW)).toBeNull();
  });
  it("без имени подставляется «Гость»", () => {
    const u = verifyInitData(sign(fresh({ user: JSON.stringify({ id: 5 }) })), TOKEN, NOW);
    expect(u?.firstName).toBe("Гость"); expect(u?.allowsWrite).toBe(false);
  });
});

describe("секрет вебхука", () => {
  it("стабилен, допустимые символы, зависит от токена и ключа", () => {
    const a = webhookSecret("t1", "k");
    expect(a).toBe(webhookSecret("t1", "k"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(webhookSecret("t2", "k"));
    expect(a).not.toBe(webhookSecret("t1", "k2"));
  });
  it("сравнение: равные строки и разной длины", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("сообщения бота", () => {
  const o = { number: 42, fulfillment: "PICKUP" as const, total: 64000, pointsEarned: 640, location: "Vitamin B <Chilonzor>" };
  it("самовывоз и доставка отличаются", () => {
    expect(orderMessage("READY", o)).toContain("Можно забирать");
    expect(orderMessage("READY", { ...o, fulfillment: "DELIVERY" })).toContain("курьеру");
    expect(orderMessage("ON_THE_WAY", o)).toContain("в пути");
  });
  it("название точки экранируется", () => {
    expect(orderMessage("CANCELLED", o)).toContain("&lt;Chilonzor&gt;");
    expect(orderMessage("CANCELLED", o)).not.toContain("<Chilonzor>");
  });
  it("баллы только если начислены, сумма с пробелами", () => {
    expect(orderMessage("COMPLETED", o)).toContain("Начислено баллов: 640");
    expect(orderMessage("COMPLETED", { ...o, pointsEarned: 0 })).not.toContain("баллов");
    expect(orderMessage("created", o).replace(/\s/g, " ")).toContain("64 000 сум");
  });
  it("уведомления только по важным статусам", () => {
    expect(kindForStatus("CONFIRMED")).toBe("CONFIRMED");
    expect(kindForStatus("PREPARING")).toBeNull();
    expect(kindForStatus("NEW")).toBeNull();
  });
  it("список заказов: пусто и с экранированием", () => {
    expect(ordersMessage([])).toContain("Заказов пока нет");
    const t = ordersMessage([{ number: 7, status: "READY", total: 30000, at: new Date("2026-10-26T08:00:00Z"), summary: "1× <b>Mango</b>" }]);
    expect(t).toContain("№7"); expect(t).toContain("готов"); expect(t).toContain("&lt;b&gt;Mango");
  });
  it("точки и приветствие", () => {
    expect(locationsMessage([])).toContain("не добавлены");
    expect(locationsMessage([{ name: "A&B", address: null, phone: "+998901234567" }])).toContain("A&amp;B");
    expect(greeting("Vitamin B", "<Аня>")).toContain("&lt;Аня&gt;");
  });
  it("escapeHtml", () => expect(escapeHtml("<a>&")).toBe("&lt;a&gt;&amp;"));
});

import { validCoord, roundCoord, distanceKm, nearestLocation, kmLabel, coordMapsUrl } from "@/lib/geo";

describe("геопозиция", () => {
  const A = { id: "a", lat: 41.2756, lng: 69.2034 }, B = { id: "b", lat: 41.3111, lng: 69.2797 }, C = { id: "c", lat: null, lng: null };
  it("проверка координат", () => {
    expect(validCoord(41.3, 69.2)).toBe(true);
    expect(validCoord(0, 0)).toBe(false);
    expect(validCoord(91, 10)).toBe(false);
    expect(validCoord(10, 181)).toBe(false);
    expect(validCoord(NaN, 10)).toBe(false);
    expect(validCoord("41" as unknown, 69)).toBe(false);
  });
  it("округление до ~100 м", () => {
    expect(roundCoord(41.275649)).toBe(41.276);
    expect(roundCoord(69.20341)).toBe(69.203);
  });
  it("расстояние: Ташкент — несколько км, и нулевое", () => {
    const d = distanceKm(A, B);
    expect(d).toBeGreaterThan(6); expect(d).toBeLessThan(9);
    expect(distanceKm(A, A)).toBe(0);
  });
  it("ближайшая точка; без координат пропускаем; далеко — не предлагаем", () => {
    expect(nearestLocation([A, B, C], { lat: 41.31, lng: 69.27 })?.loc.id).toBe("b");
    expect(nearestLocation([C], { lat: 41.31, lng: 69.27 })).toBeNull();
    expect(nearestLocation([A, B], { lat: 55.75, lng: 37.6 })).toBeNull();
  });
  it("подпись расстояния и ссылка на карту", () => {
    expect(kmLabel(0.04)).toBe("100 м");
    expect(kmLabel(0.46)).toBe("500 м");
    expect(kmLabel(2.34)).toBe("2,3 км");
    expect(kmLabel(14.6)).toBe("15 км");
    expect(coordMapsUrl(41.31, 69.27)).toBe("https://yandex.com/maps/?pt=69.27,41.31&z=17&l=map");
  });
});
