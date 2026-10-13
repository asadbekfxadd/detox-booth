import { describe, expect, it } from "vitest";
import { clickCheckoutUrl, clickConfig, clickSign, clickSignOk, parseClickBody } from "@/services/payments/click";
import { paymeAuthOk, paymeCheckoutUrl, paymeConfig, toTiyin, handlePayme } from "@/services/payments/payme";
import { enabledProviders } from "@/services/payments";

describe("Payme", () => {
  const cfg = { merchantId: "m123", key: "secret-key", test: false };
  const auth = (k: string) => `Basic ${Buffer.from(`Paycom:${k}`).toString("base64")}`;
  it("суммы в тийинах без ошибок округления", () => {
    expect(toTiyin(58000)).toBe(5_800_000);
    expect(toTiyin(0.1 + 0.2)).toBe(30);
    expect(toTiyin(12345.67)).toBe(1_234_567);
  });
  it("проверяет заголовок Authorization", () => {
    expect(paymeAuthOk(auth("secret-key"), "secret-key")).toBe(true);
    expect(paymeAuthOk(auth("other-key"), "secret-key")).toBe(false);
    expect(paymeAuthOk(null, "secret-key")).toBe(false);
    expect(paymeAuthOk("Bearer x", "secret-key")).toBe(false);
    expect(paymeAuthOk(`Basic ${Buffer.from("Someone:secret-key").toString("base64")}`, "secret-key")).toBe(false);
  });
  it("ссылка на оплату содержит мерчанта, заказ и сумму в тийинах", () => {
    const url = paymeCheckoutUrl(cfg, { orderId: "ord1", amountUzs: 58000, returnUrl: "https://x.uz/order/ord1" });
    expect(url.startsWith("https://checkout.paycom.uz/")).toBe(true);
    expect(Buffer.from(url.split("/").pop()!, "base64").toString()).toBe("m=m123;ac.order_id=ord1;a=5800000;l=ru;c=https://x.uz/order/ord1");
    expect(paymeCheckoutUrl({ ...cfg, test: true }, { orderId: "a", amountUzs: 1, returnUrl: "u" }).startsWith("https://test.paycom.uz/")).toBe(true);
  });
  it("без верной авторизации отвечает -32504 и не трогает базу", async () => {
    const r = (await handlePayme({ id: 7, method: "CheckPerformTransaction", params: {} }, auth("wrong"), cfg)) as { error: { code: number }; id: number };
    expect(r.error.code).toBe(-32504);
    expect(r.id).toBe(7);
  });
  it("неизвестный метод и кривой запрос", async () => {
    expect(((await handlePayme({ id: 1, method: "Nope", params: {} }, auth("secret-key"), cfg)) as { error: { code: number } }).error.code).toBe(-32601);
    expect(((await handlePayme({ id: 1 }, auth("secret-key"), cfg)) as { error: { code: number } }).error.code).toBe(-32600);
    expect(((await handlePayme("junk", auth("secret-key"), cfg)) as { error: { code: number } }).error.code).toBe(-32600);
  });
  it("конфиг только при обоих значениях", () => {
    expect(paymeConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(paymeConfig({ PAYME_MERCHANT_ID: "m" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(paymeConfig({ PAYME_MERCHANT_ID: "m", PAYME_KEY: "k", PAYME_TEST: "1" } as unknown as NodeJS.ProcessEnv)).toEqual({ merchantId: "m", key: "k", test: true });
  });
});

describe("Click", () => {
  const cfg = { serviceId: "555", merchantId: "777", secretKey: "click-secret" };
  const prepare = { click_trans_id: "1001", service_id: "555", merchant_trans_id: "ord1", amount: "58000", action: "0", sign_time: "2026-10-13 12:00:00" };
  it("подпись prepare: md5 от склейки полей", () => {
    // md5("1001" + "555" + "click-secret" + "ord1" + "58000" + "0" + "2026-10-13 12:00:00")
    const sig = clickSign(prepare, cfg.secretKey);
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    expect(clickSignOk({ ...prepare, sign_string: sig }, cfg.secretKey)).toBe(true);
    expect(clickSignOk({ ...prepare, sign_string: sig.toUpperCase() }, cfg.secretKey)).toBe(true);
  });
  it("подпись complete включает merchant_prepare_id", () => {
    const c = { ...prepare, action: "1", merchant_prepare_id: "42" };
    expect(clickSign(c, cfg.secretKey)).not.toBe(clickSign({ ...c, merchant_prepare_id: "43" }, cfg.secretKey));
    expect(clickSignOk({ ...c, sign_string: clickSign(c, cfg.secretKey) }, cfg.secretKey)).toBe(true);
    // подпись prepare не годится для complete
    expect(clickSignOk({ ...c, sign_string: clickSign(prepare, cfg.secretKey) }, cfg.secretKey)).toBe(false);
  });
  it("чужая подпись и подмена суммы отвергаются", () => {
    const sig = clickSign(prepare, cfg.secretKey);
    expect(clickSignOk({ ...prepare, sign_string: sig }, "another")).toBe(false);
    expect(clickSignOk({ ...prepare, amount: "1000", sign_string: sig }, cfg.secretKey)).toBe(false);
    expect(clickSignOk({ ...prepare, sign_string: "" }, cfg.secretKey)).toBe(false);
  });
  it("ссылка на оплату", () => {
    const u = new URL(clickCheckoutUrl(cfg, { orderId: "ord1", amountUzs: 58000, returnUrl: "https://x.uz/order/ord1" }));
    expect(u.origin + u.pathname).toBe("https://my.click.uz/services/pay");
    expect(Object.fromEntries(u.searchParams)).toEqual({ service_id: "555", merchant_id: "777", amount: "58000", transaction_param: "ord1", return_url: "https://x.uz/order/ord1" });
  });
  it("разбор form-urlencoded тела и конфиг", () => {
    expect(parseClickBody("click_trans_id=1&amount=100.5&sign_time=2026-10-13+12%3A00%3A00")).toEqual({ click_trans_id: "1", amount: "100.5", sign_time: "2026-10-13 12:00:00" });
    expect(clickConfig({ CLICK_SERVICE_ID: "1" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("реестр провайдеров", () => {
  it("подключает payme и click только с полными настройками", () => {
    const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
    expect(enabledProviders(env({ PAYMENT_PROVIDERS: "payme,click" }))).toHaveLength(0);
    expect(enabledProviders(env({ PAYMENT_PROVIDERS: "payme,click", PAYME_MERCHANT_ID: "m", PAYME_KEY: "k" })).map((p) => p.id)).toEqual(["payme"]);
    const both = enabledProviders(env({ PAYMENT_PROVIDERS: "payme, click", PAYME_MERCHANT_ID: "m", PAYME_KEY: "k", CLICK_SERVICE_ID: "1", CLICK_MERCHANT_ID: "2", CLICK_SECRET_KEY: "s" }));
    expect(both.map((p) => p.label)).toEqual(["Payme", "Click"]);
  });
});

describe("повторная оплата", () => {
  it("ссылка для Payme и Click строится из настроек, для остальных нет", async () => {
    const { repayUrl } = await import("@/services/payments");
    const env = { PAYME_MERCHANT_ID: "m1", PAYME_KEY: "k", CLICK_SERVICE_ID: "1", CLICK_MERCHANT_ID: "2", CLICK_SECRET_KEY: "s" } as unknown as NodeJS.ProcessEnv;
    const i = { orderId: "o1", amount: 28000, returnUrl: "https://x.uz/order/o1" };
    expect(repayUrl("payme", i, env)).toMatch(/^https:\/\/checkout\.paycom\.uz\//);
    expect(repayUrl("click", i, env)).toContain("transaction_param=o1");
    expect(repayUrl("test", i, env)).toBeNull();
    expect(repayUrl(null, i, env)).toBeNull();
    expect(repayUrl("payme", i, {} as NodeJS.ProcessEnv)).toBeNull();
  });
});
