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
- **LinkedIn outreach** — assisted or automated sequences via a Chrome extension or a self-hosted cloud worker.
- **MCP server** — 21 tools so ChatGPT or Claude can manage contacts, campaigns and sequences for you.

## Tech stack

| Layer      | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Frontend   | React 19, TanStack Start (SSR + server functions), Tailwind CSS v4 |
| Backend    | Supabase (Postgres, auth, storage, RLS)                   |
| Email      | Gmail API via per-user Google OAuth                       |
| Queue      | Scheduled queue route over an `email_logs` send queue     |
| Tracking   | Public tracking pixel + opaque link redirects             |

## Architecture notes

- All application data is owner-scoped with row-level security; server logic lives behind authenticated server functions.
- Emails send through the Gmail API from the user's own connected mailbox — no shared sending infrastructure.
- Template bodies are sanitized HTML; uploaded images are inlined as CID attachments so nothing private is exposed publicly.
- Campaign sending (limits, follow-up priority, break-up days, reply detection) is handled by a scheduled queue processor.

---

# Self-hosting guide

AceMail is fully open source (Apache 2.0) and ships with a Dockerfile, so you can run it anywhere Docker runs — a VPS, a home server, Railway, Render, Fly.io, or your laptop. It needs three things:

1. **This code** (the repository you are reading)
2. **A Supabase project** — your Postgres database, user auth, and file storage (free tier is fine)
3. **A Google Cloud project** — powers "Sign in with Google" and the "Connect Gmail" button

Plan for about 30 to 45 minutes the first time. Follow the parts in order — each one depends on the previous.

## Part 0: What you need installed

- **Docker** with the Compose plugin (recommended) — [docker.com/get-started](https://www.docker.com/get-started/). Verify with `docker --version` and `docker compose version`.
- Or, if you prefer no containers: **Node.js 20+** and npm. Verify with `node --version`.
- **Git** to clone the repository.
- A terminal where you can run `openssl rand -hex 32` (macOS/Linux have it; on Windows use Git Bash or WSL).

## Part 1: Get the code

```sh
git clone <this-repository-url>
cd <repository-name>
```

## Part 2: Create your Supabase project (database + auth)

1. Go to [supabase.com](https://supabase.com), sign in, and click **New project**.
2. Pick any organization, give the project a name (e.g. `acemail`), set a strong **database password** (save it somewhere — you will not need it for the app, but Supabase asks for it), and choose the region closest to you.
3. Wait about two minutes while the project provisions.

### 2a. Create the database tables

AceMail's schema lives in numbered SQL migration files. You will run them by hand once:

1. In your Supabase dashboard, open **SQL Editor** in the left sidebar and click **New query**.
2. In this repo, open the `drizzle/migrations/` folder. The files are numbered `0000_...sql` through `0021_...sql`.
3. Run them **in ascending order**: open `0000_...sql`, copy its entire contents, paste into the SQL editor, click **Run**. Wait for "Success", then repeat for `0001`, `0002`, and so on. Each file must succeed before you run the next — later files reference tables created by earlier ones.
4. When finished, open **Table Editor** in the sidebar. You should see tables such as `contacts`, `templates`, `campaigns`, `email_logs`, `mailboxes`, `inbox_messages`, and `suppressions`.

> Terminal alternative: install the [Supabase CLI](https://supabase.com/docs/guides/cli) or use `psql` with the connection string from **Project Settings → Database**, and pipe each file in order.

### 2b. Collect your Supabase keys

You will need four values for the `.env` file later. Find them under **Project Settings → API**:

| Value | Where on the page |
| --- | --- |
| Project URL | "Project URL" — looks like `https://abcdefghijklmno.supabase.co` |
| Project ID / ref | The subdomain of that URL (e.g. `abcdefghijklmno`) |
| anon public key | "Project API keys" → `anon` `public` |
| service_role key | "Project API keys" → `service_role` — **keep this secret; it bypasses all row-level security** |

Keep this tab open; Part 4 pastes these into `.env`.

## Part 3: Set up Google sign-in and Gmail access

Users sign in with Google, and each user connects their own Gmail mailbox through Google OAuth. Both flows use one OAuth client.

### 3a. Configure the OAuth consent screen

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or pick an existing one).
2. Open **APIs & Services → OAuth consent screen** (in the newer console: **Google Auth Platform → Branding**).
3. Choose **External**, then fill in the app name (`AceMail`), your support email, and your domain.
4. Under **Scopes**, add: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.send`, and `https://www.googleapis.com/auth/gmail.readonly`. The two Gmail scopes are required to send mail and detect replies.
5. While the app is in **Testing** mode, only Google accounts listed under **Audience → Test users** can sign in. Add your own Gmail address there now. When you are ready for the public, click **Publish app** on the consent screen.

### 3b. Enable the Google APIs

In **APIs & Services → Library**, enable:

- **Gmail API** (required)
- **Google Sheets API** and **Google Drive API** (only if you want Google Sheets contact imports)

### 3c. Create the OAuth client

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**.
2. Under **Authorized redirect URIs**, add exactly one URI, using your Supabase project ref from Part 2b:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
3. Click **Create** and copy the **Client ID** and **Client Secret**.

### 3d. Connect Google to Supabase auth

1. Back in your Supabase dashboard, go to **Authentication → Sign In / Providers** and open **Google**.
2. Toggle it **Enabled**, paste the Client ID and Client Secret, and save.
3. Under **Authentication → URL Configuration**, set **Site URL** to where your app will run (`http://localhost:3000` for local testing, your real domain later) and add the same value to **Redirect URLs**.

## Part 4: Create and fill in the `.env` file

Copy the template:

```sh
cp .env.example .env
```

Now open `.env` in any editor. Here is every variable, what it does, and exactly what to put in it:

### Supabase connection (required)

```sh
VITE_SUPABASE_URL=https://abcdefghijklmno.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...   # the "anon public" key
VITE_SUPABASE_PROJECT_ID=abcdefghijklmno       # the ref from your project URL

SUPABASE_URL=https://abcdefghijklmno.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...         # same anon key as above
SUPABASE_PROJECT_ID=abcdefghijklmno            # same ref as above

SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...        # the "service_role" key — SECRET
```

- The `VITE_*` copies are baked into the browser JavaScript at **build time**; the plain copies are read by server-side code at **runtime**. Both sets must match.
- `SUPABASE_SERVICE_ROLE_KEY` is used only by privileged server code (the queue processor, tracking routes). Never expose it in the browser, never commit it, never share it.

### App URL (required)

```sh
APP_URL=http://localhost:3000
```

The public URL where people reach your app. It is embedded in tracking pixels, click links, and unsubscribe links inside sent emails, so it must be the real, publicly reachable address once you deploy. For local testing, `http://localhost:3000` is correct.

### Secrets you invent yourself (required)

```sh
QUEUE_HOOK_SECRET=<output of: openssl rand -hex 32>
APP_USER_CONNECTION_KEY_SECRET=<output of: openssl rand -hex 32>
```

- `QUEUE_HOOK_SECRET` protects the sending-queue endpoint (`/api/public/hooks/process-queue`). Your cron caller (Part 6) must send it as a bearer token. Anyone with this string can trigger your queue, so make it long and random.
- `APP_USER_CONNECTION_KEY_SECRET` encrypts stored mailbox connection keys and LinkedIn session cookies in the database. **If you lose or change it after data exists, stored connections can no longer be decrypted** — back it up like a password.

Generate both in one go:

```sh
openssl rand -hex 32 && openssl rand -hex 32
```

### Optional: Lovable platform services

```sh
# LOVABLE_API_KEY=
# GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY=
# GOOGLE_SHEETS_APP_USER_CONNECTOR_CLIENT_API_KEY=
# GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY=
```

These only apply when running inside the Lovable platform. Self-hosted installs leave them commented out — see "What works differently outside Lovable" below.

### A complete example `.env`

```sh
VITE_SUPABASE_URL=https://abcdefghijklmno.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...anon...
VITE_SUPABASE_PROJECT_ID=abcdefghijklmno
SUPABASE_URL=https://abcdefghijklmno.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...anon...
SUPABASE_PROJECT_ID=abcdefghijklmno
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...service...
APP_URL=http://localhost:3000
QUEUE_HOOK_SECRET=9f2c...64 hex chars...
APP_USER_CONNECTION_KEY_SECRET=a41d...64 hex chars...
```

`.env` is already in `.gitignore` — never commit it.

## Part 5: Build and run

### With Docker Compose (recommended)

```sh
docker compose up --build
```

The first build takes a few minutes. When you see the server listening, open **http://localhost:3000**.

### With plain Docker

```sh
docker build \
  --build-arg VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-public-key> \
  --build-arg VITE_SUPABASE_PROJECT_ID=<your-project-ref> \
  -t acemail .
docker run -d --name acemail --env-file .env -p 3000:3000 acemail
```

> The three `VITE_*` values are baked into the browser bundle at **build** time, which is why they are build args. Everything else is read at runtime from `--env-file .env`, so you can rotate secrets without rebuilding. If you ever change a `VITE_*` value, you must rebuild the image.

### Without Docker (Node.js 20+)

```sh
npm install
ACEMAIL_TARGET=node-server npm run build   # production build
node .output/server/index.mjs              # serves on port 3000
```

The `ACEMAIL_TARGET=node-server` flag switches the build from the edge/Cloudflare preset to a standalone Node server. For local development with hot reload, plain `npm run dev` works as usual.

### First-run smoke test

1. Open the app and click **Sign in with Google** — you should land back in the app, logged in.
2. Go to **Mailboxes** and connect a Gmail account. (If Google shows "app not verified", click **Advanced → Continue** — that is expected while your OAuth app is in Testing mode.)
3. Import two or three contacts with your own email addresses, create a template, and send a small test campaign.
4. Check **Outbox** — the emails should move from queued to sent once the queue runs (Part 6).

## Part 6: Keep the sending queue alive (required)

AceMail does not run background workers inside the container. Scheduled emails and follow-ups send when the queue endpoint is called: a **POST** to `/api/public/hooks/process-queue` with an `Authorization: Bearer` header. You need something to call it every minute or two.

**Option A — free external cron (easiest):** create a job at [cron-job.org](https://cron-job.org):

- URL: `https://your-domain/api/public/hooks/process-queue` (or `http://localhost:3000/...` for local)
- Method: **POST**
- Header: `Authorization: Bearer <your QUEUE_HOOK_SECRET>`
- Interval: every 1 minute

**Option B — crontab on the same server:**

```cron
* * * * * curl -s -X POST -H "Authorization: Bearer <your QUEUE_HOOK_SECRET>" http://localhost:3000/api/public/hooks/process-queue > /dev/null 2>&1
```

**Without this, emails stay queued forever and nothing sends.** Test it by hand:

```sh
curl -X POST -H "Authorization: Bearer <your QUEUE_HOOK_SECRET>" http://localhost:3000/api/public/hooks/process-queue
```

A JSON response means the queue ran; `401` means the secret does not match.

## Part 7: Put it on a real domain with HTTPS

1. Point your domain's DNS at your server (an A record to its IP).
2. Put a reverse proxy in front of the container for HTTPS. With [Caddy](https://caddyserver.com) it is three lines in the `Caddyfile`:
   ```
   mail.yourdomain.com {
       reverse_proxy localhost:3000
   }
   ```
   Caddy issues and renews the TLS certificate automatically.
3. Update `APP_URL` in `.env` to `https://mail.yourdomain.com` and restart the container (`docker compose up -d --force-recreate`). Old tracking links in already-sent emails keep the old URL, which is normal.
4. Add your domain to the Google OAuth consent screen's authorized domains, and update Supabase **Authentication → URL Configuration** Site URL and Redirect URLs to the new domain.

### Hosted platforms (Railway, Render, Fly.io)

Deploy straight from the Dockerfile:

- Set the same environment variables in the platform's dashboard, with the three `VITE_*` values as **build-time** variables/args.
- Expose port `3000`.
- Still set up the Part 6 cron caller against your platform URL.

### Serverless note (Vercel/Netlify)

The Dockerfile path is the tested one. Serverless adapters are possible but not covered here — function execution limits can cut off the queue processor, so prefer a container host.

## Verification checklist

After deploying, confirm the whole chain end to end:

- [ ] Sign in with Google works and lands you back in the app
- [ ] A Gmail mailbox connects and shows as active in **Mailboxes**
- [ ] A test campaign email arrives in your own inbox
- [ ] Opening that email flips its status to "opened" in **Outbox** (tracking pixel works — requires correct `APP_URL`)
- [ ] Replying to it appears in **Inbox** and cancels any queued follow-up
- [ ] The cron caller gets a JSON response from the queue endpoint (not 401)
- [ ] A scheduled follow-up sends on its own without you touching anything

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| "Failed to fetch" / blank page on sign-in | Supabase project paused (free tier sleeps after inactivity) — open the Supabase dashboard to wake it, or the `VITE_SUPABASE_URL` baked into the build is wrong — rebuild the image. |
| Google shows "This app isn't verified" | Normal while the OAuth app is in Testing. Click **Advanced → Continue**, and make sure your Google account is listed under **Audience → Test users**. |
| `403: access_denied` from Google | Your Google account is not in the Test users list, or the redirect URI in the OAuth client does not exactly match `https://<ref>.supabase.co/auth/v1/callback`. |
| Emails queued but never send | The Part 6 cron is missing or the `QUEUE_HOOK_SECRET` does not match. Test with the curl command above. |
| Opens/clicks not tracked | `APP_URL` is not the public URL, or the app is behind a proxy that strips the pixel request. Check `APP_URL` and restart. |
| Mailbox shows "Reconnect needed" | The stored Gmail token expired or was revoked — reconnect from **Mailboxes**. If it keeps happening, confirm the Gmail API is enabled in Google Cloud. |
| `401` from the queue endpoint | Wrong or missing `Authorization: Bearer` header. |
| Build fails on `VITE_SUPABASE_*` | The three `VITE_*` build args were not passed to `docker build` — see Part 5. |

## What works differently outside Lovable

A few features use Lovable platform services and need small substitutions when self-hosting:

- **Access-request alert emails** are sent through Lovable's email service (`LOVABLE_API_KEY`). Outside Lovable, swap `src/lib/email-templates/send-email.ts` for any provider you like (Resend, Postmark, SES) — it is one small function.
- **One-click Gmail / Sheets connectors** use Lovable's connector gateway. Outside Lovable, use the Google OAuth client you created in Part 3 directly — the Gmail helper code in `src/server/gmail.server.ts` already speaks plain Google APIs.
- **The MCP server** (ChatGPT/Claude integration) uses Supabase OAuth, which works fine self-hosted — just make sure your Supabase project's Site URL matches your domain.

Everything else — campaigns, tracking, templates, inbox, analytics, deliverability tools, LinkedIn sequences — is plain code in this repo and runs anywhere.

## Updating your copy

```sh
git pull
# run any new files in drizzle/migrations/ in the Supabase SQL editor, in order
docker compose up --build   # or: npm install && ACEMAIL_TARGET=node-server npm run build
```

## Development

The quickest way to contribute is the [Lovable editor](https://lovable.dev/projects/278b00a9-11b9-457c-912a-5277de8da386) — every change there commits straight to this repository, and pushes back to `main` sync into Lovable. To hack on it locally instead, follow the self-hosting guide above through Part 5 and use `npm run dev`.

## License

Released under the [Apache License 2.0](LICENSE).
