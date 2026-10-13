import Image from "next/image";
import type { Brand } from "@/lib/brand-config";
import { splitName } from "@/lib/brand-config";

/** Знак и название заведения. Нет картинки логотипа: монограмма из первой буквы на цвете бренда. */
export function Logo({ brand, light = false, className = "" }: { brand: Brand; light?: boolean; className?: string }) {
  const [first, last] = splitName(brand.name);
  const word = brand.name === "Vitamin B" ? ["VITAMIN", "B"] : [first.toUpperCase(), last.toUpperCase()];
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {brand.logoUrl
        ? (brand.logoUrl.startsWith("/")
          ? <Image src={brand.logoUrl} alt="" width={260} height={321} priority className="h-10 w-auto shrink-0 drop-shadow-sm transition-transform group-hover:rotate-[-6deg]" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={brand.logoUrl} alt="" height={40} className="h-10 w-auto max-w-24 shrink-0 object-contain" />)
        : <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange text-xl font-black text-forest-deep">{brand.name.trim().charAt(0).toUpperCase()}</span>}
      <span className="flex flex-col whitespace-nowrap leading-none">
        <span className={`display text-[17px] sm:text-[19px] font-extrabold tracking-tight ${light ? "text-white" : "text-forest"}`}>{word[0]}{word[1] && <> <span className="text-orange">{word[1]}</span></>}</span>
        {brand.descriptor && <span className={`mt-1 text-[9px] font-semibold uppercase tracking-[0.28em] ${light ? "text-white/70" : "text-forest/70"}`}>{brand.descriptor}</span>}
      </span>
    </span>
  );
}
