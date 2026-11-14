import Link from "next/link";

import type { LatestOffer } from "@/lib/catalog";
import { formatOfferPrice } from "@/lib/format";

/**
 * Karta oferty z listy ofert i strony głównej: cena, tytuł, biuro (link do profilu) i przycisk do ogłoszenia
 * na stronie biura. Przycisk rozciąga się na całą kartę, więc kliknięcie w dowolne miejsce otwiera ogłoszenie,
 * a link do profilu biura leży nad nim.
 */
export function OfferTile({ offer: o }: { offer: LatestOffer }) {
  const price = formatOfferPrice(o.priceAmount, o.priceCurrency, o.pricePeriod);
  return (
    <li className="offer-tile">
      <span className={`offer-tile-price${price ? "" : " none"}`}>{price ?? "cena na stronie biura"}</span>
      <span className="offer-tile-title">{o.title}</span>
      <span className="offer-tile-firm">
        oferta biura <Link href={`/${o.citySlug}/${o.firmSlug}`}>{o.firmName}</Link> ({o.cityName})
      </span>
      <a className="offer-tile-btn" href={o.url} target="_blank" rel="noopener nofollow">
        Zobacz ofertę
        <span className="sr-only">: {o.title} (strona biura, otwiera się w nowej karcie)</span>
        <span className="arr" aria-hidden="true">
          ↗
        </span>
      </a>
    </li>
  );
}
