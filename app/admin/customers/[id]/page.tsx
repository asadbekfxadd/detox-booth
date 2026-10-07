import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getCustomer } from "@/services/customers";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { updateCustomerAction, adjustPointsAction } from "../actions";
import { money, dateStr, dateTimeStr } from "@/lib/format";
import { STATUS_LABEL, STATUS_CLS, SOURCE_LABEL } from "@/lib/order-status";

const TX_LABEL: Record<string, string> = { EARN: "Начисление", SPEND: "Списание", BONUS: "Бонус", REFERRAL: "Реферал", ADJUST: "Корректировка" };
const OK: Record<string, string> = { saved: "Данные клиента сохранены", points: "Баллы изменены" };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const user = await pageGuard("customers.view");
  const { id } = await params;
  const { ok } = await searchParams;
  const c = await getCustomer(id);
  if (!c) notFound();
  const manage = can(user.role, "customers.manage");
  const bday = c.birthday ? new Date(c.birthday.getTime() + 5 * 3600000).toISOString().slice(0, 10) : "";
  const stat = (l: string, v: string) => <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-neutral-500">{l}</p><p className="mt-1 text-xl font-bold">{v}</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/customers" className="text-sm text-neutral-500 hover:text-neutral-900">← Все клиенты</Link>
        <h1 className="text-2xl font-bold">{c.name}</h1>
        <p className="text-sm text-neutral-500">{c.phone} · клиент с {dateStr(c.createdAt)}</p>
      </div>
      {ok && OK[ok] && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[ok]}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stat("Баллы", String(c.points))}
        {stat("Завершённых заказов", String(c.stats.orders))}
        {stat("Потрачено", money(c.stats.spent))}
        {stat("Средний чек", money(c.stats.avg))}
        {stat("Последний заказ", c.stats.last ? dateStr(c.stats.last) : "—")}
      </div>

      {manage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h2 className="font-bold">Данные клиента</h2>
            <FormShell action={updateCustomerAction} submitLabel="Сохранить" cancelHref="/admin/customers">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Имя"><input name="name" defaultValue={c.name} required className={fieldClass} /></Field>
              <Field label="Телефон"><input name="phone" defaultValue={c.phone} required className={fieldClass} /></Field>
              <Field label="Email"><input name="email" type="email" defaultValue={c.email ?? ""} className={fieldClass} /></Field>
              <Field label="Дата рождения"><input name="birthday" type="date" defaultValue={bday} className={fieldClass} /></Field>
              <Field label="Кто пригласил (телефон)"><input name="referrerPhone" defaultValue={c.referredBy?.phone ?? ""} placeholder="+998 90 123 45 67" className={fieldClass} /></Field>
            </FormShell>
          </div>
          <div className="space-y-2">
            <h2 className="font-bold">Изменить баллы вручную</h2>
            <FormShell action={adjustPointsAction} submitLabel="Применить" cancelHref={`/admin/customers/${c.id}`}>
              <input type="hidden" name="id" value={c.id} />
              <Field label="Тип">
                <select name="type" defaultValue="BONUS" className={fieldClass}><option value="BONUS">Бонус (начислить)</option><option value="ADJUST">Корректировка (+ или −)</option></select>
              </Field>
              <Field label="Баллов (для списания — отрицательное число)"><input name="delta" type="number" step="1" required className={fieldClass} /></Field>
              <Field label="Причина"><input name="note" required minLength={3} maxLength={200} placeholder="Например: компенсация за задержку заказа" className={fieldClass} /></Field>
              <p className="text-xs text-neutral-500">Каждое изменение записывается в журнал с вашим именем.</p>
            </FormShell>
          </div>
        </div>
      )}

      {(c.referredBy || c.referrals.length > 0) && (
        <div className="rounded-2xl bg-white p-5 shadow-sm text-sm">
          <h2 className="mb-2 font-bold">Рефералы</h2>
          {c.referredBy && <p>Пригласил: <Link href={`/admin/customers/${c.referredBy.id}`} className="font-semibold text-green-800 underline">{c.referredBy.name}</Link> · {c.referredBy.phone}</p>}
          {c.referrals.length > 0 && (
            <div className="mt-2"><p className="text-neutral-500">Пригласил клиентов: {c.referrals.length}</p>
              <ul className="mt-1 space-y-0.5">{c.referrals.map((r) => <li key={r.id}><Link href={`/admin/customers/${r.id}`} className="text-green-800 underline">{r.name}</Link> · {r.phone} · {dateStr(r.createdAt)}</li>)}</ul></div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-bold">Заказы</h2>
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-neutral-500"><th className="p-3">№</th><th>Дата</th><th>Источник</th><th>Статус</th><th className="text-right pr-3">Сумма</th></tr></thead>
              <tbody>
                {c.orders.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-neutral-500">Заказов пока нет</td></tr>}
                {c.orders.map((o) => (
                  <tr key={o.id} className="border-t border-neutral-100">
                    <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-green-800 underline">{o.number}</Link></td>
                    <td className="text-neutral-500">{dateTimeStr(o.createdAt)}</td><td>{SOURCE_LABEL[o.source]}</td>
                    <td><span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                    <td className="pr-3 text-right">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="font-bold">История баллов</h2>
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-neutral-500"><th className="p-3">Дата</th><th>Тип</th><th className="text-right">Баллы</th><th className="pl-3">Комментарий</th></tr></thead>
              <tbody>
                {c.txs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-neutral-500">Операций пока нет</td></tr>}
                {c.txs.map((t) => (
                  <tr key={t.id} className="border-t border-neutral-100">
                    <td className="p-3 text-neutral-500">{dateTimeStr(t.createdAt)}</td><td>{TX_LABEL[t.type]}</td>
                    <td className={`text-right font-semibold ${t.points < 0 ? "text-red-700" : "text-green-800"}`}>{t.points > 0 ? "+" : ""}{t.points}</td>
                    <td className="pl-3 text-neutral-600">{t.note ?? (t.orderId ? "По заказу" : "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
