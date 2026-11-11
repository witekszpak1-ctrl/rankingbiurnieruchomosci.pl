import { ImageResponse } from "next/og";

export const alt = "Ranking biur nieruchomości w Polsce";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 34, fontWeight: 700 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#22c55e", display: "flex" }} />
          rankingbiurnieruchomosci.pl
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
