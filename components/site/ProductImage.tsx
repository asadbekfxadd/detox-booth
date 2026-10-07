import { categoryEmoji } from "@/lib/emoji";

/** Фото продукта; если фото не загружено — аккуратная плашка категории. */
export function ProductImage({ image, name, categorySlug, className = "h-44" }: { image: string | null; name: string; categorySlug: string; className?: string }) {
  if (image) return <img src={image} alt={name} className={`w-full object-cover ${className}`} />;
  return (
    <div className={`grid w-full place-items-center bg-gradient-to-br from-lime-100 to-emerald-100 text-6xl ${className}`} aria-label={name}>
      <span aria-hidden>{categoryEmoji(categorySlug)}</span>
    </div>
  );
}
