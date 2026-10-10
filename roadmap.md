# Template editor
- [ ] Auto-detect template variables and match standard/custom contact fields, including spaces and contact prefixes; verify detection and preview.
- [x] Preserve imported custom-field paragraphs across preview, test emails and campaigns; 10 regression tests and browser paragraph spacing verified. Live email delivery was not triggered.
- [x] Add rich formatting, links, uploaded images/files, HTML mode, template loading, meeting and video links.
- [x] Preserve formatting and attachments in test and campaign emails.
- [x] Verify editor interactions and email rendering tests.

# Inbox preview and campaign analytics
- [x] Render safe HTML layouts, images, video links, signature and attachments in an isolated inbox preview.
- [x] Add campaign performance totals and recipient-level opens, clicks and replies.
- [x] Verify HTML/image/video preview in the browser, tracking pixel, nine tests and build results. Live campaign activity remains unverified because the signed-in account has no campaigns.