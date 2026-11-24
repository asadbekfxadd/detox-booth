import { describe, it, expect } from "vitest";
import { dayRange, dayStartMs, prevDay, reportDue, hoursSinceMidnight, dayLabel } from "@/lib/report-day";
import { dailyReportText, noncash, type DayReport, type PlaceDay } from "@/lib/daily-report-text";

const nb = (s: string) => s.replace(/ /g, " ");
const place = (o: Partial<PlaceDay> = {}): PlaceDay => ({ name: "Vitamin B 1", orders: 0, items: 0, total: 0, cash: 0, card: 0, online: 0, refunds: 0, ...o });
const base: DayReport = { day: "2026-11-23", brand: "Vitamin B", places: [], closed: [] };
// 24 ноября 00:00:30 по Ташкенту = 23 ноября 19:00:30 UTC
const at = (iso: string) => Date.parse(iso);

describe("границы суток по Ташкенту", () => {
  it("сутки 23.11 = 22.11 19:00 UTC … 23.11 19:00 UTC", () => {
    const { from, to } = dayRange("2026-11-23");
    expect(from.toISOString()).toBe("2026-11-22T19:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-23T19:00:00.000Z");
    expect(dayStartMs("2026-11-23")).toBe(from.getTime());
  });
  it("предыдущий день, в том числе через границу месяца и года", () => {
    expect(prevDay("2026-12-01")).toBe("2026-11-30");
    expect(prevDay("2027-01-01")).toBe("2026-12-31");
  });
  it("часы с полуночи", () => {
    expect(hoursSinceMidnight(at("2026-11-23T19:30:00Z"))).toBeCloseTo(0.5);
    expect(dayLabel("2026-11-23")).toBe("23.11");
  });
});

describe("когда пора слать отчёт", () => {
  it("сразу после полуночи: отчёт за вчера", () => {
    expect(reportDue(at("2026-11-23T19:00:30Z"))).toBe("2026-11-23");
    expect(reportDue(at("2026-11-23T23:59:00Z"))).toBe("2026-11-23"); // 04:59
  });
  it("днём и вечером не запускаем: смены в рабочее время не закрываем", () => {
    expect(reportDue(at("2026-11-24T01:00:00Z"))).toBeNull(); // 06:00
    expect(reportDue(at("2026-11-24T12:00:00Z"))).toBeNull(); // 17:00
    expect(reportDue(at("2026-11-24T18:59:00Z"))).toBeNull(); // 23:59
  });
  it("1 января: вчера — 31 декабря", () => {
    expect(reportDue(at("2026-12-31T19:05:00Z"))).toBe("2026-12-31");
  });
});

describe("текст отчёта", () => {
  it("одна точка: количество, сумма, наличные, безнал", () => {
    const t = nb(dailyReportText({ ...base, places: [place({ orders: 30, items: 41, total: 1_230_000, cash: 400_000, card: 830_000 })] }));
    expect(t).toContain("итоги за 23.11"); expect(t).toContain("41 шт."); expect(t).toContain("заказов: 30");
    expect(t).toContain("Сумма: <b>1 230 000</b>"); expect(t).toContain("Наличные: 400 000"); expect(t).toContain("Безнал: 830 000");
    expect(t).not.toContain("Возвраты"); expect(t).not.toContain("Все точки");
  });
  it("безнал = карта + онлайн, с разбивкой когда есть оба", () => {
    expect(noncash({ card: 100, online: 50 })).toBe(150);
    const t = nb(dailyReportText({ ...base, places: [place({ orders: 2, items: 2, total: 300, cash: 150, card: 100, online: 50 })] }));
    expect(t).toContain("Безнал: 150 (карта 100, онлайн 50)");
  });
  it("несколько точек: по каждой и общий итог; пустые точки не показываем", () => {
    const t = nb(dailyReportText({ ...base, places: [place({ orders: 1, items: 2, total: 100, cash: 100 }), place({ name: "Vitamin B 2", orders: 3, items: 5, total: 900, cash: 300, card: 600 }), place({ name: "Пустая" })] }));
    expect(t).toContain("Vitamin B 2"); expect(t).not.toContain("Пустая"); expect(t).toContain("Все точки"); expect(t).toContain("7 шт."); expect(t).toContain("Сумма: <b>1 000</b>");
  });
  it("день без продаж", () => {
    expect(dailyReportText({ ...base, places: [place()] })).toContain("Продаж не было");
  });
  it("возвраты и автозакрытие смен; имена экранируются", () => {
    const t = nb(dailyReportText({ ...base, places: [place({ orders: 1, items: 1, total: 50, cash: 50, refunds: 20 })], closed: [{ place: "Точка <1>", cashier: "Али" }] }));
    expect(t).toContain("Возвраты: 20"); expect(t).toContain("закрыта автоматически (1)"); expect(t).toContain("Точка &lt;1&gt; — Али");
  });
  it("отчёт на сейчас помечен", () => {
    expect(dailyReportText({ ...base, partial: true, places: [place()] })).toContain("(на сейчас)");
  });
});
