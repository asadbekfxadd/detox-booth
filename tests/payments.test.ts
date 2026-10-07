import { describe, it, expect } from "vitest";
import { createTestProvider, signBody } from "@/services/payments/test-provider";
import { enabledProviders } from "@/services/payments";

const SECRET = "0123456789abcdef-secret";
const body = JSON.stringify({ externalId: "test_1", status: "PAID", amount: 45000 });
const h = (sig?: string) => new Headers(sig ? { "x-signature": sig } : {});

describe("платёжный слой", () => {
  const p = createTestProvider(SECRET);
  it("принимает верную подпись", () => {
    expect(p.verifyWebhook(body, h(signBody(body, SECRET)))).toEqual({ externalId: "test_1", status: "PAID", amount: 45000 });
  });
  it("отвергает чужую подпись, пустую и изменённое тело", () => {
    expect(p.verifyWebhook(body, h(signBody(body, "other-secret-other-secret")))).toBeNull();
    expect(p.verifyWebhook(body, h())).toBeNull();
    expect(p.verifyWebhook(body, h("zz"))).toBeNull();
    expect(p.verifyWebhook(body.replace("45000", "1"), h(signBody(body, SECRET)))).toBeNull();
  });
  it("отвергает неизвестный статус", () => {
    const bad = JSON.stringify({ externalId: "x", status: "WHATEVER" });
    expect(p.verifyWebhook(bad, h(signBody(bad, SECRET)))).toBeNull();
  });
  it("провайдеры выключены по умолчанию и без секрета", () => {
    expect(enabledProviders({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toHaveLength(0);
    expect(enabledProviders({ PAYMENT_PROVIDERS: "test" } as unknown as NodeJS.ProcessEnv)).toHaveLength(0);
    expect(enabledProviders({ PAYMENT_PROVIDERS: "test", PAYMENT_WEBHOOK_SECRET: SECRET } as unknown as NodeJS.ProcessEnv).map((x) => x.id)).toEqual(["test"]);
  });
});
