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

## Run it yourself (self-hosting guide)

AceMail is open source (Apache 2.0), so you can run your own copy. It needs three things: this code, a Postgres backend with auth (Supabase), and a Google Cloud project for Gmail sign-in. Plan for about 30 to 45 minutes the first time.

### What you need before starting

- **Node.js 20 or newer** — check with `node -v`. Install via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) if needed.
- **A free Supabase project** — sign up at [supabase.com](https://supabase.com) and create a new project. This is your database, auth, and file storage.
- **A Google Cloud project** — at [console.cloud.google.com](https://console.cloud.google.com). This powers the "Connect Gmail" button.
- **A server or hosting account** for the final step — anything that runs Node works (a VPS, Railway, Render, Fly.io, or a home server).

### Step 1: Get the code

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
```

### Step 2: Create your database tables

1. In your Supabase project, open **SQL Editor** (left sidebar).
2. Open the `drizzle/migrations/` folder in this repo. The files are numbered `0000_...sql` through `0018_...sql`.
3. Run them **in order**: paste the contents of `0000` into the SQL editor, click Run, then `0001`, and so on. Each must succeed before you run the next.
4. When done, open **Table Editor** — you should see tables like `contacts`, `templates`, `campaigns`, `email_logs`, and `mailboxes`.

> Tip: if you prefer the terminal, install the [Supabase CLI](https://supabase.com/docs/guides/cli) and run each file with `psql` against your project's connection string (found under Project Settings → Database).

### Step 3: Turn on Google sign-in for your app

AceMail users sign in with Google, and mailboxes connect through Google too.

1. In Google Cloud Console, go to **APIs & Services → OAuth consent screen**.
2. Choose **External**, fill in the app name, your support email, and your domain. Add the scopes `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/gmail.send` plus `https://www.googleapis.com/auth/gmail.readonly` (needed to send mail and detect replies).
3. Go to **APIs & Services → Library** and enable the **Gmail API**. If you want Google Sheets contact imports, also enable **Google Sheets API** and **Google Drive API**.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**. Under **Authorized redirect URIs**, add:
   - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**.
6. Back in Supabase, go to **Authentication → Sign In / Providers → Google**, enable it, paste the Client ID and Secret, and save.

While your Google OAuth app is in "Testing" mode, only Google accounts you list as test users can connect. Add yourself under **OAuth consent screen → Audience → Test users**, or publish the app when you are ready.

### Step 4: Configure environment variables

Create a file named `.env` in the project root:

```sh
# From Supabase → Project Settings → API
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-public-key>
VITE_SUPABASE_PROJECT_ID=<your-project-ref>

# Same values, used by server-side code
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<your-anon-public-key>
SUPABASE_PROJECT_ID=<your-project-ref>

# The public URL where your app will live (used for tracking links and pixels)
APP_URL=http://localhost:3000

# A random string you invent — protects the sending queue endpoint
QUEUE_HOOK_SECRET=<make-up-a-long-random-string>

# A random 32+ character string — encrypts stored mailbox connection keys
APP_USER_CONNECTION_KEY_SECRET=<make-up-another-long-random-string>
```

Never commit this file — it is already in `.gitignore`.

### Step 5: Run it locally

```sh
npm run dev
```

Open the URL it prints (usually `http://localhost:3000`). Create your account with Google sign-in, connect a Gmail mailbox, import a few contacts, and send yourself a test campaign.

### Step 6: Keep the sending queue alive

AceMail sends scheduled follow-ups through a queue processor at `/api/public/hooks/process-queue`. It runs every time that URL is called with a **POST** request that carries an `Authorization: Bearer <token>` header, so you need something to call it every minute or two:

- Easiest: a free cron service like [cron-job.org](https://cron-job.org) — create a job that sends a **POST** to `https://your-domain/api/public/hooks/process-queue` every minute, with the header `Authorization: Bearer <your QUEUE_HOOK_SECRET>`.
- On a VPS: a crontab entry like `* * * * * curl -s -X POST -H "Authorization: Bearer <secret>" https://your-domain/api/public/hooks/process-queue`.

Without this, emails stay queued and never send.

### Step 7: Deploy it for real

Build the production bundle:

```sh
npm run build
```

Then host it anywhere that runs a Node server:

- **VPS (full control):** copy the project to your server, set the same `.env` values (with `APP_URL` set to your real domain), run `npm run build`, then serve with `npm run preview` behind a process manager like `pm2` (`pm2 start "npm run preview" --name acemail`) and put nginx or Caddy in front for HTTPS.
- **Railway / Render / Fly.io:** create a new service from your GitHub repo, set the build command to `npm run build`, the start command to `npm run preview`, and add every variable from Step 4 in the service's environment settings.
- **Your domain:** point your domain's DNS at your host (your host's docs show the exact records), then update `APP_URL` to match and add your domain to the Google OAuth consent screen's authorized domains.

After deploying, sign in, connect a mailbox, and send one test email to yourself to confirm the whole chain works: sign-in, queue, sending, open tracking, and reply detection.

### What works differently outside Lovable

A few features use Lovable platform services and need small substitutions when self-hosting:

- **Access-request alert emails** are sent through Lovable's email service (`LOVABLE_API_KEY`). Outside Lovable, swap `src/lib/email-templates/send-email.ts` for any provider you like (Resend, Postmark, SES) — it is one small function.
- **One-click Gmail / Sheets connectors** use Lovable's connector gateway. Outside Lovable, use the Google OAuth client you created in Step 3 directly — the Gmail helper code in `src/server/gmail.server.ts` already speaks plain Google APIs.
- **The MCP server** (ChatGPT/Claude integration) uses Supabase OAuth, which works fine self-hosted — just make sure your Supabase project's Site URL matches your domain.

Everything else — campaigns, tracking, templates, inbox, analytics, deliverability tools — is plain code in this repo and runs anywhere.

### Updating your copy

```sh
git pull
npm install
# run any new files in drizzle/migrations/ in the Supabase SQL editor
npm run build
```

## Development

The quickest way to contribute is the [Lovable editor](https://lovable.dev/projects/278b00a9-11b9-457c-912a-5277de8da386) — every change there commits straight to this repository, and pushes back to `main` sync into Lovable. To hack on it locally instead, follow the self-hosting guide above through Step 5.

## License

Released under the [Apache License 2.0](LICENSE).

## Built with Lovable

This project was built with [Lovable](https://lovable.dev) — every change made in the Lovable editor commits straight to this repository, and pushes back to `main` sync into Lovable.

---

<div align="center">

*Rebuilt from the original [AceMail](https://github.com/priiyanshuraj/AceMail) project.*

</div>
