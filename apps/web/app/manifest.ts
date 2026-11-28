import type { MetadataRoute } from "next";

import { currentPortal } from "@/lib/portal";

// Manifest aplikacji: ikona na ekranie głównym i w kartach Chrome na Androidzie (ikony z scripts/render_icons.cjs).
export default function manifest(): MetadataRoute.Manifest {
  const portal = currentPortal();
  return {
    name: portal.brandName,
    short_name: portal.shortName,
    description: portal.texts.manifestDescription,
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
