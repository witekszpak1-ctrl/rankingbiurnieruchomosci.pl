/**
 * Formy jednostki katalogu bieżącego portalu do składania zdań: odmiana przez przypadki (portal.terms.unit) oraz
 * zaimki i przymiotniki zgodne z rodzajem ("to biuro", "ta firma", "ten warsztat"). Dzięki temu teksty wspólne dla
 * portali nie zawierają słowa "biuro" na stałe, a mimo to czytają się naturalnie w każdej branży.
 */
import { currentPortal, type PortalConfig } from "./portal";

export type UnitHelper = ReturnType<typeof unitForms>;

export function unitForms(portal: PortalConfig = currentPortal()) {
  const u = portal.terms.unit;
  const by = <T>(n: T, f: T, m: T): T => (u.gender === "n" ? n : u.gender === "f" ? f : m);
  const cap = (text: string) => text.charAt(0).toLocaleUpperCase("pl") + text.slice(1);
  const capCases = (c: typeof u.sg) => ({ nom: cap(c.nom), gen: cap(c.gen), dat: cap(c.dat), acc: cap(c.acc), ins: cap(c.ins), loc: cap(c.loc) });
  return {
    gender: u.gender,
    /** Te same formy wielką literą (pojęcie zdefiniowane w regulaminie: "Biuro", "Biura", "Biurem"). */
    Sg: capCases(u.sg),
    Pl: capCases(u.pl),
    sg: u.sg,
    pl: u.pl,
    /** Wybór formy według rodzaju: by("to", "ta", "ten"). */
    by,
    /** "to biuro" (mianownik), "tego biura", "temu biuru", "tym biurem": zaimek wskazujący przed rzeczownikiem. */
    this: {
      nom: by("to", "ta", "ten"),
      gen: by("tego", "tej", "tego"),
      dat: by("temu", "tej", "temu"),
      acc: by("to", "tę", "ten"),
      ins: by("tym", "tą", "tym"),
    },
    /** "wybrane biuro" / "wybraną firmę" / "wybrany warsztat" (biernik) oraz "wybranemu" itd. */
    chosenAcc: by("wybrane", "wybraną", "wybrany"),
    chosenDat: by("wybranemu", "wybranej", "wybranemu"),
    /** "Które biuro" / "Która firma" / "Który warsztat". */
    which: by("Które", "Która", "Który"),
    /** "sprawdzone w rejestrach" (biernik liczby pojedynczej). */
    checkedAcc: by("sprawdzone", "sprawdzoną", "sprawdzony"),
    /** "Żadne biuro" / "Żadna firma" / "Żaden warsztat". */
    none: by("Żadne", "Żadna", "Żaden"),
    /** Etykieta odnośnika dla firm z konfiguracji ("Dla biur") i jej zapis w zdaniu ("dla biur"). */
    forFirms: portal.texts.navForFirms,
    forFirmsLc: portal.texts.navForFirms.charAt(0).toLocaleLowerCase("pl") + portal.texts.navForFirms.slice(1),
    /** Dopełniacz zaimka dzierżawczego: "jego" / "jej" (np. "na jego stronie"). */
    his: by("jego", "jej", "jego"),
    /** "Wielka litera na początku": capitalize bez importu z portal.ts. */
    cap,
  };
}
