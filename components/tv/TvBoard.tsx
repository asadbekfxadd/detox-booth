"use client";
import { useEffect, useRef, useState } from "react";
import { categoryWindow, nextSpot, onTone, tvTone, type TvPage } from "@/lib/tv";
import { categoryEmoji } from "@/lib/emoji";
import { num, TvBubbles, TvFooter, TvHeader, useTvLifecycle, type BrandInfo } from "./parts";

/**
 * Меню для телевизора. Фон и акценты окрашиваются в цвет напитка на экране; слева арка с фото и круглая наклейка с ценой,
 * справа список. Строка заливается цветом, как стакан соком, потом подсветка переходит к следующей позиции,
 * а после последней открывается следующая категория. Данные обновляются сами раз в полторы минуты; экран не гаснет.
 */
export function TvBoard({ pages, sec, qr, locationName, brand }: { pages: TvPage[]; sec: number; qr: string; locationName: string; brand: BrandInfo }) {
  const [spot, setSpot] = useState<[number, number]>([0, 0]);
  const [tick, setTick] = useState(0);
  const clock = useTvLifecycle(pages.length === 0);
  const pagesRef = useRef(pages);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  useEffect(() => {
    if (pages.length === 0) return;
    const t = setInterval(() => { setSpot((s) => nextSpot(pagesRef.current, s[0], s[1])); setTick((n) => n + 1); }, sec * 1000);
    return () => clearInterval(t);
  }, [sec, pages.length]);

  const header = (cats: { slug: string; name: string }[], curCat: number) => {
    const w = categoryWindow(cats, curCat, 4);
    return (
      <TvHeader brand={brand} locationName={locationName} clock={clock}>
        <nav className="tv-cats" aria-hidden>
          {w.items.map((c, k) => <span key={c.slug} data-on={w.start + k === curCat ? "" : undefined}>{c.name}</span>)}
        </nav>
      </TvHeader>
    );
  };

  if (pages.length === 0) {
    return (
      <div className="tv" style={{ "--sec": `${sec}s` } as React.CSSProperties}>
        <TvBubbles />
        {header([], 0)}
        <div className="tv-empty"><h1>Меню обновляется</h1><p>Совсем скоро всё будет на экране</p></div>
      </div>
    );
  }

  const pi = Math.min(spot[0], pages.length - 1);
  const page = pages[pi];
  const ii = Math.min(spot[1], page.items.length - 1);
  const cur = page.items[ii];
  const tone = tvTone(cur.name);
  const cats = pages.reduce<{ slug: string; name: string }[]>((acc, p) => (acc.some((c) => c.slug === p.category.slug) ? acc : [...acc, { slug: p.category.slug, name: p.category.name }]), []);
  const curCat = cats.findIndex((c) => c.slug === page.category.slug);
  const chips = [cur.volumeMl ? `${cur.volumeMl} мл` : null, cur.calories ? `${cur.calories} ккал` : null, cur.isVegan ? "Веган" : null, cur.isHighProtein ? "Много белка" : null, cur.isSugarFree ? "Без сахара" : null].filter(Boolean) as string[];
  const priceText = num(cur.price);

  return (
    <div className="tv" style={{ "--sec": `${sec}s`, "--tone": tone, "--on": onTone(tone) } as React.CSSProperties}>
      <TvBubbles />
      {header(cats, curCat)}
      <main className="tv-main">
        <div className="tv-stage" key={`p:${page.key}`}>
          <div className="tv-arch">
            {page.items.map((it, k) => it.image
              // eslint-disable-next-line @next/next/no-img-element
              ? <img key={it.id} src={it.image} alt="" decoding="async" data-on={k === ii ? "" : undefined} />
              : <div key={it.id} className="tv-emoji" aria-hidden data-on={k === ii ? "" : undefined}>{categoryEmoji(it.categorySlug)}</div>)}
            <div className="tv-cap" key={cur.id}>
              <h2>{cur.name}</h2>
              {cur.description && <p>{cur.description}</p>}
              {chips.length > 0 && <div className="tv-chips">{chips.map((c) => <span key={c}>{c}</span>)}</div>}
            </div>
          </div>
          {cur.happyPct > 0 && <span className="tv-badge">−{cur.happyPct}%</span>}
          <div className="tv-sticker" key={`s:${cur.id}`} aria-hidden style={{ "--fs": `calc(var(--u) * ${priceText.length > 6 ? 2.4 : 3})` } as React.CSSProperties}>
            {cur.oldPrice && cur.oldPrice > cur.price ? <s>{num(cur.oldPrice)}</s> : null}
            <b>{priceText}</b>
            <small>сум</small>
          </div>
        </div>

        <section className="tv-list" key={page.key} aria-label={page.category.name}>
          <div className="tv-head">
            <h1 className="tv-cat">{page.category.name}</h1>
            {page.pageCount > 1 && <div className="tv-dots" aria-hidden>{Array.from({ length: page.pageCount }, (_, k) => <i key={k} data-on={k + 1 === page.pageNo ? "" : undefined} />)}</div>}
          </div>
          <ul className="tv-rows" style={{ "--n": page.items.length } as React.CSSProperties}>
            {page.items.map((it, k) => {
              const on = k === ii;
              return (
                <li key={it.id} className="tv-row" data-on={on ? "" : undefined}>
                  <span className="tv-fill" key={on ? `on${tick}` : "off"} aria-hidden />
                  <span className="tv-thumb" aria-hidden>
                    {it.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={it.image} alt="" decoding="async" />
                      : categoryEmoji(it.categorySlug)}
                  </span>
                  <div className="tv-line">
                    <span className="tv-name">{it.name}</span>
                    {it.volumeMl ? <span className="tv-vol">{it.volumeMl} мл</span> : null}
                    <span className="tv-leader" aria-hidden />
                    <span className="tv-price">{it.oldPrice && it.oldPrice > it.price ? <s>{num(it.oldPrice)}</s> : null}{num(it.price)} <small>сум</small></span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <TvFooter brand={brand} qr={qr} />
    </div>
  );
}
