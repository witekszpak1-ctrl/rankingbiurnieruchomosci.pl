import { listCities } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { SITE_NAME, absoluteUrl } from "@/lib/format";
import { operator } from "@/lib/legal";
import { nBiur } from "@/lib/plural";

export const dynamic = "force-dynamic";

// Plik dla asystentów AI: krótki opis serwisu i najważniejsze adresy. Skuteczność llms.txt nie jest potwierdzona,
// ale koszt jest znikomy.
export async function GET() {
  const cities = await listCities();
  const op = operator();
  const lines = [
    `# ${SITE_NAME}`,
    "",
    "> Niezależny katalog i ranking biur nieruchomości w Polsce, podzielony na miasta. Dane z rejestrów publicznych (KRS, wykaz VAT) i oficjalnych stron biur, jawna metodologia rankingu (wynik w rankingu 0-100, punkty za potwierdzenie w rejestrze, staż, cennik, spójność danych, usługi, opinie w Google i aktualne oferty), płatność nie wpływa na pozycję. Biura potwierdzone w rejestrze są oznaczone; biura bez potwierdzenia są w katalogu niżej w rankingu.",
    "",
    "## Zasady",
    `- [Ranking ogólnopolski](${absoluteUrl("/ranking")}): najwyżej ocenione biura w całym katalogu`,
    `- [Metodologia rankingu](${absoluteUrl("/metodologia")}): źródła danych, parametry, wagi, progi publikacji`,
    `- [Reklama i niezależność](${absoluteUrl("/reklama")})`,
    `- [Dla biur nieruchomości](${absoluteUrl("/dla-firm")}): jakie dane publikujemy, korekta i usunięcie wpisu`,
    `- [Lista miast według województw](${absoluteUrl("/miasta")})`,
    `- [Prowizje biur nieruchomości 2026](${absoluteUrl("/raporty/prowizje-biur-nieruchomosci-2026")}): mediana prowizji za sprzedaż według miast, z cenników biur`,
    `- [O nas](${absoluteUrl("/o-nas")}): kto prowadzi serwis (${op.name ?? "operator serwisu"}), skąd są dane i jak często je odświeżamy`,
    `- [Kontakt](${absoluteUrl("/kontakt")})${op.email ? `: ${op.email}` : ""}`,
    "",
    "## Miasta",
    ...cities.map((c) => `- [Biura nieruchomości ${c.name}](${absoluteUrl(`/${c.slug}`)}): ${nBiur(c.listings)} ${inCity(c.name)}`),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
