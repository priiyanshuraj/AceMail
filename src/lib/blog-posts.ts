export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readMinutes: number;
  body: { heading?: string; text: string }[];
};

export const SITE_URL = "https://acemail.online";

export const blogPosts: BlogPost[] = [
  {
    slug: "open-source-outreach-crm-sales-funnel",
    title: "An open-source outreach CRM: turn replies into a sales pipeline",
    description: "A practical AceMail workflow for tracking Gmail and LinkedIn prospects with a visual sales funnel, client history, deal values and reminders.",
    date: "2026-11-09",
    readMinutes: 6,
    body: [
      { text: "An outreach campaign tells you who received a message. A CRM tells you what happens next. AceMail combines Gmail outreach and LinkedIn tasks with a visual deal pipeline, so a prospect can move from first contact to a conversation, a meeting and a closed deal without losing their history." },
      { heading: "Start with contacts, then create opportunities", text: "Import your contacts from a CSV or Google Sheet and retain useful company details as custom fields. Open CRM and choose New deal. Search for an existing contact, give the opportunity a descriptive name, enter its value and currency, and choose an expected close date and starting stage. A deal represents a commercial opportunity, not simply another name in your mailing list." },
      { heading: "Use a funnel you can actually explore", text: "The pipeline shows stages as a vertical, narrowing funnel rather than a sideways board. Each segment displays the number and value of deals currently in that stage. Select a segment to see its deals, search by client or company, and sort by value or expected close date. Move a deal with its stage selector, or drag it onto a funnel segment on a desktop." },
      { heading: "Let replies reach the right stage", text: "AceMail can advance a contact's opportunity when an email reply is detected. This automation targets a stage named Replied and excludes detected automatic out-of-office replies. Keep that stage name if you use the automation. A reply signals a conversation, not a qualified sale: review the actual message before moving the deal toward Meeting booked or Proposal." },
      { heading: "Keep the client conversation together", text: "The Client board groups opportunities by contact. Open a client to review their deals, notes, reminders, email history, replies and LinkedIn tasks. Record what was agreed and add the next action while the conversation is fresh. This keeps follow-through connected to the original outreach rather than scattered across a spreadsheet and inbox." },
      { heading: "Read the metrics without confusing them", text: "Open pipeline value is the sum of deals in stages that are neither won nor lost. Closed won shows the value of won deals. Win rate compares won deals with all closed deals, not all imported contacts. Funnel segments show current stage membership, not historical conversion rates. Keep deal currencies consistent when interpreting combined totals." },
      { heading: "Customize the process, not the data history", text: "Use Stages to add stages or adjust names and colors. Keep the process short enough that each stage represents a clear next action. AceMail is Apache 2.0 open source and supports Docker self-hosting, but deployment still needs its database, authentication and scheduled queue configured. Start with a few real opportunities and make sure every active deal has an owner action and a realistic close date." },
    ],
  },
  {
    slug: "ai-personalized-cold-email-own-api-key",
    title: "AI-personalized cold email with your own API key: a practical workflow",
    description: "Research leads, save personalized email and LinkedIn drafts, and understand AceMail's free daily allowance, bring-your-own AI and MCP options.",
    date: "2026-11-09",
    readMinutes: 6,
    body: [
      { text: "Useful AI personalization connects a verified fact about a prospect to a relevant reason to talk. A first-name greeting alone does not do that. AceMail can research a lead, generate outreach copy and save useful fields on the contact, so you can review the result before putting it into an email or LinkedIn sequence." },
      { heading: "Choose free generation or connect your own AI", text: "AceMail's shared free AI allowance defaults to 20 personalized cold emails and 20 LinkedIn messages per user per day. Administrators can change those allowances or disable shared free access for an account. These credits apply to personalized message generation, not general assistant questions. Availability also depends on the shared service being configured and its provider capacity." },
      { heading: "Bring a provider you already use", text: "In Settings, configure DeepSeek, OpenAI, Anthropic or an OpenAI-compatible service with your own API key. AceMail does not apply its shared free-generation cap when you use your own key. That does not mean free or unlimited provider usage: your provider's billing, rate limits and account restrictions still apply. Never paste an API key into a contact field, email template or chat message." },
      { heading: "Give research enough context", text: "Start with the person's company, role and a trustworthy website or relevant public profile. AceMail supports website reading and web research to help collect context. Ask for a specific business connection, such as how your offer relates to the company's product or audience. If the evidence is missing, keep the draft general rather than making up recent funding, hiring or a personal achievement." },
      { heading: "Save the draft, then verify every claim", text: "Use the contacts personalization action to generate an email or LinkedIn draft and save the resulting fields. Check names, company facts and the actual source material. Remove guesses and intrusive personal details. Preview an email template with the real contact and send a test to yourself before starting a campaign. A saved draft is not proof that its claims are correct." },
      { heading: "Use the in-app assistant for account work", text: "The AceMail assistant reuses account-scoped tools for contacts, templates, campaign information and LinkedIn tasks. Ask it to review a contact's outreach history or prepare a reusable template. It is not a substitute for the mailbox connection and campaign review screens: do not assume a draft has been sent just because the assistant produced it." },
      { heading: "Continue through MCP when the shared allowance runs out", text: "Connect ChatGPT or Claude to https://acemail.online/mcp, sign in and approve access to your AceMail account. MCP provides another way to work with your contacts and outreach tools using an external assistant. It is separate from the in-app free-generation allowance; your assistant subscription and tool limits still apply. Compare the resulting drafts on accuracy and relevance, not on how many words the model can generate." },
    ],
  },
  {
    slug: "self-host-gmail-outreach-crm-docker",
    title: "Self-host a Gmail outreach app and CRM with Docker",
    description: "What an AceMail self-hosted deployment needs: Docker, database migrations, Google connections, environment settings and a scheduled sending queue.",
    date: "2026-11-09",
    readMinutes: 6,
    body: [
      { text: "Self-hosting gives you control of the application deployment, but it does not remove the services an outreach app needs. AceMail ships a Docker setup for its web app and server process. You still need a database, authentication, Google account connections, a public HTTPS address and a scheduler to process queued sends. Use the repository README as the authoritative command-by-command setup guide." },
      { heading: "Choose a host that can run the container", text: "Use a VPS or a container-capable host for the Docker deployment. The Compose setup runs the AceMail app; it does not automatically supply an entire database stack. Provision the database and authentication service separately, and check your host's pricing, persistence, outbound access and uptime requirements before moving real outreach." },
      { heading: "Prepare the database before opening the app", text: "Apply the repository's migrations in their documented order. They create application tables, access policies and supporting functions. If you are moving an existing account or multiple users, preserve the original user IDs and ownership relationships while transferring authentication and application records. A fresh schema is not a data migration, and a Docker image does not contain your existing database." },
      { heading: "Configure environment settings safely", text: "Start with .env.example and follow the README's explanation of browser-visible configuration and server-only secrets. Set your database and auth connection values, public application address and the services you plan to enable. Browser configuration is supplied during the Docker build, so changing it can require rebuilding the image. Keep secrets out of the repository and do not commit your populated environment file." },
      { heading: "Set up Google sign-in and Gmail access", text: "Configure the correct public redirect addresses for your deployment and arrange Google OAuth access for the accounts that will use it. Connecting a Gmail mailbox is separate from simply signing into AceMail. The hosted build uses per-user Google connectors; a standalone deployment must configure the connector dependencies or replace that integration as described in the README. Do not assume moving the container transfers existing Gmail connections." },
      { heading: "Schedule sending and reply processing", text: "The queue processor is an authenticated HTTP endpoint at /api/public/hooks/process-queue. Set up the external scheduler and its required authentication according to the README. This scheduled process handles queued email work and reply checks. Opening the dashboard alone is not a substitute for running the queue, and missing queue authentication should not be solved by making the endpoint publicly writable." },
      { heading: "Treat LinkedIn execution as a separate choice", text: "For LinkedIn, choose the Chrome extension, local runner or a separately hosted browser worker. Chrome must remain running for extension execution; a persistent cloud browser needs its own deployment and configuration. LinkedIn automation can lead to account restrictions. The AceMail app container does not silently start a 24/7 LinkedIn browser for you." },
      { heading: "Verify a small workflow before migrating everyone", text: "Confirm sign-in, contact import, a template preview, a test email and scheduled queue processing on the new HTTPS address. Check a reply and an unsubscribe flow, then test your CRM and any AI provider you enabled. Back up the database, plan credential rotation and monitor errors. Apache 2.0 licensing allows self-hosting, but compute, database, Google and AI provider costs or usage limits may still apply." },
    ],
  },
  {
    slug: "connect-chatgpt-claude-to-cold-email-mcp",
    title: "How to run cold email from ChatGPT or Claude with MCP",
    description:
      "MCP lets ChatGPT and Claude work with your contacts, templates and campaign stats directly. Here is what that looks like in AceMail.",
    date: "2026-10-10",
    readMinutes: 5,
    body: [
      { text: "The Model Context Protocol (MCP) is an open standard that lets AI assistants like ChatGPT and Claude use tools in other apps. AceMail ships an MCP server, so your assistant can work inside your outreach account as you." },
      { heading: "What you can ask", text: "Add a list of leads, write a template and save it, fill a new custom column for every contact, or ask how your last campaign performed. The assistant only sees data that belongs to your account." },
      { heading: "How to connect", text: "Add AceMail's MCP URL (https://acemail.online/mcp) as a connector in ChatGPT or Claude, sign in with your AceMail account and approve access. That is the whole setup." },
      { heading: "Why it matters", text: "Research and personalization are the slowest parts of outreach. Letting an assistant enrich contacts and draft copy, while AceMail handles sending, follow-ups and reply detection, saves hours per campaign." },
    ],
  },
  {
    slug: "gmail-cold-email-sending-limits",
    title: "Gmail sending limits for cold email: how many emails per day is safe?",
    description:
      "Gmail allows up to 500 emails a day on personal accounts and 2,000 on Workspace, but safe cold outreach volume is much lower. Here is a practical guide.",
    date: "2026-10-06",
    readMinutes: 4,
    body: [
      { text: "Google publishes hard caps: roughly 500 recipients per day for a personal Gmail account and 2,000 for Google Workspace. Hitting those caps with cold email is a fast way to land in spam." },
      { heading: "A safe starting point", text: "Begin around 20 to 30 cold emails per day on a new mailbox and grow slowly over several weeks. Well-established mailboxes commonly stay under 100 cold emails per day." },
      { heading: "Leave gaps between sends", text: "Sending one email every couple of minutes looks human. AceMail enforces a gap between sends and per-hour and per-day limits on every mailbox." },
      { heading: "Scale with more mailboxes, not more volume", text: "If you need more reach, rotate across several Gmail accounts instead of pushing one harder. AceMail can rotate a campaign across mailboxes while keeping each contact's follow-ups on the same one." },
    ],
  },
  {
    slug: "reduce-cold-email-bounce-rate",
    title: "How to reduce your cold email bounce rate below 2%",
    description:
      "Bounces quietly damage sender reputation. Verify lists, drop role and disposable addresses, and stop sending to bounced contacts.",
    date: "2026-10-03",
    readMinutes: 4,
    body: [
      { text: "A bounce happens when the receiving server rejects your email. A few are normal, but a bounce rate above roughly 2 to 5% tells mailbox providers your list is low quality." },
      { heading: "Verify before you send", text: "Check syntax, confirm the domain accepts mail (MX records) and filter out disposable addresses. AceMail runs these free checks when you import contacts." },
      { heading: "Be careful with role addresses", text: "Addresses like info@ or sales@ often go to shared inboxes or filters. They are not always bad, but they rarely reply to cold email." },
      { heading: "Stop after the first bounce", text: "When a bounce notice arrives, AceMail marks the contact as bounced and cancels its follow-ups so you never hit the same dead address twice." },
    ],
  },
  {
    slug: "cold-email-unsubscribe-and-spam-words",
    title: "Unsubscribe links and spam words: staying compliant with cold email",
    description:
      "One-click unsubscribe, a do-not-contact list and fewer trigger words keep your outreach compliant and out of the spam folder.",
    date: "2026-09-29",
    readMinutes: 4,
    body: [
      { text: "Gmail and Yahoo now expect bulk senders to offer easy unsubscribe. Even for smaller cold outreach, a clear way out protects your reputation and respects people's time." },
      { heading: "Add one-click unsubscribe", text: "AceMail can add an unsubscribe footer and the List-Unsubscribe header. Anyone who opts out goes to your do-not-contact list automatically." },
      { heading: "Watch your wording", text: "Phrases like 'act now', 'free money' or heavy use of capitals and exclamation marks raise spam scores. AceMail scores every template so you can fix risky lines before sending." },
      { heading: "Keep it plain", text: "Short emails with one link and no heavy images look like personal messages, which is exactly what cold email should be." },
    ],
  },
  {
    slug: "cold-email-follow-up-sequence",
    title: "How to write a cold email follow-up sequence that gets replies",
    description:
      "Most replies come after the second or third touch. Here's how to structure follow-ups with the right timing, tone and length.",
    date: "2026-10-01",
    readMinutes: 5,
    body: [
      { text: "Most cold email replies don't come from the first message. They come from the follow-ups — the quiet, patient second and third touches that remind someone you exist without pushing." },
      { heading: "Space them out", text: "A good default is 3 days after the first email, then 5 days, then 7. Short enough to stay remembered, long enough not to annoy. In AceMail, each step of a campaign has its own delay, and follow-ups stop automatically when someone replies." },
      { heading: "Make each one shorter", text: "Your first email carries the context. Follow-ups should be two or three lines: a gentle nudge, one new piece of value, and a simple question." },
      { heading: "Reply in the same thread", text: "Threaded follow-ups look like a natural conversation instead of a fresh pitch. AceMail sends follow-ups in the original Gmail thread for exactly this reason." },
      { heading: "Know when to stop", text: "Three to four touches is plenty. A polite closing email ('Should I stop reaching out?') often gets the highest reply rate of the whole sequence." },
    ],
  },
  {
    slug: "personalize-cold-emails-at-scale",
    title: "Personalizing cold emails at scale with custom fields",
    description:
      "Go beyond {{first_name}}. Use custom fields from your CSV or Google Sheet to make hundreds of emails feel hand-written.",
    date: "2026-09-24",
    readMinutes: 4,
    body: [
      { text: "Everyone uses {{first_name}}. That's no longer personalization — it's the minimum. Real personalization references something specific to the person." },
      { heading: "Collect one specific detail", text: "Add a column to your list: a recent post they wrote, their city, a product they launched. Even one line of genuine context lifts reply rates noticeably." },
      { heading: "Map it as a custom field", text: "When you import a CSV or Google Sheet into AceMail, any column can become a custom field. Use it in templates as {{city}} or {{recent_post}}." },
      { heading: "Preview with real contacts", text: "Before sending, preview the template against actual contacts to catch blank fields or awkward phrasing. Then send a test to yourself." },
    ],
  },
  {
    slug: "protect-gmail-sender-reputation",
    title: "Protecting your Gmail sender reputation during outreach",
    description:
      "Sending limits, warmup and steady volume: the simple habits that keep your cold emails out of spam.",
    date: "2026-09-15",
    readMinutes: 4,
    body: [
      { text: "Your mailbox reputation is the single biggest factor in whether cold emails land in the inbox or in spam. It's slow to build and quick to lose." },
      { heading: "Start slow", text: "New mailboxes should send a small number of emails per day and grow gradually. AceMail's warmup toggle keeps volume low while your mailbox earns trust." },
      { heading: "Set hourly and daily limits", text: "Sudden bursts look robotic. Spreading sends across the day with per-hour and per-day caps looks like a real person writing emails." },
      { heading: "Clean your lists", text: "Bounces hurt. Verify addresses before importing, and remove contacts who ask to stop hearing from you." },
      { heading: "Watch mailbox health", text: "Keep an eye on failed sends and reconnect warnings on the Mailboxes page — they're the early signal that something needs attention." },
    ],
  },
];
