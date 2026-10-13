"use client";
import { useState } from "react";
import { FormShell, Field, fieldClass, type OpState } from "@/components/admin/ops";

type Product = { id: string; name: string; price: number };
type Category = { id: string; name: string };
type Kind = "BUY_GET" | "COMBO" | "THRESHOLD" | "FIRST_ORDER";

const KINDS: { id: Kind; title: string; hint: string }[] = [
  { id: "BUY_GET", title: "Купи N — получи", hint: "2+1, третий смузи бесплатно, второй за полцены" },
  { id: "COMBO", title: "Набор по цене", hint: "Боул и фреш вместе за фиксированную сумму" },
  { id: "THRESHOLD", title: "Скидка от суммы", hint: "От 100 000 — 5%, от 200 000 — 10%" },
  { id: "FIRST_ORDER", title: "Первый заказ", hint: "Приветственная скидка новому клиенту" },
];
const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function PromotionForm({ action, products, categories }: { action: (p: OpState, fd: FormData) => Promise<OpState>; products: Product[]; categories: Category[] }) {
  const [kind, setKind] = useState<Kind>("BUY_GET");
  const productSelect = (name: string, required = false) => (
    <select name={name} className={fieldClass} defaultValue="" required={required} aria-label="Продукт">
      <option value="">{required ? "Выберите продукт" : "— нет —"}</option>
      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
  return (
    <FormShell action={action} submitLabel="Создать акцию" cancelHref="/admin/promotions">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Тип акции</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => (
            <label key={k.id} className={`cursor-pointer rounded-xl border p-3 text-sm ${kind === k.id ? "border-green-700 bg-lime-50" : "border-neutral-200 hover:bg-neutral-50"}`}>
              <input type="radio" name="kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} className="mr-2" />
              <b>{k.title}</b>
              <span className="mt-0.5 block text-neutral-600">{k.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Название (его увидит гость)"><input name="name" required maxLength={60} placeholder="Третий смузи в подарок" className={fieldClass} /></Field>
        <Field label="Описание (необязательно)"><input name="description" maxLength={200} className={fieldClass} /></Field>
      </div>

      {kind === "BUY_GET" && (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-4">
            <Field label="На что действует">
              <select name="target" required className={fieldClass} defaultValue="">
                <option value="" disabled>Выберите категорию или продукт</option>
                <optgroup label="Категория">{categories.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
                <optgroup label="Продукт">{products.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}</optgroup>
              </select>
            </Field>
          </div>
          <Field label="Купить, шт."><input name="buy" type="number" min={1} max={10} defaultValue={2} required className={fieldClass} /></Field>
          <Field label="Получить, шт."><input name="free" type="number" min={1} max={10} defaultValue={1} required className={fieldClass} /></Field>
          <Field label="Скидка на подарок, %"><input name="percent" type="number" min={1} max={100} defaultValue={100} required className={fieldClass} /></Field>
          <p className="self-end pb-2 text-xs text-neutral-500">Бесплатной (со скидкой) становится самая дешёвая позиция в каждой группе.</p>
        </div>
      )}

      {kind === "COMBO" && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem] gap-3">
              <Field label={`Позиция ${i + 1}${i > 1 ? " (необязательно)" : ""}`}>{productSelect(`item_product_${i}`, i === 0)}</Field>
              <Field label="Шт."><input name={`item_qty_${i}`} type="number" min={1} max={5} defaultValue={1} className={fieldClass} /></Field>
            </div>
          ))}
          <Field label="Цена набора, сум"><input name="price" type="number" min={1} required className={fieldClass} /></Field>
          <p className="text-xs text-neutral-500">Цена должна быть ниже суммы позиций. Размер скидки считается автоматически. Опции (добавки) в набор не входят и оплачиваются отдельно.</p>
        </div>
      )}

      {kind === "THRESHOLD" && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-3 gap-3">
              <Field label={`Ступень ${i + 1}: от суммы, сум`}><input name={`tier_from_${i}`} type="number" min={1} required={i === 0} className={fieldClass} /></Field>
              <Field label="Скидка, %"><input name={`tier_percent_${i}`} type="number" min={1} max={90} className={fieldClass} /></Field>
              <Field label="или сумма скидки"><input name={`tier_off_${i}`} type="number" min={1} className={fieldClass} /></Field>
            </div>
          ))}
          <p className="text-xs text-neutral-500">В каждой ступени заполните либо процент, либо сумму. Считается от суммы после акций на позиции.</p>
        </div>
      )}

      {kind === "FIRST_ORDER" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Скидка, %"><input name="percent" type="number" min={1} max={90} defaultValue={10} required className={fieldClass} /></Field>
          <Field label="Не больше, сум (необязательно)"><input name="maxOff" type="number" min={1} className={fieldClass} /></Field>
          <p className="text-xs text-neutral-500 sm:col-span-2">Клиента узнаём по телефону. На сайте скидка появится, когда гость введёт номер; на кассе нужно выбрать клиента.</p>
        </div>
      )}

      <details className="rounded-xl border border-neutral-200 p-3" open>
        <summary className="cursor-pointer text-sm font-medium">Когда и где действует</summary>
        <div className="mt-3 space-y-4">
          <fieldset className="space-y-1">
            <legend className="text-sm text-neutral-600">Дни недели (если не отмечать — каждый день)</legend>
            <div className="flex flex-wrap gap-3">
              {DAYS.map((d, i) => <label key={d} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="days" value={i + 1} className="size-4" />{d}</label>)}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="С (время, пусто — с начала дня)"><input name="start" type="time" className={fieldClass} /></Field>
            <Field label="До (время, пусто — до конца дня)"><input name="end" type="time" className={fieldClass} /></Field>
            <Field label="Начало акции (дата)"><input name="startsAt" type="date" className={fieldClass} /></Field>
            <Field label="Конец акции (дата)"><input name="endsAt" type="date" className={fieldClass} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Всего применений (лимит)"><input name="totalLimit" type="number" min={1} className={fieldClass} /></Field>
            <Field label="На одного клиента (лимит)"><input name="perCustomerLimit" type="number" min={1} className={fieldClass} /></Field>
            <Field label="Порядок (меньше — раньше)"><input name="sort" type="number" min={0} defaultValue={0} className={fieldClass} /></Field>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="onSite" defaultChecked className="size-4" />На сайте</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="onPos" defaultChecked className="size-4" />На кассе</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="allowCode" className="size-4" />Можно вместе с промокодом</label>
            {(kind === "BUY_GET" || kind === "COMBO") && <label className="flex items-center gap-2"><input type="checkbox" name="withHappyHour" className="size-4" />Действует и на позиции со счастливыми часами</label>}
          </div>
        </div>
      </details>
    </FormShell>
  );
}
