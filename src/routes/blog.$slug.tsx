import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import logoUrl from "@/assets/acemail-logo.png";
import { blogPosts, SITE_URL } from "@/lib/blog-posts";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = blogPosts.find((p) => p.slug === params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) return { meta: [{ title: "Post not found — AceMail" }] };
    const url = `${SITE_URL}/blog/${post.slug}`;
    return {
      meta: [
        { title: `${post.title} | AceMail` },
        { name: "description", content: post.description },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            url,
            publisher: { "@type": "Organization", name: "AceMail" },
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <p>Post not found.</p>
      <Link to="/blog" className="underline">Back to blog</Link>
    </div>
  ),
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="AceMail logo" className="h-9 w-9 rounded-lg" width={36} height={36} />
          <span className="text-xl font-semibold">AceMail</span>
        </Link>
        <Link to="/blog" className="text-sm hover:underline">All posts</Link>
      </header>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <p className="text-xs uppercase tracking-[0.2em] text-jade">
          {new Date(post.date).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })} · {post.readMinutes} min read
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">{post.title}</h1>
        <div className="mt-8 space-y-6 text-lg leading-relaxed">
          {post.body.map((b, i) => (
            <section key={i}>
              {b.heading && <h2 className="mb-2 text-2xl font-semibold">{b.heading}</h2>}
              <p className="text-foreground/85">{b.text}</p>
            </section>
          ))}
        </div>
        <div className="mt-12 rounded-xl border bg-card p-6 text-center">
          <p className="font-semibold">Try it in AceMail</p>
          <Link to="/" className="mt-2 inline-block text-sm underline">Request early access</Link>
        </div>
      </article>
    </div>
  );
}
