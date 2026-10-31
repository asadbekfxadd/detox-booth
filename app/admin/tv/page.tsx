import { pageGuard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site-url";
import { CopyLink } from "@/components/admin/CopyLink";

export const dynamic = "force-dynamic";

export default async function TvAdminPage() {
  await pageGuard("products.edit");
  const base = siteUrl();
  const locations = await prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const local = /localhost|127\.0\.0\.1/.test(base);
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ТВ-меню</h1>
        <p className="text-sm text-neutral-500">Отдельное меню для телевизоров в зале: два вида, оба листаются сами. Меню и цены берутся с сайта, поэтому правите их в обычном порядке, а на экране всё обновляется в течение полутора минут.</p>
      </div>
      {local && <p className="rounded-xl bg-amber-100 px-4 py-2 text-sm text-amber-900">Адрес сайта сейчас {base}. Задайте переменную SITE_URL с настоящим адресом, иначе ссылка и QR-код на экране не откроются на телевизоре.</p>}

      <ul className="space-y-3">
        {locations.map((l) => (
          <li key={l.id} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-bold">{l.name}</p>
            {[
              { title: "Листается по категориям", hint: "Одна позиция крупно с каплей-ценой, рядом список категории.", path: `/tv?loc=${l.id}` },
              { title: "Фото-меню: все позиции сразу", hint: "Карточки: фото, название и цена рядом. До 20 позиций помещаются на одном экране, больше листаются страницами.", path: `/tv?loc=${l.id}&view=photos` },
            ].map((v) => {
              const url = `${base}${v.path}`;
              return (
                <div key={v.path} className="space-y-2">
                  <p className="text-sm"><span className="font-semibold">{v.title}.</span> <span className="text-neutral-500">{v.hint}</span></p>
                  <input readOnly value={url} aria-label={`${v.title}: ${l.name}`} className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700" />
                  <div className="flex flex-wrap gap-2">
                    <a href={v.path} target="_blank" rel="noopener" className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">Открыть на весь экран</a>
                    <CopyLink value={url} />
                  </div>
                </div>
              );
            })}
          </li>
        ))}
      </ul>

      <section className="space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm">
        <h2 className="font-bold">Как подключить телевизор</h2>
        <ol className="list-decimal space-y-1 pl-5 text-neutral-700">
          <li>На телевизоре откройте браузер (у Smart TV он есть, или подключите мини-ПК, Chromecast, ТВ-приставку).</li>
          <li>Вбейте ссылку своей точки. Для каждой точки ссылка своя: в ней её меню и её QR-код.</li>
          <li>Включите полноэкранный режим (на компьютере F11). Телевизор подойдёт любой, картинка подстраивается под экран 16:9.</li>
          <li>В настройках телевизора отключите заставку и автоотключение экрана.</li>
        </ol>
        <p className="text-neutral-500">Скорость: добавьте к ссылке <code>&amp;sec=10</code>, чтобы позиция показывалась 10 секунд (от 3 до 30, по умолчанию 7). В фото-меню так задаётся время на страницу (от 6 до 60, по умолчанию 15). На экране видны только позиции, которые сейчас можно заказать. QR-код ведёт на меню сайта с уже выбранной точкой.</p>
      </section>
    </div>
  );
}
