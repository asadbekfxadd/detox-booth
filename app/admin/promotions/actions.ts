"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createPromotion, setPromotionActive, deletePromotion } from "@/services/promotions";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const done = (ok: string) => { revalidatePath("/admin/promotions"); revalidatePath("/promo"); revalidatePath("/cart"); revalidatePath("/"); redirect(`/admin/promotions?ok=${ok}`); };

/** Собирает данные акции из формы; проверку и сохранение делает сервис. */
function fromForm(fd: FormData) {
  const kind = s(fd, "kind");
  const base = {
    kind, name: s(fd, "name"), description: s(fd, "description"),
    onSite: fd.has("onSite"), onPos: fd.has("onPos"), allowCode: fd.has("allowCode"), withHappyHour: fd.has("withHappyHour"),
    days: fd.getAll("days").map(String), start: s(fd, "start"), end: s(fd, "end"), startsAt: s(fd, "startsAt"), endsAt: s(fd, "endsAt"),
    totalLimit: s(fd, "totalLimit"), perCustomerLimit: s(fd, "perCustomerLimit"), sort: s(fd, "sort"),
  };
  if (kind === "BUY_GET") return { ...base, target: s(fd, "target"), buy: s(fd, "buy"), free: s(fd, "free"), percent: s(fd, "percent") };
  if (kind === "COMBO") {
    const items = [0, 1, 2].map((i) => ({ productId: s(fd, `item_product_${i}`), qty: s(fd, `item_qty_${i}`) || "1" })).filter((x) => x.productId);
    return { ...base, items, price: s(fd, "price") };
  }
  if (kind === "THRESHOLD") {
    const tiers = [0, 1, 2].map((i) => ({ from: s(fd, `tier_from_${i}`), percent: s(fd, `tier_percent_${i}`), off: s(fd, `tier_off_${i}`) })).filter((t) => t.from);
    return { ...base, tiers };
  }
  return { ...base, percent: s(fd, "percent"), maxOff: s(fd, "maxOff") };
}

export async function createPromotionAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("settings.edit"); await createPromotion(fromForm(fd), u); }
  catch (e) { return { error: toMessage(e) }; }
  done("created");
}
export async function togglePromotionAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("settings.edit"); await setPromotionActive(s(fd, "id"), s(fd, "active") === "1", u); }
  catch (e) { return { error: toMessage(e) }; }
  done("toggled");
}
export async function deletePromotionAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("settings.edit"); await deletePromotion(s(fd, "id"), u); }
  catch (e) { return { error: toMessage(e) }; }
  done("deleted");
}
