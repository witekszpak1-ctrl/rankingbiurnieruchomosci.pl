/**
 * Obrazki firm (logo, zdjęcia) pochodzą z cudzych stron i bywają bardzo duże (zdjęcia po kilka MB pokazywane jako
 * miniatura 52 px). Przepuszczamy je przez publiczny serwis wsrv.nl (images.weserv.nl), który zmniejsza obrazek do
 * potrzebnej szerokości i zamienia na WebP. Gdy serwis nie da rady, parametr `default` przekierowuje do oryginału.
 * Nie używamy optymalizatora Vercel, bo jego darmowy limit przekształceń szybko by się skończył przy tysiącach firm.
 */
const PROXY = "https://wsrv.nl/";

export function optimizedImage(src: string, width: number, quality = 80): string {
  if (!/^https?:\/\//i.test(src)) return src;
  // SVG zostaje jako wektor (małe pliki, ostre na każdym ekranie).
  if (/\.svg(\?|#|$)/i.test(src)) return src;
  const params = new URLSearchParams({ url: src, w: String(Math.round(width)), output: "webp", q: String(quality), default: src });
  return `${PROXY}?${params}`;
}

/** srcSet dla zwykłych i gęstych ekranów (1x i 2x). */
export function imageSrcSet(src: string, width: number): string | undefined {
  if (!/^https?:\/\//i.test(src) || /\.svg(\?|#|$)/i.test(src)) return undefined;
  return `${optimizedImage(src, width)} 1x, ${optimizedImage(src, width * 2)} 2x`;
}

/** srcSet szerokościowy dla dużych zdjęć (np. baner profilu). */
export function responsiveSrcSet(src: string, widths: number[]): string | undefined {
  if (!/^https?:\/\//i.test(src) || /\.svg(\?|#|$)/i.test(src)) return undefined;
  return widths.map((w) => `${optimizedImage(src, w)} ${w}w`).join(", ");
}
