import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { isAdmin, isLocalAdmin } from "@/lib/admin";
import { UsersList } from "./users-list";
import { LockButton, UnlockForm } from "./unlock-form";
import { Logo } from "@/components/logo";

export const metadata = { title: "Users · CAT Sprint admin", robots: { index: false } };

// Admin list of every user. Local dev on localhost is always admin; in production it asks for the admin password.
export default async function AdminUsersPage() {
  const local = await isLocalAdmin();
  if (!local && !(await isAdmin())) {
    return (
      <main className="mx-auto w-full max-w-sm px-4 py-8">
        <Logo />
        <UnlockForm />
      </main>
    );
  }
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image, username: profiles.username,
      targetPercentile: profiles.targetPercentile, dreamColleges: profiles.dreamColleges, weakSections: profiles.weakSections,
      why: profiles.why, studyStartHour: profiles.studyStartHour, studyEndHour: profiles.studyEndHour })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .orderBy(asc(users.name));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Logo />
        {local ? <span className="chip">Local admin</span> : <LockButton />}
      </div>
      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <div className="label">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Users</h1>
        </div>
        <span className="chip num">{rows.length} total</span>
      </div>

      <UsersList rows={rows} />
      <p className="mt-3 text-[12px] text-muted">Opening a profile needs you signed in to the app (Dev login works locally). Admins see full stats even on friends-only profiles.</p>
    </main>
  );
}
