import Link from "next/link";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { BLOG_PATH, blogPath, relatedPosts, type BlogPost } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import { articleLd, breadcrumbLd } from "@/lib/seo";

/** Wspólna rama artykułu bloga: dane strukturalne, okruszki, nagłówek, daty i "Czytaj też". */
export function BlogArticle({
  post,
  children,
  extraLd = [],
  path = blogPath(post.slug),
  headline = post.h1,
  related = true,
}: {
  post: Pick<BlogPost, "slug" | "h1" | "description" | "published" | "modified" | "category">;
  children: React.ReactNode;
  extraLd?: Record<string, unknown>[];
  path?: string;
  headline?: string;
  related?: boolean;
}) {
  const others = related ? relatedPosts(post.slug) : [];
  return (
    <PublicShell>
      <JsonLd
        data={articleLd({
          headline,
          path,
          description: post.description,
          datePublished: post.published,
          dateModified: post.modified,
        })}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: "Strona główna", path: "/" },
          { name: "Blog", path: BLOG_PATH },
          { name: headline, path },
        ])}
      />
      {extraLd.map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / <Link href={BLOG_PATH}>Blog</Link> / {post.category}
      </p>
      <article className="blog-article">
        <h1>{headline}</h1>
        <p className="note">
          Opublikowano {formatDate(post.published)}
          {post.modified > post.published ? `, zaktualizowano ${formatDate(post.modified)}` : ""}. Liczby w tekście
          przeliczamy codziennie z aktualnych danych katalogu (ostatnie przeliczenie: {formatDate(new Date())}). Oceny Google i
          cenniki biur aktualizujemy stopniowo, więc dane pojedynczego biura mogą być sprzed kilku tygodni.
        </p>
        {children}
      </article>
      {others.length > 0 && (
        <section className="blog-related">
          <h2>Czytaj też</h2>
          <ul className="cards">
            {others.map((p) => (
              <li key={p.slug}>
                <Link href={blogPath(p.slug)}>
                  <small>{p.category}</small>
                  {p.h1}
                </Link>
              </li>
            ))}
          </ul>
          <p>
            <Link className="link-arrow" href="/#szukaj">
              Znajdź biuro w swoim mieście
            </Link>
          </p>
        </section>
      )}
    </PublicShell>
  );
}

/** Ramka "W skrócie" z odpowiedzią na pytanie z tytułu (pierwszy akapit dla czytelnika i wyszukiwarki). */
export function ShortAnswer({ children }: { children: React.ReactNode }) {
  return (
    <div className="answer">
      <strong>W skrócie</strong>
      <p>{children}</p>
    </div>
  );
}

/** Pasek udziału w komórce tabeli (wizualizacja odsetka 0-100). */
export function ShareBar({ value }: { value: number | null }) {
  if (value == null) return <>-</>;
  const v = Math.max(0, Math.min(100, value));
  return (
    <>
      <span className="bar-track" aria-hidden="true">
        <span className="bar" style={{ width: `${v}%` }} />
      </span>
      {Math.round(v)}%
    </>
  );
}

/** Sekcja FAQ z danymi FAQPage do JSON-LD. */
export function faqLd(items: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

/** Pytania i odpowiedzi. `node` to wersja odpowiedzi z linkami do pokazania na stronie (JSON-LD bierze tekst `a`). */
export function Faq({ items }: { items: { q: string; a: string; node?: React.ReactNode }[] }) {
  return (
    <>
      <h2>Najczęstsze pytania</h2>
      <div className="faq">
        {items.map((i) => (
          <details key={i.q}>
            <summary>{i.q}</summary>
            <p>{i.node ?? i.a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
