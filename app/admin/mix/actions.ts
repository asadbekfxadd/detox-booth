"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { saveMix } from "@/services/mix";
import { MIX_MAX_SIZES } from "@/lib/mix";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
/** «25 000», «25000,5» → число; пусто → null; мусор → NaN (ошибку покажет проверка) */
const num = (v: string) => (v === "" ? null : Number(v.replace(/[\s ]/g, "").replace(",", ".")));

export async function saveMixAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("products.edit");
    const sizes = [];
    for (let i = 0; i < MIX_MAX_SIZES; i++) {
      const name = s(fd, `size_name_${i}`);
      if (!name) continue; // пустая строка — размера нет
      sizes.push({
        id: s(fd, `size_id_${i}`) || `m${randomBytes(4).toString("hex")}`,
        name, price: num(s(fd, `size_price_${i}`)) ?? NaN, grams: num(s(fd, `size_grams_${i}`)) ?? NaN,
        cupIngredientId: s(fd, `size_cup_${i}`) || null,
      });
    }
    const ids = String(fd.get("ingredientIds") ?? "").split(",").filter(Boolean);
    const ingredients = ids.map((id) => ({ id, surcharge: num(s(fd, `sur_${id}`)) ?? 0, pieceWeightG: num(s(fd, `pw_${id}`)) }));
    await saveMix({ sizes, ingredients }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/mix");
  redirect("/admin/mix?ok=1");
}
