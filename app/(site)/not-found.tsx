import Link from "next/link";
export default function NotFound() {
  return (
    <div className="rounded-2xl bg-white p-10 text-center border border-line">
      <p className="text-xl font-bold">Страница не найдена</p>
      <Link href="/menu" className="mt-4 inline-block rounded-full bg-ink px-6 py-3 font-semibold text-white">В меню</Link>
    </div>
  );
}
