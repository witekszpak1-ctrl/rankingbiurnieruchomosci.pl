import { ImageResponse } from "next/og";

import { LOGO_HEIGHT, LOGO_LINE1, LOGO_LINE2, LOGO_RBN, LOGO_WIDTH } from "@/lib/logo-paths";

export const alt = "Ranking biur nieruchomości w Polsce";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_WHITE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}" fill="#ffffff">` +
    `<rect x="1" y="1" width="122" height="122" fill="none" stroke="#ffffff" stroke-width="2"/>` +
    `<path d="${LOGO_RBN}"/><path d="${LOGO_LINE1}"/><path d="${LOGO_LINE2}"/></svg>`,
)}`;

// Domyślny obrazek do udostępniania (Open Graph, Twitter) dla stron bez własnego zdjęcia.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0f172a",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_WHITE} width={LOGO_WIDTH} height={LOGO_HEIGHT} alt="" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>Ranking biur nieruchomości w Polsce</div>
          <div style={{ fontSize: 34, color: "#cbd5e1" }}>
            Porównaj biura w swoim mieście: prowizje, zakres usług, oferty i dane z rejestrów.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
