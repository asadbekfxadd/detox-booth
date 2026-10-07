import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

// bcrypt-хеш случайной строки: нужен только для выравнивания времени ответа
const DUMMY_HASH = "$2b$10$g9kH3Sdf76bTlaIDCyiice10qCh9d/AB5d3AlyiEt8w8oE4fXxvP.";
const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(raw) {
        const p = schema.safeParse(raw);
        if (!p.success) return null;
        const u = await prisma.user.findUnique({ where: { email: p.data.email.toLowerCase() } });
        // сравнение выполняется всегда (с «пустышкой»), чтобы по времени ответа нельзя было узнать, существует ли email
        const ok = await compare(p.data.password, u?.passwordHash ?? DUMMY_HASH);
        if (!u || !u.isActive || !ok) return null;
        await prisma.auditLog.create({ data: { userId: u.id, action: "LOGIN", entity: "User", entityId: u.id } });
        return { id: u.id, name: u.name, email: u.email, role: u.role, locationId: u.locationId };
      },
    }),
  ],
});
