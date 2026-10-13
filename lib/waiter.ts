import { z } from "zod";

/** Подачи: официант заказывает всё сразу, но горячее и десерт можно придержать до нужного момента. */
export const COURSES = [
  { value: 1, label: "Сразу" },
  { value: 2, label: "Горячее" },
  { value: 3, label: "Десерт" },
] as const;

export const courseLabel = (n: number) => COURSES.find((c) => c.value === n)?.label ?? `Подача ${n}`;

/** По умолчанию на кухню сразу уходит только первая подача; остальные ждут кнопки «На кухню». */
export const defaultHold = (course: number) => course > 1;

export const waiterOrderSchema = z.object({
  tableId: z.string().min(1, "Выберите стол"),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int("Некорректное количество").min(1, "Некорректное количество").max(50, "Слишком большое количество"),
    optionIds: z.array(z.string().min(1)).max(30),
  })).min(1, "Добавьте хотя бы одну позицию").max(40, "Слишком много позиций"),
  note: z.string().trim().max(250, "Комментарий слишком длинный").optional(),
  course: z.number().int().min(1).max(3).default(1),
  hold: z.boolean().default(false),
});
export type WaiterOrderInput = z.input<typeof waiterOrderSchema>;

/** Заказы одной подачи, которые ждут отправки на кухню. */
export function heldOrders<T extends { status: string; onHold: boolean; course: number }>(orders: T[], course?: number) {
  return orders.filter((o) => o.status === "NEW" && o.onHold && (course == null || o.course === course));
}

/** Группировка заказов стола по подачам, по порядку подач. */
export function groupByCourse<T extends { course: number }>(orders: T[]) {
  const map = new Map<number, T[]>();
  for (const o of orders) map.set(o.course, [...(map.get(o.course) ?? []), o]);
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([course, list]) => ({ course, label: courseLabel(course), orders: list }));
}

/** Комментарий для кухни: подача + пометка официанта. */
export function waiterNote(course: number, note: string | undefined) {
  const parts = [course > 1 ? courseLabel(course) : "", note?.trim() ?? ""].filter(Boolean);
  return parts.length ? parts.join(". ").slice(0, 300) : null;
}
