/**
 * Tekst stron porównań miast (/blog/porownanie/<a>-czy-<b>) liczony z danych katalogu.
 * Każde zdanie zawiera liczby z danych, a sformułowania i kolejność zdań dobieramy deterministycznie z kilku wariantów
 * (na podstawie adresu pary), żeby 28 stron nie brzmiało identycznie. Niczego nie dopowiadamy poza danymi: przy zbyt
 * małej próbie zdanie mówi wprost, że danych jest za mało. Testy: tests/pair-content.test.ts.
 */
import { CITY_COMPARE_MIN, MIN_REVIEWS, SAME_RATING, SAME_SHARE, YEARS_MIN, type CityStats } from "./blog-stats";
import { fmtRate, fmtRating, fmtShare, fmtYears } from "./blog";
import { inCity } from "./cities";
import { count, nBiur, nBiurGen, nLatGen, nOpiniami, nOpinii, plural } from "./plural";
import { PRICE_STAT_MIN } from "./ranking";

export type TopFirm = { name: string; slug: string; citySlug: string; score: number; rating: number | null; reviews: number | null };
export type ServiceShare = { label: string; share: number };
export type CityExtra = { services: ServiceShare[]; top: TopFirm[]; editorial: string | null };

/** Skrót FNV-1a: stały wybór wariantu dla danej pary i miejsca w tekście. */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pick<T>(variants: T[], seed: number, salt: string): T {
  return variants[seedOf(`${seed}:${salt}`) % variants.length];
}

const nWpisow = (n: number) => count(n, "wpis", "wpisy", "wpisów");
const ratedOk = (c: CityStats) => c.rated >= CITY_COMPARE_MIN && c.avgRating != null;
const yearsOk = (c: CityStats) => c.withYears >= YEARS_MIN && c.medianYears != null;
const joinList = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} i ${items[items.length - 1]}`);

/** Opis rynku biur w jednym mieście: 3-4 akapity z danych, w kolejności zależnej od pary. */
export function cityPortrait(c: CityStats, extra: CityExtra, seed: number): string[] {
  const where = inCity(c.name);
  const intro = pick(
    [
      `${where[0].toUpperCase()}${where.slice(1)} mamy w katalogu ${nBiur(c.firms)} z głównym wpisem${c.listings > c.firms ? `, a razem z oddziałami firm z innych miast ${nWpisow(c.listings)}` : ""}.`,
      `Nasz katalog obejmuje ${nBiur(c.firms)} ${where}${c.listings > c.firms ? ` (${nWpisow(c.listings)} razem z firmami z innych miast, które mają tu oddział albo obsługują okolicę)` : ""}.`,
      `Do wyboru ${where} masz w naszym katalogu ${nBiur(c.firms)}${c.listings > c.firms ? `, a jeśli doliczyć oddziały firm z innych miast, ${nWpisow(c.listings)}` : ""}.`,
    ],
    seed,
    `intro:${c.slug}`,
  );
  const ratings = ratedOk(c)
    ? pick(
        [
          `Ocenę Google z co najmniej ${nOpiniami(MIN_REVIEWS)} ${plural(c.rated, "ma", "mają", "ma")} ${nBiur(c.rated)}. Ich średnia to ${fmtRating(c.avgRating)}, ocenę 4,8 lub wyższą ma ${fmtShare(c.share48)} z nich${c.shareBelow4 != null && c.shareBelow4 > 0 ? `, a poniżej 4,0 ${fmtShare(c.shareBelow4)}` : ""}.`,
          `Średnia ocena Google biur, które mają co najmniej ${nOpiniami(MIN_REVIEWS)}, wynosi ${fmtRating(c.avgRating)} (próba: ${nBiur(c.rated)}). ${fmtShare(c.share48)} z nich ma 4,8 lub więcej${c.shareBelow4 != null && c.shareBelow4 > 0 ? `, ${fmtShare(c.shareBelow4)} mniej niż 4,0` : ""}.`,
        ],
        seed,
        `ratings:${c.slug}`,
      )
    : `Biur z co najmniej ${nOpiniami(MIN_REVIEWS)} w Google jest tu ${c.rated}, za mało, żeby rzetelnie policzyć średnią dla miasta.`;
  const reviews = c.reviews > 0 ? ` Łącznie biura z tego miasta zebrały w Google ${nOpinii(c.reviews)}.` : "";
  const tenure = yearsOk(c)
    ? pick(
        [
          `Typowe biuro jest w rejestrze od ${nLatGen(Math.floor(c.medianYears as number))}. 10 lat lub dłużej ma ${fmtShare(c.share10y)} firm ze znaną datą, a ${fmtShare(c.shareUnder3y)} to firmy zarejestrowane w ostatnich 3 latach.`,
          `Mediana stażu w rejestrze to ${fmtYears(c.medianYears)} (dane dla ${nBiurGen(c.withYears)}). Firm z co najmniej 10 latami jest ${fmtShare(c.share10y)}, nowych, sprzed mniej niż 3 lat, ${fmtShare(c.shareUnder3y)}.`,
        ],
        seed,
        `tenure:${c.slug}`,
      )
    : `Datę rejestracji znamy tylko dla ${c.withYears} biur, więc stażu w tym mieście nie podsumowujemy.`;
  const pricing = `Cennik na swojej stronie publikuje ${c.withPrices} z ${c.firms} biur (${fmtShare(c.sharePrices)}), a aktualne oferty pokazuje ${fmtShare(c.shareOffers)}.${
    c.commission != null
      ? ` Mediana najniższych stawek za sprzedaż z tych cenników to ${fmtRate(c.commission)} (${nBiur(c.commissionN)}).`
      : ` Procentową stawkę za sprzedaż podaje za mało biur (${c.commissionN}), żeby policzyć medianę dla miasta.`
  }`;
  const services = extra.services.length
    ? ` Najczęściej deklarowane usługi to ${joinList(extra.services.slice(0, 3).map((s) => `${s.label} (${fmtShare(s.share)} wpisów)`))}.`
    : "";
  const top = extra.top.length
    ? pick(
        [
          `Najwyżej w naszym rankingu ${where} są teraz: ${joinList(extra.top.map((f) => `${f.name} (${f.score}/100)`))}.`,
          `Pierwsze miejsca rankingu ${where} zajmują ${joinList(extra.top.map((f) => `${f.name} (${f.score}/100)`))}.`,
        ],
        seed,
        `top:${c.slug}`,
      )
    : "";
  const paras = [`${intro} ${ratings}${reviews}`, `${tenure} ${pricing}${services}`];
  if (top) paras.push(top);
  return seedOf(`${seed}:order:${c.slug}`) % 2 ? [paras[1], paras[0], ...paras.slice(2)] : paras;
}

type Side = "a" | "b" | "tie" | null;
function cmp(x: number | null, y: number | null, same: number): Side {
  if (x == null || y == null) return null;
  if (Math.abs(x - y) < same) return "tie";
  return x > y ? "a" : "b";
}

/** Akapit porównania ocen klientów. */
export function ratingsComparison(a: CityStats, b: CityStats, seed: number): string {
  if (!ratedOk(a) || !ratedOk(b)) {
    const low = !ratedOk(a) ? a : b;
    return `Ocen nie porównujemy wprost: ${inCity(low.name)} biur z co najmniej ${nOpiniami(MIN_REVIEWS)} jest tylko ${low.rated}, a do porównania potrzebujemy co najmniej ${CITY_COMPARE_MIN}.`;
  }
  const w = cmp(a.avgRating, b.avgRating, SAME_RATING);
  const s48 = cmp(a.share48, b.share48, SAME_SHARE);
  const win = w === "a" ? a : b;
  const lose = w === "a" ? b : a;
  const first =
    w === "tie"
      ? pick(
          [
            `Średnie oceny biur są w obu miastach bardzo zbliżone: ${fmtRating(a.avgRating)} ${inCity(a.name)} i ${fmtRating(b.avgRating)} ${inCity(b.name)}.`,
            `Pod względem średniej oceny Google miasta wypadają prawie tak samo (${a.name} ${fmtRating(a.avgRating)}, ${b.name} ${fmtRating(b.avgRating)}).`,
          ],
          seed,
          "r1tie",
        )
      : pick(
          [
            `Wyżej oceniane są biura ${inCity(win.name)}: średnio ${fmtRating(win.avgRating)} wobec ${fmtRating(lose.avgRating)} ${inCity(lose.name)}.`,
            `W ocenach klientów lepiej wypada ${win.name} (średnio ${fmtRating(win.avgRating)}), ${lose.name} ma ${fmtRating(lose.avgRating)}.`,
          ],
          seed,
          "r1",
        );
  const second =
    s48 == null
      ? ""
      : s48 === "tie"
        ? ` Podobny jest też odsetek biur z oceną 4,8 i wyższą (${fmtShare(a.share48)} i ${fmtShare(b.share48)}).`
        : ` Biur z oceną 4,8 i wyższą jest ${s48 === "a" ? inCity(a.name) : inCity(b.name)} ${fmtShare(s48 === "a" ? a.share48 : b.share48)}, ${s48 === "a" ? inCity(b.name) : inCity(a.name)} ${fmtShare(s48 === "a" ? b.share48 : a.share48)}.`;
  const note = ` Średnia miasta to tylko tło: o wyborze decyduje konkretne biuro, jego opinie i warunki umowy.`;
  return `${first}${second}${note}`;
}

/** Akapit porównania stażu. */
export function tenureComparison(a: CityStats, b: CityStats, seed: number): string {
  if (!yearsOk(a) || !yearsOk(b)) {
    return `Stażu nie porównujemy: datę rejestracji znamy dla ${a.withYears} biur ${inCity(a.name)} i ${b.withYears} ${inCity(b.name)}, a potrzebujemy co najmniej ${YEARS_MIN} w każdym mieście.`;
  }
  const w = cmp(a.medianYears, b.medianYears, 1);
  const s10 = cmp(a.share10y, b.share10y, SAME_SHARE);
  const head =
    w === "tie"
      ? `Typowe biuro jest w rejestrze podobnie długo w obu miastach (${fmtYears(a.medianYears)} i ${fmtYears(b.medianYears)}).`
      : pick(
          [
            `Dłużej w rejestrze są biura ${inCity(w === "a" ? a.name : b.name)}: mediana ${fmtYears(w === "a" ? a.medianYears : b.medianYears)} wobec ${fmtYears(w === "a" ? b.medianYears : a.medianYears)}.`,
            `${w === "a" ? a.name : b.name} ma starszy rynek biur: mediana stażu to ${fmtYears(w === "a" ? a.medianYears : b.medianYears)}, ${w === "a" ? b.name : a.name} ${fmtYears(w === "a" ? b.medianYears : a.medianYears)}.`,
          ],
          seed,
          "t1",
        );
  const tail =
    s10 && s10 !== "tie"
      ? ` Firm z co najmniej 10 latami w rejestrze jest ${inCity(s10 === "a" ? a.name : b.name)} ${fmtShare(s10 === "a" ? a.share10y : b.share10y)}, ${inCity(s10 === "a" ? b.name : a.name)} ${fmtShare(s10 === "a" ? b.share10y : a.share10y)}.`
      : "";
  return `${head}${tail} Staż liczymy od daty wpisu do KRS albo rejestracji jako podatnik VAT, więc firmy starsze niż te rejestry mogą działać dłużej.`;
}

/** Akapit porównania usług (odsetek wpisów deklarujących usługę). */
export function servicesComparison(a: CityStats, b: CityStats, ea: CityExtra, eb: CityExtra): string {
  const labels = [...new Set([...ea.services, ...eb.services].map((s) => s.label))];
  const parts: string[] = [];
  for (const label of labels) {
    const x = ea.services.find((s) => s.label === label)?.share ?? 0;
    const y = eb.services.find((s) => s.label === label)?.share ?? 0;
    if (Math.abs(x - y) >= 10) parts.push(`${label}: ${fmtShare(x)} ${inCity(a.name)} wobec ${fmtShare(y)} ${inCity(b.name)}`);
  }
  if (labels.length === 0) return "Biura w tych miastach nie opisują usług na tyle dokładnie, żebyśmy mogli je porównać.";
  if (parts.length === 0) return `Zakres usług deklarowanych przez biura jest w obu miastach podobny: różnice w udziale żadnej usługi nie przekraczają 10 punktów procentowych.`;
  return `Największe różnice w deklarowanych usługach: ${parts.slice(0, 3).join("; ")}. Usługi liczymy ze stron biur, więc biuro, które czegoś nie opisuje, może to mimo wszystko robić.`;
}

/** Akapit o prowizjach i cennikach. */
export function pricesComparison(a: CityStats, b: CityStats): string {
  const both = a.commission != null && b.commission != null;
  const share = cmp(a.sharePrices, b.sharePrices, SAME_SHARE);
  const head = both
    ? cmp(a.commission, b.commission, 0.2) === "tie"
      ? `Prowizje za sprzedaż z cenników są podobne: mediana ${fmtRate(a.commission)} ${inCity(a.name)} i ${fmtRate(b.commission)} ${inCity(b.name)}.`
      : `Niższe stawki za sprzedaż podają biura ${inCity((a.commission as number) < (b.commission as number) ? a.name : b.name)}: mediana ${fmtRate(Math.min(a.commission as number, b.commission as number))} wobec ${fmtRate(Math.max(a.commission as number, b.commission as number))}.`
    : `Mediany prowizji nie porównujemy, bo procentową stawkę za sprzedaż podaje za mało biur (${a.commissionN} ${inCity(a.name)}, ${b.commissionN} ${inCity(b.name)}, a potrzebujemy co najmniej ${PRICE_STAT_MIN} w każdym mieście).`;
  const tail =
    share == null || share === "tie"
      ? ` Cennik na stronie publikuje podobna część biur w obu miastach (${fmtShare(a.sharePrices)} i ${fmtShare(b.sharePrices)}).`
      : ` Cennik częściej publikują biura ${inCity(share === "a" ? a.name : b.name)} (${fmtShare(share === "a" ? a.sharePrices : b.sharePrices)} wobec ${fmtShare(share === "a" ? b.sharePrices : a.sharePrices)}).`;
  return `${head}${tail} Większość biur ustala stawkę indywidualnie, więc zapytaj o nią przed podpisaniem umowy i porównaj co najmniej dwie oferty.`;
}

/** Praktyczne wskazówki "jeśli zależy Ci na..." tylko tam, gdzie dane pokazują wyraźną różnicę. */
export function pairAdvice(a: CityStats, b: CityStats, ea: CityExtra, eb: CityExtra): string[] {
  const out: string[] = [];
  if (a.firms !== b.firms) {
    const big = a.firms > b.firms ? a : b;
    out.push(`Szukasz dużego wyboru: więcej biur mamy w katalogu ${inCity(big.name)} (${big.firms}), więc łatwiej tam porównać kilka ofert.`);
  }
  const s48 = ratedOk(a) && ratedOk(b) ? cmp(a.share48, b.share48, SAME_SHARE) : null;
  if (s48 === "a" || s48 === "b") {
    const c = s48 === "a" ? a : b;
    out.push(`Zależy Ci na biurze z bardzo dobrymi opiniami: wyższy odsetek biur z oceną 4,8+ jest ${inCity(c.name)} (${fmtShare(c.share48)}).`);
  }
  const prices = cmp(a.sharePrices, b.sharePrices, SAME_SHARE);
  if (prices === "a" || prices === "b") {
    const c = prices === "a" ? a : b;
    out.push(`Chcesz znać stawki przed pierwszym telefonem: cennik częściej publikują biura ${inCity(c.name)} (${fmtShare(c.sharePrices)}).`);
  }
  const s10 = yearsOk(a) && yearsOk(b) ? cmp(a.share10y, b.share10y, SAME_SHARE) : null;
  if (s10 === "a" || s10 === "b") {
    const c = s10 === "a" ? a : b;
    out.push(`Wolisz firmę z długim stażem: więcej biur z co najmniej 10 latami w rejestrze jest ${inCity(c.name)} (${fmtShare(c.share10y)}).`);
  }
  const mgmtA = ea.services.find((s) => s.label === "zarządzanie najmem")?.share ?? 0;
  const mgmtB = eb.services.find((s) => s.label === "zarządzanie najmem")?.share ?? 0;
  if (Math.abs(mgmtA - mgmtB) >= 10) {
    const c = mgmtA > mgmtB ? a : b;
    out.push(`Potrzebujesz zarządzania najmem: tę usługę deklaruje więcej biur ${inCity(c.name)} (${fmtShare(Math.max(mgmtA, mgmtB))} wpisów).`);
  }
  out.push("Niezależnie od miasta porównaj dwa lub trzy biura: ich opinie, staż, cennik i warunki umowy.");
  return out;
}

/** Pytania i odpowiedzi do FAQ strony porównania (tekst trafia też do JSON-LD). */
export function pairFaq(a: CityStats, b: CityStats, ea: CityExtra, eb: CityExtra): { q: string; a: string }[] {
  const faq: { q: string; a: string }[] = [
    {
      q: `Gdzie jest więcej biur nieruchomości: ${a.name} czy ${b.name}?`,
      a:
        a.firms === b.firms
          ? `W naszym katalogu oba miasta mają tyle samo biur (${a.firms}).`
          : `W naszym katalogu więcej biur jest ${inCity(a.firms > b.firms ? a.name : b.name)}: ${Math.max(a.firms, b.firms)} wobec ${Math.min(a.firms, b.firms)}. To biura z własną stroną internetową, które zweryfikowaliśmy, a nie wszystkie biura działające w mieście.`,
    },
    {
      q: `Gdzie biura nieruchomości mają lepsze opinie: ${a.name} czy ${b.name}?`,
      a:
        ratedOk(a) && ratedOk(b)
          ? `Średnia ocena Google biur z co najmniej ${nOpiniami(MIN_REVIEWS)} wynosi ${fmtRating(a.avgRating)} ${inCity(a.name)} i ${fmtRating(b.avgRating)} ${inCity(b.name)}. Ocenę 4,8 lub wyższą ma odpowiednio ${fmtShare(a.share48)} i ${fmtShare(b.share48)} biur.`
          : `W jednym z miast jest za mało biur z co najmniej ${nOpiniami(MIN_REVIEWS)}, żeby rzetelnie porównać średnie. Oceny pojedynczych biur znajdziesz w rankingach miast.`,
    },
    {
      q: `Gdzie biura biorą niższą prowizję?`,
      a:
        a.commission != null && b.commission != null
          ? `Mediana najniższych stawek za sprzedaż z cenników biur to ${fmtRate(a.commission)} ${inCity(a.name)} (${nBiur(a.commissionN)}) i ${fmtRate(b.commission)} ${inCity(b.name)} (${nBiur(b.commissionN)}). Ostateczna stawka wynika z umowy i zwykle podlega negocjacji.`
          : `Za mało biur w tych miastach podaje procentową stawkę na stronie, żeby porównać mediany. Zapytaj o stawkę co najmniej dwa biura i porównaj, co zawiera prowizja.`,
    },
  ];
  for (const [c, e] of [
    [a, ea],
    [b, eb],
  ] as const) {
    if (e.top.length > 0) {
      faq.push({
        q: `Jakie są najlepsze biura nieruchomości ${inCity(c.name)}?`,
        a: `W naszym rankingu ${inCity(c.name)} prowadzą teraz: ${joinList(e.top.map((f) => `${f.name} (${f.score}/100${f.rating != null ? `, ocena Google ${fmtRating(f.rating)}` : ""})`))}. Ranking liczymy z danych z rejestrów, stron biur i opinii Google, a płatność nie wpływa na pozycję.`,
      });
    }
  }
  faq.push({
    q: "Skąd pochodzą dane w porównaniu?",
    a: `Z katalogu biur nieruchomości: rejestrów publicznych (KRS, wykaz podatników VAT), stron internetowych biur (cenniki, usługi, oferty) i profili firm w Google. Liczby przeliczamy codziennie. Wskaźnik pokazujemy tylko przy wystarczającej próbie, na przykład średnią ocenę od ${CITY_COMPARE_MIN} ${plural(CITY_COMPARE_MIN, "biura", "biur", "biur")} z ocenami.`,
  });
  return faq;
}
