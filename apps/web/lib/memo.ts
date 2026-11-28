// Pamięć podręczna w obrębie jednej instancji serwera (Vercel trzyma instancje między wejściami).
// Dla danych, które zmieniają się najwyżej raz na przebieg workera (lista miast, wszystkie biura):
// bez tego każde wejście, także bota, czytało z bazy te same tysiące wierszy.
// W odróżnieniu od unstable_cache wynik nie przechodzi przez JSON (daty zostają datami)
// i nie ma limitu 2 MB na wpis.

type Entry<T> = { at: number; value: Promise<T> };

export function memoize<T>(fn: () => Promise<T>, ttlMs: number, now: () => number = Date.now): () => Promise<T> {
  let entry: Entry<T> | null = null;
  return () => {
    const t = now();
    if (entry && t - entry.at < ttlMs) return entry.value;
    // Wspólna obietnica: równoczesne wejścia czekają na jedno zapytanie zamiast wysyłać własne.
    const value = fn();
    const current: Entry<T> = { at: t, value };
    entry = current;
    // Błąd bazy nie zostaje w pamięci: następne wejście spróbuje od nowa.
    value.catch(() => {
      if (entry === current) entry = null;
    });
    return value;
  };
}
