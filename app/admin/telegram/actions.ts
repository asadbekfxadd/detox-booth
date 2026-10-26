"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { connectBot, disconnectBot } from "@/services/telegram";

const back = (p: string) => redirect(`/admin/telegram${p}`);

export async function connectBotAction(): Promise<void> {
  try { await connectBot(await requireUser("settings.edit")); }
  catch (e) { return back(`?error=${encodeURIComponent(toMessage(e))}`); }
  revalidatePath("/admin/telegram");
  back("?ok=connected");
}

export async function disconnectBotAction(): Promise<void> {
  try { await disconnectBot(await requireUser("settings.edit")); }
  catch (e) { return back(`?error=${encodeURIComponent(toMessage(e))}`); }
  revalidatePath("/admin/telegram");
  back("?ok=disconnected");
}
