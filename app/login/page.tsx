import { getBrand } from "@/services/brand";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const brand = await getBrand();
  return <LoginForm brandName={brand.name} searchParams={searchParams} />;
}
