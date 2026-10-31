"use client";
import { useEffect, useState } from "react";
import { gridShape, onTone, tvTone, type TvGridPage } from "@/lib/tv";
import { categoryEmoji } from "@/lib/emoji";
import { num, TvBubbles, TvFooter, TvHeader, useTvLifecycle, type BrandInfo } from "./parts";

/** Как часто подсветка переходит к следующей карточке, мс. */
const SPOT_MS = 2400;

/**
 * Фото-меню для телевизора: все позиции на экране сразу, у каждой рядом фото, название и цена.
 * Подсвеченная карточка переходит по кругу и красит экран в цвет своего напитка; когда позиций больше девяти,
 * экран через каждые `sec` секунд листается на следующую страницу.
 */
export function TvGrid({ pages, sec, qr, locationName, brand }: { pages: TvGridPage[]; sec: number; qr: string; locationName: string; brand: BrandInfo }) {
  const [pageNo, setPageNo] = useState(0);
  const [spot, setSpot] = useState(0);
  const clock = useTvLifecycle(pages.length === 0);
  const count = pages.length;

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => { setPageNo((p) => (p + 1) % count); setSpot(0); }, sec * 1000);
    return () => clearInterval(t);
  }, [sec, count]);

  const size = pages[Math.min(pageNo, count - 1)]?.items.length ?? 0;
  useEffect(() => {
    if (size < 2) return;
    const t = setInterval(() => setSpot((s) => (s + 1) % size), SPOT_MS);
    return () => clearInterval(t);
  }, [size, pageNo]);

  if (count === 0) {
    return (
      <div className="tv">
        <TvBubbles />
        <TvHeader brand={brand} locationName={locationName} clock={clock} />
        <div className="tv-empty"><h1>Меню обновляется</h1><p>Совсем скоро всё будет на экране</p></div>
      </div>
    );
  }

  const page = pages[Math.min(pageNo, count - 1)];
  const on = Math.min(spot, page.items.length - 1);
  const tone = tvTone(page.items[on].name);
  const { cols, rows } = gridShape(page.items.length);

  return (
    <div className="tv" style={{ "--tone": tone, "--on": onTone(tone) } as React.CSSProperties}>
      <TvBubbles />
      <TvHeader brand={brand} locationName={locationName} clock={clock}>
        <div className="tvg-title">
          <span>Всё меню</span>
          {count > 1 && <div className="tv-dots" aria-hidden>{pages.map((p, k) => <i key={p.key} data-on={k === pageNo ? "" : undefined} />)}</div>}
        </div>
      </TvHeader>

      <main className="tvg">
        <ul className="tvg-grid" key={page.key} style={{ "--cols": cols, "--rows": rows } as React.CSSProperties}>
          {page.items.map((it, i) => {
            const t = tvTone(it.name);
            const sale = it.oldPrice && it.oldPrice > it.price;
            return (
              <li key={it.id} className="tvg-card" data-on={i === on ? "" : undefined} style={{ "--ct": t, "--co": onTone(t), "--i": i } as React.CSSProperties}>
                <span className="tvg-photo" aria-hidden>
                  {it.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={it.image} alt="" decoding="async" />
                    : categoryEmoji(it.categorySlug)}
                  {it.volumeMl ? <i className="tvg-vol">{it.volumeMl} мл</i> : null}
                </span>
                <div className="tvg-info">
                  <span className="tvg-name">{it.name}</span>
                  <div className="tvg-buy">
                    <span className="tvg-price">{sale ? <s>{num(it.oldPrice!)}</s> : null}{num(it.price)}<small>сум</small></span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </main>

      <TvFooter brand={brand} qr={qr} />
    </div>
  );
}
