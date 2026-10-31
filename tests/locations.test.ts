import { describe, it, expect } from "vitest";
import { newLocationSchema } from "@/services/locations";

describe("новая точка: проверка формы", () => {
  it("название обязательно и не короче 2 символов", () => {
    expect(newLocationSchema.safeParse({ name: "" }).success).toBe(false);
    expect(newLocationSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(newLocationSchema.safeParse({ name: "  Vitamin B Sergeli  " }).data?.name).toBe("Vitamin B Sergeli");
  });
  it("слишком длинное название отклоняется", () => expect(newLocationSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false));
  it("менеджер необязателен", () => expect(newLocationSchema.safeParse({ name: "Точка", managerName: "", managerEmail: "", managerPassword: "" }).success).toBe(true));
});
