import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/site/Icon";

/** Фото уходит в цвет баннера слева направо, чтобы текст оставался читаемым. */
const fade = "[mask-image:linear-gradient(to_right,transparent,#000_45%)]";
const card = "group relative isolate flex min-h-48 lg:min-h-0 shrink-0 basis-[86%] snap-start overflow-hidden rounded-[1.75rem] p-5 sm:basis-[58%] lg:basis-auto";
const photo = `absolute inset-y-0 right-0 -z-10 h-full object-cover transition-transform duration-500 group-hover:scale-105 ${fade}`;

/**
 * Подборки в начале меню. На телефоне листаются пальцем, на десктопе: один большой баннер и два малых.
 * Ссылки ведут на фильтры меню, цен и условий в тексте нет — их задаёт каталог.
 */
export function PromoBanners() {
  return (
    <section aria-label="Подборки" className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:grid lg:h-[24rem] lg:grid-cols-[1.8fr_1fr] lg:grid-rows-2 lg:gap-4 lg:overflow-visible lg:pb-0">
      <Link href="/menu?category=sets" className={`${card} bg-linear-to-br from-sun to-orange text-forest-deep lg:row-span-2 lg:p-8`}>
        <div aria-hidden className="sunburst absolute inset-0 -z-10" />
        <Image src="/brand/family.jpg" alt="" width={800} height={560} sizes="(min-width: 1024px) 460px, 60vw" className={`${photo} w-3/5`} />
        <div className="flex max-w-[58%] flex-col justify-between gap-5">
          <div>
            <p className="script text-2xl sm:text-3xl">Боул и напиток вместе</p>
            <h2 className="mt-1 text-2xl font-black sm:text-4xl">Сеты выгоднее, чем по отдельности</h2>
          </div>
          <span className="btn btn-forest w-fit !px-5 !py-2.5 text-sm">Выбрать сет <Icon name="arrow" size={16} /></span>
        </div>
      </Link>

      <Link href="/menu?diet=protein" className={`${card} bg-forest-deep text-white`}>
        <div aria-hidden className="absolute -right-10 -top-12 -z-10 h-44 w-44 rounded-full bg-orange/40 blur-3xl" />
        <Image src="/brand/gym.jpg" alt="" width={295} height={330} sizes="200px" className={`${photo} w-2/5`} />
        <div className="flex max-w-[62%] flex-col justify-between gap-3">
          <h2 className="text-xl font-black sm:text-2xl">Энергия на твои цели</h2>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-orange px-4 py-1.5 text-sm font-extrabold text-forest-deep">Смузи с белком <Icon name="arrow" size={14} /></span>
        </div>
      </Link>

      <Link href="/menu?diet=sugarfree" className={`${card} bg-leaf-soft text-forest-deep`}>
        <Image src="/brand/kids.jpg" alt="" width={481} height={387} sizes="200px" className={`${photo} w-2/5`} />
        <div className="flex max-w-[62%] flex-col justify-between gap-3">
          <h2 className="text-xl font-black sm:text-2xl">Без сахара для всей семьи</h2>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-forest px-4 py-1.5 text-sm font-extrabold text-white">Показать <Icon name="arrow" size={14} /></span>
        </div>
      </Link>
    </section>
  );
}
