import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Megaphone, Users, BarChart3, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import logoUrl from "@/assets/acemail-logo.png";
import roadAsset from "@/assets/kiarostami-road.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { blogPosts, SITE_URL } from "@/lib/blog-posts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AceMail — Cold email campaigns that run themselves" },
      {
        name: "description",
        content:
          "AceMail is an email automation and cold outreach platform: build multi-step campaigns, personalize templates, and track every send.",
      },
      { property: "og:title", content: "AceMail — Cold email campaigns that run themselves" },
      {
        property: "og:description",
        content:
          "Build multi-step cold email campaigns, personalize templates, and track every send with AceMail.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: `${SITE_URL}${roadAsset.url}` },
      { name: "twitter:image", content: `${SITE_URL}${roadAsset.url}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: Landing,
});

const features = [
  {
    icon: Megaphone,
    title: "Multi-step campaigns",
    text: "Sequence initial emails and follow-ups with custom delays and send windows.",
  },
  {
    icon: Mail,
    title: "Personalized templates",
    text: "Use variables like {{first_name}} and {{company}} to make every email feel hand-written.",
  },
  {
    icon: Users,
    title: "Contact management",
    text: "Import lists from CSV, segment contacts, and keep unsubscribes handled automatically.",
  },
  {
    icon: BarChart3,
    title: "Real analytics",
    text: "Track sent, failed, and open rates per campaign and per step.",
  },
  {
    icon: Clock,
    title: "Smart scheduling",
    text: "Send only on the days and hours you choose, with built-in rate limiting.",
  },
  {
    icon: ShieldCheck,
    title: "Your own Gmail",
    text: "Send straight from your connected Gmail so messages land where they should.",
  },
];

function Landing() {
  const navigate = useNavigate();
  const [accessEmail, setAccessEmail] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequesting(true);
    try {
      const { error } = await supabase
        .from("access_requests")
        .insert({ email: accessEmail.trim().toLowerCase() });
      if (error) {
        if (error.code === "23505") {
          setRequested(true);
          return;
        }
        throw error;
      }
      setRequested(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit your request");
    } finally {
      setRequesting(false);
    }
  };
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="AceMail logo" className="h-9 w-9 rounded-lg" width={36} height={36} />
          <span className="text-xl font-semibold">AceMail</span>
        </Link>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <img
          src={roadAsset.url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.18]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 text-center">
          <p className="mb-6 text-xs uppercase tracking-[0.5em] text-jade">Where the road winds</p>
          <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight md:text-6xl">
            Cold email campaigns that <span className="neon-text">run themselves</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            AceMail schedules, personalizes, and tracks your outreach — multi-step sequences,
            your own Gmail, and analytics that show exactly what's working.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            AceMail connects to your Gmail account with your permission to send the campaigns you
            create and to detect replies so follow-ups stop automatically. We never see your Google
            password, and you can disconnect at any time. See our{" "}
            <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>{" "}
            for exactly how your Google data is accessed, used, and stored.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/auth">Start sending free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">See features</a>
            </Button>
          </div>

        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-8 text-center text-3xl font-semibold">Everything your outreach needs</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <f.icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-3xl font-semibold">From the blog</h2>
          <Link to="/blog" className="text-sm hover:underline">All posts →</Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {blogPosts.map((p) => (
            <Link
              key={p.slug}
              to="/blog/$slug"
              params={{ slug: p.slug }}
              className="rounded-xl border bg-card p-6 transition hover:shadow-md"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-jade">{p.readMinutes} min read</p>
              <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="early-access" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mx-auto max-w-md rounded-xl border bg-card/80 p-6 text-center backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-jade">Early access</p>
          <h2 className="mt-2 text-xl font-semibold">AceMail is in testing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Leave your email and we'll invite you as soon as a seat opens up.
          </p>
          {requested ? (
            <p className="mt-4 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">
              You're on the list — we'll be in touch soon.
            </p>
          ) : (
            <form onSubmit={handleRequestAccess} className="mt-4 flex gap-2">
              <Input
                type="email"
                required
                aria-label="Email address"
                value={accessEmail}
                onChange={(e) => setAccessEmail(e.target.value)}
                placeholder="you@company.com"
                className="flex-1"
              />
              <Button type="submit" disabled={requesting}>
                {requesting ? "Sending…" : "Request access"}
              </Button>
            </form>
          )}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>AceMail — open-source email automation, rebuilt for the modern web.</p>
        <p className="mt-2 font-serif italic text-amber">"Life goes on." — Abbas Kiarostami</p>
        <p className="mt-2 flex justify-center gap-4">
          <Link to="/blog" className="hover:text-foreground hover:underline">Blog</Link>
          <Link to="/privacy" className="hover:text-foreground hover:underline">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground hover:underline">Terms of Service</Link>
        </p>
      </footer>
    </div>
  );
}
