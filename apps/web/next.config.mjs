/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Wartość PORTAL z chwili budowania, żeby czcionki motywu innego portalu nie trafiały do paczki portalu nieruchomości
  // (app/layout.tsx). Wybór portalu w kodzie dalej czyta process.env.PORTAL w czasie działania.
  env: { PORTAL_THEME_FONTS: process.env.PORTAL ?? "" },
  // Czcionki okładek bloga czytane z dysku w route (assets/fonts) muszą trafić do paczki funkcji na Vercelu.
  outputFileTracingIncludes: { "/blog/okladka/[file]": ["./assets/fonts/**"] },
  // Widoki strony miasta z parametrami (?cel=, ?filtr=, ?strona=) trafiają do trasy dynamicznej /widok/[city], a /<miasto>
  // bez parametrów zostaje ISR. Przepisanie działa po sprawdzeniu tras statycznych (/ranking?strona=2 nie jest ruszane)
  // i przed trasami dynamicznymi; adres w przeglądarce i dla robotów się nie zmienia (docs/geo/profil-premium.md).
  async rewrites() {
    return ["cel", "filtr", "strona"].map((key) => ({
      source: "/:city",
      has: [{ type: "query", key }],
      destination: "/widok/:city",
    }));
  },
  async headers() {
    return [
      {
        // Podgląd szkicu Premium: nigdy w indeksie ani w pamięci podręcznej.
        source: "/podglad/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
