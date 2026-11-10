import { listCities } from "@/lib/catalog";
import { SITE_NAME, absoluteUrl } from "@/lib/format";

export const dynamic = "force-dynamic";

// Plik dla asystentów AI: krótki opis serwisu i najważniejsze adresy. Skuteczność llms.txt nie jest potwierdzona,
// ale koszt jest znikomy.
export async function GET() {
  const cities = await listCities();
  const lines = [
    `# ${SITE_NAME}`,
    "",
    "> Katalog zweryfikowanych biur nieruchomości w Polsce, podzielony na miasta. Dane z rejestrów publicznych (KRS, wykaz VAT) i stron firm, jawna metodologia rankingu, płatność nie wpływa na pozycję.",
    "",
    "## Zasady",
    `- [Metodologia rankingu](${absoluteUrl("/metodologia")}): źródła danych, parametry, wagi, progi publikacji`,
    `- [Reklama i niezależność](${absoluteUrl("/reklama")})`,
    "",
    "## Miasta",
    ...cities.map((c) => `- [Biura nieruchomości ${c.name}](${absoluteUrl(`/${c.slug}`)}): ${c.listings} biur`),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
