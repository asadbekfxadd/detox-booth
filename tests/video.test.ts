import { describe, it, expect } from "vitest";
import { parseVideo } from "@/lib/video";

describe("parseVideo", () => {
  it("YouTube: обычная, короткая, Shorts и embed ссылки", () => {
    for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=5s", "https://www.youtube.com/embed/dQw4w9WgXcQ"]) {
      const v = parseVideo(u);
      expect(v?.kind).toBe("youtube");
      expect(v && v.kind === "youtube" && v.embed).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    }
    const s = parseVideo("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect(s && s.kind === "youtube" && s.vertical).toBe(true);
    const w = parseVideo("https://youtu.be/dQw4w9WgXcQ");
    expect(w && w.kind === "youtube" && w.vertical).toBe(false);
  });
  it("прямой файл по расширению, в том числе с параметрами", () => {
    expect(parseVideo("https://cdn.example.com/juice.mp4")).toEqual({ kind: "file", src: "https://cdn.example.com/juice.mp4" });
    expect(parseVideo("https://cdn.example.com/a/b.WEBM?token=1")?.kind).toBe("file");
  });
  it("остальные ссылки открываются отдельно (Instagram и т.п.)", () => {
    expect(parseVideo("https://www.instagram.com/reel/abc123/")).toEqual({ kind: "link", src: "https://www.instagram.com/reel/abc123/" });
    expect(parseVideo("https://www.youtube.com/@vitaminb")?.kind).toBe("link"); // канал, не видео
  });
  it("не принимает http, мусор и пустое", () => {
    expect(parseVideo("http://cdn.example.com/juice.mp4")).toBeNull();
    expect(parseVideo("javascript:alert(1)")).toBeNull();
    expect(parseVideo("не ссылка")).toBeNull();
    expect(parseVideo("")).toBeNull();
    expect(parseVideo(null)).toBeNull();
  });
  it("YouTube с неверным id считается обычной ссылкой, а не встраивается", () => {
    expect(parseVideo("https://www.youtube.com/watch?v=evil\"onload")?.kind).toBe("link");
  });
});

describe("parseVideo: файл на этом же сайте", () => {
  it("путь /videos/x.mp4 — прямой файл", () => {
    expect(parseVideo("/videos/mango.mp4")).toEqual({ kind: "file", src: "/videos/mango.mp4" });
    expect(parseVideo("  /videos/a.webm ")).toEqual({ kind: "file", src: "/videos/a.webm" });
  });
  it("чужой хост без https и путь без расширения не принимаются", () => {
    expect(parseVideo("//evil.com/a.mp4")).toBeNull();
    expect(parseVideo("/videos/readme")).toBeNull();
    expect(parseVideo("javascript:alert(1)")).toBeNull();
  });
});
