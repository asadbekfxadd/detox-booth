import type { NextAuthConfig } from "next-auth";
import { can, ROUTE_PERMISSIONS } from "@/lib/rbac";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      if (path === "/login") return auth?.user ? Response.redirect(new URL("/after-login", nextUrl)) : true;
      const protectedArea = path.startsWith("/admin") || path.startsWith("/pos");
      if (!protectedArea) return true;
      if (!auth?.user) return false; // -> /login
      const rule = ROUTE_PERMISSIONS.find(([p]) => path === p || path.startsWith(p + "/"));
      const needed = rule ? rule[1] : "dashboard.view";
      return can(auth.user.role, needed) ? true : Response.redirect(new URL("/forbidden", nextUrl));
    },
    jwt({ token, user }) {
      if (user) { token.id = user.id!; token.role = user.role; token.locationId = user.locationId; }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id; session.user.role = token.role; session.user.locationId = token.locationId;
      return session;
    },
  },
} satisfies NextAuthConfig;
