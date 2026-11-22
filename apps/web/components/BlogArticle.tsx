import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { BLOG_PATH, blogPath, coverPath, relatedPosts, type BlogPost } from "@/lib/blog";
import { getBlogOverrides, isHidden, withOverride } from "@/lib/blog-overrides";
import { formatDate } from "@/lib/format";
import { articleLd, breadcrumbLd } from "@/lib/seo";

/**
 * Wspólna rama artykułu bloga: okładka, dane strukturalne, okruszki, nagłówek, daty i "Czytaj też".
 * Wpis ukryty w panelu (/admin/blog) zwraca 404; data wpisu może być nadpisana w panelu.
 */
export async function BlogArticle({
  post: basePost,
  children,
  extraLd = [],
  path = blogPath(basePost.slug),
  headline = basePost.h1,
  related = true,
  cover = coverPath(basePost.slug.replace("/", "-")),
}: {
  post: Pick<BlogPost, "slug" | "h1" | "description" | "published" | "modified" | "category">;
  children: React.ReactNode;
  extraLd?: Record<string, unknown>[];
  path?: string;
  headline?: string;
  related?: boolean;
  /** Ścieżka okładki (PNG 1200x630); null, żeby jej nie pokazywać. */
  cover?: string | null;
}) {
  const overrides = await getBlogOverrides();
  // klucz w ustawieniach: slug artykułu albo "porownanie-<para>" dla porównań miast
  const key = basePost.slug.replace("/", "-");
  if (isHidden(key, overrides)) notFound();
  const post = { ...withOverride({ ...basePost, slug: key }, overrides), slug: basePost.slug };
  const others = related ? relatedPosts(post.slug).filter((p) => !isHidden(p.slug, overrides)) : [];
  return (
    <PublicShell>
      <JsonLd
        data={articleLd({
          headline,
          path,
          description: post.description,
          datePublished: post.published,
          dateModified: post.modified,
          image: cover ?? undefined,
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
        {cover && (
          // Okładka generowana z kodu (tytuł i główna liczba), więc tekst alternatywny powtarza nagłówek.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="blog-cover" src={cover} width={1200} height={630} alt={`Okładka artykułu: ${headline}`} />
        )}
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

/** Lista kontrolna (np. do wydruku przed podpisaniem umowy). */
export function Checklist({ title, items }: { title: string; items: React.ReactNode[] }) {
  return (
    <div className="checklist">
      <strong>{title}</strong>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Przykład z wyliczeniem (ramka z nagłówkiem i treścią). */
export function Example({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="example">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
