"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { BrandError } from "@/lib/brand-config";
import { saveBrand } from "@/services/brand";
import type { OpState } from "@/components/admin/ops";

export async function saveBrandAction(_p: OpState, fd: FormData): Promise<OpState> {
  let changed: boolean;
  try {
    const u = await requireUser("settings.edit");
    changed = await saveBrand({
      name: fd.get("name"), descriptor: fd.get("descriptor"), tagline: fd.get("tagline"), seoTitle: fd.get("seoTitle"), description: fd.get("description"),
      footerText: fd.get("footerText"), logoUrl: fd.get("logoUrl"), instagram: fd.get("instagram"),
      primary: fd.get("primary"), accent: fd.get("accent"), ticker: fd.get("ticker"), homeStyle: fd.get("homeStyle"),
      assistant: fd.get("assistant") === "on", heroTitle: fd.get("heroTitle"), heroText: fd.get("heroText"), heroImage: fd.get("heroImage"),
    }, u);
  } catch (e) { return { error: e instanceof BrandError ? e.message : toMessage(e) }; }
  revalidatePath("/", "layout");
  redirect(`/admin/brand?ok=${changed ? 1 : 0}`);
}
