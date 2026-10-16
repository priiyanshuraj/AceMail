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

- AceMail is a rebuild of the Django repo github.com/priiyanshuraj/AceMail on TanStack Start + Lovable Cloud; use the repo only as a feature reference, never port Python code. Why: only stack Lovable runs.
- App server logic lives in `src/lib/acemail.functions.ts` behind `requireSupabaseAuth`; all tables are owner-scoped via RLS on `user_id`. Why: single place for data access, per-user isolation.
- Email sending runs in the scheduled `/api/public/hooks/process-queue` route over the `email_logs` queue (replaces Celery). Why: no background workers on the edge runtime.
- Open tracking uses the public `/api/public/track/$logId.png` pixel, which only flips a row to "opened". Why: email clients load it unauthenticated.
- Campaign link tracking uses opaque stored link IDs and owner-readable click events; analytics aggregates the entire campaign through an invoker RPC. Why: prevent arbitrary redirect targets, preserve recipient privacy, and avoid truncated log totals.
- Inbox previews use sandboxed documents with the same sanitized email HTML and private-upload resolution as delivery. Why: app typography must not alter email layouts or expose unsafe HTML.
- All preview, test, and campaign personalization uses the shared email-content variable renderer; contact values are escaped plain text with explicit HTML line breaks, while subjects remain text. Why: imported paragraphs must survive delivery consistently without HTML injection.
- Template variable detection and field matching live in the shared email-content helpers; exact keys take priority, and case/spacing/punctuation aliases and optional contact prefixes resolve only to unique fields. Why: preview and delivery must agree without guessing ambiguous contact data.
- Template bodies use sanitized HTML with private storage references resolved to inline CID images and MIME attachments at send time; the shared email-content helpers preserve legacy plain text. Why: formatting survives delivery without exposing uploaded files publicly or expiring stored links.
- Sending mailboxes are Gmail accounts each user connects via the google_mail App User Connector; encrypted connection keys live in server-only `mailbox_credentials`, Gmail helpers in `src/server/gmail.server.ts`. Why: one-click mailbox connect without SMTP passwords.
- Reply detection runs in the queue route before sending, writes matched replies to `inbox_messages` and cancels queued follow-ups for that contact. Why: auto-stop on reply and unified inbox.
- Google Sheets contact import uses the google_sheets App User Connector for reading sheets and a separate google_drive App User Connector for listing files (each gateway connector only proxies its own Google API); one encrypted key per user per connector in server-only `app_user_connections`; helpers in `src/server/sheets.server.ts`. Why: per-user access, separate from Gmail mailbox keys.
- Contact email verification (syntax, disposable/role lists, MX via DNS-over-HTTPS) lives in `src/server/email-verify.server.ts`; results are stored on contacts (`email_status`, reason, checked_at). Why: free bounce prevention usable at import and on re-check.
- Removing a contact keeps its sent email history: a DB trigger deletes only unsent logs and stamps `recipient_email` on sent ones (FK is ON DELETE SET NULL); Outbox counts and campaign step stats are computed over all logs, not the loaded page. Why: bounce/open stats must survive contact cleanup and not be truncated.
- MCP server is defined in `src/lib/mcp/` (one tool per file, registered in index.ts) with Supabase OAuth; tools query as the caller via `supabaseForUser` so RLS applies. Why: external AI assistants act as the signed-in user without privileged keys.
- Free deliverability helpers (spintax, spam check, unsubscribe footer, contact timezone, auto-reply detection) live in `src/lib/deliverability.ts`; spintax runs before variable rendering everywhere. Why: preview, test and queue must behave the same with no AI cost.
- Mailbox limits/gaps are counted per `email_logs.config_id` (set on every send); campaigns may rotate across extra mailboxes and a contact's follow-ups stay on its first mailbox. Why: rotation needs per-mailbox caps and same-thread follow-ups.
- Do-not-contact lives in `suppressions` (owner RLS) and is enforced at campaign start and send time; the public `/api/public/unsubscribe/$logId` route requires a POST to unsubscribe. Why: link scanners must not unsubscribe people.
- Visual styling comes only from semantic tokens in `src/styles.css` (light + dark defined together); pages must not hardcode colors. Why: both themes stay consistent from one source.
- LinkedIn sequences (`src/server/linkedin.server.ts`) never log into LinkedIn: assisted task list, or a user-hosted runner via token-auth `/api/public/linkedin/tasks` (hashes only). Why: no browsers on edge; LinkedIn bans automation.
- Apollo uses each user's own key, encrypted in server-only `user_api_keys`. Why: per-user credits.
