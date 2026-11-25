import { isSitemapFile, sitemapGroups, urlsetXml, xmlResponse } from "@/lib/sitemap";

// Pojedyncza mapa strony z indeksu /sitemap.xml: /sitemaps/strony.xml, /sitemaps/miasta.xml, /sitemaps/firmy.xml.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await params;
  const name = file.endsWith(".xml") ? file.slice(0, -4) : "";
  if (!isSitemapFile(name)) return new Response("Nie znaleziono", { status: 404 });
  const groups = await sitemapGroups();
  return xmlResponse(urlsetXml(groups[name]));
}
