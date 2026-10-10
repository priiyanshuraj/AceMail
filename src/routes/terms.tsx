import { createFileRoute, Link } from "@tanstack/react-router";
import logoUrl from "@/assets/acemail-logo.png";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — AceMail" },
      { name: "description", content: "The terms that govern your use of AceMail." },
      { property: "og:title", content: "Terms of Service — AceMail" },
      { property: "og:description", content: "The terms that govern your use of AceMail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="AceMail logo" className="h-8 w-8 rounded-lg" width={32} height={32} />
          <span className="text-lg font-semibold">AceMail</span>
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: October 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold">1. The service</h2>
            <p className="mt-2 text-muted-foreground">
              AceMail is an email outreach platform that lets you send multi-step email campaigns
              through your own connected Gmail mailbox, track opens and replies, and manage contacts
              and templates.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. Acceptable use</h2>
            <p className="mt-2 text-muted-foreground">
              You are responsible for the emails you send. You must comply with applicable anti-spam
              and marketing laws (such as CAN-SPAM, GDPR, and similar regulations), honor
              unsubscribe requests, and only email contacts you have a lawful basis to contact. You
              may not use AceMail to send phishing, malware, deceptive, or illegal content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Your mailbox</h2>
            <p className="mt-2 text-muted-foreground">
              Emails are sent from your own Gmail account under your control. Sending volume,
              deliverability, and compliance with Google's terms remain your responsibility. You can
              disconnect your mailbox at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Availability and liability</h2>
            <p className="mt-2 text-muted-foreground">
              The service is provided "as is" without warranties of any kind. We are not liable for
              lost campaigns, delivery failures, or indirect damages arising from use of the service,
              to the maximum extent permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Termination</h2>
            <p className="mt-2 text-muted-foreground">
              You may stop using AceMail and request account deletion at any time. We may suspend
              accounts that violate these terms, particularly the acceptable-use rules.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Changes</h2>
            <p className="mt-2 text-muted-foreground">
              We may update these terms from time to time; the current version is always available on
              this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">7. Contact</h2>
            <p className="mt-2 text-muted-foreground">
              Support: <a className="underline" href="mailto:mepriyanshuonline@gmail.com">mepriyanshuonline@gmail.com</a>
              {" · "}Developer: <a className="underline" href="mailto:hi@priyanshuraj.online">hi@priyanshuraj.online</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
