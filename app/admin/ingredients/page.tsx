import { redirect } from "next/navigation";
import { pageGuard } from "@/lib/guard";

/** Список ингредиентов теперь на странице «Склад» (там же остатки, приход и закупки). Старый адрес ведёт туда. */
export default async function IngredientsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("inventory.edit");
  const { ok } = await searchParams;
  redirect(ok && ["created", "updated", "deleted"].includes(ok) ? `/admin/inventory?ok=ing_${ok}` : "/admin/inventory");
}
