"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createReservation, setReservationStatus, assignReservationTable, setDepositPaid } from "@/services/reservations";
import type { OpState } from "@/components/admin/ops";
import type { ReservationStatus } from "@prisma/client";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const refresh = () => { revalidatePath("/admin/reservations"); revalidatePath("/waiter"); };

export async function createStaffReservationAction(_p: OpState, fd: FormData): Promise<OpState> {
  const day = s(fd, "day");
  try {
    const u = await requireUser("reservations.manage");
    await createReservation({ name: s(fd, "name"), phone: s(fd, "phone"), guests: s(fd, "guests"), day, time: s(fd, "time"), note: s(fd, "note") || undefined, tableId: s(fd, "tableId"), confirm: fd.get("confirm") === "on" }, s(fd, "locationId"), { staff: u });
  } catch (e) { return { error: toMessage(e) }; }
  refresh();
  redirect(`/admin/reservations?d=${day}&ok=created`);
}

export async function reservationStatusAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("reservations.manage"); await setReservationStatus(s(fd, "id"), s(fd, "to") as ReservationStatus, u); }
  catch (e) { return { error: toMessage(e) }; }
  refresh();
}
export async function assignTableAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("reservations.manage"); await assignReservationTable(s(fd, "id"), s(fd, "tableId"), u); }
  catch (e) { return { error: toMessage(e) }; }
  refresh();
}
export async function depositAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("reservations.manage"); await setDepositPaid(s(fd, "id"), s(fd, "paid") === "1", u); }
  catch (e) { return { error: toMessage(e) }; }
  refresh();
}
