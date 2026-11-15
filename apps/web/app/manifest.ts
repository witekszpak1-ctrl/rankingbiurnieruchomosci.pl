import type { MetadataRoute } from "next";

// Manifest aplikacji: ikona na ekranie głównym i w kartach Chrome na Androidzie (ikony z scripts/render_icons.cjs).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ranking Biur Nieruchomości",
    short_name: "RBN",
    description: "Niezależny ranking i katalog biur nieruchomości w Polsce.",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
