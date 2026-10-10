import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logoUrl from "@/assets/acemail-logo.png";

export const SUPPORT_EMAIL = "mepriyanshuonline@gmail.com";
export const DEVELOPER_EMAIL = "hi@priyanshuraj.online";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AceMail" },
      {
        name: "description",
        content:
          "How AceMail collects, uses, stores, shares, and deletes your data, including Google user data from Gmail, Google Sheets, and Google Drive.",
      },
      { property: "og:title", content: "Privacy Policy — AceMail" },
      {
        property: "og:description",
        content: "How AceMail handles your data and Google user data, with Limited Use disclosure.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

const scopes: { scope: string; why: string }[] = [
  {
    scope: "userinfo.email, userinfo.profile",
    why: "To identify which Google account you connected and show its address and name in AceMail.",
  },
  {
    scope: "gmail.send",
    why: "To send the campaign and follow-up emails you write and schedule, from your own Gmail address.",
  },
  {
    scope: "gmail.readonly",
    why: "To check your inbox for replies from your campaign contacts, so follow-ups stop automatically and the reply appears in your AceMail inbox. Messages unrelated to your campaigns are not stored.",
  },
  {
    scope: "spreadsheets.readonly",
    why: "Only if you choose to import contacts from Google Sheets: to read the rows of the sheet you pick.",
  },
  {
    scope: "drive.metadata.readonly",
    why: "Only if you choose to import from Google Sheets: to list your spreadsheet file names so you can pick one. File contents are not read through this permission.",
  },
];

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="AceMail logo" className="h-8 w-8 rounded-lg" width={32} height={32} />
          <span className="text-lg font-semibold">AceMail</span>
        </Link>
        <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          Terms of Service
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <h1 className="text-3xl font-bold">AceMail Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective date: October 10, 2026 · Last updated: October 10, 2026</p>

        <div className="mt-8 space-y-10 leading-relaxed text-foreground">
          <Section title="1. Who we are">
            <p>
              AceMail ("AceMail", "we", "us") is an email outreach application available at{" "}
              <a className="underline" href="https://acemail.lovable.app">https://acemail.lovable.app</a>. It lets
              you connect your own Gmail account, import contacts, write email templates, send personalised
              campaigns with automatic follow-ups, detect replies, and view open, click, and reply analytics.
            </p>
            <p>
              AceMail is developed and operated by Priyanshu Raj, who is the data controller for the information
              described in this policy. Contact: <a className="underline" href={`mailto:${DEVELOPER_EMAIL}`}>{DEVELOPER_EMAIL}</a>.
              User support: <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
            <p>
              This policy explains what information AceMail collects, why, how it is used, stored, and shared, how
              long it is kept, and the choices you have. By using AceMail you agree to this policy.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p><strong className="text-foreground">Account information.</strong> Your email address, display name, and a securely hashed password (if you sign up with email), or your Google account email and name (if you sign in with Google).</p>
            <p><strong className="text-foreground">Content you create.</strong> Contacts and contact lists you add or import (names, email addresses, company, and any custom fields you map), email templates including images and files you upload, campaigns, schedules, and sending limits.</p>
            <p><strong className="text-foreground">Google user data.</strong> When you connect a Gmail mailbox or import from Google Sheets, we receive the data described in sections 3 and 4.</p>
            <p><strong className="text-foreground">Delivery and engagement data.</strong> For emails sent through AceMail: send status, time sent, errors, whether a recipient opened the email (via a tracking image), which tracked links were clicked and when, and whether the recipient replied.</p>
            <p><strong className="text-foreground">Technical data.</strong> Basic logs needed to run and secure the service, such as request timestamps and error messages. We do not use advertising trackers or sell analytics data.</p>
          </Section>

          <Section title="3. Google permissions we request and why">
            <p>AceMail requests only the Google permissions needed for the features you choose to use:</p>
            <ul className="list-disc space-y-2 pl-6">
              {scopes.map((s) => (
                <li key={s.scope}>
                  <code className="rounded bg-muted px-1 text-foreground">{s.scope}</code> — {s.why}
                </li>
              ))}
            </ul>
            <p>Authorization happens on Google's own consent screen. AceMail never sees or stores your Google password.</p>
          </Section>

          <Section title="4. How we access, use, store, and share Google user data">
            <p><strong className="text-foreground">Access.</strong> We access Gmail only when sending a campaign email you scheduled, or when checking for replies to emails AceMail sent. We access Google Sheets and Drive only when you open the import dialog and pick a spreadsheet.</p>
            <p><strong className="text-foreground">Use.</strong> Google user data is used only to provide and improve user-facing features visible in AceMail: sending your emails, detecting and showing replies, stopping follow-ups when someone replies, and importing the contacts you select. It is never used for advertising, never used to build user profiles, and never used to train generalised artificial-intelligence or machine-learning models.</p>
            <p><strong className="text-foreground">Storage.</strong> We store (a) an encrypted authorization key for each connected Google account, (b) the sender, subject, date, and text of replies that match your campaign contacts, and (c) the contact rows you chose to import. Other emails in your inbox are read only transiently to find matching replies and are not saved. Data is stored in an encrypted database with per-user access controls, so only your account can read it.</p>
            <p><strong className="text-foreground">Sharing.</strong> We do not sell, rent, or trade Google user data. We do not transfer it to advertisers, data brokers, or other apps. It is processed only by the infrastructure providers needed to host AceMail (cloud hosting and database), under confidentiality and security obligations, and is disclosed otherwise only if required by law, to protect against abuse, or as part of a merger or acquisition with notice to you.</p>
            <p><strong className="text-foreground">Human access.</strong> No person reads your Google user data unless you give explicit permission for specific messages (for example, when asking support for help), it is necessary for security purposes such as investigating abuse, or it is required to comply with law.</p>
          </Section>

          <Section title="5. Google API Services — Limited Use disclosure">
            <p>
              AceMail's use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <a
                className="underline"
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </Section>

          <Section title="6. How we use other information">
            <ul className="list-disc space-y-2 pl-6">
              <li>To create and secure your account and let you sign in.</li>
              <li>To send emails you schedule, respect your per-hour and per-day limits, and run mailbox warmup if you enable it.</li>
              <li>To show you campaign analytics (sent, opened, clicked, replied).</li>
              <li>To honour unsubscribe requests from your recipients.</li>
              <li>To respond to support requests and to detect, prevent, and fix abuse, spam, and technical problems.</li>
            </ul>
          </Section>

          <Section title="7. Your recipients' data">
            <p>
              When you upload contacts, you are responsible for having a lawful basis to email them. AceMail processes
              recipient data only on your instructions to send your emails and report engagement. Recipients can
              unsubscribe through the link in emails, and can contact us at{" "}
              <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to request removal.
            </p>
          </Section>

          <Section title="8. Cookies and tracking">
            <p>
              The AceMail website uses only essential browser storage to keep you signed in. We do not use advertising
              cookies. In emails you send, AceMail may include a small tracking image to record opens and may rewrite
              links to record clicks; these are used only to show you your own campaign analytics.
            </p>
          </Section>

          <Section title="9. Data security">
            <p>
              Data is encrypted in transit (HTTPS) and at rest. Google authorization keys are stored in a restricted
              area that is never sent to your browser. Access is limited by per-user rules in the database. No method
              is 100% secure, but we take reasonable measures to protect your information and will notify affected
              users of any breach as required by law.
            </p>
          </Section>

          <Section title="10. Data retention and deletion">
            <ul className="list-disc space-y-2 pl-6">
              <li>Your data is kept while your account is active.</li>
              <li>Disconnecting a mailbox in the Mailboxes page deletes its stored Google authorization key immediately.</li>
              <li>You can delete contacts, templates, and campaigns at any time from within the app.</li>
              <li>
                You can request deletion of your account and all associated data, including all Google user data, by
                emailing <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We complete
                deletion within 30 days; backups are overwritten within a further 30 days.
              </li>
              <li>
                You can also revoke AceMail's access at any time at{" "}
                <a className="underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
                  myaccount.google.com/permissions
                </a>.
              </li>
            </ul>
          </Section>

          <Section title="11. Your rights">
            <p>
              Depending on where you live, you may have the right to access, correct, export, or delete your personal
              data, to object to or restrict processing, and to withdraw consent. To exercise any of these rights,
              email <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We respond within 30
              days. You may also complain to your local data protection authority.
            </p>
          </Section>

          <Section title="12. International transfers">
            <p>
              AceMail's infrastructure providers may process data in countries other than your own. Where this happens
              we rely on appropriate safeguards offered by those providers.
            </p>
          </Section>

          <Section title="13. Children">
            <p>
              AceMail is not intended for anyone under 16, and we do not knowingly collect data from children. If you
              believe a child has provided us data, contact us and we will delete it.
            </p>
          </Section>

          <Section title="14. Changes to this policy">
            <p>
              We will post any changes on this page and update the date above. If changes materially affect how we use
              Google user data, we will notify you and ask for consent where required.
            </p>
          </Section>

          <Section title="15. Contact us">
            <p>
              User support (account help, data access and deletion requests):{" "}
              <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
            <p>
              Developer contact (Priyanshu Raj):{" "}
              <a className="underline" href={`mailto:${DEVELOPER_EMAIL}`}>{DEVELOPER_EMAIL}</a>
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
