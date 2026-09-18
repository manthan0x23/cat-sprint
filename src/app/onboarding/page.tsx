import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/data";
import { Logo } from "@/components/logo";
import { istNow } from "@/lib/cat";
import { OnboardingForm } from "./form";

export default async function OnboardingPage() {
  const user = await requireUser();
  const p = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
  if (p?.onboarded) redirect("/dashboard");
  return (
    <div className="relative min-h-dvh">
      <div className="grid-bg absolute inset-0 -z-10 h-[420px]" />
      <header className="mx-auto max-w-3xl px-4 h-16 flex items-center"><Logo /></header>
      <main className="mx-auto max-w-3xl px-4 pb-24">
        <p className="label mt-6">Setup · 1 minute</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
          Hi {user.name.split(" ")[0] || "there"}, let&apos;s aim this at 29 Nov.
        </h1>
        <p className="mt-2 text-muted">Your goal and your &ldquo;why&rdquo; power the coach. Everything is editable later.</p>
        <OnboardingForm today={istNow().date} suggested={(user.email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20)} />
      </main>
    </div>
  );
}
