"use client";
import { useRef, useState } from "react";

const MAX_SIDE = 1400;

/** Читает фото из файла. createImageBitmap учитывает поворот с телефона; для старых браузеров запасной путь через <img>. */
async function decode(file: File): Promise<{ src: CanvasImageSource; w: number; h: number }> {
  try {
    const b = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { src: b, w: b.width, h: b.height };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("decode")); i.src = url; });
      return { src: img, w: img.naturalWidth, h: img.naturalHeight };
    } finally { URL.revokeObjectURL(url); }
  }
}

/** Уменьшаем до 1400 px и сжимаем в JPEG: быстрее грузится на сайте, а данные камеры (в том числе место съёмки) убираются. */
async function shrink(file: File): Promise<Blob> {
  const { src, w, h } = await decode(file);
  if (!w || !h) throw new Error("decode");
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.86));
  if (!blob) throw new Error("encode");
  return blob;
}

/** Фото продукта: перетащить, выбрать, вставить из буфера (Ctrl+V) или, как запасной путь, ссылка. Значение уходит в поле image. */
export function ImageField({ initial, onBusy }: { initial: string | null; onBusy?: (b: boolean) => void }) {
  const [value, setValue] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const setBusyBoth = (b: boolean) => { setBusy(b); onBusy?.(b); };

  async function upload(file: File) {
    setErr(null);
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) { setErr("Это не фото. Подойдут JPG, PNG, WebP."); return; }
    setBusyBoth(true);
    try {
      let blob: Blob;
      try { blob = await shrink(file); } catch { setErr("Не удалось прочитать фото. Сохраните его как JPG или PNG и попробуйте снова."); return; }
      const fd = new FormData(); fd.set("file", blob, "photo.jpg");
      const r = await fetch("/api/products/photo", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) { setErr(j.error ?? "Не получилось загрузить фото. Попробуйте ещё раз."); return; }
      setValue(j.url);
    } catch { setErr("Нет связи. Проверьте интернет и попробуйте ещё раз."); }
    finally { setBusyBoth(false); }
  }

  function take(files: FileList | null | undefined, dt?: DataTransfer | null) {
    const f = [...(files ?? [])].find((x) => /^image\//.test(x.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(x.name));
    if (f) { void upload(f); return; }
    // картинку перетащили с другого сайта: у браузера есть только ссылка на неё
    const url = dt?.getData("text/uri-list")?.split("\n").find((l) => /^https:\/\//.test(l.trim()))?.trim();
    if (url) { setErr(null); setValue(url); return; }
    setErr("Это не фото. Подойдут JPG, PNG, WebP.");
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="image" value={value} />
      <div
        tabIndex={0} role="group" aria-label="Фото продукта"
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files, e.dataTransfer); }}
        onPaste={(e) => { const fs = e.clipboardData.files; if (fs.length) { e.preventDefault(); take(fs); } }}
        className={`flex flex-wrap items-center gap-4 rounded-2xl border-2 border-dashed p-4 outline-none transition-colors focus:border-green-600 ${over ? "border-green-600 bg-lime-50" : "border-neutral-300 bg-neutral-50"}`}
      >
        <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
          {value
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={value} alt="Текущее фото" className="size-full object-cover" />
            : <span className="px-2 text-center text-xs text-neutral-500">нет фото</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold">{busy ? "Загружаем фото…" : "Перетащите фото сюда"}</p>
          <p className="text-xs text-neutral-500">или выберите файл, или нажмите здесь и вставьте из буфера (Ctrl+V). Подойдут JPG, PNG, WebP. Фото само уменьшится и сожмётся.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => pick.current?.click()} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">{value ? "Заменить фото" : "Выбрать фото"}</button>
            {value && <button type="button" disabled={busy} onClick={() => { setValue(""); setErr(null); }} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60">Убрать фото</button>}
          </div>
          <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
        </div>
      </div>
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-neutral-500">Или вставить ссылку на фото</summary>
        <input type="text" inputMode="url" placeholder="https://…" value={value.startsWith("/media/") ? "" : value} onChange={(e) => setValue(e.target.value)} className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600" />
      </details>
    </div>
  );
}
