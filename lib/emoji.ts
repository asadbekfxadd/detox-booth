const EMOJI: Record<string, string> = { smoothies: "🥤", detox: "🥬", bowls: "🥣", fresh: "🍊", "healthy-snacks": "🌾", fruits: "🍓" };
export const categoryEmoji = (slug: string) => EMOJI[slug] ?? "🍽️";
