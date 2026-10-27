# Template editor
- [x] Show the detected-variables list below the email preview instead of above it; browser verified the preview box ends at 587px and the list starts at 600px with all three variables listed.
- [x] Add a remap selector for detected variables; browser verified all occurrences update in subject and body, preview refreshes, and no runtime errors occur.
- [x] Auto-detect template variables and match standard/custom contact fields, including spaces and contact prefixes; 13 tests and browser detection, matching, and removal verified.
- [x] Preserve imported custom-field paragraphs across preview, test emails and campaigns; 10 regression tests and browser paragraph spacing verified. Live email delivery was not triggered.
- [x] Add rich formatting, links, uploaded images/files, HTML mode, template loading, meeting and video links.
- [x] Preserve formatting and attachments in test and campaign emails.
- [x] Verify editor interactions and email rendering tests.

# Inbox preview and campaign analytics
- [x] Render safe HTML layouts, images, video links, signature and attachments in an isolated inbox preview.
- [x] Add campaign performance totals and recipient-level opens, clicks and replies.
- [x] Verify HTML/image/video preview in the browser, tracking pixel, nine tests and build results. Live campaign activity remains unverified because the signed-in account has no campaigns.
# Free deliverability features
- [x] Spintax + spam checker
- [x] Unsubscribe link + do-not-contact list
- [x] A/B testing per step
- [x] Mailbox rotation
- [x] Out-of-office handling
- [x] Recipient time zone sending
- [ ] WhatsApp reply alerts — blocked: needs a WhatsApp Business connection and an approved message template

## Redesign ("Ember" design system)
- [x] Design system, fonts, light/dark tokens, system-preference theme, app shell, dashboard
- [ ] Per-page layout polish: campaign builder, email editor, templates, analytics, contacts, inbox/outbox, mailboxes, settings
- [x] Marketing site: landing rewritten with the sakura scene, MCP section, blog and early-access form; old film photos removed
- [x] Landing nav bar stays pinned while scrolling so Sign in / Get started are always one click away; browser verified in day and night
- [x] Sign-in page: sakura scene, falling petals, frosted card, day/night toggle; browser verified in both themes

# LinkedIn + extras (from linki reference)
- [x] LinkedIn sequences: assisted daily task list + automated runner API with daily limits
- [x] Reply from Inbox inside the Gmail thread
- [x] Contact detail page with phone, LinkedIn, title and full activity
- [x] Campaign pipeline view with click-through
- [x] Apollo enrichment with the user's own key (Settings)
- [x] LinkedIn: manual/automated choice per sequence, downloadable runner that signs in to LinkedIn locally, runner status, 14-day tracker

# Open-source packaging
- [x] Dockerfile + docker-compose + .dockerignore for one-command self-hosting; node-server build verified booting and serving HTTP 200
- [x] .env.example documenting every variable; README rewritten Docker-first with build args, cron queue setup, domain/HTTPS steps
