import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#f7f3ea]">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">Нет доступа</h1>
        <p className="text-neutral-600">У вашей роли нет прав на эту страницу.</p>
        <Link href="/after-login" className="inline-block rounded-xl bg-green-700 px-5 py-2 text-white">На главную</Link>
      </div>
    </main>
  );
}
