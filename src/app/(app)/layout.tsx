import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavSheet } from "@/components/nav";
import { requireProfile } from "@/lib/data";
import { daysToExam, istNow } from "@/lib/cat";
import { pendingRequests } from "@/lib/social";
import { logout } from "../actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, profile } = await requireProfile();
  const left = daysToExam(istNow().date);
  const { incoming } = await pendingRequests(user.id);
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 bg-bg/75 backdrop-blur-md border-b border-line/60">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/dashboard" aria-label="CAT Sprint home"><Logo /></Link>
          <div className="flex items-center gap-2.5">
            <span className="chip num">
              <span className="size-1.5 rounded-full bg-accent pulse" />
              {left}<span className="hidden sm:inline">&nbsp;days to CAT</span><span className="sm:hidden">d</span>
            </span>
            <NavSheet user={{ name: user.name, email: user.email, image: user.image }} username={profile.username} requests={incoming.length} logout={logout} />
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 pt-6 pb-16">{children}</main>
    </div>
  );
}
