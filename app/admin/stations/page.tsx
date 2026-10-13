import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { ActionButton } from "@/components/admin/ActionButton";
import { listStations } from "@/services/stations";
import { createStationAction, deleteStationAction } from "./actions";

const OK: Record<string, string> = { created: "Станция добавлена", updated: "Изменения сохранены", deleted: "Станция удалена" };

export default async function StationsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("products.edit");
  const sp = await searchParams;
  const rows = await listStations();
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Станции кухни</h1>
        <Link href="/admin/categories" className="rounded-xl border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold hover:bg-neutral-50">К категориям</Link>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      <p className="text-sm text-neutral-600">Станция — это место, где готовят: бар, горячий цех, холодный цех. Привяжите к станции категории меню (в карточке категории), и каждая станция увидит на экране кухни и в бегунке только свои позиции. Заказ становится готовым, когда готовы все станции.</p>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Станция</th><th>Категории</th><th className="text-right">Порядок</th><th className="p-3 text-right">Действия</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-neutral-500">Станций пока нет. Без станций кухня работает как раньше: один общий экран.</td></tr>}
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-neutral-100">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="text-neutral-600">{s.categories.length ? s.categories.map((c) => c.name).join(", ") : "—"}</td>
                <td className="text-right">{s.sort}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <Link href={`/admin/stations/${s.id}`} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50">Изменить</Link>
                    <ActionButton action={deleteStationAction} fields={{ id: s.id }} label="Удалить" danger confirmText={`Удалить станцию «${s.name}»? Её категории останутся без станции.`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-lg font-bold">Добавить станцию</h2>
      <FormShell action={createStationAction} submitLabel="Добавить" cancelHref="/admin/stations">
        <Field label="Название (например, Бар)"><input name="name" required maxLength={30} className={fieldClass} /></Field>
        <Field label="Порядок (меньше — левее на экране кухни)"><input name="sort" type="number" min="0" step="1" defaultValue="0" className={fieldClass} /></Field>
      </FormShell>
    </div>
  );
}
