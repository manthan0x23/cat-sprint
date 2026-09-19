import Link from "next/link";
import { Logo } from "@/components/logo";

export const CONTACT_EMAIL = "manthan0x23@gmail.com";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between">
        <Link href="/"><Logo /></Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-20">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-2 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:underline">
          {children}
        </div>
      </main>
    </div>
  );
}
