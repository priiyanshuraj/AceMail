<div align="center">

<img src="public/favicon.png" alt="AceMail" width="72" />

# AceMail

**Cold email outreach, minus the busywork.**

[Live app](https://acemail.lovable.app) · [Website](https://acemail.online) · [Privacy](https://acemail.lovable.app/privacy) · [Terms](https://acemail.lovable.app/terms)

</div>

---

AceMail is an outreach platform for sales and security teams: import contacts, write templates with dynamic variables, run multi-step campaigns with automatic follow-ups, and send straight from your own Gmail — with open, click, and reply tracking built in.

## Highlights

- **One-click Gmail connect** — sign in with Google, no SMTP passwords or app-specific keys.
- **Campaigns with smart follow-ups** — multi-step sequences with per-day sending limits, follow-up prioritization, break-up emails, and auto-stop the moment a reply lands.
- **Dynamic templates** — a rich-text/HTML editor with `{{variables}}` that auto-detect and remap against any contact field, with inbox-accurate previews per contact or list.
- **Unified inbox & outbox** — replies flow into one inbox, replies auto-cancel queued follow-ups, and every send (campaign or one-off) is logged.
- **Full tracking** — open pixels, opaque click tracking with per-campaign analytics and CSV export.
- **Flexible imports** — CSV or Google Sheets with dynamic column mapping, custom fields, and empty-column detection.
- **Deliverability care** — mailbox health, warmup toggle, and per-hour/per-day sending limits.

## Tech stack

| Layer      | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Frontend   | React 19, TanStack Start (SSR + server functions), Tailwind CSS v4 |
| Backend    | Lovable Cloud (Postgres, auth, storage, RLS)              |
| Email      | Gmail API via per-user Google OAuth                       |
| Queue      | Scheduled queue route over an `email_logs` send queue     |
| Tracking   | Public tracking pixel + opaque link redirects             |

## Architecture notes

- All application data is owner-scoped with row-level security; server logic lives behind authenticated server functions.
- Emails send through the Gmail API from the user's own connected mailbox — no shared sending infrastructure.
- Template bodies are sanitized HTML; uploaded images are inlined as CID attachments so nothing private is exposed publicly.
- Campaign sending (limits, follow-up priority, break-up days, reply detection) is handled by a scheduled queue processor.

## Development

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Requires Node.js 20+ ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)). The app pairs with a Lovable Cloud backend — continue in the [Lovable editor](https://lovable.dev/projects/278b00a9-11b9-457c-912a-5277de8da386) to develop, preview, and deploy in one place.

## License

Released under the [Apache License 2.0](LICENSE).

## Built with Lovable

This project was built with [Lovable](https://lovable.dev) — every change made in the Lovable editor commits straight to this repository, and pushes back to `main` sync into Lovable.

---

<div align="center">

*Rebuilt from the original [AceMail](https://github.com/priiyanshuraj/AceMail) project.*

</div>
