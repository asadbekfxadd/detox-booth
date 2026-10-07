export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Загружаем…</span>
      <div aria-hidden className="h-8 w-48 animate-pulse rounded-lg bg-neutral-200" />
      <div aria-hidden className="h-64 animate-pulse rounded-2xl bg-neutral-200/70" />
    </div>
  );
}
