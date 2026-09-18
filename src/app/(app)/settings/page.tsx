import { requireProfile } from "@/lib/data";
import { SECTIONS, SECTION_META } from "@/lib/cat";
import { SYSTEM_TEMPLATES } from "@/lib/templates";
import { saveNotificationSettings, saveProfileSettings, updateGoal } from "@/app/actions";
import { PushToggle, TestButton, ResetPlan, SubmitButton } from "./client";

export default async function SettingsPage() {
  const { profile: p } = await requireProfile();
  const hours = Array.from({ length: 25 }, (_, h) => h);
  const hourLabel = (h: number) => (h === 24 ? "12 AM" : `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <div className="label">Settings</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Goal & notifications</h1>
      </div>

      <form action={saveProfileSettings} className="card p-5 space-y-4">
        <div className="label">Profile & privacy</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label><span className="text-[13px] text-muted">Username</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">@</span>
              <input name="username" required pattern="[a-z0-9_]{3,20}" defaultValue={p.username ?? ""} className="input !pl-7 num" />
            </div></label>
          <label><span className="text-[13px] text-muted">Who can see your stats</span>
            <select name="visibility" defaultValue={p.visibility} className="input mt-1">
              <option value="friends">Friends only</option>
              <option value="public">Anyone signed in</option>
            </select></label>
        </div>
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" name="showMocks" defaultChecked={p.showMocks} className="accent-[var(--accent)]" /> Show my mock percentiles on my profile
        </label>
        <p className="text-[12px] text-muted">Your &ldquo;why&rdquo;, notes and notification settings are never shared.</p>
        <div className="flex justify-end"><SubmitButton>Save profile</SubmitButton></div>
      </form>

      <form action={updateGoal} className="card p-5 space-y-4">
        <div className="label">Goal</div>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="text-[13px] text-muted">Target percentile</span>
            <input name="targetPercentile" type="number" step="0.1" min={50} max={100} defaultValue={p.targetPercentile} className="input mt-1 num" /></label>
          <label><span className="text-[13px] text-muted">Dream colleges</span>
            <input name="dreamColleges" defaultValue={p.dreamColleges.join(", ")} className="input mt-1" /></label>
        </div>
        <label className="block"><span className="text-[13px] text-muted">Your why</span>
          <textarea name="why" rows={3} defaultValue={p.why} className="input mt-1" /></label>
        <div>
          <span className="text-[13px] text-muted">Weak sections</span>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {SECTIONS.map((s) => (
              <label key={s} className="inline-flex items-center gap-1.5 text-[13.5px]">
                <input type="checkbox" name="weakSections" value={s} defaultChecked={p.weakSections.includes(s)} className="accent-[var(--accent)]" />
                {SECTION_META[s].label}
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="text-[13px] text-muted">Study starts (IST)</span>
            <select name="studyStartHour" defaultValue={p.studyStartHour} className="input mt-1 num">{hours.slice(0, 24).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
          <label><span className="text-[13px] text-muted">Study ends</span>
            <select name="studyEndHour" defaultValue={p.studyEndHour} className="input mt-1 num">{hours.slice(1).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
        </div>
        <div className="flex justify-end"><SubmitButton>Save goal</SubmitButton></div>
      </form>

      <form action={saveNotificationSettings} className="card p-5 space-y-5">
        <div className="label">Coach & notifications</div>
        <label className="block"><span className="text-[13px] text-muted">Coach tone</span>
          <select name="coachIntensity" defaultValue={p.coachIntensity} className="input mt-1">
            <option value="gentle">Supportive</option>
            <option value="firm">Direct</option>
            <option value="strict">Strict</option>
          </select></label>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium text-[14.5px]">Push notifications</div>
            <p className="text-[13px] text-muted mt-0.5">On phones, first install the app (Share → Add to Home Screen on iPhone; ⋮ → Install app on Android), then enable here.</p>
          </div>
          <PushToggle subscribed={p.pushSubscriptions.length} />
        </div>
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" name="notifyPush" defaultChecked={p.notifyPush} className="accent-[var(--accent)]" /> Send push notifications
        </label>

        <div className="pt-4 border-t border-line">
          <div className="font-medium text-[14.5px]">WhatsApp (via CallMeBot, free)</div>
          <ol className="mt-2 text-[13px] text-muted list-decimal ml-4 space-y-1">
            <li>Save <span className="num text-ink">+34 623 91 22 04</span> in your contacts.</li>
            <li>WhatsApp it: <span className="text-ink">I allow callmebot to send me messages</span></li>
            <li>Paste the API key it replies with below. (Personal-use service. It can occasionally be slow.)</li>
          </ol>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label><span className="text-[13px] text-muted">Your WhatsApp number</span>
              <input name="callmebotPhone" defaultValue={p.callmebotPhone ?? ""} placeholder="+919876543210" className="input mt-1 num" /></label>
            <label><span className="text-[13px] text-muted">CallMeBot API key</span>
              <input name="callmebotKey" defaultValue={p.callmebotKey ?? ""} placeholder="1234567" className="input mt-1 num" /></label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13.5px]">
            <input type="checkbox" name="notifyWhatsapp" defaultChecked={p.notifyWhatsapp} className="accent-[var(--accent)]" /> Send WhatsApp messages
          </label>
        </div>

        <div className="pt-4 border-t border-line text-[13px] text-muted">
          The coach checks in at 12 PM, 3 PM, 6 PM, 8 PM and 10 PM (within your study window). It warns you when you&apos;re behind and escalates if you ignore it, pushes you to close when you&apos;re almost done, applauds the moment you finish, and calls out a bad yesterday the next morning. It stays quiet when you&apos;re on pace.
        </div>
        <div className="flex justify-between gap-2 flex-wrap">
          <TestButton />
          <SubmitButton>Save notifications</SubmitButton>
        </div>
      </form>

      <div className="card p-5">
        <div className="label">Plan</div>
        <p className="mt-2 text-[13.5px] text-muted">Rebuild your whole plan from today with a template. This replaces your custom day edits from today onwards; past days and logs stay.</p>
        <ResetPlan templates={SYSTEM_TEMPLATES.map((t) => ({ id: t.id, name: t.name }))} current={p.templateId} />
      </div>
    </div>
  );
}
