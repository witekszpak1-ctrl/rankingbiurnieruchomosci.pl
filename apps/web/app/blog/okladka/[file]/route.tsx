import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { BLOG_POSTS, fmtRating } from "@/lib/blog";
import { CREAM, INK, THEMES, YELLOW, coverData, coverKeys, iconFor, type CoverPair, type CoverTheme } from "@/lib/blog-covers";
import { LOGO_FRAME_SIZE, LOGO_FRAME_STROKE, LOGO_HEIGHT, LOGO_LINE1, LOGO_LINE2, LOGO_RBN, LOGO_WIDTH } from "@/lib/logo-paths";

/**
 * Okładki wpisów bloga (1200x630 PNG) generowane z kodu w stylu strony, bez zdjęć. Każdy wpis ma własny rysunek
 * i motyw tła (lib/blog-covers.ts), a liczbę z aktualnych danych. Obrazki powstają przy wdrożeniu (generateStaticParams)
 * i odświeżają się raz na dobę, więc wczytują się od razu. Adres: /blog/okladka/<slug>.png albo porownanie-<para>.png.
 */

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ file: string }[]> {
  return (await coverKeys()).map((k) => ({ file: `${k}.png` }));
}

const SIZE = { width: 1200, height: 630 };

/** Czcionki serwisu (Archivo, IBM Plex Mono) z assets/fonts, ładowane raz na proces. Bez nich zostaje czcionka domyślna. */
type OgFont = { name: string; data: ArrayBuffer; weight: 500 | 600 | 800; style: "normal" };
let fontsPromise: Promise<OgFont[]> | null = null;
function loadFonts(): Promise<OgFont[]> {
  fontsPromise ??= (async () => {
    const files: [string, string, OgFont["weight"]][] = [
      ["Archivo", "archivo-800ExtraBold.woff", 800],
      ["Archivo", "archivo-500Medium.woff", 500],
      ["Plex Mono", "ibm-plex-mono-latin-600-normal.woff", 600],
      ["Plex Mono", "ibm-plex-mono-latin-ext-600-normal.woff", 600],
    ];
    const out: OgFont[] = [];
    for (const [name, file, weight] of files) {
      try {
        const buf = await readFile(join(process.cwd(), "assets/fonts", file));
        out.push({ name, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight, style: "normal" });
      } catch {
        // brak pliku: okładka i tak się wygeneruje z czcionką domyślną
      }
    }
    return out;
  })();
  return fontsPromise;
}

const logo = (color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}" fill="${color}">` +
      `<rect x="${LOGO_FRAME_STROKE / 2}" y="${LOGO_FRAME_STROKE / 2}" width="${LOGO_FRAME_SIZE - LOGO_FRAME_STROKE}" ` +
      `height="${LOGO_FRAME_SIZE - LOGO_FRAME_STROKE}" fill="none" stroke="${color}" stroke-width="${LOGO_FRAME_STROKE}"/>` +
      `<path d="${LOGO_RBN}"/><path d="${LOGO_LINE1}"/><path d="${LOGO_LINE2}"/></svg>`,
  )}`;

type Cover = { eyebrow: string; title: string; stat?: string; statLabel?: string; theme: CoverTheme; icon?: string; pair?: CoverPair };

async function coverFor(key: string): Promise<Cover | null> {
  const data = await coverData().catch(() => null);
  if (key.startsWith("porownanie-")) {
    const pair = data?.pairs.find((p) => `porownanie-${p.slug}` === key);
    if (!pair) return null;
    return {
      eyebrow: "Porównanie miast",
      title: `${pair.a} czy ${pair.b}? Biura nieruchomości w liczbach`,
      stat: `${pair.na} : ${pair.nb}`,
      statLabel: "biur w katalogu",
      theme: THEMES.Para,
      pair,
    };
  }
  const post = BLOG_POSTS.find((p) => p.slug === key);
  if (!post) return null;
  const theme = THEMES[post.category];
  const stat = data?.stats[key];
  return {
    eyebrow: post.category === "Dane" ? "Dane z katalogu" : post.category,
    title: post.h1,
    stat: stat?.stat,
    statLabel: stat?.statLabel,
    theme,
    icon: iconFor(key, theme),
  };
}

function PairArt({ pair, theme }: { pair: CoverPair; theme: CoverTheme }) {
  const max = Math.max(pair.na, pair.nb, 1);
  const cols = [
    { name: pair.a, n: pair.na, r: pair.ra, bg: YELLOW, fg: INK },
    { name: pair.b, n: pair.nb, r: pair.rb, bg: INK, fg: CREAM },
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 34, height: 400 }}>
      {cols.map((c) => (
        <div key={c.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: theme.fg, display: "flex" }}>{c.n}</div>
          <div
            style={{
              width: 120,
              height: Math.max(50, (c.n / max) * 250),
              background: c.bg,
              border: `4px solid ${INK}`,
              borderRadius: "12px 12px 0 0",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              paddingTop: 10,
              color: c.fg,
              fontSize: 22,
              fontWeight: 500,
            }}
          >
            {c.r != null ? `★ ${fmtRating(c.r)}` : ""}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: theme.fg, maxWidth: 170, textAlign: "center", display: "flex" }}>{c.name}</div>
        </div>
      ))}
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const key = file.replace(/\.png$/, "");
  if (!/^[a-z0-9-]+$/.test(key)) return new Response("Nie znaleziono", { status: 404 });
  const cover = await coverFor(key);
  if (!cover) return new Response("Nie znaleziono", { status: 404 });
  const t = cover.theme;
  const titleSize = cover.title.length > 70 ? 50 : cover.title.length > 45 ? 58 : 66;
  const fonts = await loadFonts();
  const mono = fonts.some((f) => f.name === "Plex Mono") ? "Plex Mono" : undefined;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: t.bg, color: t.fg, padding: "56px 64px", fontFamily: "Archivo" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 720, height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo(t.fg)} width={LOGO_WIDTH * 0.8} height={LOGO_HEIGHT * 0.8} alt="" />
            <div style={{ fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: t.muted, display: "flex", fontFamily: mono }}>Blog</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex" }}>
              <div style={{ fontSize: 22, letterSpacing: 5, textTransform: "uppercase", fontWeight: 600, borderBottom: `6px solid ${t.accent}`, paddingBottom: 4, fontFamily: mono }}>
                {cover.eyebrow}
              </div>
            </div>
            <div style={{ fontSize: titleSize, fontWeight: 800, lineHeight: 1.06, letterSpacing: -1.5, display: "flex" }}>{cover.title}</div>
          </div>
          {cover.stat ? (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ background: t.statBg, color: t.statFg, padding: "6px 18px", borderRadius: 12, fontSize: 54, fontWeight: 800, display: "flex" }}>{cover.stat}</div>
              <div style={{ fontSize: 26, maxWidth: 440, lineHeight: 1.2, display: "flex", fontWeight: 500 }}>{cover.statLabel}</div>
            </div>
          ) : (
            <div style={{ fontSize: 26, color: t.muted, display: "flex", fontWeight: 500 }}>rankingbiurnieruchomosci.pl</div>
          )}
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          {cover.pair ? (
            <PairArt pair={cover.pair} theme={t} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.icon} width={300} height={300} alt="" />
          )}
        </div>
      </div>
    ),
    { ...SIZE, fonts: fonts.length ? fonts : undefined, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
