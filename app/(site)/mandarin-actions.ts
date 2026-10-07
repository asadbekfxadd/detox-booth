"use server";
import { z } from "zod";
import { getSiteLocation } from "@/lib/site";
import { clientIp } from "@/lib/client-ip";
import { hit } from "@/lib/rate-limit";
import { mandarinRespond, menuForAssistant, type MandarinResult } from "@/services/mandarin";

const input = z.object({
  text: z.string().trim().min(1).max(400),
  lang: z.enum(["ru", "uz"]),
  history: z.array(z.object({ role: z.enum(["user", "bot"]), text: z.string().max(600) })).max(12),
  shown: z.array(z.string().max(80)).max(40),
});

/** Сообщение гостю Мандаринке. Ответ: подбор по меню или ответ ИИ (если на сервере задан ключ). */
export async function mandarinAction(raw: unknown): Promise<MandarinResult | { error: string }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: "Не поняла сообщение. Напишите покороче, до 400 символов." };
  const { text, lang, history, shown } = parsed.data;
  const ip = await clientIp();
  // в заведении гости сидят на одном Wi-Fi и делят адрес, поэтому лимит щедрый; расходы на ИИ ограничивает дневной потолок
  if (!hit(`mandarin:min:${ip}`, 25, 60_000).ok || !hit(`mandarin:${ip}`, 200, 10 * 60_000).ok) {
    return { error: lang === "ru" ? "Я немного устала. Подождите минутку и спросите ещё раз 🍊" : "Biroz charchadim. Bir daqiqadan keyin yana so'rang 🍊" };
  }
  try {
    const { current } = await getSiteLocation();
    const menu = await menuForAssistant(current?.id ?? null);
    if (!menu.length) return { reply: lang === "ru" ? "Меню сейчас пустое. Загляните чуть позже!" : "Menyu hozircha bo'sh. Birozdan keyin qaytib keling!", picks: [], chips: [], mode: "rules", lang };
    return await mandarinRespond({ text, lang, history, shown, menu });
  } catch (e) {
    console.error("[MANDARIN]", e instanceof Error ? e.message : e);
    return { error: lang === "ru" ? "Что-то пошло не так. Попробуйте ещё раз." : "Nimadir xato ketdi. Yana urinib ko'ring." };
  }
}
