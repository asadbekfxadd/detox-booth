import Link from "next/link";
import { Page } from "@/components/site/Page";
import { publicPromotions } from "@/services/promotions";
import { listHappyHours } from "@/services/happy-hour";
import { DAY_LABEL, hhmm } from "@/lib/happy-hour";

export const metadata = { title: "Акции", description: "Акции, наборы и счастливые часы." };
export const dynamic = "force-dynamic";

export default async function PromoPage() {
  const [promos, happy] = await Promise.all([publicPromotions(), listHappyHours()]);
  const hours = happy.filter((h) => h.isActive);
  const empty = promos.length === 0 && hours.length === 0;
  return (
    <Page className="space-y-8">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold">Акции</h1>
        <p className="mt-1 text-forest/70">Скидки применяются сами: добавьте позиции в корзину, и мы всё посчитаем. Промокод вводится при оформлении заказа.</p>
      </div>

      {empty && (
        <div className="max-w-2xl rounded-2xl bg-white p-8 pop">
          <p className="font-bold">Сейчас акций нет.</p>
          <p className="mt-1 text-sm text-forest/70">Загляните позже или выберите что-нибудь вкусное в меню.</p>
          <Link href="/menu" className="btn btn-primary pop mt-4 inline-block">В меню</Link>
        </div>
      )}

      {promos.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Акции">
          {promos.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-3xl bg-white p-6 pop">
              {p.activeNow
                ? <span className="w-fit rounded-full bg-leaf-soft px-3 py-1 text-xs font-extrabold text-forest-deep">Действует сейчас</span>
                : <span className="w-fit rounded-full bg-forest/10 px-3 py-1 text-xs font-bold text-forest/70">Скоро: {p.when || "по расписанию"}</span>}
              <h2 className="text-xl font-black leading-tight">{p.name}</h2>
              <p className="font-semibold text-forest-deep">{p.condition}</p>
              {p.description && <p className="text-sm text-forest/70">{p.description}</p>}
              {p.when && p.activeNow && <p className="mt-auto pt-2 text-sm text-forest/60">{p.when}</p>}
            </li>
          ))}
        </ul>
      )}

      {hours.length > 0 && (
        <section aria-label="Счастливые часы" className="space-y-3">
          <h2 className="text-2xl font-extrabold">Счастливые часы</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hours.map((h) => (
              <li key={h.id} className="rounded-2xl bg-sun/40 p-5">
                <p className="text-3xl font-black text-forest-deep">−{h.percent}%</p>
                <p className="font-bold">{h.name}</p>
                <p className="text-sm text-forest-deep/80">{h.category?.name ?? "всё меню"} · {h.days.length === 7 ? "каждый день" : h.days.map((d) => DAY_LABEL[d]).join(", ")}, {hhmm(h.startMin)}–{hhmm(h.endMin)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
