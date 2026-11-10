import Link from "next/link";

import { PublicShell } from "@/components/SiteChrome";
import { listCities } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cities = await listCities();
  const total = cities.reduce((sum, c) => sum + c.listings, 0);
  return (
    <PublicShell>
      <h1>Ranking biur nieruchomości w Polsce</h1>
      <div className="answer">
        <strong>W skrócie</strong>
        {total > 0 ? (
          <p>
            {`Katalog zawiera ${total} zweryfikowanych biur nieruchomości w ${cities.length} miastach. Każde biuro sprawdzamy w rejestrach publicznych (KRS, wykaz podatników VAT) oraz na jego własnej stronie internetowej. Ranking liczymy według `}
            <Link href="/metodologia">jawnej metodologii</Link>, a płatność nie wpływa na pozycję.
          </p>
        ) : (
          <p>
            Katalog jest w budowie. Publikujemy tylko biura, których dane udało się potwierdzić w rejestrach i na
            własnej stronie firmy. Zobacz <Link href="/metodologia">metodologię</Link>.
          </p>
        )}
      </div>

      {cities.length > 0 && (
        <>
          <h2>Wybierz miasto</h2>
          <ul className="cards">
            {cities.map((city) => (
              <li key={city.slug}>
                <Link href={`/${city.slug}`}>
                  <strong>{city.name}</strong>
                  <small>{city.listings} biur w katalogu</small>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </PublicShell>
  );
}
