import { VOID_REASONS } from "@/lib/void-item";

/** Отмена позиции в заказе стола: раскрывающаяся форма. Если нужен менеджер, показываем его email и пароль. */
export function VoidItemForm({ action, tableId, item, needsApproval, big }: {
  action: (fd: FormData) => Promise<void>; tableId: string; item: { id: string; name: string; quantity: number }; needsApproval: boolean; big?: boolean;
}) {
  const field = `w-full rounded-lg border border-neutral-300 bg-white px-3 ${big ? "min-h-11" : "py-1.5"} text-sm`;
  const dl = `void-reasons-${item.id}`;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-red-700 hover:underline">Отменить позицию</summary>
      <form action={action} className="mt-2 space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
        <input type="hidden" name="tableId" value={tableId} />
        <input type="hidden" name="orderItemId" value={item.id} />
        <p className="font-semibold">Отмена: {item.name}</p>
        {item.quantity > 1 && (
          <label className="block"><span className="mb-1 block text-xs text-neutral-600">Сколько порций отменить (в заказе {item.quantity})</span>
            <input name="quantity" type="number" min={1} max={item.quantity} defaultValue={1} required className={field} />
          </label>
        )}
        <label className="block"><span className="mb-1 block text-xs text-neutral-600">Причина</span>
          <input name="reason" list={dl} required minLength={3} maxLength={200} className={field} />
          <datalist id={dl}>{VOID_REASONS.map((r) => <option key={r} value={r} />)}</datalist>
        </label>
        {needsApproval && (
          <fieldset className="space-y-2 rounded-lg bg-white p-2">
            <legend className="px-1 text-xs font-semibold text-red-800">Заказ уже на кухне: подтвердите у менеджера</legend>
            <input name="approverEmail" type="email" autoComplete="off" placeholder="Email менеджера" required className={field} />
            <input name="approverPassword" type="password" autoComplete="off" placeholder="Пароль менеджера" required className={field} />
          </fieldset>
        )}
        <button className={`rounded-lg bg-red-700 px-4 ${big ? "min-h-11" : "py-1.5"} text-sm font-semibold text-white hover:bg-red-800`}>Отменить позицию</button>
      </form>
    </details>
  );
}
