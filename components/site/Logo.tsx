import Image from "next/image";

/** Знак бренда (апельсиновая «B» с листьями) и подпись Vitamin B / juice & fresh. */
export function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image src="/brand/mark.png" alt="" width={260} height={321} priority className="h-10 w-auto shrink-0 drop-shadow-sm transition-transform group-hover:rotate-[-6deg]" />
      <span className="flex flex-col whitespace-nowrap leading-none">
        <span className={`display text-[17px] sm:text-[19px] font-extrabold tracking-tight ${light ? "text-white" : "text-forest"}`}>VITAMIN <span className="text-orange">B</span></span>
        <span className={`mt-1 text-[9px] font-semibold tracking-[0.28em] ${light ? "text-white/70" : "text-forest/70"}`}>JUICE &amp; FRESH</span>
      </span>
    </span>
  );
}
