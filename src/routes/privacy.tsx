import { createFileRoute, Link } from "@tanstack/react-router";
import logoUrl from "@/assets/acemail-logo.png";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AceMail" },
      { name: "description", content: "How AceMail collects, uses, and protects your data." },
      { property: "og:title", content: "Privacy Policy — AceMail" },
      { property: "og:description", content: "How AceMail collects, uses, and protects your data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="AceMail logo" className="h-8 w-8 rounded-lg" width={32} height={32} />
          <span className="text-lg font-semibold">AceMail</span>
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: October 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold">1. What we collect</h2>
            <p className="mt-2 text-muted-foreground">
              When you use AceMail we store your account email address, the contact lists and email
              templates you create, campaign settings, and delivery statistics. When you connect a
              Gmail mailbox, we store an encrypted access credential that lets AceMail send email and
              read replies on your behalf. We never see or store your Google password.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">2. How we use your data</h2>
            <p className="mt-2 text-muted-foreground">
              Your data is used only to operate the service: sending the campaigns you configure,
              detecting replies, tracking opens, and showing you analytics. We do not sell, rent, or
              share your data or your contacts' data with third parties for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">3. Gmail access</h2>
            <p className="mt-2 text-muted-foreground">
              AceMail requests Gmail access solely to send emails you compose and to check your inbox
              for replies to those emails, so follow-ups can stop automatically. Mailbox data is not
              used for any other purpose and is not transferred to anyone else. You can disconnect a
              mailbox at any time from the Mailboxes page, which revokes our access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">4. Data security and retention</h2>
            <p className="mt-2 text-muted-foreground">
              Data is stored in an encrypted database with per-user isolation. Mailbox credentials are
              encrypted at rest. Your data is kept while your account is active; you can request
              deletion of your account and all associated data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">5. Your rights</h2>
            <p className="mt-2 text-muted-foreground">
              You may export or delete your contacts, templates, and campaigns at any time. For any
              privacy question or deletion request, contact the app owner through the support channel
              listed on the home page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">6. Changes</h2>
            <p className="mt-2 text-muted-foreground">
              If this policy changes, the updated version will be posted on this page with a new
              "last updated" date.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
