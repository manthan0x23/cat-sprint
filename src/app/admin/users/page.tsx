import { loadAdminStats } from "@/lib/admin-stats";
import { AdminShell, Locked, adminAccess } from "../shell";
import { UsersList } from "./users-list";
import { STATUSES, type Status } from "./statuses";

export const metadata = { title: "Users · CAT Sprint admin", robots: { index: false } };

// Every user with their goals and activity. `?status=` preselects a filter (the overview links here).
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { local, ok } = await adminAccess();
  if (!ok) return <Locked />;
  const { status } = await searchParams;
  const initial = STATUSES.some((s) => s.id === status) ? (status as Status) : "all";
  const { people, today } = await loadAdminStats();

  return (
    <AdminShell local={local} tab="/admin/users">
      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <div className="label">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Users</h1>
        </div>
        <span className="chip num">{people.length} total</span>
      </div>

      <UsersList rows={people} today={today} initialStatus={initial} />
      <p className="mt-3 text-[12px] text-muted">Opening a profile needs you signed in to the app (Dev login works locally). Admins see full stats even on friends-only profiles.</p>
    </AdminShell>
  );
}
