export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readMinutes: number;
  body: { heading?: string; text: string }[];
};

export const SITE_URL = "https://acemail.lovable.app";

export const blogPosts: BlogPost[] = [
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
