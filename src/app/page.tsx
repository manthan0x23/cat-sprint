import { redirect } from "next/navigation";
import { ArrowRight, BellRing, Brain, CalendarRange, TrendingUp } from "lucide-react";
import { auth, devLoginEnabled } from "@/auth";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { daysToExam, istNow } from "@/lib/cat";
import { devSignIn, signInWithGoogle } from "./actions";

export default async function Landing() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const left = daysToExam(istNow().date);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="grid-bg absolute inset-0 -z-10 h-[640px]" />
      <header className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <form action={signInWithGoogle}><button className="btn btn-ghost btn-sm">Sign in</button></form>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 pt-16 md:pt-24 text-center rise">
        <span className="chip num"><span className="size-1.5 rounded-full bg-accent pulse" />CAT 2026 · Sun 29 Nov · {left} days left</span>
        <h1 className="mt-6 text-[44px] md:text-[72px] leading-[1.02] font-semibold tracking-[-0.035em]">
          Every day you skip<br /><span className="text-muted">shows up on 29 Nov.</span>
        </h1>
        <p className="mt-6 text-[17px] text-ink-2 max-w-xl mx-auto leading-relaxed">
          Plan your mocks, set daily QA · RC · VA · DILR targets, and watch how each day&apos;s work
          moves your projected percentile. An AI coach checks in when you fall behind.
        </p>
        <form action={signInWithGoogle} className="mt-9 flex justify-center">
          <button className="btn btn-primary h-11 px-5 text-[15px]">
            <GoogleG /> Continue with Google <ArrowRight size={16} />
          </button>
        </form>
        {devLoginEnabled && (
          <form action={devSignIn} className="mt-3 flex justify-center">
            <button className="btn btn-ghost btn-sm">Dev login (local only)</button>
          </form>
        )}
      </section>

      <section className="mx-auto max-w-5xl px-4 mt-20 md:mt-28 pb-20 grid gap-3 md:grid-cols-4">
        {[
          { icon: CalendarRange, t: "Mock calendar", d: "Auto-planned to CAT day: 2/week now, 3/week in the final stretch, tapering at the end." },
          { icon: TrendingUp, t: "Cause → effect", d: "See how skipping today changes your backlog, your consistency and your projected %ile." },
          { icon: Brain, t: "AI coach", d: "A Qwen-powered brief each morning and nudges that use your own goal and numbers." },
          { icon: BellRing, t: "Phone reminders", d: "3 PM and you're at 10%? You'll get a push notification on your phone." },
        ].map(({ icon: Icon, t, d }, i) => (
          <div key={t} className="card p-5 rise" style={{ animationDelay: `${120 + i * 60}ms` }}>
            <Icon size={18} className="text-accent" />
            <div className="mt-4 font-medium">{t}</div>
            <p className="mt-1.5 text-[13.5px] text-muted leading-relaxed">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
