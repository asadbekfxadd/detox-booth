import { describe, it, expect } from "vitest";
import { assignableRoles } from "@/services/employees";

describe("кого можно назначать сотрудниками", () => {
  it("владелец — любые роли", () => expect(assignableRoles("OWNER")).toContain("OWNER"));
  it("администратор не создаёт владельцев и администраторов", () => {
    const r = assignableRoles("ADMIN");
    expect(r).not.toContain("OWNER");
    expect(r).not.toContain("ADMIN");
    expect(r).toContain("CASHIER");
  });
});
