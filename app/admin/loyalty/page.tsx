import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { loyaltyStats } from "@/services/customers";
import { listPromos } from "@/services/promos";
import { getSettingValues } from "@/services/settings";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { ActionButton } from "@/components/admin/ActionButton";
import { createPromoAction, togglePromoAction, deletePromoAction } from "./actions";
import { money, dateStr, num } from "@/lib/format";

const OK: Record<string, string> = { created: "Промокод создан", updated: "Промокод обновлён", deleted: "Промокод удалён" };

export default async function LoyaltyPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const user = await pageGuard("customers.view");
  const { ok } = await searchParams;
  const edit = can(user.role, "settings.edit");
  const [st, promos, set] = await Promise.all([loyaltyStats(), listPromos(), getSettingValues()]);
  const cashback = set["loyalty.earnRate"] * set["loyalty.pointValue"] * 100;
  const card = (l: string, v: string, sub?: string) => <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-neutral-500">{l}</p><p className="mt-1 text-xl font-bold">{v}</p>{sub && <p className="text-xs text-neutral-500">{sub}</p>}</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Лояльность и промокоды</h1>
        <p className="text-sm text-neutral-500">Баллы начисляются после выдачи заказа. Списать баллы можно на кассе при выбранном клиенте.</p>
      </div>
      {ok && OK[ok] && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[ok]}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {card("Баллов у клиентов", num(st.outstanding), `в ${st.customers} клиентов`)}
        {card("Начислено за 30 дней", num(st.earned30))}
        {card("Списано за 30 дней", num(st.spent30))}
        {card("Бонусов за 30 дней", num(st.bonus30), "приветственные, реферальные, ручные")}
        {card("По приглашению", num(st.referred), "клиентов пришли от друзей")}
      </div>

      <div className={`rounded-2xl p-4 text-sm ${cashback > 10 ? "bg-amber-50 text-amber-900" : "bg-white shadow-sm"}`}>
        <p><b>Текущие правила:</b> {set["loyalty.earnRate"]} балла за 1 UZS, 1 балл = {set["loyalty.pointValue"]} UZS, баллами можно оплатить до {set["loyalty.maxRedeemPct"]}% заказа. Приветственный бонус: {set["loyalty.welcomeBonus"]}, реферальный: {set["loyalty.referralBonus"]}.</p>
        <p className="mt-1">Эффективный кэшбэк: <b>{cashback.toFixed(1)}%</b> от суммы заказа.{cashback > 10 && " Это много — проверьте правила в настройках."}</p>
        {edit && <Link href="/admin/settings" className="mt-2 inline-block font-semibold underline">Изменить правила</Link>}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Промокоды</h2>
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="p-3">Код</th><th>Скидка</th><th className="text-right">От суммы</th><th className="text-right">Использовано</th><th>До</th><th>Статус</th>{edit && <th />}</tr></thead>
            <tbody>
              {promos.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-neutral-500">Промокодов пока нет</td></tr>}
              {promos.map((p) => {
                const state = !p.isActive ? ["Отключён", "bg-neutral-100 text-neutral-600"] : p.expired ? ["Истёк", "bg-red-100 text-red-700"] : p.exhausted ? ["Исчерпан", "bg-amber-100 text-amber-800"] : ["Активен", "bg-lime-100 text-green-900"];
                return (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="p-3 font-mono font-bold">{p.code}</td>
                    <td>{p.type === "PERCENT" ? `${p.value}%` : money(p.value)}</td>
                    <td className="text-right">{p.minOrder > 0 ? money(p.minOrder) : "—"}</td>
                    <td className="text-right">{p.usedCount}{p.usageLimit != null && ` / ${p.usageLimit}`}</td>
                    <td>{p.expiresAt ? dateStr(p.expiresAt) : "—"}</td>
                    <td><span className={`rounded px-2 py-0.5 text-xs ${state[1]}`}>{state[0]}</span></td>
                    {edit && (
                      <td className="space-x-2 whitespace-nowrap p-2 text-right">
                        <ActionButton action={togglePromoAction} fields={{ id: p.id, active: p.isActive ? "0" : "1" }} label={p.isActive ? "Отключить" : "Включить"} danger={p.isActive} />
                        {p.usedCount === 0 && <ActionButton action={deletePromoAction} fields={{ id: p.id }} label="Удалить" danger confirmText={`Удалить промокод ${p.code}?`} />}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {edit && (
        <section className="max-w-xl space-y-3">
          <h2 className="text-lg font-bold">Новый промокод</h2>
          <FormShell action={createPromoAction} submitLabel="Создать" cancelHref="/admin/loyalty">
            <Field label="Код (латиница и цифры)"><input name="code" required minLength={3} maxLength={20} placeholder="SUMMER10" className={`${fieldClass} uppercase`} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Тип"><select name="type" defaultValue="PERCENT" className={fieldClass}><option value="PERCENT">Процент, %</option><option value="FIXED">Сумма, UZS</option></select></Field>
              <Field label="Размер"><input name="value" type="number" step="any" min="0" required className={fieldClass} /></Field>
              <Field label="Минимальная сумма заказа, UZS"><input name="minOrder" type="number" min="0" placeholder="0" className={fieldClass} /></Field>
              <Field label="Лимит использований"><input name="usageLimit" type="number" min="1" step="1" placeholder="без лимита" className={fieldClass} /></Field>
            </div>
            <Field label="Действует до (включительно)"><input name="expiresAt" type="date" className={fieldClass} /></Field>
          </FormShell>
        </section>
      )}
    </div>
  );
}
