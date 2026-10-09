# AceMail — Rebuild in Lovable

## Context
AceMail (github.com/priiyanshuraj/AceMail) is a Django + Celery + PostgreSQL cold-email automation platform. Lovable projects run on React / TanStack Start, so the Django codebase cannot run here directly. Instead we rebuild AceMail's product as a modern web app in this project, using the GitHub repo as the feature and design reference. The repo stays connected via the GitHub connector for reference; further iteration happens here.

## What we build (v1)

1. **Design system** — clean, modern dark-on-light SaaS look in `src/styles.css` (semantic tokens, no generic gradients).
2. **Auth + database (Lovable Cloud)** — sign up / log in; Postgres tables:
   - `email_configurations` (SMTP/IMAP settings, encrypted secrets)
   - `contacts` + `contact_lists` (import via CSV/Excel paste or upload)
   - `email_templates` (subject, body, variables like {{name}})
   - `campaigns` + `campaign_templates` (multi-step sequences, delays, send windows)
   - `email_logs` (per-recipient status: queued/sent/failed/opened)
3. **Pages**
   - Dashboard: campaign stats (sent, failed, open rate), recent activity
   - Contacts: lists, import, segment
   - Templates: editor with live preview + personalization variables
   - Campaigns: create wizard (list → templates → schedule), detail view with per-step stats
   - Settings: SMTP configuration, sending limits, blacklisted domains
4. **Sending engine** — server functions that render templates, send via the user's SMTP (nodemailer-style fetch/SMTP), respect rate limits and send windows, log results. A scheduled worker route processes the queue.
5. **Analytics** — open tracking pixel + per-campaign charts.

## Technical notes
- TanStack Start (React 19) frontend; `createServerFn` for app logic; `/api/public/*` routes for the tracking pixel and queue worker.
- Lovable Cloud provides Postgres, auth, and storage — no external accounts needed.
- SMTP credentials stored server-side only, never exposed to the browser.
- Django features we intentionally defer: blog app, Firebase storage, Celery (replaced by server functions + scheduled route).

## Steps
1. Enable Lovable Cloud; create schema migration (tables + RLS).
2. Design system + app shell (sidebar layout).
3. Auth pages and guards.
4. Contacts, Templates, Settings (SMTP) CRUD.
5. Campaign wizard + detail.
6. Sending engine + queue worker + tracking pixel.
7. Dashboard analytics.
8. Verify end-to-end with a test campaign.
