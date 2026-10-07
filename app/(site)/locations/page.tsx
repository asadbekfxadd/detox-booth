import { getSiteLocation } from "@/lib/site";
import { Page } from "@/components/site/Page";

export const metadata = { title: "Точки", description: "Адреса и телефоны точек Vitamin B. Закажите онлайн и заберите готовым." };
export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const { locations } = await getSiteLocation();
  return (
    <Page className="space-y-6">
      <h1 className="text-4xl font-black sm:text-6xl">Наши точки</h1>
      {locations.length === 0
        ? <p className="pop rounded-2xl bg-white p-6">Скоро откроемся. Следите за новостями.</p>
        : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((l) => (
              <li key={l.id} className="pop rounded-3xl bg-white p-6">
                <h2 className="text-xl">{l.name}</h2>
                {l.address && <p className="mt-2 text-forest/80">{l.address}</p>}
                {l.phone && <p className="mt-1"><a href={`tel:${l.phone.replace(/[^+\d]/g, "")}`} className="font-bold underline">{l.phone}</a></p>}
                <p className="mt-3 text-sm text-forest/60">Заказ готовим сразу после оформления.</p>
              </li>
            ))}
          </ul>
        )}
    </Page>
  );
}
