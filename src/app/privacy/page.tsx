import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy · CAT Sprint" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="19 September 2026">
      <p>
        CAT Sprint (&ldquo;we&rdquo;, cat-sprint.vercel.app) is a free study planner for CAT aspirants, run by an
        individual developer. This page explains what data we collect, why, and who it is shared with.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>From Google sign-in:</b> your name, email address and profile picture, and your Google account ID. We only request the basic <code>openid</code>, <code>email</code> and <code>profile</code> scopes and never access your Gmail, Drive or other Google data.</li>
        <li><b>What you enter:</b> username, target score/percentile, dream colleges, your &ldquo;why&rdquo;, weak sections, study hours, daily plans and progress, mock scores and notes, weekly goals.</li>
        <li><b>Social:</b> friend requests and friendships, and your profile visibility setting.</li>
        <li><b>Notifications:</b> your push subscription (a browser-issued address for your device), your notification preferences, and a log of notifications sent.</li>
        <li><b>Usage counters:</b> how many AI coach messages were generated per day, to stay within free limits.</li>
      </ul>
      <p>We do not collect payment details, and we do not use analytics or advertising trackers.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To run the app: sign you in, show your plan and progress, and project your mock score.</li>
        <li>To send the reminders and check-ins you turn on (push notifications and, if enabled, email).</li>
        <li>To generate AI coach messages (see below).</li>
        <li>To show your progress to friends, or publicly, according to your visibility setting.</li>
      </ul>
      <p>We do not sell your data or use it for advertising.</p>

      <h2>Who we share it with</h2>
      <p>Only the services needed to run the app:</p>
      <ul>
        <li><b>Vercel</b>: hosts the app (Singapore region).</li>
        <li><b>Neon</b>: stores the database (Singapore region).</li>
        <li><b>Google</b>: sign-in.</li>
        <li><b>OpenRouter</b> and the AI model providers it routes to: to write coach messages we send your first name, target, dream colleges, your &ldquo;why&rdquo;, and study/mock numbers and notes. We do not send your email address. Free AI models may log prompts under their providers&rsquo; policies, so avoid writing anything sensitive in notes.</li>
        <li><b>Push services</b> (e.g. Google, Apple, Mozilla) deliver notifications to your device; <b>Gmail SMTP</b> sends emails if you enable them.</li>
      </ul>

      <h2>Cookies and local storage</h2>
      <p>We use one sign-in cookie to keep you logged in, and your browser&rsquo;s local storage to remember your theme. No third-party cookies.</p>

      <h2>Retention and deletion</h2>
      <p>
        We keep your data while your account exists. To delete your account and all its data, or to get a copy of it,
        email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address you signed in with. We act on
        requests within 30 days. You can turn notifications off anytime in Settings, and revoke the app&rsquo;s access
        from your Google Account&rsquo;s security settings.
      </p>

      <h2>Security</h2>
      <p>Data is sent over HTTPS and stored with our hosting providers. No system is perfectly secure, but we limit access to what the app needs.</p>

      <h2>Children</h2>
      <p>CAT Sprint is intended for users aged 18 and over.</p>

      <h2>Changes</h2>
      <p>If this policy changes, we will update the date above. Significant changes will be shown in the app.</p>

      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </LegalPage>
  );
}
