import { describe, it, expect } from "vitest";
import { csvCell, csvLine } from "@/lib/csv";

describe("CSV-экспорт", () => {
  it("экранирует формулы", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+7 999")).toBe("'+7 999");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-1+1")).toBe("'-1+1");
  });
  it("числа и отрицательные суммы не трогает", () => {
    expect(csvCell(-1500)).toBe("-1500");
    expect(csvCell("-12.5")).toBe("-12.5");
    expect(csvCell(0)).toBe("0");
  });
  it("разделитель и кавычки", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('он сказал "да"')).toBe('"он сказал ""да"""');
    expect(csvLine("Дата", 5, null)).toBe("Дата;5;");
  });
});
