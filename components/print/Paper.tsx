import { PrintBar } from "@/components/print/PrintBar";

/** Лист под термопринтер 80 мм: на экране выглядит как лента, при печати — только содержимое. */
export function Paper({ auto, children }: { auto: boolean; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-200 p-4 text-black print:bg-white print:p-0">
      <style>{`@page { size: 80mm auto; margin: 0 }`}</style>
      <PrintBar auto={auto} />
      <article className="mx-auto w-[76mm] max-w-full bg-white p-[3mm] font-mono text-[12px] leading-snug shadow print:w-[76mm] print:shadow-none">{children}</article>
    </main>
  );
}

export const Dash = () => <hr className="my-2 border-0 border-t border-dashed border-black" />;
export const Row = ({ k, v, bold, big }: { k: React.ReactNode; v?: React.ReactNode; bold?: boolean; big?: boolean }) => (
  <div className={`flex items-baseline justify-between gap-2 ${bold ? "font-bold" : ""} ${big ? "text-[15px]" : ""}`}><span>{k}</span>{v != null && <span className="whitespace-nowrap">{v}</span>}</div>
);
