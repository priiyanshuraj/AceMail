import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mail,
  Megaphone,
  Users,
  BarChart3,
  ShieldCheck,
  Sparkles,
  Bot,
  Inbox,
  Shuffle,
  Moon,
  Sun,
  ArrowRight,
  Check,
  Github,
} from "lucide-react";
import { toast } from "sonner";
import logoUrl from "@/assets/acemail-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { blogPosts, SITE_URL } from "@/lib/blog-posts";
import { SakuraScene } from "@/components/SakuraScene";
import { PetalField } from "@/components/PetalField";

const TITLE = "AceMail: Cold outreach from your own Gmail, now with MCP for ChatGPT and Claude";
const DESC =
  "AceMail runs personalized multi-step cold email campaigns from your own Gmail, stops follow-ups on reply, and connects to ChatGPT and Claude through MCP.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#org`,
              name: "AceMail",
              url: `${SITE_URL}/`,
              sameAs: ["https://github.com/priiyanshuraj/AceMail"],
            },
            { "@type": "WebSite", name: "AceMail", url: `${SITE_URL}/`, publisher: { "@id": `${SITE_URL}/#org` } },
            {
              "@type": "SoftwareApplication",
              name: "AceMail",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: `${SITE_URL}/`,
              description: DESC,
              license: "https://www.apache.org/licenses/LICENSE-2.0",
              featureList: [
                "Multi-step cold email sequences from your own Gmail",
                "Automatic follow-up stop on reply",
                "MCP server for ChatGPT and Claude",
                "CSV and Google Sheets import with custom fields",
                "Spintax, spam check, email verification and one-click unsubscribe",
                "Mailbox rotation with per-mailbox limits",
              ],
            },
          ],
        }),
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Megaphone, title: "Sequences that think", text: "Initial emails, follow-ups and break-ups with smart delays, send windows and A/B tests." },
  { icon: Mail, title: "Personal at scale", text: "Any CSV column becomes a {{variable}}. Spintax makes every email unique." },
  { icon: Inbox, title: "Auto-stop on reply", text: "Replies land in one unified inbox and follow-ups stop instantly. Out of office? We wait." },
  { icon: Shuffle, title: "Mailbox rotation", text: "Spread sends across Gmail accounts with per-mailbox limits, gaps and health." },
  { icon: ShieldCheck, title: "Deliverability built in", text: "Spam check, email verification, one-click unsubscribe and a do-not-contact list." },
  { icon: BarChart3, title: "Analytics that matter", text: "Opens, clicks, replies and bounces per campaign, per step, per variant." },
];

const mcpPrompts = [
  "Find a LinkedIn hook for every contact in my Q4 list",
  "Write a template for founders and save it",
  "How did my last campaign perform?",
  "Add these 40 leads to a new list",
];

function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pinned, setPinned] = useState(false);
  const [accessEmail, setAccessEmail] = useState("");
  const [referral, setReferral] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [dark, setDark] = useState(false);

  // Scroll to the #hash target after navigation (e.g. /#early-access from the auth page).
  useEffect(() => {
    const hash = location.hash.replace(/^#/, "");
    if (!hash) return;
    const t = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => clearTimeout(t);
  }, [location.hash]);

  // Solidify the floating bar once the page is scrolled, so text stays readable over content.
  useEffect(() => {
    const onScroll = () => setPinned(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("acemail-theme", next ? "dark" : "light");
    } catch {}
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequesting(true);
    try {
      const { error } = await supabase
        .from("access_requests")
        .insert({ email: accessEmail.trim().toLowerCase(), referral: referral.trim() || null });
      if (error && error.code !== "23505") throw error;
      setRequested(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit your request");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      <SakuraScene />
      <PetalField />

      <div className="relative z-10">
        <header className="sticky top-0 z-40 px-4 pt-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-background"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-4 h-20 bg-gradient-to-b from-background/75 to-transparent"
          />
          <div className={`glass-strong relative mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-border/60 px-4 py-3${pinned ? " nav-pin" : ""}`}>
            <Link to="/" className="flex items-center gap-2">
              <img src={logoUrl} alt="AceMail logo" className="h-8 w-8 rounded-lg" width={32} height={32} />
              <span className="font-serif text-2xl">AceMail</span>
            </Link>
            <nav className="hidden gap-6 text-sm text-muted-foreground md:flex">
              <a href="#features" className="hover:text-foreground">Features</a>
              <a href="#mcp" className="hover:text-foreground">MCP</a>
              <Link to="/blog" className="hover:text-foreground">Blog</Link>
              <a href="https://github.com/priiyanshuraj/AceMail" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub</a>
            </nav>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" asChild className="md:hidden">
                <a href="https://github.com/priiyanshuraj/AceMail" target="_blank" rel="noopener noreferrer" aria-label="AceMail on GitHub">
                  <Github className="h-5 w-5" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={dark ? "Switch to day mode" : "Switch to night mode"}
              >
                {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild>
                <Link to="/auth">Get started</Link>
              </Button>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 text-center md:pt-28">
          <span className="glass inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            New: MCP server for ChatGPT and Claude
          </span>
          <h1 className="mx-auto mt-8 max-w-4xl font-serif text-5xl leading-[1.05] tracking-tight md:text-7xl">
            Cold outreach that feels <em className="text-primary">hand-written</em>, sent while you sleep.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            AceMail sends unlimited personalized sequences from your own Gmail, stops the moment
            someone replies, and lets your AI assistant run the busywork for you. Every template,
            step and schedule is fully customizable.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild className="h-12 rounded-full px-7">
              <Link to="/auth">
                Start sending free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="glass h-12 rounded-full px-7">
              <a href="#mcp">See MCP in action</a>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["One-click Gmail connect", "No SMTP setup", "Free deliverability tools", "Unlimited sends", "Open source"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" /> {t}
              </span>
            ))}
          </div>
        </section>

        <section id="mcp" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-24">
          <div className="glass-strong grid gap-10 rounded-3xl border border-border/60 p-8 md:grid-cols-2 md:p-12">
            <div>
              <p className="eyebrow text-primary">Model Context Protocol</p>
              <h2 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
                Your outreach, inside ChatGPT and Claude.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Connect AceMail as an MCP server and talk to your data. Enrich contacts with new
                columns, draft and save templates, add leads, check campaign stats and manage your
                do-not-contact list, all from the chat you already use.
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                {[
                  "Secure sign-in: the assistant only sees your own data",
                  "13 tools across contacts, templates, campaigns and inbox",
                  "Uses your existing AI plan, zero extra credits",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              {mcpPrompts.map((p, i) => (
                <div
                  key={p}
                  className="glass flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 transition hover:-translate-y-0.5"
                  style={{ marginLeft: `${(i % 2) * 1.5}rem` }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    {i % 2 ? <Sparkles className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-primary" />}
                  </div>
                  <span className="text-sm">{p}</span>
                </div>
              ))}
              <p className="pt-2 text-center font-mono text-xs text-muted-foreground">acemail.online/mcp</p>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-24">
          <p className="eyebrow text-center text-primary">Everything included</p>
          <h2 className="mt-3 text-center font-serif text-4xl md:text-5xl">Built for replies, not just sends.</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="glass group rounded-2xl border border-border/60 p-6 transition hover:-translate-y-1">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 transition group-hover:bg-primary/25">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-serif text-4xl">From the blog</h2>
            <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">All posts <ArrowRight className="inline h-3 w-3" /></Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {blogPosts.slice(0, 3).map((p) => (
              <Link
                key={p.slug}
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="glass rounded-2xl border border-border/60 p-6 transition hover:-translate-y-1"
              >
                <p className="eyebrow text-primary">{p.readMinutes} min read</p>
                <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="early-access" className="mx-auto max-w-6xl px-6 pb-24">
          <div className="glass-strong mx-auto max-w-xl rounded-3xl border border-border/60 p-8 text-center">
            <p className="eyebrow text-primary">Initial release</p>
            <h2 className="mt-2 font-serif text-3xl">Get your seat under the blossoms</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              AceMail is now open in initial release. Leave your email and we will send your invite.
              The best unlimited and customizable outreach, straight from your own Gmail.
            </p>
            {requested ? (
              <p className="mt-5 rounded-xl bg-primary/15 px-4 py-3 text-sm font-medium">
                You're on the list. We'll be in touch soon.
              </p>
            ) : (
              <form onSubmit={handleRequestAccess} className="mt-5 space-y-2">
                <Input
                  type="email"
                  required
                  aria-label="Email address"
                  value={accessEmail}
                  onChange={(e) => setAccessEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-11 rounded-full bg-background/60 px-5"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    aria-label="Referral"
                    value={referral}
                    onChange={(e) => setReferral(e.target.value)}
                    placeholder="Referred by? (name or code, optional)"
                    className="h-11 flex-1 rounded-full bg-background/60 px-5"
                  />
                  <Button type="submit" disabled={requesting} className="h-11 rounded-full px-6">
                    {requesting ? "Sending..." : "Request access"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </section>

        <footer className="border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
          <p className="font-serif text-lg text-foreground">AceMail</p>
          <p className="mt-1">Open-source email automation, rebuilt for the modern web.</p>
          <p className="mt-4 flex flex-wrap justify-center gap-4">
            <Link to="/blog" className="hover:text-foreground">Blog</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
          </p>
          <p className="mt-3">
            Support: <a href="mailto:mepriyanshuonline@gmail.com" className="hover:text-foreground">mepriyanshuonline@gmail.com</a>
            {" · "}
            Developer: <a href="mailto:hi@priyanshuraj.online" className="hover:text-foreground">hi@priyanshuraj.online</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
