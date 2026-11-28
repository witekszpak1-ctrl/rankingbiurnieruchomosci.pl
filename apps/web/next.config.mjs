/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Wartość PORTAL z chwili budowania, żeby czcionki motywu innego portalu nie trafiały do paczki portalu nieruchomości
  // (app/layout.tsx). Wybór portalu w kodzie dalej czyta process.env.PORTAL w czasie działania.
  env: { PORTAL_THEME_FONTS: process.env.PORTAL ?? "" },
  // Czcionki okładek bloga czytane z dysku w route (assets/fonts) muszą trafić do paczki funkcji na Vercelu.
  outputFileTracingIncludes: { "/blog/okladka/[file]": ["./assets/fonts/**"] },
  async headers() {
    return [
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
