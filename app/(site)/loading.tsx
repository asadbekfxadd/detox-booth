import { Page } from "@/components/site/Page";

export default function Loading() {
  return (
    <Page>
      <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <span className="sr-only">Загружаем…</span>
        {Array.from({ length: 8 }).map((_, i) => <div key={i} aria-hidden className="aspect-[3/4] animate-pulse rounded-3xl bg-forest/8" />)}
      </div>
    </Page>
  );
}
