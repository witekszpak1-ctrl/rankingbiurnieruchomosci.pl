import type { Premium } from "@/lib/premium";

/**
 * Warstwa Premium profilu: sekcje z treścią dostarczoną przez firmę. Każda sekcja ma widoczną etykietę
 * "Informacje od firmy" i stoi osobno od danych zweryfikowanych przez katalog (rejestry, cennik, wynik w rankingu).
 * Treść nie wpływa na wynik w rankingu (docs/ops/DECISIONS.md, pkt 4). Pola są już zwalidowane w lib/premium.ts.
 */
const TAG = "Informacje od firmy";

function Head({ title }: { title: string }) {
  return (
    <div className="premium-head">
      <h2>{title}</h2>
      <span className="premium-tag">{TAG}</span>
    </div>
  );
}

export function PremiumSections({ premium, firmName }: { premium: Premium; firmName: string }) {
  const c = premium.content;
  return (
    <div className="premium-layer" data-premium={premium.status}>
      {c.longDescription && (
        <section className="profile-section premium-section" aria-label={`${TAG}: opis`}>
          <Head title={`Więcej o ${firmName}`} />
          {c.longDescription.split(/\n\s*\n/).map((para, i) => (
            <p key={i} className="profile-about">
              {para.trim()}
            </p>
          ))}
        </section>
      )}

      {c.specializations.length > 0 && (
        <section className="profile-section premium-section" aria-label={`${TAG}: specjalizacje`}>
          <Head title="Specjalizacje" />
          <ul className="service-chips">
            {c.specializations.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {c.serviceAreas.length > 0 && (
        <section className="profile-section premium-section" aria-label={`${TAG}: obszar działania`}>
          <Head title="Obszar działania" />
          <ul className="service-chips">
            {c.serviceAreas.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {c.team.length > 0 && (
        <section className="profile-section premium-section" aria-label={`${TAG}: zespół`}>
          <Head title="Zespół" />
          <ul className="premium-team">
            {c.team.map((m) => (
              <li key={`${m.name}-${m.role ?? ""}`}>
                <b>{m.name}</b>
                {m.role && <span>{m.role}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.gallery.length > 0 && (
        <section className="profile-section premium-section" aria-label={`${TAG}: galeria`}>
          <Head title="Galeria" />
          <ul className="premium-gallery">
            {c.gallery.map((g) => (
              <li key={g.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.url} alt={g.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.videoUrl && (
        <section className="profile-section premium-section" aria-label={`${TAG}: film`}>
          <Head title="Film" />
          <p>
            <a href={c.videoUrl} rel="noopener nofollow" target="_blank">
              Obejrzyj film przygotowany przez firmę
            </a>
          </p>
        </section>
      )}

      {c.faq.length > 0 && (
        <section className="profile-section premium-section" aria-label={`${TAG}: pytania`}>
          <Head title={`Pytania do ${firmName}`} />
          <div className="faq">
            {c.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {c.ctaUrl && (
        <section className="profile-section premium-section" aria-label={`${TAG}: kontakt`}>
          <Head title="Zapraszamy do kontaktu" />
          <p>
            <a className="btn-green" href={c.ctaUrl} rel="noopener nofollow" target="_blank">
              {c.ctaLabel ?? "Przejdź do strony firmy"}
            </a>
          </p>
        </section>
      )}

      <p className="note premium-note">
        Treści oznaczone &bdquo;{TAG}&rdquo; dostarczyła firma. Katalog ich nie weryfikuje, a ich obecność nie wpływa na wynik w rankingu.
      </p>
    </div>
  );
}
