import { absoluteUrl } from "@/lib/format";
import { newestDate, SITEMAP_FILES, sitemapGroups, sitemapIndexXml, sitemapPath, xmlResponse } from "@/lib/sitemap";

// Indeks map strony: strony stałe i blog, miasta, firmy (lib/sitemap.ts). Adres /sitemap.xml zostaje ten sam,
// więc wpis w Search Console i w robots.txt nie wymaga zmiany.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const groups = await sitemapGroups();
  return xmlResponse(
    sitemapIndexXml(
      SITEMAP_FILES.map((name) => ({
        url: absoluteUrl(sitemapPath(name)),
        lastModified: newestDate(groups[name].map((u) => u.lastModified)),
      })),
    ),
  );
}
