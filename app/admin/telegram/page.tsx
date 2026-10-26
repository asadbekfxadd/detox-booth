import { pageGuard } from "@/lib/guard";
import { botStatus } from "@/services/telegram";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site-url";
import { connectBotAction, disconnectBotAction } from "./actions";

export const dynamic = "force-dynamic";

const btn = "rounded-xl px-5 py-2.5 text-sm font-semibold";

export default async function TelegramPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await pageGuard("settings.edit");
  const { ok, error } = await searchParams;
  const [st, users, withPhone, orders] = await Promise.all([
    botStatus(),
    prisma.telegramUser.count(), prisma.telegramUser.count({ where: { phone: { not: null } } }), prisma.order.count({ where: { telegramId: { not: null } } }),
  ]);
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Telegram-бот и Mini App</h1>
        <p className="text-sm text-neutral-500">Покупатели открывают сайт прямо в Telegram: меню, свой микс, акции, бронь и заказ. Бот пишет им о статусе заказа.</p>
      </div>
      {ok === "connected" && <p role="status" className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">Бот подключён. Откройте его в Telegram и нажмите «Меню».</p>}
      {ok === "disconnected" && <p role="status" className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">Бот отключён: сообщения больше не приходят на сайт.</p>}
      {error && <p role="alert" className="rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-800">{error}</p>}

      {!st.configured ? (
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Как подключить</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>В Telegram откройте <b>@BotFather</b>, отправьте <code>/newbot</code>, придумайте название и имя бота (оно оканчивается на <code>bot</code>).</li>
            <li>BotFather пришлёт токен вида <code>123456:ABC…</code>. Это пароль бота, никому его не показывайте.</li>
            <li>В Railway откройте сервис сайта → <b>Variables</b> и добавьте переменную <code>TELEGRAM_BOT_TOKEN</code> со значением токена. Сервис перезапустится сам.</li>
            <li>Вернитесь на эту страницу и нажмите «Подключить бота».</li>
          </ol>
        </section>
      ) : !st.ok ? (
        <section className="space-y-2 rounded-2xl bg-red-50 p-5 text-sm text-red-800">
          <p className="font-semibold">Токен задан, но Telegram его не принял: {st.error}</p>
          <p>Проверьте, что токен скопирован целиком и без пробелов (<code>TELEGRAM_BOT_TOKEN</code> в Railway Variables).</p>
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">{st.name}{st.username && <> <a href={`https://t.me/${st.username}`} target="_blank" rel="noreferrer" className="text-sm font-normal text-green-800 underline">@{st.username}</a></>}</h2>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${st.connected ? "bg-lime-100 text-green-900" : "bg-amber-100 text-amber-900"}`}>{st.connected ? "Подключён" : "Не подключён"}</span>
          </div>
          {!st.https && <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Адрес сайта ({siteUrl()}) без https. Telegram принимает только https: задайте <code>SITE_URL</code> с https://.</p>}
          {st.lastError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Последняя ошибка доставки от Telegram: {st.lastError}</p>}
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-neutral-500">Открыли бота</dt><dd className="text-xl font-bold">{users}</dd></div>
            <div><dt className="text-neutral-500">Поделились номером</dt><dd className="text-xl font-bold">{withPhone}</dd></div>
            <div><dt className="text-neutral-500">Заказов из Telegram</dt><dd className="text-xl font-bold">{orders}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <form action={connectBotAction}><button className={`${btn} bg-green-700 text-white hover:bg-green-800`}>{st.connected ? "Обновить настройки бота" : "Подключить бота"}</button></form>
            {st.connected && <form action={disconnectBotAction}><button className={`${btn} border border-neutral-300 hover:bg-neutral-50`}>Отключить</button></form>}
          </div>
          <p className="text-xs text-neutral-500">Кнопка настраивает вебхук, команды /menu /orders /locations /help, кнопку «Меню» (открывает сайт) и описание бота. Её можно нажимать повторно, например после смены адреса сайта.</p>
        </section>
      )}
    </div>
  );
}
