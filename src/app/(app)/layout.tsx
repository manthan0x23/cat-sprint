import Link from "next/link";
import { Logo } from "@/components/logo";
import { BottomNav, TopNav } from "@/components/nav";
import { requireProfile } from "@/lib/data";
import { daysToExam, istNow } from "@/lib/cat";
import { logout } from "../actions";
import { pendingRequests } from "@/lib/social";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireProfile();
  const left = daysToExam(istNow().date);
  const { incoming } = await pendingRequests(user.id);
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard"><Logo /></Link>
            <TopNav requests={incoming.length} />
          </div>
          <div className="flex items-center gap-3">
            <span className="chip num">
              <span className="size-1.5 rounded-full bg-accent pulse" />
              {left} days to CAT
            </span>
            <form action={logout}>
              <button className="size-8 rounded-full overflow-hidden border border-line bg-panel" title={`Sign out ${user.email}`}>
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-xs">{user.name.slice(0, 1)}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 pt-6 pb-28 md:pb-12">{children}</main>
      <BottomNav />
    </div>
  );
}
