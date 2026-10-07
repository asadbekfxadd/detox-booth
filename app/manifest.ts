import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vitamin B — fresh juice bar",
    short_name: "Vitamin B",
    description: "Свежие соки, смузи, боулы и салаты. Закажите онлайн и заберите готовым.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffdf8",
    theme_color: "#fffdf8",
    lang: "ru",
    icons: [{ src: "/brand/mark.png", sizes: "any", type: "image/png" }],
  };
}
