"use client";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Строка таблицы, по которой можно нажать в любом месте. Нажатие обрабатываем в самой строке, а не растягиваем ссылку
 * через position: Safari на Mac и iPad не считает <tr> опорным блоком, и растянутые ссылки всех строк накладывались
 * друг на друга: любое нажатие открывало один и тот же заказ. Ссылка внутри строки остаётся для клавиатуры и «открыть в новой вкладке».
 */
export function ClickableRow({ href, className = "", children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const open = (newTab: boolean) => { if (newTab) window.open(href, "_blank", "noopener"); else router.push(href); };
  return (
    <tr
      className={`cursor-pointer ${className}`}
      onClick={(e) => {
        if (e.defaultPrevented || (e.target as HTMLElement).closest("a,button,input,select,textarea,label,form,summary")) return;
        if (window.getSelection()?.toString()) return; // человек выделяет текст, а не открывает заказ
        open(e.metaKey || e.ctrlKey);
      }}
      onAuxClick={(e) => { if (e.button === 1 && !(e.target as HTMLElement).closest("a,button")) { e.preventDefault(); open(true); } }}
    >
      {children}
    </tr>
  );
}
