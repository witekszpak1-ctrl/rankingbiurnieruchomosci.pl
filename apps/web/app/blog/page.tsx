import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { BLOG_PATH, BLOG_POSTS, blogPath, type BlogCategory } from "@/lib/blog";
import { cityPairs, loadBlogData } from "@/lib/blog-stats";
import { absoluteUrl, formatDate } from "@/lib/format";
import { breadcrumbLd, organizationLd, pageMetadata, websiteRef } from "@/lib/seo";

export const revalidate = 86400;

export const metadata: Metadata = pageMetadata({
  title: "Blog o biurach nieruchomości: dane, porównania miast, prowizje",
  description:
    "Artykuły oparte na danych z katalogu biur nieruchomości: oceny biur w miastach, prowizje za sprzedaż i najem, staż firm, porównania miast i poradniki dla kupujących i sprzedających.",
  path: BLOG_PATH,
});

const SECTIONS: { category: BlogCategory; title: string; lead: string }[] = [
  { category: "Dane", title: "Dane z katalogu", lead: "Zestawienia liczone na bieżąco z danych o biurach w całej Polsce." },
  { category: "Porównania", title: "Porównania", lead: "Miasta i typy biur obok siebie, na tych samych zasadach." },
  { category: "Poradnik", title: "Poradniki", lead: "Odpowiedzi na pytania kupujących, sprzedających i wynajmujących, z liczbami z cenników biur." },
];

const GUIDES = [
  { href: "/poradnik/ile-bierze-biuro-nieruchomosci", title: "Ile bierze biuro nieruchomości za sprzedaż mieszkania" },
  { href: "/poradnik/jak-sprawdzic-biuro-nieruchomosci", title: "Jak sprawdzić biuro nieruchomości" },
  { href: "/poradnik/biura-z-jawnym-cennikiem", title: "Biura z jawnym cennikiem" },
  { href: "/raporty/prowizje-biur-nieruchomosci-2026", title: "Raport: prowizje biur nieruchomości 2026" },
];

export default async function BlogIndex() {
  const data = await loadBlogData().catch(() => null);
  const pairs = data ? cityPairs(data.cities) : [];
  const posts = [...BLOG_POSTS].sort((a, b) => (b.published > a.published ? 1 : b.published < a.published ? -1 : 0));
  return (
    <PublicShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          "@id": `${absoluteUrl(BLOG_PATH)}#blog`,
          name: "Blog Rankingu biur nieruchomości",
          url: absoluteUrl(BLOG_PATH),
          inLanguage: "pl-PL",
          publisher: organizationLd(),
          isPartOf: websiteRef(),
          blogPost: posts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.h1,
            url: absoluteUrl(blogPath(p.slug)),
            datePublished: p.published,
            dateModified: p.modified,
          })),
        }}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: "Strona główna", path: "/" },
          { name: "Blog", path: BLOG_PATH },
        ])}
      />
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / Blog
      </p>
      <h1>Blog o biurach nieruchomości</h1>
      <p className="lead-text">
        Piszemy na podstawie danych, które zbieramy o biurach nieruchomości w całej Polsce: rejestrów firm, cenników ze stron
        biur, ocen Google i ofert. Liczby w artykułach odświeżają się codziennie.
      </p>

      {SECTIONS.map((s) => {
        const list = posts.filter((p) => p.category === s.category);
        if (list.length === 0) return null;
        return (
          <section key={s.category}>
            <h2>{s.title}</h2>
            <p className="note">{s.lead}</p>
            <ul className="blog-list">
              {list.map((p) => (
                <li key={p.slug}>
                  <Link href={blogPath(p.slug)}>
                    <b>{p.h1}</b>
                    <span>{p.description}</span>
                    <small>{formatDate(p.published)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {pairs.length > 0 && (
        <section>
          <h2>Porównania miast</h2>
          <p className="note">Dwa miasta obok siebie: liczba biur, oceny klientów, staż, cenniki i prowizje.</p>
          <ul className="chips">
            {pairs.map((p) => (
              <li key={p.slug}>
                <Link href={blogPath(`porownanie/${p.slug}`)}>
                  {p.a.name} czy {p.b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Poradniki i raporty</h2>
        <ul className="cards">
          {GUIDES.map((g) => (
            <li key={g.href}>
              <Link href={g.href}>{g.title}</Link>
            </li>
          ))}
        </ul>
      </section>
    </PublicShell>
  );
}
