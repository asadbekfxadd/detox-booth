import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(raw) {
        const p = schema.safeParse(raw);
        if (!p.success) return null;
        const u = await prisma.user.findUnique({ where: { email: p.data.email.toLowerCase() } });
        if (!u || !u.isActive || !(await compare(p.data.password, u.passwordHash))) return null;
        await prisma.auditLog.create({ data: { userId: u.id, action: "LOGIN", entity: "User", entityId: u.id } });
        return { id: u.id, name: u.name, email: u.email, role: u.role, locationId: u.locationId };
      },
    }),
  ],
});
