import { knownIngredients } from "@/lib/ingredients";

/**
 * Готовое описание для AI-генератора видео (Veo, Kling, Runway, Sora и подобных) по данным товара.
 * Пишем по-английски: генераторы лучше понимают его. Без людей, текста и логотипов, чтобы ролик не пришлось переснимать.
 */
export function buildVideoPrompt(p: { name: string; categoryName: string; drink: boolean; ingredients: string[]; volumeMl: number | null }): string {
  const known = knownIngredients(p.ingredients, 5).map((k) => k.en);
  const list = known.length ? known.join(", ") : "fresh fruits and vegetables";
  const style = "Soft natural daylight, clean bright background, shallow depth of field, slow motion, smooth camera movement, appetizing, high-end food commercial. No text, no logos, no people.";
  const head = "Vertical 9:16 video, 8 seconds.";
  if (p.drink) {
    const cup = p.volumeMl ? `a clear ${p.volumeMl} ml takeaway cup with a straw` : "a clear takeaway cup with a straw";
    return `${head} Macro shots of a juice bar drink "${p.name}". Fresh ${list} fall into a clear blender jar, juice splashes in slow motion, the blender spins and mixes everything into a smooth vivid drink with the natural color of the ingredients, which is poured into ${cup}. Final close-up of the finished cup with a few fresh ingredients beside it. ${style}`;
  }
  return `${head} Top-down shot of a clean white table. A chef's hands-free time-lapse: a bowl "${p.name}" is assembled piece by piece, with fresh ${list} placed one by one in neat sections, a final drizzle and sprinkle on top. Final close-up of the finished bowl. ${style}`;
}
