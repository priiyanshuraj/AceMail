<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

- AceMail is a rebuild of the Django repo github.com/priiyanshuraj/AceMail on TanStack Start + Lovable Cloud; use the repo only as a feature reference, never port Python code. Why: Lovable only runs this stack.
- App server logic lives in `src/lib/acemail.functions.ts` behind `requireSupabaseAuth`; all tables are owner-scoped via RLS on `user_id`. Why: single place for data access, per-user isolation.
- Email sending runs in the scheduled `/api/public/hooks/process-queue` route over the `email_logs` queue (replaces Celery). Why: no background workers on the edge runtime.
- Open tracking uses the public `/api/public/track/$logId.png` pixel, which only flips a row to "opened". Why: email clients load it unauthenticated.
- Sending mailboxes are Gmail accounts each user connects via the google_mail App User Connector; encrypted connection keys live in server-only `mailbox_credentials`, Gmail helpers in `src/server/gmail.server.ts`. Why: one-click mailbox connect without SMTP passwords.
- Reply detection runs in the queue route before sending, writes matched replies to `inbox_messages` and cancels queued follow-ups for that contact. Why: auto-stop on reply and unified inbox.
- Google Sheets contact import uses the google_sheets App User Connector, one encrypted key per user in server-only `app_user_connections`; helpers in `src/server/sheets.server.ts`. Why: per-user Drive access, separate from Gmail mailbox keys.
