import type { NextFetchEvent, NextRequest } from "next/server";

/**
 * Zgłasza wejścia botów (wyszukiwarki, boty AI, podglądy linków) do „Statystyk stron” w CRM.
 * Boty nie uruchamiają JavaScriptu, więc licznik z PulseTracker ich nie widzi - zgłasza je serwer.
 * Wysyłka idzie w tle (waitUntil), więc nie spowalnia odpowiedzi. Sekret tylko w PULSE_SECRET na Vercelu.
 */
const PULSE_URL = "https://witekcrm.com/api/public/pulse/b";

export const BOT_RE =
  /bot|crawler|spider|crawl|slurp|GPTBot|ChatGPT-User|OAI-SearchBot|Claude|anthropic|Perplexity|Google-|GoogleOther|Applebot|meta-external|meta-webindexer|facebookexternalhit|WhatsApp|Bytespider|Amazonbot|Amzn-|MistralAI|DuckAssist|YouBot|CCBot|cohere|Diffbot|Grok|DeepSeek|TelegramBot|Slackbot|Discordbot|LinkedInBot|Twitterbot|Pinterestbot|PetalBot|Lighthouse|Mediapartners|FeedFetcher|APIs-Google|Google Favicon|GoogleProducer|MicrosoftPreview|SkypeUriPreview|Iframely|Embedly|vkShare|Cardyb|Quora Link Preview|Snap URL|Mastodon|Yeti\/|Daumoa|Qwantify|ia_archiver|Feedly|Inoreader|NewsBlur|Feedbin|StatusCake|Site24x7|Uptime|Freshping|HetrixTools|NodePing|Checkly|Datadog|NewRelic|GTmetrix|PageSpeed|Sitebulb|Siteimprove|JetOctopus|ContentKing|MegaIndex|python-|aiohttp|httpx|curl\/|Wget\/|Go-http-client|axios\/|node-fetch|undici|okhttp|Java\/|libwww|Scrapy|HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium|Apache-HttpClient|PostmanRuntime|GuzzleHttp|Censys|Expanse|zgrab|Nuclei|Nmap|masscan|InternetMeasurement|Shodan|Firecrawl|img2dataset|Cotoyogi|Novellum|preview|fetcher/i;

export function reportBot(req: NextRequest, event: NextFetchEvent): void {
  const PULSE_SECRET = process.env.PULSE_SECRET;
  if (!PULSE_SECRET) return;
  const ua = req.headers.get("user-agent") || "";
  if (ua && !BOT_RE.test(ua)) return;
  event.waitUntil(
    fetch(PULSE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-pulse-secret": PULSE_SECRET },
      body: JSON.stringify({
        ua,
        path: req.nextUrl.pathname,
        country: req.headers.get("x-vercel-ip-country"),
      }),
    }).catch(() => {}),
  );
}
