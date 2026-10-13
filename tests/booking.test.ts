import { describe, expect, it } from "vitest";
import { checkWhen, overlaps, pickTable, slotTimes, toUtc, type Busy } from "@/lib/booking";
import { canMove } from "@/services/reservations";
import { can, ROUTE_PERMISSIONS } from "@/lib/rbac";

const min = 60000;
const T = [{ id: "t2", number: 2, seats: 2 }, { id: "t4", number: 1, seats: 4 }, { id: "t6", number: 3, seats: 6 }];
const at = toUtc("2026-10-20", "19:00")!;
const slot = { startsAt: at, durationMin: 90 };

describe("бронь столов", () => {
  it("время в Ташкенте переводится в UTC", () => {
    expect(new Date(at).toISOString()).toBe("2026-10-20T14:00:00.000Z");
    expect(toUtc("2026-02-31", "10:00")).toBeNull();
    expect(toUtc("bad", "10:00")).toBeNull();
    expect(toUtc("2026-10-20", "25:00")).toBeNull();
  });
  it("пересечения: впритык можно, внахлёст нет", () => {
    expect(overlaps(slot, { startsAt: at + 90 * min, durationMin: 90 })).toBe(false);
    expect(overlaps(slot, { startsAt: at - 90 * min, durationMin: 90 })).toBe(false);
    expect(overlaps(slot, { startsAt: at + 89 * min, durationMin: 90 })).toBe(true);
    expect(overlaps(slot, { startsAt: at - 30 * min, durationMin: 60 })).toBe(true);
  });
  it("подбирает самый компактный подходящий стол", () => {
    expect(pickTable(T, [], slot, 2)?.id).toBe("t2");
    expect(pickTable(T, [], slot, 3)?.id).toBe("t4");
    expect(pickTable(T, [], slot, 5)?.id).toBe("t6");
    expect(pickTable(T, [], slot, 7)).toBeNull();
  });
  it("занятый стол пропускает, берёт следующий по размеру", () => {
    const busy: Busy[] = [{ tableId: "t2", startsAt: at + 30 * min, durationMin: 90 }];
    expect(pickTable(T, busy, slot, 2)?.id).toBe("t4");
    expect(pickTable(T, [...busy, { tableId: "t4", startsAt: at, durationMin: 90 }, { tableId: "t6", startsAt: at, durationMin: 90 }], slot, 2)).toBeNull();
  });
  it("слоты с шагом 30 минут", () => {
    expect(slotTimes(10, 12)).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00"]);
  });
  it("ограничения по срокам", () => {
    const now = at - 3 * 3600000;
    expect(checkWhen(at, now, 60, 30).ok).toBe(true);
    expect(checkWhen(now + 30 * min, now, 60, 30).ok).toBe(false);
    expect(checkWhen(now + 31 * 86400000, now, 60, 30).ok).toBe(false);
  });
  it("переходы статусов", () => {
    expect(canMove("PENDING", "CONFIRMED")).toBe(true);
    expect(canMove("CONFIRMED", "SEATED")).toBe(true);
    expect(canMove("CONFIRMED", "NO_SHOW")).toBe(true);
    expect(canMove("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canMove("SEATED", "CANCELLED")).toBe(false);
    expect(canMove("PENDING", "NO_SHOW")).toBe(false);
  });
  it("права: кассир и менеджер ведут брони, курьер и повар нет", () => {
    expect(can("CASHIER", "reservations.manage")).toBe(true);
    expect(can("MANAGER", "reservations.manage")).toBe(true);
    expect(can("COURIER", "reservations.manage")).toBe(false);
    expect(can("BARISTA", "reservations.manage")).toBe(false);
    expect(ROUTE_PERMISSIONS.find(([p]) => p === "/admin/reservations")?.[1]).toBe("reservations.manage");
  });
});
