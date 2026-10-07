import Link from "next/link";
export default function NotFound() {
  return (
    <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
      <p className="text-xl font-bold">Страница не найдена</p>
      <Link href="/menu" className="mt-4 inline-block rounded-full bg-green-700 px-6 py-3 font-semibold text-white">В меню</Link>
    </div>
  );
}
