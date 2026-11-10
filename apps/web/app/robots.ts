import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/format";

// Boty wyszukiwania asystentów AI jawnie dopuszczamy (chcemy być cytowani). Boty treningowe (GPTBot, ClaudeBot)
// podlegają regule ogólnej: to osobna decyzja biznesowa, którą można zmienić tutaj.
export default function robots(): MetadataRoute.Robots {
  const searchBots = ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot", "ChatGPT-User", "Claude-User"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/admin/"] },
      ...searchBots.map((userAgent) => ({ userAgent, allow: "/", disallow: ["/admin", "/admin/"] })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
