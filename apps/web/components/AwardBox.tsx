import Link from "next/link";

import { CopyCode } from "@/components/CopyCode";
import { AWARD, BADGE_HEIGHT, BADGE_WIDTH, badgeEmbedCode } from "@/lib/awards";
import { inCity } from "@/lib/cities";
import { absoluteUrl } from "@/lib/format";

/** Wyróżnienie w profilu biura z pierwszej trójki w mieście: odznaka i kod do wklejenia na stronę biura. */
export function AwardBox({ listingId, place, cityName, profilePath }: { listingId: string; place: number; cityName: string; profilePath: string }) {
  const badgePath = `/odznaka/${listingId}.svg`;
  const code = badgeEmbedCode({ profileUrl: absoluteUrl(profilePath), badgeUrl: absoluteUrl(badgePath) });
  return (
    <section className="award-box" aria-label="Wyróżnienie">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={badgePath} width={BADGE_WIDTH} height={BADGE_HEIGHT} alt="" />
      <div className="award-box-text">
        <p>
          <b>
            {place}. miejsce {inCity(cityName)}
          </b>{" "}
          w zestawieniu <Link href={AWARD.path}>{AWARD.title}</Link>, według aktualnego wyniku w rankingu.
        </p>
        <details>
          <summary>Pobierz odznakę na stronę biura</summary>
          <p>
            Wklej ten kod na swojej stronie. Odznaka pokazuje aktualne miejsce w rankingu i prowadzi do tego profilu.
          </p>
          <CopyCode code={code} label="Kod odznaki do wklejenia na stronę" />
        </details>
      </div>
    </section>
  );
}
