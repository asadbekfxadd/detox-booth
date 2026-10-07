import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-xl font-bold">Запись не найдена</h1>
      <p className="mt-2 text-sm text-neutral-600">Её могли удалить, или она относится к другой точке.</p>
      <Link href="/admin/dashboard" className="mt-4 inline-block rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white">В обзор</Link>
    </div>
  );
}
