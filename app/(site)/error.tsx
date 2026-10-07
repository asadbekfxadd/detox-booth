"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Page } from "@/components/site/Page";

export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <Page>
      <div role="alert" className="pop mx-auto max-w-lg rounded-3xl bg-sand p-10 text-center">
        <p className="text-5xl" aria-hidden>🍊</p>
        <h1 className="mt-3 text-2xl">Не получилось загрузить страницу</h1>
        <p className="mt-2 text-forest/70">Проверьте соединение и попробуйте ещё раз. Корзина сохранена.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button onClick={() => retry()} className="btn btn-primary">Повторить</button>
          <Link href="/menu" className="btn btn-ghost">В меню</Link>
        </div>
      </div>
    </Page>
  );
}
