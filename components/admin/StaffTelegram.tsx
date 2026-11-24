"use client";
import { useActionState } from "react";
import { CopyText } from "@/components/admin/CopyText";

export type LinkState = { error?: string; link?: string; unlinked?: boolean } | undefined;

/** Привязка Telegram сотрудника: ссылка действует 15 минут, сотрудник открывает её на телефоне, где стоит его Telegram. */
export function StaffTelegram({ userId, linked, canLink, issueAction, unlinkAction }: {
  userId: string; linked: boolean; canLink: boolean;
  issueAction: (p: LinkState, fd: FormData) => Promise<LinkState>; unlinkAction: (p: LinkState, fd: FormData) => Promise<LinkState>;
}) {
  const [issued, issue, issuing] = useActionState(issueAction, undefined);
  const [unl, unlink, unlinking] = useActionState(unlinkAction, undefined);
  const isLinked = linked && !unl?.unlinked;
  return (
    <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="font-semibold">Продажи и приход через Telegram-бота</h2>
      {!canLink ? (
        <p className="text-sm text-neutral-500">У этой роли нет доступа ни к кассе, ни к закупкам, поэтому записывать что-либо через бота она не может.</p>
      ) : isLinked ? (
        <>
          <p className="text-sm text-green-700">Telegram привязан. Сотрудник пишет боту, что продал («2 латте»), и продажа попадает в кассу. Те, у кого есть право закупок, так же записывают приход товара.</p>
          <form action={unlink}>
            <input type="hidden" name="id" value={userId} />
            <button disabled={unlinking} className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60">{unlinking ? "Отвязываем…" : "Отвязать Telegram"}</button>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-600">Нажмите кнопку, получите ссылку (действует 15 минут) и откройте её в Telegram на телефоне сотрудника. После этого бот будет принимать от него продажи текстом.</p>
          <form action={issue}>
            <input type="hidden" name="id" value={userId} />
            <button disabled={issuing} className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">{issuing ? "Готовим…" : issued?.link ? "Выдать новую ссылку" : "Привязать Telegram"}</button>
          </form>
          {issued?.link && <CopyText text={issued.link} label="Ссылка для привязки (15 минут)" />}
        </>
      )}
      {(issued?.error || unl?.error) && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{issued?.error || unl?.error}</p>}
    </div>
  );
}
