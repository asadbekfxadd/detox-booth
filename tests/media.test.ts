import { describe, it, expect } from "vitest";
import { isMediaPath, mediaPath, MEDIA_ID_RE, MAX_UPLOAD_BYTES, sniffImage } from "@/lib/media";
import { productSchema } from "@/services/products";

const bytes = (...a: number[]) => new Uint8Array([...a, ...new Array(Math.max(0, 16 - a.length)).fill(0)]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("тип фото по содержимому", () => {
  it("JPEG, PNG и WebP узнаются", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImage(new Uint8Array([...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBPVP8 ")]))).toBe("image/webp");
  });
  it("SVG, GIF, HTML, PDF и пустой файл отклоняются", () => {
    expect(sniffImage(new Uint8Array(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>')))).toBeNull();
    expect(sniffImage(new Uint8Array(ascii("GIF89a\u0001\u0000\u0001\u0000\u0000\u0000\u0000\u0000")))).toBeNull();
    expect(sniffImage(new Uint8Array(ascii("<html><script>alert(1)</script>")))).toBeNull();
    expect(sniffImage(new Uint8Array(ascii("%PDF-1.7 aaaaaaaaaa")))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
  it("RIFF без WEBP (например, WAV) не принимается", () => {
    expect(sniffImage(new Uint8Array([...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVEfmt ")]))).toBeNull();
  });
  it("лимит размера 3 МБ", () => expect(MAX_UPLOAD_BYTES).toBe(3_000_000));
});

describe("адрес загруженного фото", () => {
  it("свой адрес принимается, чужие нет", () => {
    const id = "cmvnqp0wj0000tx7d9d1lui76";
    expect(MEDIA_ID_RE.test(id)).toBe(true);
    expect(mediaPath(id)).toBe(`/media/${id}`);
    expect(isMediaPath(`/media/${id}`)).toBe(true);
    for (const bad of ["/media/", "/media/../etc/passwd", "/media/ABC", "/media/short", `/media/${id}/x`, `//media/${id}`, `/uploads/${id}`]) expect(isMediaPath(bad)).toBe(false);
  });
  it("карточка продукта принимает загруженное фото", () => {
    const f = productSchema.shape.image;
    expect(f.safeParse("/media/cmvnqp0wj0000tx7d9d1lui76").success).toBe(true);
    expect(f.safeParse("/media/x").success).toBe(false);
  });
});
