import Link from "next/link";

import type { BlogLinkItem } from "@/lib/blog-links";

/** Ramka z wpisami bloga dobranymi do strony (profil biura, miasto, strona główna). */
export function BlogLinks({ title, items, className = "blog-links" }: { title: string; items: BlogLinkItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <section className={className}>
      <h2>{title}</h2>
      <ul className="cards">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href}>
              <small>{i.kicker}</small>
              {i.title}
            </Link>
          </li>
        ))}
      </ul>
      <p className="note">
        Więcej w <Link href="/blog">blogu o biurach nieruchomości</Link>.
      </p>
    </section>
  );
}
