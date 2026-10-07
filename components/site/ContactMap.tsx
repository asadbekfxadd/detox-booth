import { Icon } from "@/components/site/Icon";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, hasMap, mapEmbedUrl, googleRouteUrl, yandexMapUrl } from "@/lib/brand";

type Loc = { name: string; address: string | null; phone: string | null; lat: number | null; lng: number | null };

/** Блок «Где нас найти» над подвалом: адрес, телефон, Instagram и карта выбранной точки. */
export function ContactMap({ location }: { location: Loc | null }) {
  const address = location?.address ?? null;
  const exact = !!location && hasMap(location);
  const link = "btn !px-5 !py-2.5 text-sm";
  return (
    <section aria-labelledby="where" className="mx-auto w-full max-w-6xl px-4 pb-14 pt-6 sm:pb-20">
      <div className={`grid gap-6 overflow-hidden rounded-[2rem] border border-forest/12 bg-white p-4 sm:p-6 ${exact ? "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]" : ""}`}>
        <div className="flex flex-col justify-between gap-6 p-2 sm:p-4">
          <div>
            <h2 id="where" className="text-3xl font-black sm:text-4xl">Где нас найти</h2>
            {location && (
              <div className="mt-5 space-y-2 text-forest/80">
                <p className="flex items-start gap-2 font-bold text-forest"><Icon name="pin" size={20} className="mt-0.5 text-orange-deep" />{location.name}</p>
                {address && <p className="pl-7">{address}</p>}
                {location.phone && <p className="pl-7"><a href={`tel:${location.phone.replace(/[^+\d]/g, "")}`} className="font-bold underline underline-offset-4 hover:text-orange-deep">{location.phone}</a></p>}
              </div>
            )}
            <p className="mt-5 text-sm text-forest/60">Заказ готовим сразу после оформления. Сменить точку можно в шапке сайта.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {exact && location && <a href={googleRouteUrl(location)} target="_blank" rel="noopener noreferrer" className={`${link} btn-forest`}>Построить маршрут</a>}
            {exact && location && <a href={yandexMapUrl(location)} target="_blank" rel="noopener noreferrer" className={`${link} btn-ghost`}>Яндекс Карты</a>}
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={`${link} btn-primary`}><Icon name="instagram" size={18} />@{INSTAGRAM_HANDLE}</a>
          </div>
        </div>
        {exact && location && (
          <iframe
            title={`Карта: ${location?.name ?? "Vitamin B"}`}
            src={mapEmbedUrl(location)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-72 w-full rounded-3xl border-0 sm:h-96 lg:h-full lg:min-h-[22rem]"
          />
        )}
      </div>
    </section>
  );
}
