import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/format";

// Wszystkie publiczne strony, CSS, JS i obrazki są dostępne dla robotów. Blokujemy tylko panel i techniczny
// adres wyszukiwarki miast (/szukaj tylko przekierowuje na stronę miasta). Strony, których nie chcemy w indeksie
// (np. formularz właściciela), mają meta robots noindex, a nie Disallow, żeby robot mógł ten noindex zobaczyć.
// Boty wyszukiwania asystentów AI jawnie dopuszczamy (chcemy być cytowani). Boty treningowe (GPTBot, ClaudeBot)
// podlegają regule ogólnej: to osobna decyzja biznesowa, którą można zmienić tutaj.
export default function robots(): MetadataRoute.Robots {
  // Regulamin i polityka prywatności: decyzja właściciela, roboty mają tam nie wchodzić (nie ma ich też w mapie strony).
  const disallow = ["/admin", "/admin/", "/szukaj", "/regulamin", "/polityka-prywatnosci"];
  const named = ["Googlebot", "Bingbot", "OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User"];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }, ...named.map((userAgent) => ({ userAgent, allow: "/", disallow }))],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
