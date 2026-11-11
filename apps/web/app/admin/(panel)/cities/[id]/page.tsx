import Link from "next/link";
import { notFound } from "next/navigation";

import { Flash } from "@/components/admin";
import { query } from "@/lib/db";
import { inCity } from "@/lib/cities";
import { cityAction } from "../../../actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CityEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const rows = await query<{ id: string; name: string; slug: string; editorial: string | null; published: number }>(
    `select c.id, c.name, c.slug, c.editorial,
            (select count(*)::int from listings l where l.city_id = c.id and l.status = 'published') as published
     from cities c where c.id = $1`,
    [id],
  );
  const city = rows[0];
  if (!city) notFound();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{city.name}</h1>
          <p className="page-sub">
            Własna treść strony miasta. Pojawia się pod wstępem, przed rankingiem. Strona:{" "}
            <a href={`/${city.slug}`} target="_blank" rel="noreferrer">
              /{city.slug}
            </a>{" "}
            ({city.published} firm na stronie).
          </p>
        </div>
      </div>
      <Flash params={sp} />
      <form action={cityAction} className="prompt-form">
        <input type="hidden" name="id" value={city.id} />
        <input type="hidden" name="action" value="editorial" />
        <label htmlFor="editorial">Tekst o rynku nieruchomości {inCity(city.name)} (opcjonalnie, do 4000 znaków)</label>
        <textarea id="editorial" name="editorial" rows={12} defaultValue={city.editorial ?? ""} maxLength={4000} />
        <p className="note">
          Pisz tylko sprawdzone fakty o mieście (np. dzielnice, charakter rynku), bez wymyślonych statystyk. Akapity
          rozdziel pustą linią. Puste pole usuwa treść.
        </p>
        <div className="row-actions">
          <button className="primary" type="submit">
            Zapisz
          </button>
          <Link className="btn" href="/admin/cities">
            Wróć do listy miast
          </Link>
        </div>
      </form>
    </>
  );
}
