import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FirmProfile } from "@/components/FirmProfile";
import { getListingForPreview, getPremium } from "@/lib/premium";
import { verifyPreviewToken } from "@/lib/preview-token";

/**
 * Podgląd profilu ze szkicem Premium: /podglad/<token>, token = "<id wpisu>.<HMAC>" (lib/preview-token.ts).
 * To osobna trasa dynamiczna, bo profile /[city]/[firm] są ISR i nie mogą czytać parametrów żądania. Strona nie jest
 * indeksowana (meta noindex, nagłówek X-Robots-Tag i Cache-Control: no-store w next.config.mjs) i nie liczy wejść.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Podgląd profilu",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PreviewPage({ params }: Props) {
  const { token } = await params;
  const listingId = verifyPreviewToken(decodeURIComponent(token), process.env.ADMIN_SESSION_SECRET);
  if (!listingId) notFound();
  const listing = await getListingForPreview(listingId);
  if (!listing) notFound();
  // Podgląd pokazuje szkic; gdy wpis ma już opublikowaną warstwę (jeden wiersz na wpis), pokazuje ją.
  const premium = (await getPremium(listingId, "draft")) ?? (await getPremium(listingId, "published"));
  return <FirmProfile listing={listing} premium={premium} preview />;
}
