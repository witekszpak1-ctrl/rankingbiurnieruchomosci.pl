import { BLOG_PATH, BLOG_POSTS, blogPath } from "@/lib/blog";
import { getBlogOverrides, isHidden } from "@/lib/blog-overrides";
import { listCities } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { SITE_NAME, absoluteUrl } from "@/lib/format";
import { operator } from "@/lib/legal";
import { nBiur } from "@/lib/plural";
import { capitalize, currentPortal, firmPhrase } from "@/lib/portal";

export const dynamic = "force-dynamic";

// Plik dla asystentów AI: krótki opis serwisu i najważniejsze adresy. Skuteczność llms.txt nie jest potwierdzona,
// ale koszt jest znikomy.
export async function GET() {
  const [cities, blogOverrides] = await Promise.all([listCities(), getBlogOverrides()]);
  const op = operator();
  const portal = currentPortal();
  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${portal.texts.llmsSummary}`,
    "",
    "## Zasady",
    `- [Ranking ogólnopolski](${absoluteUrl("/ranking")}): najwyżej ocenione biura w całym katalogu`,
    `- [Metodologia rankingu](${absoluteUrl("/metodologia")}): źródła danych, parametry, wagi, progi publikacji`,
    `- [Reklama i niezależność](${absoluteUrl("/reklama")})`,
    `- [Dla ${firmPhrase("many")}](${absoluteUrl("/dla-firm")}): jakie dane publikujemy, korekta i usunięcie wpisu`,
    `- [Lista miast według województw](${absoluteUrl("/miasta")})`,
    ...portal.texts.llmsReports.map((r) => `- [${r.label}](${absoluteUrl(r.href)}): ${r.description}`),
    `- [O nas](${absoluteUrl("/o-nas")}): kto prowadzi serwis (${op.name ?? "operator serwisu"}), skąd są dane i jak często je odświeżamy`,
    `- [Kontakt](${absoluteUrl("/kontakt")})${op.email ? `: ${op.email}` : ""}`,
    "",
    "## Blog",
    `- [Blog](${absoluteUrl(BLOG_PATH)}): artykuły z danymi katalogu, odświeżane codziennie`,
    ...BLOG_POSTS.filter((p) => !isHidden(p.slug, blogOverrides)).map((p) => `- [${p.h1}](${absoluteUrl(blogPath(p.slug))})`),
    "",
    "## Miasta",
    ...cities.map((c) => `- [${capitalize(firmPhrase("few"))} ${c.name}](${absoluteUrl(`/${c.slug}`)}): ${nBiur(c.listings)} ${inCity(c.name)}`),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
