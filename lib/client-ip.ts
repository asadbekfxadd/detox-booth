import { headers } from "next/headers";

/**
 * IP клиента за прокси Railway. Берём последний адрес из X-Forwarded-For: его дописывает
 * доверенный прокси, а левые элементы клиент может подделать.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return h.get("x-real-ip") ?? "unknown";
}
