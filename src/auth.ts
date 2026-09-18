import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

// Local-only shortcut so the app can be tried before Google OAuth is set up.
// Never active in production builds.
const devLogin = process.env.NODE_ENV === "development" && process.env.DEV_LOGIN === "1";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google,
    ...(devLogin
      ? [Credentials({
          id: "dev",
          credentials: {},
          async authorize() {
            const email = "dev@cat-sprint.local";
            const found = await db.query.users.findFirst({ where: eq(users.email, email) });
            if (found) return found;
            const [u] = await db.insert(users).values({ email, name: "Dev Aspirant" }).returning();
            return u;
          },
        })]
      : []),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});

export const devLoginEnabled = devLogin;
