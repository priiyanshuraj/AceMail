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
