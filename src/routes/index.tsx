import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Megaphone, Users, BarChart3, Clock, ShieldCheck } from "lucide-react";
import logoUrl from "@/assets/acemail-logo.png";
import roadAsset from "@/assets/kiarostami-road.jpg.asset.json";
import fieldAsset from "@/assets/kiarostami-field.jpg.asset.json";
import poppiesAsset from "@/assets/kiarostami-poppies.jpg.asset.json";
import hillsAsset from "@/assets/kiarostami-hills.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";

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
      { name: "twitter:card", content: "summary_large_image" },
    ],
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
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);
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

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { src: fieldAsset.url, caption: "The wind will carry us", alt: "Golden sunrise over misty hills" },
            { src: poppiesAsset.url, caption: "Where is the friend's house?", alt: "Red poppies against a bright sky" },
            { src: hillsAsset.url, caption: "And life goes on", alt: "Mountains above a sea of clouds at dusk" },
          ].map((img) => (
            <figure key={img.caption} className="group overflow-hidden rounded-xl border shadow-sm">
              <img
                src={img.src}
                alt={img.alt}
                loading="lazy"
                className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <figcaption className="bg-card px-4 py-3 font-serif text-sm italic text-muted-foreground">
                {img.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
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

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>AceMail — open-source email automation, rebuilt for the modern web.</p>
        <p className="mt-2 font-serif italic text-amber">Design inspired by my favourite filmmaker, Abbas Kiarostami.</p>
        <p className="mt-2 flex justify-center gap-4">
          <Link to="/privacy" className="hover:text-foreground hover:underline">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground hover:underline">Terms of Service</Link>
        </p>
      </footer>
    </div>
  );
}
