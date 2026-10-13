import { pageGuard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { ActionButton } from "@/components/admin/ActionButton";
import { PromotionForm } from "@/components/admin/PromotionForm";
import { listPromotions } from "@/services/promotions";
import { sum } from "@/lib/format";
import { createPromotionAction, togglePromotionAction, deletePromotionAction } from "./actions";

export const metadata = { title: "Акции" };
export const dynamic = "force-dynamic";
const OK: Record<string, string> = { created: "Акция создана", toggled: "Готово", deleted: "Акция удалена" };

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("settings.edit");
  const sp = await searchParams;
  const [rows, products, categories] = await Promise.all([
    listPromotions(),
    prisma.product.findMany({ where: { isArchived: false }, orderBy: { name: "asc" }, select: { id: true, name: true, price: true } }),
    prisma.category.findMany({ orderBy: { sort: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">Акции</h1>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      <p className="text-sm text-neutral-600">Акции применяются к корзине сами, без промокода: на сайте и на кассе. Гость видит их на странице «Акции», а в корзине получает подсказки вроде «добавьте ещё один смузи — третий бесплатно». Сначала считаются акции на позиции, затем одна самая выгодная скидка на сумму. Промокод и ручная скидка считаются после акций.</p>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Акция</th><th>Условие</th><th className="text-right">Применений</th><th className="text-right">Скидок выдано</th><th className="p-3 text-right">Действия</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-neutral-500">Акций пока нет. Создайте первую ниже.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id} className={`border-t border-neutral-100 align-top ${p.isActive && !p.expired && !p.exhausted ? "" : "opacity-60"}`}>
                <td className="p-3">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-neutral-500">{p.kindLabel}</p>
                  <p className="mt-1 flex flex-wrap gap-1 text-xs">
                    {!p.isActive && <span className="rounded bg-neutral-100 px-2 py-0.5">выключена</span>}
                    {p.expired && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">срок закончился</span>}
                    {p.exhausted && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">лимит исчерпан</span>}
                    {p.onSite && <span className="rounded bg-sky-50 px-2 py-0.5 text-sky-900">сайт</span>}
                    {p.onPos && <span className="rounded bg-sky-50 px-2 py-0.5 text-sky-900">касса</span>}
                    {p.allowCode && <span className="rounded bg-neutral-100 px-2 py-0.5">с промокодом</span>}
                  </p>
                </td>
                <td className="p-3 text-neutral-700">{p.condition}{p.when && <span className="mt-1 block text-xs text-neutral-500">{p.when}</span>}</td>
                <td className="p-3 text-right">{p.usedCount}{p.totalLimit != null && <span className="text-neutral-500"> / {p.totalLimit}</span>}</td>
                <td className="p-3 text-right font-semibold">{sum(p.discountTotal)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <ActionButton action={togglePromotionAction} fields={{ id: p.id, active: p.isActive ? "0" : "1" }} label={p.isActive ? "Выключить" : "Включить"} />
                    <ActionButton action={deletePromotionAction} fields={{ id: p.id }} label="Удалить" danger confirmText={`Удалить акцию «${p.name}»?`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-lg font-bold">Новая акция</h2>
      <PromotionForm action={createPromotionAction} products={products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))} categories={categories} />
    </div>
  );
}
