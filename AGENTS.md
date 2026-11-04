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
- Inbox previews use sandboxed documents with delivery's sanitized HTML. Why: safe, layout-faithful.
- All preview, test, and campaign personalization uses the shared email-content variable renderer; contact values are escaped plain text with explicit HTML line breaks, while subjects remain text. Why: consistent, injection-safe.
- Template variable detection and field matching live in the shared email-content helpers; exact keys take priority, and case/spacing/punctuation aliases and optional contact prefixes resolve only to unique fields. Why: preview and delivery agree.
- Template bodies use sanitized HTML with private storage references resolved to inline CID images and MIME attachments at send time; the shared email-content helpers preserve legacy plain text. Why: no public file links.
- Sending mailboxes are Gmail accounts each user connects via the google_mail App User Connector; encrypted connection keys live in server-only `mailbox_credentials`, Gmail helpers in `src/server/gmail.server.ts`. Why: one-click mailbox connect without SMTP passwords.
- Reply detection runs in the queue route before sending, writes matched replies to `inbox_messages` and cancels queued follow-ups for that contact. Why: auto-stop on reply and unified inbox.
- Google Sheets contact import uses the google_sheets App User Connector for reading sheets and a separate google_drive App User Connector for listing files (each gateway connector only proxies its own Google API); one encrypted key per user per connector in server-only `app_user_connections`; helpers in `src/server/sheets.server.ts`. Why: per-user access, separate from Gmail mailbox keys.
- Contact email verification (syntax, disposable/role lists, MX via DNS-over-HTTPS) lives in `src/server/email-verify.server.ts`; results are stored on contacts (`email_status`, reason, checked_at). Why: free bounce prevention usable at import and on re-check.
- Removing a contact keeps its sent email history: a DB trigger deletes only unsent logs and stamps `recipient_email` on sent ones (FK is ON DELETE SET NULL); Outbox counts and campaign step stats are computed over all logs, not the loaded page. Why: stats survive cleanup.
- MCP server is defined in `src/lib/mcp/` (one tool per file, registered in index.ts) with Supabase OAuth; tools query as the caller via `supabaseForUser` so RLS applies. Why: no privileged keys.
- Free deliverability helpers (spintax, spam check, unsubscribe footer, contact timezone, auto-reply detection) live in `src/lib/deliverability.ts`; spintax runs before variable rendering everywhere. Why: consistent, no AI cost.
- Mailbox limits/gaps are counted per `email_logs.config_id` (set on every send); campaigns may rotate across extra mailboxes and a contact's follow-ups stay on its first mailbox. Why: rotation needs per-mailbox caps and same-thread follow-ups.
- Do-not-contact lives in `suppressions` (owner RLS) and is enforced at campaign start and send time; the public `/api/public/unsubscribe/$logId` route requires a POST to unsubscribe. Why: link scanners must not unsubscribe people.
- Visual styling comes only from semantic tokens in `src/styles.css` (light + dark defined together); pages must not hardcode colors. Why: both themes stay consistent from one source.
- LinkedIn sequences (`src/server/linkedin.server.ts`) never log into LinkedIn: assisted task list, or a user-hosted runner via token-auth `/api/public/linkedin/tasks` (hashes only). Why: no browsers on edge; LinkedIn bans automation.
- Apollo uses each user's own key, encrypted in server-only `user_api_keys`. Why: per-user credits.
- Self-hosting ships via the root `Dockerfile` + `.env.example`; the Docker build sets `ACEMAIL_TARGET=node-server` so vite.config.ts switches nitro from the sandbox-forced cloudflare-module preset to a plain Node bundle (`.output/server/index.mjs`). Why: open-source users run it anywhere Docker runs.
- Bring-your-own AI (DeepSeek/OpenAI/Anthropic/OpenAI-compatible) stores encrypted JSON configs in `user_api_keys`; AceMail features native built-in web search directly inside its server process for lead research and assistant lookups, with optional user overrides for external Siftdog, Tavily, or Exa; client in `src/server/llm.server.ts`, assistant in `src/server/ai-agent.server.ts`. Why: runs 100% self-contained inside AceMail with zero extra containers or search fees.

<!-- gitnexus:start -->
# GitNexus — Primary & Default Context Engine

This project is indexed by GitNexus as **AceMail** (2623 symbols, 5779 relationships, 217 execution flows). GitNexus is the **default and mandatory context engine** for all codebase exploration, comprehension, impact assessment, and refactoring to conserve context tokens and maximize accuracy.

> Re-indexing is managed from the GitNexus Hub dashboard.

## Context Engine Rules (Always Enforced)

- **Default to GitNexus for All Context**: NEVER perform broad workspace searches, blind greps, or full-file context dumps without first querying GitNexus. Use `gitnexus_query` to locate execution flows and relevant symbol references with minimal token usage.
- **Precision File Reads**: Use `gitnexus_context` to identify exact symbol boundaries (file paths and line numbers) and only read the specific line slices required, avoiding loading unnecessary code into context.
- **Mandatory Pre-Edit Impact Analysis**: Before modifying ANY function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report blast radius (direct callers, affected processes, risk level) to the user.
- **Risk Escalation**: MUST warn the user if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.

## When Debugging & Exploring

1. **Find Flows**: `gitnexus_query({query: "<error, symptom, or feature concept>"})` — discover processes and execution flows ranked by relevance.
2. **Inspect Callers & Callees**: `gitnexus_context({name: "<suspect or target symbol>"})` — inspect 360-degree symbol dependencies.
3. **Trace Execution**: `READ gitnexus://repo/AceMail/process/{processName}` — step through the precise execution path without searching manually.

## When Refactoring or Modifying

- **Extracting/Splitting/Moving**: Run `gitnexus_context({name: "target"})` followed by `gitnexus_impact({target: "target", direction: "upstream"})` to identify all d=1, d=2, d=3 callers before touching code.
- **Git Diff Impact**: Run `gitnexus_detect_changes({changed_files: [...]})` after making edits to evaluate affected processes and verify zero broken execution flows.

## Prohibitions

- NEVER edit a function, class, or method without first running `gitnexus_impact`.
- NEVER bypass GitNexus in favor of recursive file reads or indiscriminate regex searches when exploring architecture.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/AceMail/context` | Codebase overview, check index freshness |
| `gitnexus://repo/AceMail/clusters` | All functional areas |
| `gitnexus://repo/AceMail/processes` | All execution flows |
| `gitnexus://repo/AceMail/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. All d=1 (WILL BREAK) dependents were updated

<!-- gitnexus:end -->
- Free AI generation (shared Groq key) is capped per user per day by admin-controlled limits in `src/server/ai-quota.server.ts`; users with their own key are unlimited; admin role lives in `user_roles` checked via `has_role`. Why: protect the shared Groq quota.
