import { createFileRoute, Link } from "@tanstack/react-router";
import logoUrl from "@/assets/acemail-logo.png";
import { blogPosts, SITE_URL } from "@/lib/blog-posts";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Outreach CRM, AI personalization & self-hosting guides | AceMail" },
      { name: "description", content: "Practical guides to sales funnels, Gmail and LinkedIn outreach, AI personalization, MCP and Docker self-hosting with AceMail." },
      { property: "og:title", content: "AceMail guides: outreach CRM, AI and self-hosting" },
      { property: "og:description", content: "Build an outreach workflow with visual CRM funnels, personalized emails, MCP assistants and Docker self-hosting." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/blog` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/blog` }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="AceMail logo" className="h-9 w-9 rounded-lg" width={36} height={36} />
          <span className="text-xl font-semibold">AceMail</span>
        </Link>
        <Link to="/auth" className="text-sm hover:underline">Sign in</Link>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-8">
        <h1 className="text-5xl font-bold">The AceMail blog</h1>
        <p className="mt-3 text-lg text-muted-foreground">From the first personalized message to the next client conversation. Guides to outreach, CRM, AI and running AceMail your way.</p>
        <div className="mt-10 space-y-6">
          {blogPosts.map((p) => (
            <article key={p.slug} className="rounded-xl border bg-card p-6 transition hover:shadow-md">
              <p className="text-xs uppercase tracking-[0.2em] text-jade">
                {new Date(p.date).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })} · {p.readMinutes} min read
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                <Link to="/blog/$slug" params={{ slug: p.slug }} className="hover:underline">{p.title}</Link>
              </h2>
              <p className="mt-2 text-muted-foreground">{p.description}</p>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
