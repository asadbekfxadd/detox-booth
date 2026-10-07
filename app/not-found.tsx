import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f3ea] px-4">
      <div className="max-w-sm rounded-3xl bg-white p-10 text-center shadow-sm">
        <p className="text-xl font-bold">Страница не найдена</p>
        <p className="mt-2 text-sm text-neutral-600">Возможно, она была удалена или ссылка введена с ошибкой.</p>
        <Link href="/" className="mt-5 inline-block rounded-full bg-green-700 px-6 py-3 font-semibold text-white">На главную</Link>
      </div>
    </main>
  );
}
