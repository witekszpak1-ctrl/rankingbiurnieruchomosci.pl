const PL_MAP: Record<string, string> = { ł: "l", Ł: "L" };

/** Slug do adresów URL: bez polskich znaków, małe litery, myślniki. */
export function slugify(text: string): string {
  const replaced = text.replace(/[łŁ]/g, (c) => PL_MAP[c]);
  return replaced
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Zwraca slug unikalny względem zajętych: dodaje -2, -3... przy kolizji. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = base || "firma";
  if (!used.has(root)) return root;
  for (let n = 2; ; n += 1) {
    const candidate = `${root}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}
