/** Zapis i odczyt ustawień narzędzi analitycznych (settings.tracking). Tylko po stronie serwera. */

import { createHash } from "node:crypto";

import { query } from "./db";
import { type CustomCode, type PublicTracking, TOOLS, type ToolKey } from "./tracking-tools";

export type TrackingSettings = {
  ids: Partial<Record<ToolKey, string>>;
  customStatistics: CustomCode | null;
  customMarketing: CustomCode | null;
  /** Token Conversions API Meta (sekret, nigdy nie trafia do przeglądarki) i kod testowy z Menedżera zdarzeń. */
  metaCapiToken: string | null;
  metaTestCode: string | null;
};

export const EMPTY_TRACKING: TrackingSettings = {
  ids: {},
  customStatistics: null,
  customMarketing: null,
  metaCapiToken: null,
  metaTestCode: null,
};
const TOKEN_RE = /^[A-Za-z0-9_-]{30,400}$/;
const TEST_CODE_RE = /^TEST[A-Z0-9]{2,20}$/;
export const CUSTOM_CODE_MAX = 20000;

export async function getTracking(): Promise<TrackingSettings> {
  try {
    const rows = await query<{ value: Partial<TrackingSettings> }>("select value from settings where key = 'tracking'");
    const value = rows[0]?.value;
    if (!value) return EMPTY_TRACKING;
    const ids: Partial<Record<ToolKey, string>> = {};
    for (const tool of TOOLS) {
      const id = value.ids?.[tool.key];
      if (typeof id === "string" && tool.pattern.test(id)) ids[tool.key] = id;
    }
    return {
      ids,
      customStatistics: value.customStatistics?.code ? value.customStatistics : null,
      customMarketing: value.customMarketing?.code ? value.customMarketing : null,
      metaCapiToken: typeof value.metaCapiToken === "string" && TOKEN_RE.test(value.metaCapiToken) ? value.metaCapiToken : null,
      metaTestCode: typeof value.metaTestCode === "string" && TEST_CODE_RE.test(value.metaTestCode) ? value.metaTestCode : null,
    };
  } catch {
    return EMPTY_TRACKING;
  }
}

/** Wersja konfiguracji: zmienia się, gdy dojdzie lub zniknie narzędzie, i wtedy baner pyta o zgodę ponownie. */
export function trackingVersion(settings: TrackingSettings): string {
  const parts = [
    ...TOOLS.filter((t) => settings.ids[t.key]).map((t) => t.key),
    settings.customStatistics ? `cs:${settings.customStatistics.description}` : "",
    settings.customMarketing ? `cm:${settings.customMarketing.description}` : "",
    settings.ids.metaPixel && settings.metaCapiToken ? "capi" : "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 10);
}

export function toPublic(settings: TrackingSettings): PublicTracking {
  return {
    version: trackingVersion(settings),
    ids: settings.ids,
    customStatistics: settings.customStatistics,
    customMarketing: settings.customMarketing,
    metaCapi: Boolean(settings.ids.metaPixel && settings.metaCapiToken),
  };
}

export type TrackingParse = { ok: true; value: TrackingSettings } | { ok: false; message: string };

/** Sprawdza dane z formularza panelu. Puste pole tokenu zostawia zapisany token (chyba że zaznaczono usunięcie). */
export function parseTrackingForm(form: FormData, current: TrackingSettings = EMPTY_TRACKING): TrackingParse {
  const ids: Partial<Record<ToolKey, string>> = {};
  for (const tool of TOOLS) {
    const raw = String(form.get(tool.key) ?? "").trim();
    if (!raw) continue;
    const id = tool.key === "clarity" ? raw.toLowerCase() : raw.toUpperCase();
    if (!tool.pattern.test(id)) return { ok: false, message: `${tool.label}: nieprawidłowy format (np. ${tool.placeholder}).` };
    ids[tool.key] = id;
  }
  const custom = (kind: "Statistics" | "Marketing"): CustomCode | null | string => {
    const code = String(form.get(`custom${kind}`) ?? "").replace(/\r\n/g, "\n").trim();
    const description = String(form.get(`custom${kind}Description`) ?? "").replace(/[–—]/g, "-").trim();
    if (!code) return null;
    if (code.length > CUSTOM_CODE_MAX) return `Własny kod jest za długi (najwięcej ${CUSTOM_CODE_MAX} znaków).`;
    if (description.length < 3) return "Do własnego kodu wpisz nazwę narzędzia i dostawcy (pokażemy ją w banerze i w polityce prywatności).";
    return { code, description: description.slice(0, 200) };
  };
  const stats = custom("Statistics");
  if (typeof stats === "string") return { ok: false, message: stats };
  const marketing = custom("Marketing");
  if (typeof marketing === "string") return { ok: false, message: marketing };
  const tokenRaw = String(form.get("metaCapiToken") ?? "").trim();
  let metaCapiToken = current.metaCapiToken;
  if (form.get("metaCapiTokenRemove") === "on") metaCapiToken = null;
  else if (tokenRaw) {
    if (!TOKEN_RE.test(tokenRaw)) return { ok: false, message: "Token Conversions API wygląda na niepełny (skopiuj go w całości z Menedżera zdarzeń)." };
    metaCapiToken = tokenRaw;
  }
  const testRaw = String(form.get("metaTestCode") ?? "").trim().toUpperCase();
  if (testRaw && !TEST_CODE_RE.test(testRaw)) return { ok: false, message: "Kod testowy Meta ma postać TEST12345." };
  return {
    ok: true,
    value: { ids, customStatistics: stats, customMarketing: marketing, metaCapiToken, metaTestCode: testRaw || null },
  };
}
