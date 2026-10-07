/** Центрированный контейнер для внутренних страниц. Главная рисует цветные блоки на всю ширину сама. */
export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 py-8 sm:py-10 ${className}`}>{children}</div>;
}
