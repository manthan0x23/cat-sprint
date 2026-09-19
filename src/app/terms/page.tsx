import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Service · CAT Sprint" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="19 September 2026">
      <p>
        By signing in to CAT Sprint (cat-sprint.vercel.app) you agree to these terms. If you don&rsquo;t agree, please
        don&rsquo;t use the app.
      </p>

      <h2>The service</h2>
      <p>
        CAT Sprint is a free study planner for the CAT exam, run by an individual developer. It is not affiliated with
        the IIMs or the official CAT administration.
      </p>

      <h2>No guarantees</h2>
      <ul>
        <li>Projected scores, percentile references and AI coach messages are estimates and motivation, not predictions or advice. Your actual result depends on you and the exam.</li>
        <li>The app is provided &ldquo;as is&rdquo;. It may have bugs, downtime or data loss, and features may change or be discontinued.</li>
        <li>AI-generated messages may be wrong. Don&rsquo;t rely on them for important decisions.</li>
      </ul>

      <h2>Your account</h2>
      <ul>
        <li>You sign in with your own Google account and are responsible for what happens under it.</li>
        <li>You must be 18 or older.</li>
        <li>Keep your username and anything you share with friends respectful. Don&rsquo;t use the app to harass others, abuse it, or try to break or overload it.</li>
        <li>We may suspend accounts that break these rules.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        Your plans, progress and notes remain yours. You allow us to store and process them to run the app, as described
        in the <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent permitted by law, CAT Sprint and its developer are not liable for any indirect or consequential
        loss arising from use of the app, including exam outcomes or lost data.
      </p>

      <h2>Ending use</h2>
      <p>
        You can stop using the app anytime and ask us to delete your data by emailing{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Changes and law</h2>
      <p>We may update these terms; the date above shows the latest version. These terms are governed by the laws of India.</p>

      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </LegalPage>
  );
}
