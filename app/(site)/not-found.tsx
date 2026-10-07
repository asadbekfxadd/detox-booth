import Link from "next/link";
import { Page } from "@/components/site/Page";

export default function NotFound() {
  return (
    <Page>
      <div className="pop mx-auto max-w-lg rounded-3xl bg-orange p-10 text-center">
        <p className="display text-6xl">404</p>
        <p className="mt-2 text-xl font-bold">Такой страницы нет</p>
        <Link href="/menu" className="btn btn-forest pop mt-5">В меню</Link>
      </div>
    </Page>
  );
}
