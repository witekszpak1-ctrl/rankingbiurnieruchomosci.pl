import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/format";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} w Polsce`, template: `%s | ${SITE_NAME}` },
  description:
    "Katalog zweryfikowanych biur nieruchomości w Polsce, podzielony na miasta. Dane z rejestrów i stron firm, jawna metodologia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
