import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { isLocalAdmin } from "@/lib/admin";
import { UsersList } from "./users-list";
import { Logo } from "@/components/logo";

export const metadata = { title: "Users · CAT Sprint admin", robots: { index: false } };

// Local admin list of every user. 404s unless isLocalAdmin() (dev server on localhost).
export default async function AdminUsersPage() {
  if (!(await isLocalAdmin())) notFound();
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image, username: profiles.username })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .orderBy(asc(users.name));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Logo />
        <span className="chip">Local admin</span>
      </div>
      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <div className="label">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Users</h1>
        </div>
        <span className="chip num">{rows.length} total</span>
      </div>

      <UsersList rows={rows} />
      <p className="mt-3 text-[12px] text-muted">Opening a profile needs you signed in to the app (Dev login works). Admins see full stats even on friends-only profiles.</p>
    </main>
  );
}
